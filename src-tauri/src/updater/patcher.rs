// Patcher - HDiffPatch integration for delta updates
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager};
use super::{UpdateProgress, UpdateStage};

/// Apply a binary patch using hpatchz sidecar
/// This function assumes hpatchz.exe is available in the sidecar directory
pub async fn apply_patch(
    app: &AppHandle,
    old_file: &PathBuf,
    patch_file: &PathBuf,
    new_file: &PathBuf,
    patch_name: &str,
) -> Result<(), String> {
    // Emit patching progress
    let progress = UpdateProgress {
        stage: UpdateStage::Patching,
        current_file: Some(patch_name.to_string()),
        downloaded_bytes: 0,
        total_bytes: 0,
        files_completed: 0,
        files_total: 0,
        message: format!("Applying patch: {}", patch_name),
    };
    let _ = app.emit("update_progress", &progress);

    // Get sidecar path
    let resource_path = app.path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "windows")]
    let hpatchz = resource_path.join("binaries").join("hpatchz.exe");
    
    #[cfg(not(target_os = "windows"))]
    let hpatchz = resource_path.join("binaries").join("hpatchz");

    if !hpatchz.exists() {
        return Err(format!("HDiffPatch binary not found at: {:?}", hpatchz));
    }

    // Run hpatchz: hpatchz old_file patch_file new_file
    let output = Command::new(&hpatchz)
        .arg(old_file)
        .arg(patch_file)
        .arg(new_file)
        .output()
        .map_err(|e| format!("Failed to run hpatchz: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("hpatchz failed: {}", stderr));
    }

    Ok(())
}

/// Decompress a Zstd compressed file
pub async fn decompress_zstd(
    src: &PathBuf,
    dest: &PathBuf,
) -> Result<(), String> {
    use std::io::{Read, Write};
    
    let file = std::fs::File::open(src).map_err(|e| e.to_string())?;
    let mut decoder = zstd::stream::Decoder::new(file).map_err(|e| e.to_string())?;
    
    // Ensure parent directory exists
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let mut output = std::fs::File::create(dest).map_err(|e| e.to_string())?;
    
    let mut buffer = [0u8; 8192];
    loop {
        let bytes_read = decoder.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        output.write_all(&buffer[..bytes_read]).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
