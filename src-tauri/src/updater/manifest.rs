// Manifest Parser - Handles remote and local manifest comparison
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Remote manifest structure from GitHub
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub version: String,
    pub required_shell_version: Option<String>,
    pub assets: Vec<AssetEntry>,
    pub patches: Vec<PatchEntry>,
}

/// Individual asset entry in manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetEntry {
    pub path: String,
    pub hash: String,
    pub size: u64,
    pub pack: Option<String>,
}

/// Patch entry for delta updates
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchEntry {
    pub from_version: String,
    pub to_version: String,
    pub file: String,
    pub size: u64,
}

/// Result of comparing local vs remote manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestDiff {
    pub needs_update: bool,
    pub files_to_download: Vec<AssetEntry>,
    pub patches_available: Vec<PatchEntry>,
    pub total_download_size: u64,
}

impl Manifest {
    /// Parse manifest from JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Save manifest to local file
    pub fn save_to_file(&self, path: &PathBuf) -> Result<(), std::io::Error> {
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        std::fs::write(path, json)
    }

    /// Load manifest from local file
    pub fn load_from_file(path: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let content = std::fs::read_to_string(path)?;
        let manifest = Self::from_json(&content)?;
        Ok(manifest)
    }

    /// Compare with local files and determine what needs updating
    pub fn diff_with_local(&self, _assets_dir: &PathBuf, local_hashes: &HashMap<String, String>) -> ManifestDiff {
        let mut files_to_download = Vec::new();
        let mut total_size = 0u64;

        for asset in &self.assets {
            let local_hash = local_hashes.get(&asset.path);
            
            // If file doesn't exist or hash doesn't match, we need to download
            if local_hash.map_or(true, |h| h != &asset.hash) {
                files_to_download.push(asset.clone());
                total_size += asset.size;
            }
        }

        // Find applicable patches (from current version to target)
        let patches_available: Vec<PatchEntry> = self.patches.clone();

        ManifestDiff {
            needs_update: !files_to_download.is_empty(),
            files_to_download,
            patches_available,
            total_download_size: total_size,
        }
    }
}
