// Download Manager - Handles resumable file downloads with progress reporting
use reqwest::Client;
use std::path::PathBuf;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tauri::{AppHandle, Emitter};
use super::{UpdateProgress, UpdateStage};

/// Download a file with resume support, progress events, and optional speed limiting
pub async fn download_file(
    app: &AppHandle,
    url: &str,
    dest: &PathBuf,
    expected_size: u64,
    file_name: &str,
    files_completed: u32,
    files_total: u32,
    speed_limit_kbps: Option<u32>,
) -> Result<(), String> {
    let client = Client::new();
    
    // Check if partial download exists
    let (mut file, start_pos) = if dest.exists() {
        let metadata = std::fs::metadata(dest).map_err(|e| e.to_string())?;
        let existing_size = metadata.len();
        
        if existing_size >= expected_size {
            // File already complete
            return Ok(());
        }
        
        // Open for append (resume)
        let file = tokio::fs::OpenOptions::new()
            .append(true)
            .open(dest)
            .await
            .map_err(|e| e.to_string())?;
        (file, existing_size)
    } else {
        // Ensure parent directory exists
        if let Some(parent) = dest.parent() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
        }
        let file = File::create(dest).await.map_err(|e| e.to_string())?;
        (file, 0)
    };

    // Make request with Range header for resume
    let mut request = client.get(url);
    if start_pos > 0 {
        request = request.header("Range", format!("bytes={}-", start_pos));
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    
    if !response.status().is_success() && response.status().as_u16() != 206 {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let mut stream = response.bytes_stream();
    let mut downloaded = start_pos;
    
    // For speed limiting: track bytes downloaded in current second
    let mut bytes_this_second: u64 = 0;
    let mut last_reset = std::time::Instant::now();
    let bytes_per_second_limit = speed_limit_kbps.map(|kbps| (kbps as u64) * 1024);

    use futures::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        // Speed limiting logic
        if let Some(limit) = bytes_per_second_limit {
            bytes_this_second += chunk.len() as u64;
            
            // Check if we've exceeded the limit for this second
            if bytes_this_second >= limit {
                let elapsed = last_reset.elapsed();
                if elapsed < std::time::Duration::from_secs(1) {
                    // Sleep for remaining time in the second
                    let sleep_duration = std::time::Duration::from_secs(1) - elapsed;
                    tokio::time::sleep(sleep_duration).await;
                }
                // Reset counter for next second
                bytes_this_second = 0;
                last_reset = std::time::Instant::now();
            }
        }

        // Emit progress event (throttled to avoid too many events)
        if downloaded % (1024 * 100) < chunk.len() as u64 || downloaded >= expected_size {
            let progress = UpdateProgress {
                stage: UpdateStage::Downloading,
                current_file: Some(file_name.to_string()),
                downloaded_bytes: downloaded,
                total_bytes: expected_size,
                files_completed,
                files_total,
                message: format!("Downloading: {}", file_name),
            };
            let _ = app.emit("update_progress", &progress);
        }
    }

    file.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Fetch remote manifest from URL
pub async fn fetch_manifest(url: &str) -> Result<String, String> {
    let client = Client::new();
    let response = client.get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to fetch manifest: HTTP {}", response.status()));
    }

    response.text().await.map_err(|e| e.to_string())
}
