use lancedb::connect;
use lancedb::query::{ExecutableQuery, QueryBase};
use arrow::datatypes::{DataType, Field, Schema};
use arrow::array::{RecordBatch, StringArray, Float32Array, FixedSizeListArray, ArrayRef, Int64Array, Array};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::path::PathBuf;
use tauri::Manager;
use reqwest::Client;
use once_cell::sync::Lazy;
use tokio::sync::Mutex;
use futures::StreamExt;

// Global DB connection (lazy initialized)
pub static DB: Lazy<Mutex<Option<lancedb::Connection>>> = Lazy::new(|| Mutex::new(None));

const TABLE_NAME: &str = "memories";
const VECTOR_DIM: usize = 1024; // Mistral embed dimension

// ========================================
// Structs
// ========================================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntry {
    pub id: String,
    pub text: String,
    pub role: String, // "user" or "assistant"
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreMemoryRequest {
    pub text: String,
    pub role: String,
    pub mistral_api_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryMemoryRequest {
    pub query: String,
    pub mistral_api_key: String,
    pub top_k: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryMemoryResponse {
    pub memories: Vec<MemoryEntry>,
}

// ========================================
// Mistral Embedding
// ========================================

async fn get_mistral_embedding(client: &Client, api_key: &str, text: &str) -> Result<Vec<f32>, String> {
    let url = "https://api.mistral.ai/v1/embeddings";
    
    let body = serde_json::json!({
        "model": "mistral-embed",
        "input": [text]
    });

    let res = client.post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Mistral connection error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Mistral Embedding API Error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let embedding = json["data"][0]["embedding"]
        .as_array()
        .ok_or("Failed to parse embedding")?
        .iter()
        .filter_map(|v| v.as_f64().map(|f| f as f32))
        .collect::<Vec<f32>>(); 

    if embedding.len() != VECTOR_DIM {
        return Err(format!("Unexpected embedding dimension: {}", embedding.len()));
    }

    Ok(embedding)
}

// ========================================
// LanceDB Operations
// ========================================

#[tauri::command]
pub async fn init_memory_db(app: tauri::AppHandle, custom_path: Option<String>) -> Result<String, String> {
    let db_path = if let Some(path) = custom_path {
        PathBuf::from(path)
    } else {
        // Fallback to settings or default
        let settings_path = app.path().app_data_dir().unwrap().join("api_settings.json");
        let settings_mem_path = if settings_path.exists() {
            let content = std::fs::read_to_string(&settings_path).unwrap_or_default();
            let settings: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
            settings["memoryPath"].as_str().map(|s| s.to_string())
        } else {
            None
        };

        if let Some(path) = settings_mem_path {
            PathBuf::from(path)
        } else {
            app.path().app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?
                .join("vector_db")
        }
    };
    
    // Ensure directory exists
    std::fs::create_dir_all(&db_path).map_err(|e| e.to_string())?;
    
    let db_path_str = db_path.to_str().ok_or("Invalid path")?;
    
    let db = connect(db_path_str).execute().await
        .map_err(|e| format!("LanceDB connection error: {}", e))?;
    
    // Check if table exists, if not create it
    let tables = db.table_names().execute().await.map_err(|e| e.to_string())?;
    
    if !tables.contains(&TABLE_NAME.to_string()) {
        // Create schema for memories table
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("text", DataType::Utf8, false),
            Field::new("role", DataType::Utf8, false),
            Field::new("timestamp", DataType::Int64, false),
            Field::new("vector", DataType::FixedSizeList(
                Arc::new(Field::new("item", DataType::Float32, true)),
                VECTOR_DIM as i32
            ), false),
            // Label columns (added for memory enrichment)
            Field::new("emotion", DataType::Utf8, true),
            Field::new("topic", DataType::Utf8, true),
            Field::new("quality_score", DataType::Float32, true),
            Field::new("toxicity", DataType::Float32, true),
            Field::new("is_labeled", DataType::Boolean, false),
        ]));
        
        // Create empty table with schema
        db.create_empty_table(TABLE_NAME, schema).execute().await
            .map_err(|e| format!("Failed to create table: {}", e))?;
    }
    
    // Store connection globally
    let mut db_lock = DB.lock().await;
    *db_lock = Some(db);
    
    Ok(db_path_str.to_string())
}

#[tauri::command]
pub async fn store_memory(request: StoreMemoryRequest) -> Result<String, String> {
    let db_lock = DB.lock().await;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    
    let client = Client::new();
    
    // Get embedding from Mistral
    let embedding = get_mistral_embedding(&client, &request.mistral_api_key, &request.text).await?;
    
    // Generate unique ID (UUIDv7 for better DB indexing performance)
    let id = uuid::Uuid::now_v7().to_string();
    let timestamp = chrono::Utc::now().timestamp();
    
    // Create record batch
    let id_array = StringArray::from(vec![id.as_str()]);
    let text_array = StringArray::from(vec![request.text.as_str()]);
    let role_array = StringArray::from(vec![request.role.as_str()]);
    let timestamp_array = Int64Array::from(vec![timestamp]);
    
    // Create vector array (FixedSizeList) using ArrayData
    let values = Float32Array::from(embedding);
    let field = Arc::new(Field::new("item", DataType::Float32, true));
    let vector_array = FixedSizeListArray::new(field, VECTOR_DIM as i32, Arc::new(values), None);
    
    // Create label arrays with default/null values (will be filled by labeler)
    use arrow::array::BooleanArray;
    let emotion_array = StringArray::from(vec![None::<&str>]);
    let topic_array = StringArray::from(vec![None::<&str>]);
    let quality_array = Float32Array::from(vec![None::<f32>]);
    let toxicity_array = Float32Array::from(vec![None::<f32>]);
    let is_labeled_array = BooleanArray::from(vec![false]);
    
    let schema = Arc::new(Schema::new(vec![
        Field::new("id", DataType::Utf8, false),
        Field::new("text", DataType::Utf8, false),
        Field::new("role", DataType::Utf8, false),
        Field::new("timestamp", DataType::Int64, false),
        Field::new("vector", DataType::FixedSizeList(
            Arc::new(Field::new("item", DataType::Float32, true)),
            VECTOR_DIM as i32
        ), false),
        // Label columns (default values, will be filled by labeler)
        Field::new("emotion", DataType::Utf8, true),
        Field::new("topic", DataType::Utf8, true),
        Field::new("quality_score", DataType::Float32, true),
        Field::new("toxicity", DataType::Float32, true),
        Field::new("is_labeled", DataType::Boolean, false),
    ]));
    
    let batch = RecordBatch::try_new(
        schema,
        vec![
            Arc::new(id_array) as ArrayRef,
            Arc::new(text_array) as ArrayRef,
            Arc::new(role_array) as ArrayRef,
            Arc::new(timestamp_array) as ArrayRef,
            Arc::new(vector_array) as ArrayRef,
            Arc::new(emotion_array) as ArrayRef,
            Arc::new(topic_array) as ArrayRef,
            Arc::new(quality_array) as ArrayRef,
            Arc::new(toxicity_array) as ArrayRef,
            Arc::new(is_labeled_array) as ArrayRef,
        ],
    ).map_err(|e| format!("Failed to create record batch: {}", e))?;
    
    // Add to table
    let table = db.open_table(TABLE_NAME).execute().await
        .map_err(|e| format!("Failed to open table: {}", e))?;
    
    // Create a RecordBatchIterator for the add operation
    use arrow::record_batch::RecordBatchIterator;
    let batch_schema = batch.schema();
    let batches = RecordBatchIterator::new(vec![Ok(batch)], batch_schema);
    
    table.add(batches).execute().await
        .map_err(|e| format!("Failed to add memory: {}", e))?;
    
    Ok(id)
}

#[tauri::command]
pub async fn query_memory(request: QueryMemoryRequest) -> Result<QueryMemoryResponse, String> {
    let db_lock = DB.lock().await;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    
    let client = Client::new();
    let top_k = request.top_k.unwrap_or(5);
    
    // Get embedding for query
    let query_embedding = get_mistral_embedding(&client, &request.mistral_api_key, &request.query).await?;
    
    // Open table and search
    let table = db.open_table(TABLE_NAME).execute().await
        .map_err(|e| format!("Failed to open table: {}", e))?;
    
    let results = table.vector_search(query_embedding)
        .map_err(|e| format!("Vector search error: {}", e))?
        .limit(top_k)
        .execute()
        .await
        .map_err(|e| format!("Query execution error: {}", e))?;
    
    // Parse results
    let mut memories = Vec::new();
    
    use futures::TryStreamExt;
    let batches: Vec<RecordBatch> = results.try_collect().await
        .map_err(|e| format!("Failed to collect results: {}", e))?;
    
    for batch in batches {
        let num_rows = batch.num_rows();
        
        // Get columns once per batch
        let id_arr = batch.column_by_name("id");
        let text_arr = batch.column_by_name("text");
        let role_arr = batch.column_by_name("role");
        let ts_arr = batch.column_by_name("timestamp");
        
        if let (Some(ids), Some(texts), Some(roles), Some(timestamps)) = 
            (id_arr, text_arr, role_arr, ts_arr) 
        {
            // Downcast to concrete types
            let ids = ids.as_any().downcast_ref::<StringArray>().ok_or("Failed to cast id column")?;
            let texts = texts.as_any().downcast_ref::<StringArray>().ok_or("Failed to cast text column")?;
            let roles = roles.as_any().downcast_ref::<StringArray>().ok_or("Failed to cast role column")?;
            let timestamps = timestamps.as_any().downcast_ref::<Int64Array>().ok_or("Failed to cast timestamp column")?;
            
            for i in 0..num_rows {
                memories.push(MemoryEntry {
                    id: ids.value(i).to_string(),
                    text: texts.value(i).to_string(),
                    role: roles.value(i).to_string(),
                    timestamp: timestamps.value(i),
                });
            }
        }
    }
    
    Ok(QueryMemoryResponse { memories })
}

#[tauri::command]
pub async fn get_recent_memories(limit_count: Option<usize>) -> Result<QueryMemoryResponse, String> {
    let db_lock = DB.lock().await;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    
    let table = db.open_table(TABLE_NAME).execute().await
        .map_err(|e| format!("Failed to open table: {}", e))?;
    
    let mut streams = table.query().execute().await
        .map_err(|e| format!("Query failed: {}", e))?;
    
    let mut all_memories = Vec::new();
    
    while let Some(batch) = streams.next().await {
        let batch = batch.map_err(|e| e.to_string())?;
        let num_rows = batch.num_rows();
        
        let id_arr = batch.column_by_name("id");
        let text_arr = batch.column_by_name("text");
        let role_arr = batch.column_by_name("role");
        let ts_arr = batch.column_by_name("timestamp");
        
        if let (Some(ids), Some(texts), Some(roles), Some(timestamps)) = 
            (id_arr, text_arr, role_arr, ts_arr) 
        {
            let ids = ids.as_ref().as_any().downcast_ref::<StringArray>().ok_or("Failed to cast id column")?;
            let texts = texts.as_ref().as_any().downcast_ref::<StringArray>().ok_or("Failed to cast text column")?;
            let roles = roles.as_ref().as_any().downcast_ref::<StringArray>().ok_or("Failed to cast role column")?;
            let timestamps = timestamps.as_ref().as_any().downcast_ref::<Int64Array>().ok_or("Failed to cast timestamp column")?;
            
            for i in 0..num_rows {
                all_memories.push(MemoryEntry {
                    id: ids.value(i).to_string(),
                    text: texts.value(i).to_string(),
                    role: roles.value(i).to_string(),
                    timestamp: timestamps.value(i),
                });
            }
        }
    }
    
    // Sort by timestamp descending (newest first)
    all_memories.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    
    // Limit
    let limit = limit_count.unwrap_or(20);
    let memories = all_memories.into_iter().take(limit).collect::<Vec<_>>();
    
    // Reverse to get chronological order (oldest first for chat display)
    let mut chronological = memories;
    chronological.reverse();
    
    Ok(QueryMemoryResponse { memories: chronological })
}

#[tauri::command]
pub async fn clear_all_memories() -> Result<(), String> {
    let db_lock = DB.lock().await;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    
    // Drop the table (ignore if not found)
    let _ = db.drop_table(TABLE_NAME, &[]).await;
    
    let schema = Arc::new(Schema::new(vec![
        Field::new("id", DataType::Utf8, false),
        Field::new("text", DataType::Utf8, false),
        Field::new("role", DataType::Utf8, false),
        Field::new("timestamp", DataType::Int64, false),
        Field::new("vector", DataType::FixedSizeList(
            Arc::new(Field::new("item", DataType::Float32, true)),
            VECTOR_DIM as i32
        ), false),
        // Label columns
        Field::new("emotion", DataType::Utf8, true),
        Field::new("topic", DataType::Utf8, true),
        Field::new("quality_score", DataType::Float32, true),
        Field::new("toxicity", DataType::Float32, true),
        Field::new("is_labeled", DataType::Boolean, false),
    ]));
    
    db.create_empty_table(TABLE_NAME, schema).execute().await
        .map_err(|e| format!("Failed to recreate table: {}", e))?;
    
    Ok(())
}
