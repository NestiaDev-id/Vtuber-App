// Key Obfuscation Module for Kyber-AES-GCM Encryption
// Uses Split + XOR technique to hide keys from Hex Editor inspection
//
// IMPORTANT: The actual key parts should be generated using the CLI tool
// and then embedded here. These are PLACEHOLDER values.

/// XOR mask for decoding the split key parts
/// This mask is applied to all parts before concatenation
const XOR_MASK: [u8; 32] = [
    0x5A, 0x3C, 0x9F, 0x1E, 0x7B, 0x4D, 0x2A, 0x8E,
    0xC1, 0x6F, 0xB3, 0x0D, 0xE5, 0x92, 0x48, 0xF7,
    0x21, 0x84, 0xA6, 0x5B, 0xD9, 0x3E, 0x70, 0xCC,
    0x15, 0x8A, 0xE2, 0x4F, 0x97, 0x63, 0xBD, 0x09,
];

// ============================================================
// Kyber Public Key Parts (for encryption - safe to embed)
// Split into 3 parts, each XOR'd with mask for obfuscation
// Total size: KYBER_PUBLICKEYBYTES (1568 bytes for Kyber-1024)
// ============================================================

/// Part A: Embedded in encryption module (523 bytes)
/// PLACEHOLDER - Replace with actual obfuscated key part during build
const PK_PART_A: [u8; 523] = [0u8; 523];

/// Part B: Embedded in audio module (523 bytes)
/// PLACEHOLDER - Replace with actual obfuscated key part during build
const PK_PART_B: [u8; 523] = [0u8; 523];

/// Part C: Embedded in character module (522 bytes)
/// PLACEHOLDER - Replace with actual obfuscated key part during build  
const PK_PART_C: [u8; 522] = [0u8; 522];

// ============================================================
// Kyber Secret Key Parts (for decryption - SENSITIVE)
// Split into 4 parts for extra security
// Total size: KYBER_SECRETKEYBYTES (3168 bytes for Kyber-1024)
// ============================================================

/// Part 1: In encryption module
const SK_PART_1: [u8; 792] = [0u8; 792];

/// Part 2: In updater module  
const SK_PART_2: [u8; 792] = [0u8; 792];

/// Part 3: In settings module
const SK_PART_3: [u8; 792] = [0u8; 792];

/// Part 4: In audio module
const SK_PART_4: [u8; 792] = [0u8; 792];

/// Reconstruct the Kyber Public Key from obfuscated parts
/// This happens at runtime, key only exists in RAM
pub fn get_kyber_public_key() -> [u8; 1568] {
    let mut pk = Vec::with_capacity(1568);
    
    // Concatenate parts
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
    
    // Concatenate parts
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

/// Obfuscate raw key bytes for embedding in source code
/// Use this during build process to generate the const arrays
#[allow(dead_code)]
pub fn obfuscate_key_part(raw_bytes: &[u8]) -> Vec<u8> {
    raw_bytes
        .iter()
        .enumerate()
        .map(|(i, byte)| byte ^ XOR_MASK[i % XOR_MASK.len()])
        .collect()
}

/// Split a key into N parts for obfuscation
#[allow(dead_code)]
pub fn split_key(key: &[u8], num_parts: usize) -> Vec<Vec<u8>> {
    let part_size = key.len() / num_parts;
    let remainder = key.len() % num_parts;
    
    let mut parts = Vec::new();
    let mut offset = 0;
    
    for i in 0..num_parts {
        let size = if i < remainder { part_size + 1 } else { part_size };
        parts.push(key[offset..offset + size].to_vec());
        offset += size;
    }
    
    parts
}
