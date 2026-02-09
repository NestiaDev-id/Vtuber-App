# Build Script for VTuber App Distribution Packages
# Creates: vtuber_app.zip and content.zip for GitHub Release

param(
    [switch]$SkipBuild,
    [switch]$ContentOnly
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== VTuber App Packaging Script ===" -ForegroundColor Cyan

# 1. Build the main app (if not skipped)
if (-not $SkipBuild -and -not $ContentOnly) {
    Write-Host "`n[1/4] Building Tauri application..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    npm run tauri build
    Pop-Location
}

# 2. Create release directory
$ReleaseDir = Join-Path $ProjectRoot "release"
if (-not (Test-Path $ReleaseDir)) {
    New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
}

# 3. Package Content (Live2D Characters)
Write-Host "`n[2/4] Packaging Content (Live2D assets)..." -ForegroundColor Yellow
$ContentSource = Join-Path $ProjectRoot "public\vtuber_chara"
$ContentZip = Join-Path $ReleaseDir "content.zip"

# Create temp Content structure
$TempContentDir = Join-Path $env:TEMP "vtuber_content_package"
if (Test-Path $TempContentDir) { Remove-Item $TempContentDir -Recurse -Force }
New-Item -ItemType Directory -Path "$TempContentDir\Content\Characters" -Force | Out-Null

# Copy characters to Content/Characters structure
Copy-Item -Path "$ContentSource\*" -Destination "$TempContentDir\Content\Characters\" -Recurse

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

# 4. Package VTuber App (Main executable)
Write-Host "`n[3/4] Packaging VTuber App..." -ForegroundColor Yellow
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

# 5. Summary
Write-Host "`n[4/4] Packaging Complete!" -ForegroundColor Yellow
Write-Host "=== Release Artifacts ===" -ForegroundColor Cyan
Write-Host "  - $AppZip" -ForegroundColor White
Write-Host "  - $ContentZip" -ForegroundColor White
Write-Host "`nUpload these to GitHub Releases for distribution." -ForegroundColor Gray
