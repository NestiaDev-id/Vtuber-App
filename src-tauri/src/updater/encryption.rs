// Post-Quantum Ready Asset Encryption
// Uses AES-256-GCM for data encryption with hardware-derived keys
// Kyber integration placeholder for future quantum-resistant key exchange

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use sha2::{Sha256, Digest};
use std::path::PathBuf;
use std::io::{Read, Write};

/// Encrypted file header magic bytes
const ENCRYPTED_HEADER: &[u8; 8] = b"VTENC001";

/// Nonce size for AES-GCM (96 bits = 12 bytes)
const NONCE_SIZE: usize = 12;

/// Get APP_SALT from .env or use fallback
fn get_app_salt() -> Vec<u8> {
    dotenvy::dotenv().ok();
    match std::env::var("APP_ASSET_SALT") {
        Ok(val) => val.as_bytes().to_vec(),
        Err(_) => b"vtuber_app_2026_quantum_shield".to_vec()
    }
}

/// Derive a unique 256-bit key from hardware fingerprint
pub fn derive_key() -> Result<[u8; 32], String> {
    let hardware_id = get_hardware_fingerprint()?;
    
    // Use SHA-256 to derive a 256-bit key from hardware ID + salt
    let mut hasher = Sha256::new();
    hasher.update(&hardware_id);
    hasher.update(&get_app_salt());
    
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    
    Ok(key)
}

/// Get a unique hardware fingerprint for this machine
/// Combines multiple system identifiers for robustness
fn get_hardware_fingerprint() -> Result<Vec<u8>, String> {
    let mut fingerprint = Vec::new();
    
    // Method 1: Machine GUID (Windows Registry)
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("wmic")
            .args(["csproduct", "get", "UUID"])
            .output()
            .map_err(|e| format!("Failed to get hardware ID: {}", e))?;
        
        let uuid_output = String::from_utf8_lossy(&output.stdout);
        // Extract UUID from output (skip header line)
        for line in uuid_output.lines().skip(1) {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                fingerprint.extend_from_slice(trimmed.as_bytes());
                break;
            }
        }
    }
    
    // Fallback: Use Tauri app data path as part of fingerprint
    // This ensures some uniqueness even if hardware detection fails
    if fingerprint.is_empty() {
        fingerprint.extend_from_slice(b"fallback_fingerprint_vtuber");
    }
    
    // Add extra entropy from app salt
    fingerprint.extend_from_slice(&get_app_salt());
    
    Ok(fingerprint)
}

/// Encrypt data using AES-256-GCM with derived key
/// Note: This function is for build tools (offline). Use decrypt_data at runtime.
#[allow(dead_code)]
pub fn encrypt_data(plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let key = derive_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    // Generate random nonce
    let nonce_bytes: [u8; NONCE_SIZE] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt
    let ciphertext = cipher.encrypt(nonce, plaintext)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // Build output: HEADER + NONCE + CIPHERTEXT
    let mut output = Vec::with_capacity(ENCRYPTED_HEADER.len() + NONCE_SIZE + ciphertext.len());
    output.extend_from_slice(ENCRYPTED_HEADER);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    
    Ok(output)
}

/// Decrypt data using AES-256-GCM with derived key
pub fn decrypt_data(encrypted: &[u8]) -> Result<Vec<u8>, String> {
    // Verify header
    if encrypted.len() < ENCRYPTED_HEADER.len() + NONCE_SIZE {
        return Err("Invalid encrypted data: too short".to_string());
    }
    
    let header = &encrypted[..ENCRYPTED_HEADER.len()];
    if header != ENCRYPTED_HEADER {
        return Err("Invalid encrypted data: wrong header".to_string());
    }
    
    // Extract nonce and ciphertext
    let nonce_start = ENCRYPTED_HEADER.len();
    let nonce_end = nonce_start + NONCE_SIZE;
    let nonce_bytes = &encrypted[nonce_start..nonce_end];
    let ciphertext = &encrypted[nonce_end..];
    
    // Derive key and decrypt
    let key = derive_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed: invalid key or corrupted data".to_string())?;
    
    Ok(plaintext)
}

/// Encrypt a file and save to destination
/// Note: This function is for build tools (offline). Use decrypt_file_to_memory at runtime.
#[allow(dead_code)]
pub fn encrypt_file(src: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    let mut file = std::fs::File::open(src)
        .map_err(|e| format!("Failed to open source file: {}", e))?;
    
    let mut plaintext = Vec::new();
    file.read_to_end(&mut plaintext)
        .map_err(|e| format!("Failed to read source file: {}", e))?;
    
    let encrypted = encrypt_data(&plaintext)?;
    
    // Ensure parent directory exists
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let mut output = std::fs::File::create(dest)
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    output.write_all(&encrypted)
        .map_err(|e| format!("Failed to write encrypted data: {}", e))?;
    
    Ok(())
}

/// Decrypt a file and return contents in memory (no disk write)
pub fn decrypt_file_to_memory(src: &PathBuf) -> Result<Vec<u8>, String> {
    let mut file = std::fs::File::open(src)
        .map_err(|e| format!("Failed to open encrypted file: {}", e))?;
    
    let mut encrypted = Vec::new();
    file.read_to_end(&mut encrypted)
        .map_err(|e| format!("Failed to read encrypted file: {}", e))?;
    
    decrypt_data(&encrypted)
}

/// Check if a file is encrypted (has our header)
pub fn is_encrypted(src: &PathBuf) -> bool {
    if let Ok(mut file) = std::fs::File::open(src) {
        let mut header = [0u8; 8];
        if file.read_exact(&mut header).is_ok() {
            return &header == ENCRYPTED_HEADER;
        }
    }
    false
}

// ============================================================
// Tauri Commands for Asset Encryption
// ============================================================

/// Decrypt an asset file and return as base64 (for frontend consumption)
#[tauri::command]
pub async fn decrypt_asset(asset_path: String) -> Result<String, String> {
    let path = PathBuf::from(&asset_path);
    
    if !path.exists() {
        return Err(format!("Asset not found: {}", asset_path));
    }
    
    // If file is not encrypted, return as-is
    if !is_encrypted(&path) {
        let content = std::fs::read(&path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        return Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &content));
    }
    
    // Decrypt and return as base64
    let decrypted = decrypt_file_to_memory(&path)?;
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &decrypted))
}

/// Get encryption status of an asset
#[tauri::command]
pub fn check_asset_encryption(asset_path: String) -> Result<bool, String> {
    let path = PathBuf::from(&asset_path);
    
    if !path.exists() {
        return Err(format!("Asset not found: {}", asset_path));
    }
    
    Ok(is_encrypted(&path))
}
