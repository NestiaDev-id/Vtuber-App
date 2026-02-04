use screenshots::Screen;
use base64::{Engine as _, engine::general_purpose};
use image::ImageEncoder;
use std::io::Cursor;

#[tauri::command]
pub fn capture_screenshot() -> Result<String, String> {
    // Get the primary screen
    let screens = Screen::all().map_err(|e| e.to_string())?;
    
    if screens.is_empty() {
        return Err("No screens found".to_string());
    }

    // Capture from the primary screen (first screen)
    let screen = &screens[0];
    let image = screen.capture().map_err(|e| e.to_string())?;
    
    // Convert image to PNG bytes
    let mut png_bytes: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut png_bytes);
    
    let encoder = image::codecs::png::PngEncoder::new(&mut cursor);
    encoder
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| e.to_string())?;
    
    // Encode to base64
    let base64_image = general_purpose::STANDARD.encode(&png_bytes);
    
    Ok(base64_image)
}
