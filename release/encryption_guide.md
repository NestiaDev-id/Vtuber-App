# 🔐 Content Encryption Guide (Kyber-AES-GCM)

Dokumen ini menjelaskan cara menggunakan sistem enkripsi **Post-Quantum Hybrid** untuk melindungi aset digital aplikasi.

## 🛠️ Persiapan CLI Tool
Tool enkripsi berada di `src-tauri/src/bin/encrypt_content.rs`.

1. Masuk ke direktori backend:
   ```powershell
   cd src-tauri
   ```
2. Pastikan `pqc_kyber` dengan fitur `kyber1024` sudah terpasang di `Cargo.toml`.

---

## 🔑 Langkah 1: Key Generation (Hanya Sekali)
Aplikasi menggunakan pasangan kunci Kyber-1024. Kunci ini harus di-generate dan ditaruh di dalam kode program dengan teknik obfuscation.

1. Jalankan perintah:
   ```powershell
   cargo run --bin encrypt_content -- --generate-keys
   ```
2. **⚠️ PENTING:** 
   - File `keys/kyber_keypair.bin` akan tercipta. **JANGAN PERNAH** membagikan atau men-commit file ini ke GitHub.
   - CLI akan mengeluarkan output berupa kode Rust (array bytes).

---

## 🛡️ Langkah 2: Key Obfuscation (Embedding)
Agar kunci tidak mudah ditemukan oleh Hex Editor, kita menggunakan teknik **Split + XOR**.

1. Salin array `PK_PART_A/B/C` dan `SK_PART_1/2/3/4` dari output konsol.
2. Buka file `src-tauri/src/updater/key_obfuscation.rs`.
3. Ganti placeholder array yang ada dengan kode yang baru saja disalin.
4. **Build ulang** aplikasi agar kunci tertanam di dalam binary.

---

## 📦 Langkah 3: Enkripsi Aset (Build-Time)
Aset official harus dienkripsi sebelum dipackage ke `content.zip`.

1. Pastikan aset berada di folder `Content/Official/`.
2. Jalankan enkripsi:
   ```powershell
   cargo run --bin encrypt_content -- --input ../Content/Official --output ../Content/Official
   ```
3. File asli akan digantikan dengan versi `.vtenc`.
4. Hapus file sumber asli (jika masih ada) sebelum melakukan packaging final.

---

## 🏗️ Struktur Folder Content
Aplikasi akan mencari aset dengan urutan prioritas:
1. `Content/Custom/` (Polos, Modding - Prioritas Utama)
2. `Content/Official/` (Terenkripsi `.vtenc`)

```
C:\Program Files\VTuber-App\
├── VTuberApp.exe
└── Content\
    ├── Official\
    │   └── Characters\
    │       └── Miku.png.vtenc    <-- Aman (Kyber-AES-GCM)
    └── Custom\
        └── Characters\
            └── MyAvatar.l2d      <-- Polos (User Mod)
```

---

## 🚨 Troubleshooting
- **Error: Key not found**: Pastikan file `.bin` ada di folder `keys/` saat menjalankan CLI.
- **Decryption Error di App**: Pastikan kunci yang di-copy ke `key_obfuscation.rs` adalah kunci yang sama dengan yang digunakan saat proses enkripsi.
