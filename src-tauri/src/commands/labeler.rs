// Background Memory Labeler
// Async batch processing for enriching stored memories with labels
// Labels: emotion, topic, quality_score, toxicity

use reqwest::Client;
use serde::{Deserialize, Serialize};
use lancedb::query::{ExecutableQuery, QueryBase};
use arrow::array::{StringArray, Array};
use futures::StreamExt;

/// Label data structure for enriched memories
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryLabels {
    pub emotion: String,        // happy, sad, angry, neutral, etc.
    pub topic: String,          // general topic of the conversation
    pub quality_score: f32,     // 0.0 to 1.0
    pub toxicity: f32,          // 0.0 to 1.0 (0 = safe, 1 = toxic)
}

impl Default for MemoryLabels {
    fn default() -> Self {
        Self {
            emotion: "neutral".to_string(),
            topic: "general".to_string(),
            quality_score: 0.5,
            toxicity: 0.0,
        }
    }
}

/// Request structure for batch labeling
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchLabelRequest {
    pub mistral_api_key: String,
    pub limit: Option<usize>,
}

/// Response from batch labeling
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchLabelResponse {
    pub labeled_count: usize,
    pub skipped_count: usize,
    pub errors: Vec<String>,
}

/// Call Mistral to analyze and label a piece of text
async fn analyze_text_with_llm(client: &Client, api_key: &str, text: &str) -> Result<MemoryLabels, String> {
    let url = "https://api.mistral.ai/v1/chat/completions";
    
    let prompt = format!(
        r#"Analyze the following conversation text and provide labels in JSON format.
Text: "{}"

Respond ONLY with a JSON object (no explanation):
{{
  "emotion": "<one of: happy, sad, angry, surprised, fearful, disgusted, neutral>",
  "topic": "<brief topic in 2-3 words>",
  "quality_score": <0.0 to 1.0, where 1.0 is high quality/meaningful conversation>,
  "toxicity": <0.0 to 1.0, where 0.0 is completely safe>
}}"#,
        text.chars().take(500).collect::<String>() // Limit text length
    );

    let body = serde_json::json!({
        "model": "mistral-small-latest",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    });

    let res = client.post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Mistral API error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Mistral API returned: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("Failed to parse LLM response")?;

    // Parse the JSON response
    let labels: MemoryLabels = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse labels JSON: {} - Content: {}", e, content))?;

    Ok(labels)
}

/// Batch label unlabeled memories in the database
/// This function is designed to be called periodically or manually
#[tauri::command]
pub async fn batch_label_memories(request: BatchLabelRequest) -> Result<BatchLabelResponse, String> {
    use super::memory::DB;
    
    let db_lock = DB.lock().await;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    
    let client = Client::new();
    let limit = request.limit.unwrap_or(50);
    
    // Open table and get unlabeled entries (is_labeled = false)
    let table = db.open_table("memories").execute().await
        .map_err(|e| format!("Failed to open table: {}", e))?;
    
    // Query only unlabeled memories
    let mut stream = table.query()
        .only_if("is_labeled = false")
        .limit(limit)
        .execute()
        .await
        .map_err(|e| format!("Query failed: {}", e))?;
    
    let mut labeled_count = 0;
    let mut skipped_count = 0;
    let mut errors = Vec::new();
    
    // Collect IDs and texts first, then process
    let mut to_label: Vec<(String, String)> = Vec::new();
    
    while let Some(batch_result) = stream.next().await {
        let batch = match batch_result {
            Ok(b) => b,
            Err(e) => {
                errors.push(format!("Batch error: {}", e));
                continue;
            }
        };
        
        let num_rows = batch.num_rows();
        let id_col = batch.column_by_name("id");
        let text_col = batch.column_by_name("text");
        
        if let (Some(ids), Some(texts)) = (id_col, text_col) {
            let ids = ids.as_any().downcast_ref::<StringArray>()
                .ok_or("Failed to cast id column")?;
            let texts = texts.as_any().downcast_ref::<StringArray>()
                .ok_or("Failed to cast text column")?;
            
            for i in 0..num_rows {
                let id = ids.value(i).to_string();
                let text = texts.value(i).to_string();
                
                if text.len() < 10 {
                    skipped_count += 1;
                    continue;
                }
                
                to_label.push((id, text));
            }
        }
    }
    
    // Drop the stream to release the lock, then process labels
    drop(stream);
    
    // Now process each memory and update in DB
    for (id, text) in to_label {
        match analyze_text_with_llm(&client, &request.mistral_api_key, &text).await {
            Ok(labels) => {
                // Update the record in LanceDB
                let update_result = table.update()
                    .only_if(format!("id = '{}'", id))
                    .column("emotion", format!("'{}'", labels.emotion))
                    .column("topic", format!("'{}'", labels.topic))
                    .column("quality_score", labels.quality_score.to_string())
                    .column("toxicity", labels.toxicity.to_string())
                    .column("is_labeled", "true".to_string())
                    .execute()
                    .await;
                
                match update_result {
                    Ok(_) => {
                        println!(
                            "✓ Labeled [{}]: emotion={}, topic={}, quality={:.2}",
                            id, labels.emotion, labels.topic, labels.quality_score
                        );
                        labeled_count += 1;
                    }
                    Err(e) => {
                        errors.push(format!("Failed to update {}: {}", id, e));
                    }
                }
            }
            Err(e) => {
                errors.push(format!("Failed to label {}: {}", id, e));
            }
        }
        
        // Rate limiting: pause between API calls
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
    
    Ok(BatchLabelResponse {
        labeled_count,
        skipped_count,
        errors,
    })
}

/// Get labeling statistics
#[tauri::command]
pub async fn get_labeling_stats() -> Result<serde_json::Value, String> {
    use super::memory::DB;
    
    let db_lock = DB.lock().await;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    
    let table = db.open_table("memories").execute().await
        .map_err(|e| format!("Failed to open table: {}", e))?;
    
    let count = table.count_rows(None).await.map_err(|e: lancedb::Error| e.to_string())?;
    
    Ok(serde_json::json!({
        "total_memories": count,
        "labeling_enabled": true,
        "last_batch_run": null
    }))
}
