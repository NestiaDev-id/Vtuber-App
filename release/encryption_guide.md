# 🔐 Content Encryption Guide (Kyber-AES-GCM)

Panduan enkripsi aset digital menggunakan **Post-Quantum Hybrid Encryption**.

---

## 🔑 Langkah 1: Generate Keypair (Sekali Saja)

```powershell
cd src-tauri
cargo run --bin encrypt_content -- --generate-keys
```

Output berupa dua baris base64. Copy ke root `.env`:
```
KYBER_PUBLIC_KEY=abc123...
KYBER_SECRET_KEY=xyz789...
```

> [!CAUTION]
> `.env` sudah di-`.gitignore`. **JANGAN** commit file ini.

---

## 📦 Langkah 2: Enkripsi Aset Official

```powershell
cargo run --bin encrypt_content -- --input ../Content/Official --output ../Content/Official
```

File asli → `.vtenc` (Kyber-AES-GCM encrypted).

---

## 🏗️ Langkah 3: Build Aplikasi

```powershell
npm run tauri build
```

`build.rs` secara otomatis membaca `.env` → XOR-obfuscate → inject ke binary.

---

## 📤 Langkah 4: Package Release

```powershell
.\tools\package_release.ps1               # Full: build + encrypt + package
.\tools\package_release.ps1 -SkipBuild    # Skip build, hanya package
.\tools\package_release.ps1 -ContentOnly  # Hanya package content.zip
```

---

## 🏗️ Struktur Folder

```
Content\
├── Official\   ← Terenkripsi (.vtenc) — IP Protected
└── Custom\     ← Polos — User Modding (Prioritas Utama)
```

---

## 🔒 Keamanan

| Item | Di GitHub? | Di .exe? |
|------|-----------|----------|
| Source code (`key_obfuscation.rs`) | ✅ Placeholder `[0u8;...]` | ✅ Kunci ter-obfuscate |
| `.env` (base64 keys) | ❌ Gitignored | N/A |
| `keys/kyber_keypair.bin` | ❌ Gitignored | N/A |
