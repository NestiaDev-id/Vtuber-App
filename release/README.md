# 📦 VTuber App Release Packaging Guide

Dokumen ini berisi langkah-langkah untuk menyiapkan paket distribusi (.zip) yang akan diupload ke GitHub Releases. Proses ini memisahkan aplikasi utama dari aset berat agar update lebih efisien.

## 🚀 Cara Cepat (Menggunakan Script)

Saya telah menyediakan script PowerShell untuk menangani penamaan folder dan kompresi secara otomatis sesuai standar industri:

1. Buka PowerShell di folder project utama.
2. Jalankan perintah berikut:
   ```powershell
   # Untuk membuat vtuber_app.zip dan content.zip sekaligus (beserta build)
   .\tools\package_release.ps1

   # Jika sudah melakukan 'npm run tauri build' dan hanya ingin membungkusnya saja:
   .\tools\package_release.ps1 -SkipBuild
   ```
3. Hasilnya akan muncul di folder `release/`.

---

## 🛠️ Cara Manual (Jika Ingin Melakukannya Sendiri)

Jika Anda ingin melakukan packaging secara manual, pastikan struktur folder di dalam ZIP mengikuti aturan ini untuk kompatibilitas dengan Installer:

### 1. `vtuber_app.zip` (Aplikasi Utama)
Berisi file executable aplikasi yang sudah di-build.
- **Source**: `src-tauri/target/release/vtuber-app.exe`
- **Struktur di dalam ZIP**:
  ```text
  vtuber_app.zip
  └── VTuberApp.exe  (Ubah nama dari vtuber-app.exe)
  ```

### 2. `content.zip` (Aset Live2D)
Berisi semua model karakter dan aset berat lainnya.
- **Source**: `public/vtuber_chara/`
- **Struktur di dalam ZIP (PENTING)**:
  ```text
  content.zip
  └── Content/
      └── Characters/
          └── [Folder-folder model Live2D Anda...]
  ```
  *Catatan: Installer mengharapkan folder root bernama `Content` di dalam ZIP ini.*

---

## 🔑 Keamanan & Kunci (Keys)

Proses build dan rilis menggunakan dua jenis kunci yang berbeda:

### 1. Tauri Signing Key (Untuk Update)
Digunakan untuk menandatangani binary agar fitur Updater berfungsi.
- **File**: `src-tauri/tauri.key` (⚠️ JANGAN HILANG!)
- **Config**: Public key harus ada di `tauri.conf.json` -> `plugins.updater.pubkey`.
- **Environment**: Pastikan variable berikut ada di `.env`:
  ```env
  TAURI_SIGNING_PRIVATE_KEY="isi_dari_file_tauri_key"
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD="password_kunci_anda"
  ```

### 2. Kyber-AES-GCM (Untuk Konten)
Digunakan untuk mengunci aset di `Content/Official` agar tidak bisa dibajak.
- **Panduan Lengkap**: Lihat [Encryption Guide](../release/encryption_guide.md)

---

## ☁️ Langkah Distribusi

1. Buat **New Release** di GitHub Repository Anda.
2. Lampirkan file berikut ke dalam Release:
   - `vtuber_app.zip`
   - `content.zip`
   - (Optional) `VTuber_Installer.exe` (Hasil build dari `installer_project`)

Installer akan secara otomatis mencari file dengan nama tersebut di URL Release terbaru.

