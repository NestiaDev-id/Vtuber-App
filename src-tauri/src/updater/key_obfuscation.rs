// Key Obfuscation Module for Kyber-AES-GCM Encryption
// Keys are injected at BUILD TIME from .env via build.rs
// Source code on GitHub contains NO real keys — only zeros in dev builds.
//
// How it works:
// 1. Developer puts base64-encoded keys in src-tauri/.env
// 2. build.rs reads .env, XOR-obfuscates, splits, and generates generated_keys.rs
// 3. This module includes the generated file at compile time
// 4. At runtime, keys are reconstructed in RAM only

/// XOR mask for decoding the split key parts (must match build.rs)
const XOR_MASK: [u8; 32] = [
    0x5A, 0x3C, 0x9F, 0x1E, 0x7B, 0x4D, 0x2A, 0x8E,
    0xC1, 0x6F, 0xB3, 0x0D, 0xE5, 0x92, 0x48, 0xF7,
    0x21, 0x84, 0xA6, 0x5B, 0xD9, 0x3E, 0x70, 0xCC,
    0x15, 0x8A, 0xE2, 0x4F, 0x97, 0x63, 0xBD, 0x09,
];

// ============================================================
// Build-time generated key parts (from .env via build.rs)
// These constants are generated during `cargo build`
// If no keys are in .env, they default to all zeros
// ============================================================
include!(concat!(env!("OUT_DIR"), "/generated_keys.rs"));

/// Reconstruct the Kyber Public Key from obfuscated parts
/// This happens at runtime, key only exists in RAM
#[allow(dead_code)]
pub fn get_kyber_public_key() -> [u8; 1568] {
    let mut pk = Vec::with_capacity(1568);
    
    pk.extend_from_slice(&PK_PART_A);
    pk.extend_from_slice(&PK_PART_B);
    pk.extend_from_slice(&PK_PART_C);
    
    // De-obfuscate with XOR mask (cyclic)
    for (i, byte) in pk.iter_mut().enumerate() {
        *byte ^= XOR_MASK[i % XOR_MASK.len()];
    }
    
    pk.try_into().expect("Key reconstruction failed")
}

/// Reconstruct the Kyber Secret Key from obfuscated parts
/// This happens at runtime, key only exists in RAM
pub fn get_kyber_secret_key() -> [u8; 3168] {
    let mut sk = Vec::with_capacity(3168);
    
    sk.extend_from_slice(&SK_PART_1);
    sk.extend_from_slice(&SK_PART_2);
    sk.extend_from_slice(&SK_PART_3);
    sk.extend_from_slice(&SK_PART_4);
    
    // De-obfuscate with XOR mask (cyclic)
    for (i, byte) in sk.iter_mut().enumerate() {
        *byte ^= XOR_MASK[i % XOR_MASK.len()];
    }
    
    sk.try_into().expect("Key reconstruction failed")
}

/// Check if real keys were loaded at build time
#[allow(dead_code)]
pub fn keys_available() -> bool {
    KEYS_LOADED
}
