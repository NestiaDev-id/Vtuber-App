# Build Script for VTuber App Distribution Packages
# Creates: vtuber_app.zip and content.zip for GitHub Release
#
# Prerequisites:
#   1. Root .env must contain KYBER_PUBLIC_KEY and KYBER_SECRET_KEY
#   2. Content/Official/ must contain the official assets to encrypt
#
# Usage:
#   .\tools\package_release.ps1                  # Full build + package
#   .\tools\package_release.ps1 -SkipBuild       # Package only (use existing build)
#   .\tools\package_release.ps1 -ContentOnly     # Package content only
#   .\tools\package_release.ps1 -SkipEncryption  # Skip content encryption step

param(
    [switch]$SkipBuild,
    [switch]$ContentOnly,
    [switch]$SkipEncryption
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== VTuber App Packaging Script ===" -ForegroundColor Cyan
Write-Host "  Project Root: $ProjectRoot" -ForegroundColor Gray

# ============================================================
# Step 0: Validate .env and load variables
# ============================================================
Write-Host "`n[0/5] Validating & Loading environment..." -ForegroundColor Yellow
$EnvFile = Join-Path $ProjectRoot ".env"

# 0.1 Load .env if exists
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^(?<name>[^#\s]+)=(?<value>.+)$') {
            $name = $Matches['name'].Trim()
            $value = $Matches['value'].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($name, $value)
        }
    }
}

# 0.2 Auto-detect & Encode Tauri Private Key
$AutoTauriKey = Join-Path $ProjectRoot "src-tauri\tauri.key"
if (Test-Path $AutoTauriKey) {
    # Read raw bytes and encode to Base64 - this is the most robust way for Tauri CLI
    $KeyBytes = [System.IO.File]::ReadAllBytes($AutoTauriKey)
    $Base64Key = [System.Convert]::ToBase64String($KeyBytes)
    $env:TAURI_SIGNING_PRIVATE_KEY = $Base64Key
    Write-Host "  OK Auto-detected & encoded Tauri key" -ForegroundColor Green
}

# 0.3 Verify critical variables
$hasPK = [Environment]::GetEnvironmentVariable("KYBER_PUBLIC_KEY")
$hasSK = [Environment]::GetEnvironmentVariable("KYBER_SECRET_KEY")
$hasTauriKey = [Environment]::GetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY")
$hasTauriPass = [Environment]::GetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY_PASSWORD")

if ($hasPK -and $hasSK) {
    Write-Host "  OK Kyber keys loaded" -ForegroundColor Green
}
if ($hasTauriKey) {
    if ($hasTauriPass) {
        Write-Host "  OK Tauri signing key & password ready" -ForegroundColor Green
    } else {
        Write-Host "  NOTE: Tauri key found but password is empty (assumed no password)" -ForegroundColor Gray
    }
} else {
    Write-Host "  WARNING: TAURI_SIGNING_PRIVATE_KEY not found (build may fail signing)" -ForegroundColor Red
}


# ============================================================
# Step 1: Build the main app (if not skipped)
# ============================================================
if (-not $SkipBuild -and -not $ContentOnly) {
    Write-Host "`n[1/5] Building Tauri application..." -ForegroundColor Yellow
    Write-Host "  build.rs will inject keys from .env into binary" -ForegroundColor Gray
    Push-Location $ProjectRoot
    npm run tauri build
    Pop-Location
}

# ============================================================
# Step 2: Encrypt Official Content (if not skipped)
# ============================================================
$ContentOfficialDir = Join-Path $ProjectRoot "Content\Official"
$ContentCustomDir = Join-Path $ProjectRoot "Content\Custom"

if (-not $SkipEncryption -and (Test-Path $ContentOfficialDir)) {
    Write-Host "`n[2/5] Encrypting Official Content (Kyber-AES-GCM)..." -ForegroundColor Yellow
    
    $KeyFile = Join-Path $ProjectRoot "src-tauri\keys\kyber_keypair.bin"
    if (-not (Test-Path $KeyFile)) {
        Write-Host "  ERROR: Keypair not found at $KeyFile" -ForegroundColor Red
        Write-Host "  Run: cd src-tauri && cargo run --bin encrypt_content -- --generate-keys" -ForegroundColor Red
        exit 1
    }
    
    # Create temp encrypted output
    $TempEncryptedDir = Join-Path $env:TEMP "vtuber_encrypted_content"
    if (Test-Path $TempEncryptedDir) { Remove-Item $TempEncryptedDir -Recurse -Force }
    
    Push-Location (Join-Path $ProjectRoot "src-tauri")
    cargo run --bin encrypt_content -- `
        --input $ContentOfficialDir `
        --output $TempEncryptedDir `
        --key-file $KeyFile
    Pop-Location
    
    Write-Host "  OK Official content encrypted" -ForegroundColor Green
} else {
    $TempEncryptedDir = $null
    if ($SkipEncryption) {
        Write-Host "`n[2/5] Skipping encryption (--SkipEncryption)" -ForegroundColor Gray
    } else {
        Write-Host "`n[2/5] No Official content found, skipping encryption" -ForegroundColor Gray
    }
}

# ============================================================
# Step 3: Create release directory
# ============================================================
$ReleaseDir = Join-Path $ProjectRoot "release"
if (-not (Test-Path $ReleaseDir)) {
    New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
}

# ============================================================
# Step 4: Package Content ZIP
# ============================================================
Write-Host "`n[3/5] Packaging Content ZIP..." -ForegroundColor Yellow
$ContentZip = Join-Path $ReleaseDir "content.zip"

# Create temp Content structure
$TempContentDir = Join-Path $env:TEMP "vtuber_content_package"
if (Test-Path $TempContentDir) { Remove-Item $TempContentDir -Recurse -Force }

# Structure: Content/Official/ (encrypted) + Content/Custom/ (template)
New-Item -ItemType Directory -Path "$TempContentDir\Content\Official" -Force | Out-Null
New-Item -ItemType Directory -Path "$TempContentDir\Content\Custom" -Force | Out-Null

# Copy encrypted official content (if available)
if ($TempEncryptedDir -and (Test-Path $TempEncryptedDir)) {
    Copy-Item -Path "$TempEncryptedDir\*" -Destination "$TempContentDir\Content\Official\" -Recurse
    Remove-Item $TempEncryptedDir -Recurse -Force
} elseif (Test-Path $ContentOfficialDir) {
    # Fallback: copy unencrypted official content (dev builds)
    Copy-Item -Path "$ContentOfficialDir\*" -Destination "$TempContentDir\Content\Official\" -Recurse
}

# Copy custom content template (if exists)
if (Test-Path $ContentCustomDir) {
    Copy-Item -Path "$ContentCustomDir\*" -Destination "$TempContentDir\Content\Custom\" -Recurse
}

# Also support legacy path (public/vtuber_chara) for backward compatibility
$LegacyContent = Join-Path $ProjectRoot "public\vtuber_chara"
if ((Test-Path $LegacyContent) -and -not (Test-Path "$TempContentDir\Content\Official\Characters")) {
    New-Item -ItemType Directory -Path "$TempContentDir\Content\Official\Characters" -Force | Out-Null
    Copy-Item -Path "$LegacyContent\*" -Destination "$TempContentDir\Content\Official\Characters\" -Recurse
    Write-Host "  (Copied from legacy public/vtuber_chara path)" -ForegroundColor Gray
}

# Create ZIP
if (Test-Path $ContentZip) { Remove-Item $ContentZip -Force }
Compress-Archive -Path "$TempContentDir\*" -DestinationPath $ContentZip -CompressionLevel Optimal
Remove-Item $TempContentDir -Recurse -Force

$ContentSize = (Get-Item $ContentZip).Length / 1MB
Write-Host "  Created: content.zip ($([math]::Round($ContentSize, 2)) MB)" -ForegroundColor Green

if ($ContentOnly) {
    Write-Host "`n=== Content Package Ready ===" -ForegroundColor Cyan
    exit 0
}

# ============================================================
# Step 5: Package VTuber App ZIP
# ============================================================
Write-Host "`n[4/5] Packaging VTuber App..." -ForegroundColor Yellow
$AppSource = Join-Path $ProjectRoot "src-tauri\target\release\vtuber-app.exe"
$AppZip = Join-Path $ReleaseDir "vtuber_app.zip"

if (-not (Test-Path $AppSource)) {
    Write-Host "  ERROR: Build output not found at $AppSource" -ForegroundColor Red
    Write-Host "  Run 'npm run tauri build' first or use -SkipBuild with existing build" -ForegroundColor Red
    exit 1
}

# Create temp VTuber App structure
$TempAppDir = Join-Path $env:TEMP "vtuber_app_package"
if (Test-Path $TempAppDir) { Remove-Item $TempAppDir -Recurse -Force }
New-Item -ItemType Directory -Path $TempAppDir -Force | Out-Null

# Copy main executable
Copy-Item -Path $AppSource -Destination "$TempAppDir\VTuberApp.exe"

# Create ZIP
if (Test-Path $AppZip) { Remove-Item $AppZip -Force }
Compress-Archive -Path "$TempAppDir\*" -DestinationPath $AppZip -CompressionLevel Optimal
Remove-Item $TempAppDir -Recurse -Force

$AppSize = (Get-Item $AppZip).Length / 1MB
Write-Host "  Created: vtuber_app.zip ($([math]::Round($AppSize, 2)) MB)" -ForegroundColor Green

# ============================================================
# Summary
# ============================================================
Write-Host "`n[5/5] Packaging Complete!" -ForegroundColor Yellow
Write-Host "=== Release Artifacts ===" -ForegroundColor Cyan
Write-Host "  - $AppZip" -ForegroundColor White
Write-Host "  - $ContentZip" -ForegroundColor White
Write-Host "`n  Upload these to GitHub Releases for distribution." -ForegroundColor Gray
