// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod screenshot;

mod commands;
mod updater;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn set_click_through(window: tauri::Window, enable: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(enable)
        .map_err(|e| e.to_string())
}



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Custom URI Protocol for encrypted assets
        // Usage: vt-asset://path/to/file.png
        // Supports both Official (encrypted) and Custom (plain) content
        .register_uri_scheme_protocol("vt-asset", |ctx, request| {
            let uri = request.uri().path();
            let _app = ctx.app_handle();
            
            // Get asset path from URI - resolve relative to executable directory
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_else(|| std::path::PathBuf::from("."));
            
            let content_dir = exe_dir.join("Content");
            let relative_path = uri.trim_start_matches('/');
            
            // Priority lookup: Custom (user mods) -> Official (encrypted)
            // This allows users to override official content with custom mods
            let custom_path = content_dir.join("Custom").join(relative_path);
            let official_path = content_dir.join("Official").join(relative_path);
            
            // Also check for encrypted version in Official folder
            let official_vtenc_path = content_dir.join("Official")
                .join(format!("{}.vtenc", relative_path.trim_end_matches(".model3.json").trim_end_matches(".png").trim_end_matches(".jpg")));
            
            let asset_path = if custom_path.exists() {
                custom_path // User custom content (plain)
            } else if official_path.exists() {
                official_path // Official content (may be encrypted)
            } else if official_vtenc_path.exists() {
                official_vtenc_path // Encrypted official content
            } else {
                // Fallback: direct path under Content/ for backward compatibility
                content_dir.join(relative_path)
            };
            
            // Check if file exists
            if !asset_path.exists() {
                return tauri::http::Response::builder()
                    .status(404)
                    .header("Content-Type", "text/plain")
                    .body(Vec::from(format!("Asset not found: {:?}", asset_path)))
                    .unwrap();
            }
            
            // Check if encrypted and decrypt in memory
            let data = if updater::encryption::is_encrypted(&asset_path) {
                match updater::encryption::decrypt_file_to_memory(&asset_path) {
                    Ok(decrypted) => decrypted,
                    Err(e) => {
                        eprintln!("Decryption failed: {}", e);
                        return tauri::http::Response::builder()
                            .status(500)
                            .header("Content-Type", "text/plain")
                            .body(Vec::from(format!("Decryption error: {}", e)))
                            .unwrap();
                    }
                }
            } else {
                // Not encrypted, read normally
                std::fs::read(&asset_path).unwrap_or_default()
            };
            
            // Guess content type from extension
            // For .vtenc files, strip the encrypted extension to detect the original type
            // e.g., "model.png.vtenc" -> detect from "model.png" -> "image/png"
            let type_path = {
                let path_str = asset_path.to_string_lossy();
                if path_str.ends_with(".vtenc") {
                    std::path::PathBuf::from(path_str.trim_end_matches(".vtenc"))
                } else {
                    asset_path.clone()
                }
            };
            let content_type = match type_path.extension().and_then(|e| e.to_str()) {
                Some("png") => "image/png",
                Some("jpg") | Some("jpeg") => "image/jpeg",
                Some("json") => "application/json",
                Some("moc3") => "application/octet-stream",
                Some("model3") => "application/json",
                Some("exp3") => "application/json",
                Some("motion3") => "application/json",
                Some("physics3") => "application/json",
                Some("cdi3") => "application/json",
                Some("wav") | Some("mp3") => "audio/mpeg",
                _ => "application/octet-stream",
            };
            
            tauri::http::Response::builder()
                .status(200)
                .header("Content-Type", content_type)
                .header("Access-Control-Allow-Origin", "*")
                .body(data)
                .unwrap()
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            screenshot::capture_screenshot,
            commands::send_chat_message,
            commands::get_api_settings,
            commands::save_api_settings,
            commands::test_api_connection,
            commands::synthesize_audio,
            commands::list_voices,
            commands::set_active_voice,
            commands::analyze_emotion,
            commands::get_usage_stats,
            commands::reset_usage_stats,
            commands::init_memory_db,
            commands::store_memory,
            commands::query_memory,
            commands::get_recent_memories,
            commands::clear_all_memories,
            commands::check_asset_updates,
            commands::apply_asset_updates,
            commands::verify_assets,
            updater::encryption::decrypt_asset,
            updater::encryption::check_asset_encryption,
            commands::batch_label_memories,
            commands::get_labeling_stats,
            commands::get_launcher_settings,
            commands::save_launcher_settings,
            set_click_through
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
