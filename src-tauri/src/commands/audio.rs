use std::io::Cursor;
use rodio::{Decoder, OutputStream, Sink};
// use serde::{Deserialize, Serialize};

// Import sesuai dokumentasi lib.rs yang kamu kasih
use msedge_tts::{
    tts::{client::connect_async, SpeechConfig},
    voice::get_voices_list, // Pakai versi sync biar stabil saat ambil list
};
use tauri::Emitter;

#[tauri::command]
pub async fn synthesize_audio(app: tauri::AppHandle, text: String, voice: String) -> Result<String, String> {
    // Track usage
    crate::commands::usage_stats::increment_usage(&app, "tts");

    // 1. Ambil list voices
    let voices = get_voices_list().map_err(|e| format!("Gagal ambil voice: {}", e))?;
    
    // 2. Tentukan kata kunci pencarian
    // Jika input "en-US-AriaNeural", kita ambil bagian "Aria" saja untuk pencarian lebih aman
    let search_term = if voice.is_empty() || voice == "default" {
        "Aria".to_string()
    } else {
        // Ambil bagian setelah tanda hubung terakhir jika ada (misal en-US-AriaNeural -> AriaNeural)
        voice.split('-').last().unwrap_or(&voice).to_string()
    };

    // 3. Cari voice secara fleksibel
    let selected_voice = voices.iter()
        .find(|v| {
            v.name.contains(&search_term) || 
            v.short_name.as_ref().map_or(false, |s| s.contains(&search_term))
        })
        .ok_or_else(|| {
            // Jika gagal, tampilkan satu contoh voice yang tersedia di error log untuk debug
            let available = voices.get(0).map(|v| v.name.clone()).unwrap_or("Kosong".to_string());
            format!("Voice '{}' tidak ditemukan. Contoh voice tersedia: {}", search_term, available)
        })?;

    // 4. Buat config
    let mut config = SpeechConfig::from(selected_voice);
    config.audio_format = "audio-24khz-48kbitrate-mono-mp3".to_string();

    // 5. Connect dan Synthesize
    let mut tts = connect_async().await
        .map_err(|e| format!("Gagal koneksi: {}", e))?;

    let audio = tts.synthesize(&text, &config).await
        .map_err(|e| format!("Gagal sintesis: {}", e))?;

    let audio_data = audio.audio_bytes;

    // 6. Playback dengan Event Notification
    let app_handle = app.clone();
    std::thread::spawn(move || {
        // Emit audio-start event
        println!("🎵 [BACKEND] Emitting audio-start event");
        let _ = app_handle.emit("audio-start", ());
        
        if let Ok((_stream, stream_handle)) = OutputStream::try_default() {
            if let Ok(sink) = Sink::try_new(&stream_handle) {
                let cursor = Cursor::new(audio_data);
                if let Ok(source) = Decoder::new(cursor) {
                    sink.append(source);
                    sink.sleep_until_end();
                }
            }
        }
        
        // Emit audio-end event
        println!("🎵 [BACKEND] Emitting audio-end event");
        let _ = app_handle.emit("audio-end", ());
    });

    Ok("success".to_string())
}

#[allow(dead_code)]
#[tauri::command]
pub async fn list_voices() -> Result<serde_json::Value, String> {
    let voices = get_voices_list().map_err(|e| e.to_string())?;
    
    // Convert to a simple list for frontend
    let voices_list: Vec<serde_json::Value> = voices.iter().map(|v| {
        serde_json::json!({
            "name": v.name,
            "audioPath": "",
            "sampleRate": 24000,
            "description": v.friendly_name.clone().unwrap_or_default()
        })
    }).collect();

    Ok(serde_json::json!({
        "voices": voices_list,
        "activeVoice": "en-US-AriaNeural"
    }))
}

#[allow(dead_code)]
#[tauri::command]
pub async fn set_active_voice(voice_name: String) -> Result<(), String> {
    println!("Setting active voice to: {}", voice_name);
    // Simpan ke state jika perlu, untuk sekarang kita return Ok saja
    Ok(())
}
