// Updater Tauri Commands - Interface between frontend and updater system
use crate::updater::{UpdateProgress, UpdateStage};
use crate::updater::manifest::{Manifest, ManifestDiff};
use crate::updater::downloader;
use crate::updater::verify;
use crate::updater::patcher;
use tauri::{AppHandle, Manager, Emitter};
use std::path::PathBuf;

/// Get the assets directory path
fn get_assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(data_dir.join("assets"))
}

/// Get cached manifest path
fn get_manifest_cache_path(app: &AppHandle) -> Result<PathBuf, String> {
    let assets_dir = get_assets_dir(app)?;
    Ok(assets_dir.join(".manifest.cache.json"))
}

/// Check for asset updates
#[tauri::command]
pub async fn check_asset_updates(
    app: AppHandle,
    manifest_url: String,
) -> Result<ManifestDiff, String> {
    // Emit checking status
    let progress = UpdateProgress {
        stage: UpdateStage::Checking,
        message: "Checking for updates...".to_string(),
        ..Default::default()
    };
    let _ = app.emit("update_progress", &progress);

    // Try to load cached manifest for comparison
    let manifest_cache_path = get_manifest_cache_path(&app)?;
    let _cached_manifest = if manifest_cache_path.exists() {
        Manifest::load_from_file(&manifest_cache_path).ok()
    } else {
        None
    };

    // Fetch remote manifest
    let manifest_json = downloader::fetch_manifest(&manifest_url).await?;
    let remote_manifest = Manifest::from_json(&manifest_json)
        .map_err(|e| format!("Failed to parse manifest: {}", e))?;

    // Get local asset hashes
    let assets_dir = get_assets_dir(&app)?;
    let local_hashes = if assets_dir.exists() {
        verify::scan_directory_hashes(&app, &assets_dir)?
    } else {
        std::collections::HashMap::new()
    };

    // Compare and return diff
    let diff = remote_manifest.diff_with_local(&assets_dir, &local_hashes);

    // Emit result
    let progress = UpdateProgress {
        stage: if diff.needs_update { UpdateStage::Downloading } else { UpdateStage::Ready },
        message: if diff.needs_update {
            format!("{} files need update ({:.2} MB)", 
                diff.files_to_download.len(),
                diff.total_download_size as f64 / 1_000_000.0)
        } else {
            "All assets up to date!".to_string()
        },
        ..Default::default()
    };
    let _ = app.emit("update_progress", &progress);

    Ok(diff)
}

/// Download and apply asset updates
#[tauri::command]
pub async fn apply_asset_updates(
    app: AppHandle,
    manifest_url: String,
    base_url: String,
    diff: ManifestDiff,
) -> Result<(), String> {
    let assets_dir = get_assets_dir(&app)?;
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    // =============================================
    // Phase 1: Apply patches if available
    // =============================================
    if !diff.patches_available.is_empty() {
        let patches_total = diff.patches_available.len() as u32;
        
        for (index, patch) in diff.patches_available.iter().enumerate() {
            // Emit patching progress
            let progress = UpdateProgress {
                stage: UpdateStage::Patching,
                current_file: Some(patch.file.clone()),
                files_completed: index as u32,
                files_total: patches_total,
                message: format!("Applying patch: {}", patch.file),
                ..Default::default()
            };
            let _ = app.emit("update_progress", &progress);

            // Download patch file
            let patch_url = format!("{}/patches/{}", base_url, patch.file);
            let patch_dest = assets_dir.join(".temp").join(&patch.file);
            
            downloader::download_file(
                &app,
                &patch_url,
                &patch_dest,
                patch.size,
                &patch.file,
                index as u32,
                patches_total,
            ).await?;

            // Apply patch using hpatchz
            let old_file = assets_dir.join(&patch.file);
            let new_file = old_file.with_extension("new");
            
            if old_file.exists() {
                patcher::apply_patch(&app, &old_file, &patch_dest, &new_file, &patch.file).await?;
                
                // Replace old with new
                std::fs::rename(&new_file, &old_file).map_err(|e| e.to_string())?;
                
                // Cleanup patch file
                let _ = std::fs::remove_file(&patch_dest);
            }
        }
    }

    // =============================================
    // Phase 2: Download full files
    // =============================================
    let files_total = diff.files_to_download.len() as u32;
    
    for (index, asset) in diff.files_to_download.iter().enumerate() {
        let dest = assets_dir.join(&asset.path);
        
        // If pack is specified, download the pack instead
        let (url, download_dest) = if let Some(pack) = &asset.pack {
            let pack_url = format!("{}/{}", base_url, pack);
            let pack_dest = assets_dir.join(".temp").join(pack);
            (pack_url, pack_dest)
        } else {
            let file_url = format!("{}/{}", base_url, asset.path);
            (file_url, dest.clone())
        };

        // Download file
        downloader::download_file(
            &app,
            &url,
            &download_dest,
            asset.size,
            &asset.path,
            index as u32,
            files_total,
        ).await?;

        // If it was a .zst file, decompress
        let final_dest = if download_dest.extension().map_or(false, |e| e == "zst") {
            let decompressed = download_dest.with_extension("");
            patcher::decompress_zstd(&download_dest, &decompressed).await?;
            std::fs::remove_file(&download_dest).map_err(|e| e.to_string())?;
            decompressed
        } else {
            download_dest.clone()
        };

        // =============================================
        // Phase 3: Verify file hash after download
        // =============================================
        let progress = UpdateProgress {
            stage: UpdateStage::Verifying,
            current_file: Some(asset.path.clone()),
            files_completed: index as u32,
            files_total,
            message: format!("Verifying: {}", asset.path),
            ..Default::default()
        };
        let _ = app.emit("update_progress", &progress);

        let is_valid = verify::verify_file(&final_dest, &asset.hash)?;
        if !is_valid {
            return Err(format!("Hash mismatch for: {}. File may be corrupted.", asset.path));
        }
    }

    // =============================================
    // Phase 4: Cache the manifest locally
    // =============================================
    let manifest_cache_path = get_manifest_cache_path(&app)?;
    
    // Fetch and save manifest for future offline checks
    let manifest_json = downloader::fetch_manifest(&manifest_url).await?;
    let remote_manifest = Manifest::from_json(&manifest_json)
        .map_err(|e| format!("Failed to parse manifest for caching: {}", e))?;
    
    remote_manifest.save_to_file(&manifest_cache_path)
        .map_err(|e| format!("Failed to cache manifest: {}", e))?;

    // Emit ready
    let progress = UpdateProgress {
        stage: UpdateStage::Ready,
        message: "All assets updated successfully!".to_string(),
        files_completed: files_total,
        files_total,
        ..Default::default()
    };
    let _ = app.emit("update_progress", &progress);

    // Cleanup temp directory
    let temp_dir = assets_dir.join(".temp");
    if temp_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    Ok(())
}

/// Verify all local assets against manifest
#[tauri::command]
pub async fn verify_assets(
    app: AppHandle,
    manifest_url: String,
) -> Result<ManifestDiff, String> {
    // Same as check_asset_updates but forces full hash scan
    check_asset_updates(app, manifest_url).await
}
