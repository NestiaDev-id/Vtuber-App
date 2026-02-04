use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
// use std::collections::HashMap;.
use chrono::{Local};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderUsage {
    pub today: u32,
    pub total: u32,
    pub last_reset: String, // Format: YYYY-MM-DD
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageStats {
    pub groq: ProviderUsage,
    pub gemini: ProviderUsage,
    pub mistral: ProviderUsage,
    pub openai: ProviderUsage,
    pub tts: ProviderUsage,
}

impl Default for UsageStats {
    fn default() -> Self {
        let today = Local::now().format("%Y-%m-%d").to_string();
        UsageStats {
            groq: ProviderUsage { last_reset: today.clone(), ..Default::default() },
            gemini: ProviderUsage { last_reset: today.clone(), ..Default::default() },
            mistral: ProviderUsage { last_reset: today.clone(), ..Default::default() },
            openai: ProviderUsage { last_reset: today.clone(), ..Default::default() },
            tts: ProviderUsage { last_reset: today.clone(), ..Default::default() },
        }
    }
}

fn get_stats_path(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("usage_stats.json")
}

fn load_stats(app: &AppHandle) -> UsageStats {
    let path = get_stats_path(app);
    if path.exists() {
        let content = fs::read_to_string(path).unwrap_or_default();
        let mut stats: UsageStats = serde_json::from_str(&content).unwrap_or_default();
        check_daily_reset(&mut stats);
        stats
    } else {
        UsageStats::default()
    }
}

fn save_stats(app: &AppHandle, stats: &UsageStats) {
    let path = get_stats_path(app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(stats).unwrap_or_default();
    let _ = fs::write(path, json);
}

fn check_daily_reset(stats: &mut UsageStats) {
    let today = Local::now().format("%Y-%m-%d").to_string();
    
    // reset if day changed
    reset_if_needed(&mut stats.groq, &today);
    reset_if_needed(&mut stats.gemini, &today);
    reset_if_needed(&mut stats.mistral, &today);
    reset_if_needed(&mut stats.openai, &today);
    reset_if_needed(&mut stats.tts, &today);
}

fn reset_if_needed(provider: &mut ProviderUsage, today: &str) {
    if provider.last_reset != today {
        provider.today = 0;
        provider.last_reset = today.to_string();
    }
}

// Commands used by frontend
#[tauri::command]
pub fn get_usage_stats(app: AppHandle) -> UsageStats {
    load_stats(&app)
}

#[tauri::command]
pub fn reset_usage_stats(app: AppHandle) -> String {
    let stats = UsageStats::default(); // Reset to zeros
    save_stats(&app, &stats);
    "Stats reset".to_string()
}

// Internal helper to increment usage
pub fn increment_usage(app: &AppHandle, provider: &str) {
    let mut stats = load_stats(app);
    match provider {
        "groq" => { stats.groq.today += 1; stats.groq.total += 1; },
        "gemini" => { stats.gemini.today += 1; stats.gemini.total += 1; },
        "mistral" => { stats.mistral.today += 1; stats.mistral.total += 1; },
        "openai" => { stats.openai.today += 1; stats.openai.total += 1; },
        "tts" => { stats.tts.today += 1; stats.tts.total += 1; },
        _ => {}
    }
    save_stats(app, &stats);
}
