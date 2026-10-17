// Updater Module - Asset Management System
// Handles manifest parsing, downloading, patching, and verification

pub mod manifest;
pub mod downloader;
pub mod patcher;
pub mod verify;
pub mod encryption;
pub mod key_obfuscation;

use serde::{Deserialize, Serialize};

/// Update status for frontend progress display
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    pub stage: UpdateStage,
    pub current_file: Option<String>,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub files_completed: u32,
    pub files_total: u32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UpdateStage {
    Checking,
    Downloading,
    Patching,
    Verifying,
    Ready,
    Error,
}

impl Default for UpdateProgress {
    fn default() -> Self {
        Self {
            stage: UpdateStage::Checking,
            current_file: None,
            downloaded_bytes: 0,
            total_bytes: 0,
            files_completed: 0,
            files_total: 0,
            message: "Initializing...".to_string(),
        }
    }
}
