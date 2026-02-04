use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiProvider {
    pub id: String,
    pub name: String,
    pub requires_key: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiSettings {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub memory_path: Option<String>,
}

impl Default for ApiSettings {
    fn default() -> Self {
        ApiSettings {
            provider: "groq".to_string(),
            api_key: "".to_string(),
            model: "llama-3.3-70b-versatile".to_string(),
            memory_path: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiSettingsResponse {
    pub provider: String,
    pub api_key: String,
    pub api_key_set: bool,
    pub model: String,
    pub memory_path: Option<String>,
    pub available_providers: Vec<ApiProvider>,
    pub default_models: std::collections::HashMap<String, String>,
    pub error: Option<String>,
}

fn get_settings_path(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("api_settings.json")
}

#[tauri::command]
pub fn get_api_settings(app: AppHandle) -> ApiSettingsResponse {
    let path = get_settings_path(&app);
    let settings = if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        ApiSettings::default()
    };

    let providers = vec![
        ApiProvider { id: "local".into(), name: "Local LLM (Ollama)".into(), requires_key: false },
        ApiProvider { id: "groq".into(), name: "Groq API (Free)".into(), requires_key: true },
        ApiProvider { id: "gemini".into(), name: "Google Gemini (Free)".into(), requires_key: true },
        ApiProvider { id: "mistral".into(), name: "Mistral AI".into(), requires_key: true },
        ApiProvider { id: "openai".into(), name: "OpenAI".into(), requires_key: true },
    ];

    let mut default_models = std::collections::HashMap::new();
    default_models.insert("groq".into(), "llama-3.3-70b-versatile".into());
    default_models.insert("gemini".into(), "gemini-3-flash-preview".into());
    default_models.insert("mistral".into(), "mistral-tiny".into());
    default_models.insert("openai".into(), "gpt-4o".into());

    ApiSettingsResponse {
        provider: settings.provider,
        api_key: settings.api_key.clone(),
        api_key_set: !settings.api_key.is_empty(),
        model: settings.model,
        memory_path: settings.memory_path,
        available_providers: providers,
        default_models,
        error: None,
    }
}

#[tauri::command]
pub fn save_api_settings(app: AppHandle, settings: ApiSettings) -> Result<String, String> {
    let path = get_settings_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    
    Ok("Settings saved".to_string())
}

#[tauri::command]
pub async fn test_api_connection(app: AppHandle, settings: ApiSettings) -> Result<serde_json::Value, String> {
    // ...
    // REALITY CHECK: The user wants to "Test connection".
    // I should create a ChatRequest and call the same logic. 
    
    use crate::commands::llm::{send_chat_message, ChatRequest};
    
    let req = ChatRequest {
        message: "Hello".to_string(),
        session_id: Some("test".to_string()),
        provider: settings.provider,
        api_key: settings.api_key,
        model: settings.model,
    };
    
    match send_chat_message(app, req).await {
        Ok(_) => Ok(serde_json::json!({ "success": true, "message": "Connection successful!" })),
        Err(e) => Ok(serde_json::json!({ "success": false, "message": format!("Connection failed: {}", e) })),
    }
}
