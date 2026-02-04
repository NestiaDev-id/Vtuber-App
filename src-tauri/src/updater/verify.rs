// File Verification - SHA256 hash checking for integrity
use sha2::{Sha256, Digest};
use std::collections::HashMap;
use std::path::PathBuf;
use std::io::Read;
use tauri::{AppHandle, Emitter};
use super::{UpdateProgress, UpdateStage};

/// Calculate SHA256 hash of a file
pub fn hash_file(path: &PathBuf) -> Result<String, String> {
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let result = hasher.finalize();
    Ok(format!("sha256:{:x}", result))
}

/// Verify a single file against expected hash
pub fn verify_file(path: &PathBuf, expected_hash: &str) -> Result<bool, String> {
    if !path.exists() {
        return Ok(false);
    }
    let actual_hash = hash_file(path)?;
    Ok(actual_hash == expected_hash)
}

/// Scan a directory and compute hashes for all files
pub fn scan_directory_hashes(
    app: &AppHandle,
    base_dir: &PathBuf,
) -> Result<HashMap<String, String>, String> {
    let mut hashes = HashMap::new();
    
    scan_recursive(base_dir, base_dir, &mut hashes, app)?;
    
    Ok(hashes)
}

fn scan_recursive(
    base_dir: &PathBuf,
    current_dir: &PathBuf,
    hashes: &mut HashMap<String, String>,
    app: &AppHandle,
) -> Result<(), String> {
    if !current_dir.exists() {
        return Ok(());
    }

    let entries = std::fs::read_dir(current_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            scan_recursive(base_dir, &path, hashes, app)?;
        } else {
            // Get relative path from base_dir
            let relative = path.strip_prefix(base_dir)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            
            // Emit progress
            let progress = UpdateProgress {
                stage: UpdateStage::Verifying,
                current_file: Some(relative.clone()),
                downloaded_bytes: 0,
                total_bytes: 0,
                files_completed: hashes.len() as u32,
                files_total: 0,
                message: format!("Verifying: {}", relative),
            };
            let _ = app.emit("update_progress", &progress);
            
            let hash = hash_file(&path)?;
            hashes.insert(relative, hash);
        }
    }

    Ok(())
}
