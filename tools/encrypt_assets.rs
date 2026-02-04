// Developer Tool: Bulk Asset Encryptor
// Run this tool to encrypt all assets before uploading to GitHub
//
// Usage: cargo run --bin encrypt_assets -- --input ./public/vtuber_chara --output ./encrypted_assets

use std::path::PathBuf;
use std::io::{Read, Write};
use sha2::{Sha256, Digest};

/// Encrypted file header
const ENCRYPTED_HEADER: &[u8; 8] = b"VTENC001";
const NONCE_SIZE: usize = 12;

/// Get APP_SALT from .env or use fallback
fn get_app_salt() -> Vec<u8> {
    dotenvy::dotenv().ok();
    match std::env::var("APP_ASSET_SALT") {
        Ok(val) => val.as_bytes().to_vec(),
        Err(_) => {
            println!("⚠️  Warning: APP_ASSET_SALT not found in .env, using default development salt");
            b"vtuber_app_2026_quantum_shield".to_vec()
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    
    if args.len() < 5 {
        println!("VTuber Asset Encryptor");
        println!("======================");
        println!("Usage: {} --input <source_dir> --output <dest_dir>", args[0]);
        println!("");
        println!("Options:");
        println!("  --input   Source directory containing assets to encrypt");
        println!("  --output  Destination directory for encrypted assets");
        println!("");
        println!("Example:");
        println!("  {} --input ./public/vtuber_chara --output ./encrypted_assets", args[0]);
        return;
    }
    
    let mut input_dir: Option<PathBuf> = None;
    let mut output_dir: Option<PathBuf> = None;
    
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--input" => {
                if i + 1 < args.len() {
                    input_dir = Some(PathBuf::from(&args[i + 1]));
                    i += 2;
                }
            }
            "--output" => {
                if i + 1 < args.len() {
                    output_dir = Some(PathBuf::from(&args[i + 1]));
                    i += 2;
                }
            }
            _ => i += 1,
        }
    }
    
    let input = input_dir.expect("--input is required");
    let output = output_dir.expect("--output is required");
    
    println!("🔐 VTuber Asset Encryptor");
    println!("========================");
    println!("Input:  {:?}", input);
    println!("Output: {:?}", output);
    println!("");
    
    // Create output directory
    std::fs::create_dir_all(&output).expect("Failed to create output directory");
    
    // Process all files recursively
    let mut total_files = 0;
    let mut total_bytes: u64 = 0;
    
    process_directory(&input, &input, &output, &mut total_files, &mut total_bytes);
    
    println!("");
    println!("✅ Encryption complete!");
    println!("   Files encrypted: {}", total_files);
    println!("   Total size: {:.2} MB", total_bytes as f64 / 1_000_000.0);
}

fn process_directory(
    base: &PathBuf,
    current: &PathBuf,
    output_base: &PathBuf,
    total_files: &mut u32,
    total_bytes: &mut u64,
) {
    let entries = match std::fs::read_dir(current) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("Failed to read directory {:?}: {}", current, e);
            return;
        }
    };
    
    for entry in entries.flatten() {
        let path = entry.path();
        
        if path.is_dir() {
            process_directory(base, &path, output_base, total_files, total_bytes);
        } else {
            // Get relative path
            let relative = path.strip_prefix(base).unwrap();
            let dest = output_base.join(relative);
            
            // Create parent directories
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            
            // Encrypt file
            match encrypt_file(&path, &dest) {
                Ok(size) => {
                    *total_files += 1;
                    *total_bytes += size;
                    println!("  ✓ {}", relative.display());
                }
                Err(e) => {
                    eprintln!("  ✗ {} - {}", relative.display(), e);
                }
            }
        }
    }
}

fn encrypt_file(src: &PathBuf, dest: &PathBuf) -> Result<u64, String> {
    // Read source file
    let mut file = std::fs::File::open(src)
        .map_err(|e| format!("Failed to open: {}", e))?;
    let mut plaintext = Vec::new();
    file.read_to_end(&mut plaintext)
        .map_err(|e| format!("Failed to read: {}", e))?;
    
    // For developer tool, we use a fixed key derived from salt only
    // This matches what the app will derive when running on the developer's machine
    let key = derive_developer_key();
    
    // Generate random nonce
    let nonce_bytes: [u8; NONCE_SIZE] = rand::random();
    
    // Encrypt using AES-256-GCM
    use aes_gcm::{Aes256Gcm, Nonce, aead::{Aead, KeyInit}};
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Cipher error: {}", e))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
        .map_err(|_| "Encryption failed".to_string())?;
    
    // Build output: HEADER + NONCE + CIPHERTEXT
    let mut output_data = Vec::with_capacity(ENCRYPTED_HEADER.len() + NONCE_SIZE + ciphertext.len());
    output_data.extend_from_slice(ENCRYPTED_HEADER);
    output_data.extend_from_slice(&nonce_bytes);
    output_data.extend_from_slice(&ciphertext);
    
    let size = output_data.len() as u64;
    
    // Write to destination
    let mut output_file = std::fs::File::create(dest)
        .map_err(|e| format!("Failed to create output: {}", e))?;
    output_file.write_all(&output_data)
        .map_err(|e| format!("Failed to write: {}", e))?;
    
    Ok(size)
}

fn derive_developer_key() -> [u8; 32] {
    // For the developer tool, derive key from salt + fixed developer ID
    // In production, the app will derive this from hardware ID + salt
    let mut hasher = Sha256::new();
    hasher.update(b"DEVELOPER_BUILD_KEY");
    hasher.update(&get_app_salt());
    
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}
