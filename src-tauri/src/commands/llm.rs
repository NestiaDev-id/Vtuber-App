use serde::{Deserialize, Serialize};
use reqwest::Client;
// use std::env; // We might use env vars later, but strictly speaking we get keys from settings

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub message: std::string::String,
    pub session_id: Option<String>,
    pub provider: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub response: String,
    pub session_id: String,
}

#[tauri::command]
pub async fn send_chat_message(app: tauri::AppHandle, request: ChatRequest) -> Result<ChatResponse, String> {
    let client = Client::new();
    
    // Track usage
    crate::commands::usage_stats::increment_usage(&app, &request.provider);
    
    // Choose provider logic
    let response_text = match request.provider.as_str() {
        "groq" => send_groq(&client, &request).await?,
        "gemini" => send_gemini(&client, &request).await?,
        "mistral" => send_mistral(&client, &request).await?,
        "openai" => send_openai(&client, &request).await?,
        "local" => send_local(&client, &request).await?,
        _ => return Err(format!("Unknown provider: {}", request.provider)),
    };

    Ok(ChatResponse {
        response: response_text,
        session_id: request.session_id.unwrap_or_else(|| "default".to_string()),
    })
}

async fn send_local(client: &Client, request: &ChatRequest) -> Result<String, String> {
    let url = "http://localhost:11434/api/generate";
    
    // Use fallback model for local if not specified
    let model = if request.model.is_empty() { "llama3" } else { &request.model };

    let body = serde_json::json!({
        "model": model,
        "prompt": request.message,
        "stream": false
    });

    let res = client.post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama (Local): {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Ollama API Error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    json["response"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to parse Ollama response".to_string())
}

async fn send_groq(client: &Client, request: &ChatRequest) -> Result<String, String> {
    let url = "https://api.groq.com/openai/v1/chat/completions";
    
    let body = serde_json::json!({
        "model": request.model,
        "messages": [{"role": "user", "content": request.message}]
    });

    let res = client.post(url)
        .header("Authorization", format!("Bearer {}", request.api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Groq API Error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to parse Groq response".to_string())
}

async fn send_gemini(client: &Client, request: &ChatRequest) -> Result<String, String> {
    // Gemini API format is different
    // url: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", 
        request.model, 
        request.api_key
    );

    let body = serde_json::json!({
        "contents": [{
            "parts": [{"text": request.message}]
        }]
    });

    let res = client.post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        // Handle Gemini errors more gracefully
        // If 429 or other, maybe fallback? For now just error.
        return Err(format!("Gemini API Error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    // Safety: Traverse carefully
    json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to parse Gemini response".to_string())
}

async fn send_mistral(client: &Client, request: &ChatRequest) -> Result<String, String> {
    // Mistral API Endpoint
    let url = "https://api.mistral.ai/v1/chat/completions";
    
    let body = serde_json::json!({
        "model": request.model,
        "messages": [{"role": "user", "content": request.message}]
    });

    let res = client.post(url)
        .header("Authorization", format!("Bearer {}", request.api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Mistral API Error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to parse Mistral response".to_string())
}

async fn send_openai(client: &Client, request: &ChatRequest) -> Result<String, String> {
    let url = "https://api.openai.com/v1/chat/completions";
    
    let body = serde_json::json!({
        "model": request.model,
        "messages": [{"role": "user", "content": request.message}]
    });

    let res = client.post(url)
        .header("Authorization", format!("Bearer {}", request.api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("OpenAI API Error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to parse OpenAI response".to_string())
}

// ==============================
// EMOTION ANALYSIS (Gemini Pro)
// ==============================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmotionRequest {
    pub text: String,
    pub api_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmotionResponse {
    pub emotion: String,
    pub confidence: f32,
}

#[tauri::command]
pub async fn analyze_emotion(app: tauri::AppHandle, request: EmotionRequest) -> Result<EmotionResponse, String> {
    let client = Client::new();
    
    // Track usage for emotion (always gemini for now)
    crate::commands::usage_stats::increment_usage(&app, "gemini");
    
    // Use Gemini Flash for faster response (User verified Pro version)
    let model = "gemini-3-flash-preview";
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model,
        request.api_key
    );

    // System prompt for structured emotion output
    let prompt = format!(
        r#"Analyze the emotional tone of the following text and respond ONLY with a JSON object.
Do not include any other text, markdown, or explanation.

Text: "{}"

Response format (JSON only):
{{"emotion": "neutral" | "happy" | "sad" | "angry" | "surprised" | "embarrassed", "confidence": 0.0-1.0}}

Example valid responses:
{{"emotion": "happy", "confidence": 0.9}}
{{"emotion": "sad", "confidence": 0.7}}"#,
        request.text
    );

    let body = serde_json::json!({
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 256,
            "responseMimeType": "application/json"
        }
    });

    let res = client.post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini connection error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Gemini Emotion API Error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    // Extract text response
    let text_response = json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| "Failed to parse Gemini emotion response".to_string())?;

    // Parse JSON from response (may have markdown code blocks)
    let clean_json = text_response
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let emotion_data: serde_json::Value = serde_json::from_str(clean_json)
        .map_err(|e| format!("Failed to parse emotion JSON: {} - Raw: {}", e, clean_json))?;

    Ok(EmotionResponse {
        emotion: emotion_data["emotion"]
            .as_str()
            .unwrap_or("neutral")
            .to_string(),
        confidence: emotion_data["confidence"]
            .as_f64()
            .unwrap_or(0.5) as f32,
    })
}
