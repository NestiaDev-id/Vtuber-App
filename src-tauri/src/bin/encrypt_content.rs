// VTuber App Content Encryption CLI Tool
// Usage: cargo run --bin encrypt_content -- [OPTIONS]
//
// This tool:
// 1. Generates Kyber-1024 keypair (if not exists)
// 2. Encrypts all files in Content/Official with Kyber-AES-GCM
// 3. Outputs obfuscated key parts for embedding in source code

use std::path::{Path, PathBuf};
use std::fs;
use std::io::{Read, Write};
use pqc_kyber::*;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use sha2::{Sha256, Digest};

/// Encrypted file header
const ENCRYPTED_HEADER: &[u8; 8] = b"VTENC002";
const NONCE_SIZE: usize = 12;

/// XOR mask for key obfuscation (same as in key_obfuscation.rs)
const XOR_MASK: [u8; 32] = [
    0x5A, 0x3C, 0x9F, 0x1E, 0x7B, 0x4D, 0x2A, 0x8E,
    0xC1, 0x6F, 0xB3, 0x0D, 0xE5, 0x92, 0x48, 0xF7,
    0x21, 0x84, 0xA6, 0x5B, 0xD9, 0x3E, 0x70, 0xCC,
    0x15, 0x8A, 0xE2, 0x4F, 0x97, 0x63, 0xBD, 0x09,
];

/// APP Salt for key derivation
fn get_app_salt() -> Vec<u8> {
    b"vtuber_app_2026_quantum_shield".to_vec()
}

/// Custom RNG for Kyber (bridges rand_core version gap)
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

fn main() {
    println!("═══════════════════════════════════════════════════════════");
    println!("  VTuber App Content Encryption Tool (Kyber-AES-GCM)");
    println!("═══════════════════════════════════════════════════════════\n");

    let args: Vec<String> = std::env::args().collect();
    
    // Parse arguments
    let mut input_dir = PathBuf::from("Content/Official");
    let mut output_dir = PathBuf::from("Content/Official_Encrypted");
    let mut generate_keys = false;
    let mut key_file = PathBuf::from("keys/kyber_keypair.bin");
    
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--input" | "-i" => {
                i += 1;
                if i < args.len() {
                    input_dir = PathBuf::from(&args[i]);
                }
            }
            "--output" | "-o" => {
                i += 1;
                if i < args.len() {
                    output_dir = PathBuf::from(&args[i]);
                }
            }
            "--generate-keys" | "-g" => {
                generate_keys = true;
            }
            "--key-file" | "-k" => {
                i += 1;
                if i < args.len() {
                    key_file = PathBuf::from(&args[i]);
                }
            }
            "--help" | "-h" => {
                print_help();
                return;
            }
            _ => {
                eprintln!("Unknown argument: {}", args[i]);
                print_help();
                return;
            }
        }
        i += 1;
    }
    
    // Generate keys if requested
    if generate_keys {
        println!("[1/3] Generating Kyber-1024 keypair...");
        let mut rng = KyberRng;
        let keys = keypair(&mut rng).expect("Failed to generate keypair");
        
        // Save keypair to file
        if let Some(parent) = key_file.parent() {
            fs::create_dir_all(parent).expect("Failed to create keys directory");
        }
        
        let mut file = fs::File::create(&key_file).expect("Failed to create key file");
        file.write_all(&keys.public).expect("Failed to write public key");
        file.write_all(&keys.secret).expect("Failed to write secret key");
        
        println!("  ✓ Keypair saved to: {:?}", key_file);
        
        // Output obfuscated key parts for embedding
        println!("\n[2/3] Generating obfuscated key parts for source code...");
        output_obfuscated_keys(&keys.public, &keys.secret);
        
        println!("\n  ⚠️  IMPORTANT: Copy the above arrays to key_obfuscation.rs");
        println!("  ⚠️  Keep the keypair file SECURE and DO NOT commit to git!\n");
    }
    
    // Load keypair
    if !key_file.exists() {
        eprintln!("Error: Key file not found: {:?}", key_file);
        eprintln!("Run with --generate-keys first to create a keypair.");
        return;
    }
    
    println!("[*] Loading keypair from {:?}...", key_file);
    let mut key_data = Vec::new();
    fs::File::open(&key_file)
        .expect("Failed to open key file")
        .read_to_end(&mut key_data)
        .expect("Failed to read key file");
    
    let public_key: [u8; KYBER_PUBLICKEYBYTES] = key_data[..KYBER_PUBLICKEYBYTES]
        .try_into()
        .expect("Invalid public key length");
    
    // Encrypt content
    println!("[*] Encrypting content from {:?}...", input_dir);
    
    if !input_dir.exists() {
        eprintln!("Error: Input directory not found: {:?}", input_dir);
        return;
    }
    
    fs::create_dir_all(&output_dir).expect("Failed to create output directory");
    
    let mut encrypted_count = 0;
    let mut total_size: u64 = 0;
    
    encrypt_directory(&input_dir, &output_dir, &public_key, &mut encrypted_count, &mut total_size);
    
    println!("\n═══════════════════════════════════════════════════════════");
    println!("  Encryption Complete!");
    println!("  Files encrypted: {}", encrypted_count);
    println!("  Total size: {:.2} MB", total_size as f64 / 1024.0 / 1024.0);
    println!("═══════════════════════════════════════════════════════════");
}

fn encrypt_directory(
    input_dir: &Path,
    output_dir: &Path,
    public_key: &[u8; KYBER_PUBLICKEYBYTES],
    count: &mut u32,
    total_size: &mut u64,
) {
    for entry in fs::read_dir(input_dir).expect("Failed to read directory") {
        let entry = entry.expect("Failed to read entry");
        let path = entry.path();
        
        if path.is_dir() {
            let subdir_name = path.file_name().unwrap();
            let output_subdir = output_dir.join(subdir_name);
            fs::create_dir_all(&output_subdir).expect("Failed to create subdirectory");
            encrypt_directory(&path, &output_subdir, public_key, count, total_size);
        } else {
            // Skip already encrypted files
            if path.extension().map(|e| e == "vtenc").unwrap_or(false) {
                continue;
            }
            
            let file_name = path.file_name().unwrap().to_string_lossy();
            let output_path = output_dir.join(format!("{}.vtenc", file_name));
            
            match encrypt_file(&path, &output_path, public_key) {
                Ok(size) => {
                    println!("  ✓ {}", file_name);
                    *count += 1;
                    *total_size += size;
                }
                Err(e) => {
                    eprintln!("  ✗ {} - Error: {}", file_name, e);
                }
            }
        }
    }
}

fn encrypt_file(
    input_path: &Path,
    output_path: &Path,
    public_key: &[u8; KYBER_PUBLICKEYBYTES],
) -> Result<u64, String> {
    // Read plaintext
    let mut plaintext = Vec::new();
    fs::File::open(input_path)
        .map_err(|e| e.to_string())?
        .read_to_end(&mut plaintext)
        .map_err(|e| e.to_string())?;
    
    // Kyber encapsulation
    let mut rng = KyberRng;
    let (kyber_ciphertext, shared_secret) = encapsulate(public_key, &mut rng)
        .map_err(|_| "Kyber encapsulation failed")?;
    
    // Derive AES key
    let mut hasher = Sha256::new();
    hasher.update(&shared_secret);
    hasher.update(&get_app_salt());
    let aes_key: [u8; 32] = hasher.finalize().into();
    
    // AES-GCM encryption
    let cipher = Aes256Gcm::new_from_slice(&aes_key)
        .map_err(|e| format!("Cipher error: {}", e))?;
    
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    getrandom::getrandom(&mut nonce_bytes).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let aes_ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
        .map_err(|e| format!("Encryption error: {}", e))?;
    
    // Build output
    let mut output = Vec::new();
    output.extend_from_slice(ENCRYPTED_HEADER);
    output.extend_from_slice(&kyber_ciphertext);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&aes_ciphertext);
    
    let output_size = output.len() as u64;
    
    // Write encrypted file
    fs::File::create(output_path)
        .map_err(|e| e.to_string())?
        .write_all(&output)
        .map_err(|e| e.to_string())?;
    
    Ok(output_size)
}

fn output_obfuscated_keys(public_key: &[u8], secret_key: &[u8]) {
    println!("\n// === PUBLIC KEY PARTS (1568 bytes total) ===");
    
    // Split public key into 3 parts
    let pk_parts = [
        &public_key[0..523],
        &public_key[523..1046],
        &public_key[1046..1568],
    ];
    
    for (i, part) in pk_parts.iter().enumerate() {
        let obfuscated: Vec<u8> = part.iter()
            .enumerate()
            .map(|(j, b)| b ^ XOR_MASK[j % XOR_MASK.len()])
            .collect();
        
        println!("\nconst PK_PART_{}: [u8; {}] = [", ['A', 'B', 'C'][i], obfuscated.len());
        print_bytes_as_array(&obfuscated);
        println!("];");
    }
    
    println!("\n// === SECRET KEY PARTS (3168 bytes total) ===");
    
    // Split secret key into 4 parts
    let sk_parts = [
        &secret_key[0..792],
        &secret_key[792..1584],
        &secret_key[1584..2376],
        &secret_key[2376..3168],
    ];
    
    for (i, part) in sk_parts.iter().enumerate() {
        let obfuscated: Vec<u8> = part.iter()
            .enumerate()
            .map(|(j, b)| b ^ XOR_MASK[j % XOR_MASK.len()])
            .collect();
        
        println!("\nconst SK_PART_{}: [u8; {}] = [", i + 1, obfuscated.len());
        print_bytes_as_array(&obfuscated);
        println!("];");
    }
}

fn print_bytes_as_array(bytes: &[u8]) {
    for (i, chunk) in bytes.chunks(16).enumerate() {
        print!("    ");
        for b in chunk {
            print!("0x{:02X}, ", b);
        }
        if i < bytes.len() / 16 {
            println!();
        }
    }
}

fn print_help() {
    println!("VTuber App Content Encryption Tool");
    println!();
    println!("USAGE:");
    println!("    encrypt_content [OPTIONS]");
    println!();
    println!("OPTIONS:");
    println!("    -g, --generate-keys    Generate new Kyber-1024 keypair");
    println!("    -k, --key-file PATH    Path to keypair file (default: keys/kyber_keypair.bin)");
    println!("    -i, --input PATH       Input directory (default: Content/Official)");
    println!("    -o, --output PATH      Output directory (default: Content/Official_Encrypted)");
    println!("    -h, --help             Show this help message");
    println!();
    println!("EXAMPLES:");
    println!("    # First time: Generate keypair and encrypt");
    println!("    encrypt_content --generate-keys");
    println!();
    println!("    # Subsequent runs: Use existing keypair");
    println!("    encrypt_content --input ./assets --output ./encrypted_assets");
}
