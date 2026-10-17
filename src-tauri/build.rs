// Build script: reads Kyber keys from .env, XOR-obfuscates them,
// splits into parts, and generates a Rust file for compile-time inclusion.

use std::io::Write;
use std::path::Path;

/// Same XOR mask used at runtime for de-obfuscation
const XOR_MASK: [u8; 32] = [
    0x5A, 0x3C, 0x9F, 0x1E, 0x7B, 0x4D, 0x2A, 0x8E,
    0xC1, 0x6F, 0xB3, 0x0D, 0xE5, 0x92, 0x48, 0xF7,
    0x21, 0x84, 0xA6, 0x5B, 0xD9, 0x3E, 0x70, 0xCC,
    0x15, 0x8A, 0xE2, 0x4F, 0x97, 0x63, 0xBD, 0x09,
];

/// XOR-obfuscate a byte slice with the cyclic mask
fn obfuscate(data: &[u8]) -> Vec<u8> {
    data.iter()
        .enumerate()
        .map(|(i, b)| b ^ XOR_MASK[i % XOR_MASK.len()])
        .collect()
}

/// Format a byte slice as a Rust array literal string
fn bytes_to_rust_array(bytes: &[u8]) -> String {
    let mut s = String::new();
    for (i, chunk) in bytes.chunks(16).enumerate() {
        if i > 0 { s.push('\n'); }
        s.push_str("    ");
        for b in chunk {
            s.push_str(&format!("0x{:02X}, ", b));
        }
    }
    s
}

/// Decode base64 (simple implementation for build script — no external deps)
fn decode_base64(input: &str) -> Vec<u8> {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    
    fn val(c: u8) -> u8 {
        TABLE.iter().position(|&x| x == c).unwrap_or(0) as u8
    }
    
    let clean: Vec<u8> = input.bytes().filter(|b| *b != b'\n' && *b != b'\r' && *b != b' ').collect();
    let mut out = Vec::new();
    
    for chunk in clean.chunks(4) {
        if chunk.len() < 2 { break; }
        let a = val(chunk[0]);
        let b = val(chunk[1]);
        let c = if chunk.len() > 2 && chunk[2] != b'=' { val(chunk[2]) } else { 0 };
        let d = if chunk.len() > 3 && chunk[3] != b'=' { val(chunk[3]) } else { 0 };
        
        out.push((a << 2) | (b >> 4));
        if chunk.len() > 2 && chunk[2] != b'=' {
            out.push((b << 4) | (c >> 2));
        }
        if chunk.len() > 3 && chunk[3] != b'=' {
            out.push((c << 6) | d);
        }
    }
    out
}

fn main() {
    tauri_build::build();
    
    // Re-run build script if .env changes
    // .env is at project root (parent of src-tauri/)
    println!("cargo:rerun-if-changed=../.env");
    println!("cargo:rerun-if-env-changed=KYBER_PUBLIC_KEY");
    println!("cargo:rerun-if-env-changed=KYBER_SECRET_KEY");
    
    // Try to load .env from project root (parent of src-tauri/)
    let mut pk_b64 = String::new();
    let mut sk_b64 = String::new();
    
    if let Ok(content) = std::fs::read_to_string("../.env") {
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with('#') || line.is_empty() { continue; }
            if let Some(val) = line.strip_prefix("KYBER_PUBLIC_KEY=") {
                pk_b64 = val.trim().trim_matches('"').to_string();
            } else if let Some(val) = line.strip_prefix("KYBER_SECRET_KEY=") {
                sk_b64 = val.trim().trim_matches('"').to_string();
            }
        }
    }
    
    // Also check environment variables (for CI/CD)
    if pk_b64.is_empty() {
        if let Ok(val) = std::env::var("KYBER_PUBLIC_KEY") {
            pk_b64 = val;
        }
    }
    if sk_b64.is_empty() {
        if let Ok(val) = std::env::var("KYBER_SECRET_KEY") {
            sk_b64 = val;
        }
    }
    
    // Generate the keys file
    let out_dir = std::env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("generated_keys.rs");
    let mut f = std::fs::File::create(&dest_path).unwrap();
    
    if !pk_b64.is_empty() && !sk_b64.is_empty() {
        // Decode from base64
        let pk_raw = decode_base64(&pk_b64);
        let sk_raw = decode_base64(&sk_b64);
        
        // Validate key sizes (Kyber-1024)
        assert_eq!(pk_raw.len(), 1568, "Public key must be 1568 bytes (Kyber-1024), got {}", pk_raw.len());
        assert_eq!(sk_raw.len(), 3168, "Secret key must be 3168 bytes (Kyber-1024), got {}", sk_raw.len());
        
        // Obfuscate the full keys
        let pk_obf = obfuscate(&pk_raw);
        let sk_obf = obfuscate(&sk_raw);
        
        // Split PK into 3 parts
        let pk_parts = [&pk_obf[0..523], &pk_obf[523..1046], &pk_obf[1046..1568]];
        let pk_names = ["PK_PART_A", "PK_PART_B", "PK_PART_C"];
        
        for (i, part) in pk_parts.iter().enumerate() {
            writeln!(f, "const {}: [u8; {}] = [\n{}];", pk_names[i], part.len(), bytes_to_rust_array(part)).unwrap();
            writeln!(f).unwrap();
        }
        
        // Split SK into 4 parts
        let sk_parts = [&sk_obf[0..792], &sk_obf[792..1584], &sk_obf[1584..2376], &sk_obf[2376..3168]];
        
        for (i, part) in sk_parts.iter().enumerate() {
            writeln!(f, "const SK_PART_{}: [u8; {}] = [\n{}];", i + 1, part.len(), bytes_to_rust_array(part)).unwrap();
            writeln!(f).unwrap();
        }
        
        // Mark as real keys
        writeln!(f, "const KEYS_LOADED: bool = true;").unwrap();
        
        println!("cargo:warning=Kyber keys loaded from .env and obfuscated successfully!");
    } else {
        // Generate placeholder zeros (for development builds without keys)
        writeln!(f, "const PK_PART_A: [u8; 523] = [0u8; 523];").unwrap();
        writeln!(f, "const PK_PART_B: [u8; 523] = [0u8; 523];").unwrap();
        writeln!(f, "const PK_PART_C: [u8; 522] = [0u8; 522];").unwrap();
        writeln!(f).unwrap();
        writeln!(f, "const SK_PART_1: [u8; 792] = [0u8; 792];").unwrap();
        writeln!(f, "const SK_PART_2: [u8; 792] = [0u8; 792];").unwrap();
        writeln!(f, "const SK_PART_3: [u8; 792] = [0u8; 792];").unwrap();
        writeln!(f, "const SK_PART_4: [u8; 792] = [0u8; 792];").unwrap();
        writeln!(f).unwrap();
        writeln!(f, "const KEYS_LOADED: bool = false;").unwrap();
        
        println!("cargo:warning=No Kyber keys found in .env — using placeholder zeros (decryption will fail)");
    }
}
