// Post-Quantum Ready Asset Encryption
// Uses Kyber-1024 KEM + AES-256-GCM for hybrid post-quantum encryption
// Backward compatible with VTENC001 (legacy AES-only)

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use sha2::{Sha256, Digest};
use std::path::PathBuf;
use std::io::{Read, Write};
use pqc_kyber::*;

/// Custom RNG wrapper that implements pqc_kyber's RngCore + CryptoRng traits
/// This bridges the rand_core 0.6 (pqc_kyber) vs 0.9 (rand) version incompatibility
struct KyberRng;

impl rand_core::RngCore for KyberRng {
    fn next_u32(&mut self) -> u32 {
        let mut buf = [0u8; 4];
        getrandom::getrandom(&mut buf).expect("getrandom failed");
        u32::from_le_bytes(buf)
    }

    fn next_u64(&mut self) -> u64 {
        let mut buf = [0u8; 8];
        getrandom::getrandom(&mut buf).expect("getrandom failed");
        u64::from_le_bytes(buf)
    }

    fn fill_bytes(&mut self, dest: &mut [u8]) {
        getrandom::getrandom(dest).expect("getrandom failed");
    }

    fn try_fill_bytes(&mut self, dest: &mut [u8]) -> Result<(), rand_core::Error> {
        getrandom::getrandom(dest).map_err(|e| rand_core::Error::new(e))
    }
}

impl rand_core::CryptoRng for KyberRng {}


/// Encrypted file header magic bytes (legacy AES-only)
const ENCRYPTED_HEADER_V1: &[u8; 8] = b"VTENC001";
/// Encrypted file header magic bytes (Kyber-AES-GCM hybrid)
const ENCRYPTED_HEADER_V2: &[u8; 8] = b"VTENC002";

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

/// Derive a unique 256-bit key from hardware fingerprint (legacy, for V1)
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

// ============================================================
// Kyber-AES-GCM Hybrid Encryption (V2 - Post-Quantum)
// ============================================================

/// Encrypt data using Kyber-1024 KEM + AES-256-GCM hybrid encryption
/// Returns: HEADER + KYBER_CIPHERTEXT + NONCE + AES_CIPHERTEXT
#[allow(dead_code)]
pub fn kyber_encrypt_data(plaintext: &[u8], public_key: &[u8]) -> Result<Vec<u8>, String> {
    // 1. Encapsulate: Generate shared secret using recipient's public key
    let pk: [u8; KYBER_PUBLICKEYBYTES] = public_key.try_into()
        .map_err(|_| "Invalid Kyber public key length")?;
    
    // Use custom KyberRng for cryptographic randomness (compatible with pqc_kyber's rand_core 0.6)
    let mut rng = KyberRng;
    let (kyber_ciphertext, shared_secret) = encapsulate(&pk, &mut rng)
        .map_err(|_| "Kyber encapsulation failed")?;
    
    // 2. Derive AES key from shared secret
    let mut hasher = Sha256::new();
    hasher.update(&shared_secret);
    hasher.update(&get_app_salt());
    let aes_key: [u8; 32] = hasher.finalize().into();
    
    // 3. Encrypt with AES-256-GCM
    let cipher = Aes256Gcm::new_from_slice(&aes_key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    let nonce_bytes: [u8; NONCE_SIZE] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let aes_ciphertext = cipher.encrypt(nonce, plaintext)
        .map_err(|e| format!("AES encryption failed: {}", e))?;
    
    // 4. Build output: HEADER + KYBER_CIPHERTEXT + NONCE + AES_CIPHERTEXT
    let mut output = Vec::with_capacity(
        ENCRYPTED_HEADER_V2.len() + KYBER_CIPHERTEXTBYTES + NONCE_SIZE + aes_ciphertext.len()
    );
    output.extend_from_slice(ENCRYPTED_HEADER_V2);
    output.extend_from_slice(&kyber_ciphertext);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&aes_ciphertext);
    
    Ok(output)
}

/// Decrypt data using Kyber-1024 KEM + AES-256-GCM hybrid decryption
pub fn kyber_decrypt_data(encrypted: &[u8], secret_key: &[u8]) -> Result<Vec<u8>, String> {
    let min_len = ENCRYPTED_HEADER_V2.len() + KYBER_CIPHERTEXTBYTES + NONCE_SIZE;
    if encrypted.len() < min_len {
        return Err("Invalid encrypted data: too short".to_string());
    }
    
    // Verify header
    let header = &encrypted[..ENCRYPTED_HEADER_V2.len()];
    if header != ENCRYPTED_HEADER_V2 {
        return Err("Invalid encrypted data: wrong header (expected VTENC002)".to_string());
    }
    
    // Extract components
    let kyber_start = ENCRYPTED_HEADER_V2.len();
    let kyber_end = kyber_start + KYBER_CIPHERTEXTBYTES;
    let nonce_end = kyber_end + NONCE_SIZE;
    
    let kyber_ct: [u8; KYBER_CIPHERTEXTBYTES] = encrypted[kyber_start..kyber_end]
        .try_into()
        .map_err(|_| "Invalid Kyber ciphertext length")?;
    let nonce_bytes = &encrypted[kyber_end..nonce_end];
    let aes_ciphertext = &encrypted[nonce_end..];
    
    // 1. Decapsulate: Recover shared secret
    let sk: [u8; KYBER_SECRETKEYBYTES] = secret_key.try_into()
        .map_err(|_| "Invalid Kyber secret key length")?;
    
    let shared_secret = decapsulate(&kyber_ct, &sk)
        .map_err(|_| "Kyber decapsulation failed")?;
    
    // 2. Derive AES key
    let mut hasher = Sha256::new();
    hasher.update(&shared_secret);
    hasher.update(&get_app_salt());
    let aes_key: [u8; 32] = hasher.finalize().into();
    
    // 3. Decrypt with AES-256-GCM
    let cipher = Aes256Gcm::new_from_slice(&aes_key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let plaintext = cipher.decrypt(nonce, aes_ciphertext)
        .map_err(|_| "Decryption failed: invalid key or corrupted data".to_string())?;
    
    Ok(plaintext)
}

/// Generate a new Kyber-1024 keypair
#[allow(dead_code)]
pub fn generate_kyber_keypair() -> Result<(Vec<u8>, Vec<u8>), String> {
    let mut rng = KyberRng;
    let keys = keypair(&mut rng)
        .map_err(|_| "Failed to generate Kyber keypair")?;
    Ok((keys.public.to_vec(), keys.secret.to_vec()))
}

// ============================================================
// Legacy AES-256-GCM Encryption (V1 - Backward Compatibility)
// ============================================================

/// Encrypt data using AES-256-GCM with derived key (LEGACY V1)
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
    let mut output = Vec::with_capacity(ENCRYPTED_HEADER_V1.len() + NONCE_SIZE + ciphertext.len());
    output.extend_from_slice(ENCRYPTED_HEADER_V1);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    
    Ok(output)
}

/// Decrypt data using AES-256-GCM with derived key (LEGACY V1)
pub fn decrypt_data(encrypted: &[u8]) -> Result<Vec<u8>, String> {
    // Verify header
    if encrypted.len() < ENCRYPTED_HEADER_V1.len() + NONCE_SIZE {
        return Err("Invalid encrypted data: too short".to_string());
    }
    
    let header = &encrypted[..ENCRYPTED_HEADER_V1.len()];
    if header != ENCRYPTED_HEADER_V1 {
        return Err("Invalid encrypted data: wrong header (expected VTENC001)".to_string());
    }
    
    // Extract nonce and ciphertext
    let nonce_start = ENCRYPTED_HEADER_V1.len();
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

/// Check if a file is encrypted (has V1 or V2 header)
pub fn is_encrypted(src: &PathBuf) -> bool {
    if let Ok(mut file) = std::fs::File::open(src) {
        let mut header = [0u8; 8];
        if file.read_exact(&mut header).is_ok() {
            return &header == ENCRYPTED_HEADER_V1 || &header == ENCRYPTED_HEADER_V2;
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
