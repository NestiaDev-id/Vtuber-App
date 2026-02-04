# Release Process Guide

## Quick Reference

### Files Created
- `release/latest.json` - Tauri Updater manifest
- `release/manifest.json` - Core Assets manifest

---

## Build & Release Steps

### 1. Build the Application with Signing
```powershell
# From project root
.\build.ps1
```

This automatically:
- Loads `.env` variables (including signing keys)
- Compiles Rust backend
- Bundles frontend
- Creates installers (.msi and .exe)
- **Signs both installers** (generates .sig files)

### 2. Read Signature Content
```powershell
# Get the signature for latest.json
Get-Content "src-tauri/target/release/bundle/msi/vtuber-app_0.1.0_x64_en-US.msi.sig"
```

### 3. Update latest.json
Copy the signature output and paste it into `release/latest.json` under `platforms.windows-x86_64.signature`.

### 4. Upload to GitHub Release
Create a new release (e.g., `v0.1.0`) and upload:
- `vtuber-app_0.1.0_x64_en-US.msi` (from `src-tauri/target/release/bundle/msi/`)
- `latest.json` (from `release/`)

---

## For Core Assets Update (Optional)

Only needed if you want to distribute model files separately from the main installer.

### 1. Generate Hashes
```powershell
Get-FileHash "public/vtuber_chara/kamiyahakuko.moc3" -Algorithm SHA256
```

### 2. Create Zstd Pack
```powershell
zstd -r --ultra -22 -o "release/character_kamiya.zst" "public/vtuber_chara/kamiya/"
```

### 3. Update manifest.json
Fill in actual hashes and sizes for each asset.

### 4. Upload Core Assets
Upload to a separate release (e.g., `v0.1.0-core`):
- `manifest.json`
- `character_kamiya.zst`
- Any patch files (.patch.zst)
