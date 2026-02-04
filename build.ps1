# build.ps1 - VTuber App Release Build Script
# Loads .env variables and runs Tauri build with signing

Write-Host "🔐 Loading environment variables from .env..." -ForegroundColor Cyan

# Load .env file
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^([^#=][^=]*)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
            Write-Host "  ✓ $key loaded" -ForegroundColor DarkGray
        }
    }
} else {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    exit 1
}

# Verify signing key is present
if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
    Write-Host "❌ TAURI_SIGNING_PRIVATE_KEY not found in .env!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🏗️  Starting Tauri build with signing..." -ForegroundColor Green
Write-Host ""

# Run Tauri build
npm run tauri build

Write-Host ""
Write-Host "✅ Build complete! Check src-tauri/target/release/bundle/" -ForegroundColor Green
