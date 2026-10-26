# INC-004: Penipisan Kapasitas Disk Akibat Akumulasi Log Debug Tanpa Rotasi
- **Severity:** P1 (Critical - Storage Exhaustion Warning)
- **Waktu mulai / terdeteksi / selesai:** 2026-10-26 12:46:20 WIB / 2026-10-26 12:46:40 WIB / 2026-10-26 12:48:30 WIB
- **Durasi dampak:** 2 menit 10 detik
- **Dampak ke pengguna:** Partisi disk aplikasi dan log mengalami lonjakan penggunaan tak terkontrol. Pada kondisi disk 100% penuh di produksi, PostgreSQL akan gagal menulis WAL logs (`PANIC: could not write to log file: No space left on device`), Express gagal mencatat audit transaksi (`ENOSPC`), dan seluruh operasi I/O terhenti sehingga melumpuhkan seluruh layanan PolisKu.

---

## 1. Ringkasan
Pada pukul 12:46 WIB, terjadi penulisan log debug audit secara terus menerus ke berkas log lokal container `/app/logs/audit-debug.log` tanpa batas ukuran dan tanpa kebijakan rotasi. Dalam waktu singkat, file log membengkak sebesar 150 MB. Investigasi melalui perintah CLI `df -h`, `du -ah`, dan `docker inspect` membuktikan bahwa container berjalan tanpa batas rotasi log (`HostConfig.LogConfig.Config` kosong). Insiden dimitigasi secara instan dengan memotong (truncate) file log menjadi 0 byte tanpa downtime proses, dilanjutkan dengan penerapan konfigurasi rotasi log Docker resmi (`max-size: 10m`, `max-file: 3`) dan alert rule kapasitas disk Prometheus.

---

## 2. Timeline

| Waktu (WIB) | Aktivitas / Peristiwa |
|---|---|
| **12:46:20** | Diaktifkan logging audit verbose level debug yang menulis setiap payload transaksi ke `/app/logs/audit-debug.log`. |
| **12:46:40** | File log membengkak menyentuh 150 MB dalam hitungan detik. |
| **12:46:45** | Tim Support mendeteksi laju peningkatan disk tak wajar; Pesan Awal insiden dikirimkan ke stakeholder. |
| **12:46:55** | Investigasi dijalankan via `docker exec polisku-app-1 df -h /app` dan `du -ah /app/logs/` untuk mengidentifikasi berkas terbesar. |
| **12:47:00** | Inspeksi konfigurasi Docker via `docker inspect` mengonfirmasi ketiadaan parameter rotasi log pada daemon/service level. |
| **12:47:30** | Pesan Update dikirimkan bahwa akar masalah log bloat telah terlokalisasi dan tindakan pemotongan log sedang dilakukan. |
| **12:47:45** | File `/app/logs/audit-debug.log` dipotong (truncate) kembali ke 0 byte melalui instruksi pembersihan aman. |
| **12:47:50** | Diterapkan konfigurasi `logging` resmi pada `docker-compose.yml` (`max-size: 10m`, `max-file: 3`) dan alert Prometheus `DiskSpaceUsageAbove80`. |
| **12:48:30** | Kapasitas disk diverifikasi kembali aman dan stabil; Pesan Resolusi dikirimkan ke stakeholder. |

---

## 3. Gejala dan Cara Deteksi

### Gejala yang Teramati
1. **Pertumbuhan File Log Drastis:** Berkas log `/app/logs/audit-debug.log` tumbuh pesat mencapai 150 MB.
2. **Ketiadaan Pembatasan Docker Log:** Output `docker inspect` menunjukkan objek `LogConfig: {"Type":"local","Config":{}}` tanpa parameter batas ukuran.
3. **Risiko Disk Full (ENOSPC):** Jika penulisan berlanjut tanpa rotasi, ruang kosong disk host akan habis dalam hitungan jam.

### Cara Deteksi
- **Perintah CLI Diagnostik:**
  - `df -h`: Memeriksa persentase partisi yang terisi (*overlay filesystem*).
  - `du -ah /app/logs | sort -rh`: Menemukan file log audit berukuran ratusan megabyte.
  - `docker inspect`: Menemukan absennya konfigurasi `max-size`.

---

## 4. Investigasi (Langkah, Perintah, Temuan)

### Langkah 1: Memeriksa Penggunaan Partisi Filesystem
```bash
docker exec polisku-app-1 df -h /app
```
**Temuan ([01-disk-usage-df.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-004/01-disk-usage-df.txt)):**
Partisi overlay menunjukkan lonjakan konsumsi disk pada direktori kerja aplikasi.

### Langkah 2: Mengidentifikasi File Penyerap Ruang Terbesar
```bash
docker exec polisku-app-1 du -ah /app/logs/
```
**Temuan ([02-large-files-du.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-004/02-large-files-du.txt)):**
Ditemukan tepat satu file yang menyerap seluruh ruang:
```text
150.0M  /app/logs/audit-debug.log
150.0M  /app/logs/
```

### Langkah 3: Memeriksa Konfigurasi Rotasi Docker Daemon
```bash
docker inspect --format '{{json .HostConfig.LogConfig}}' polisku-app-1
```
**Temuan ([03-docker-logconfig-unrotated.json](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-004/03-docker-logconfig-unrotated.json)):**
`{"Type":"local","Config":{}}` — **Sama sekali tidak ada konfigurasi `max-size` atau `max-file`.** Docker dibiarkan menulis log tanpa batas.

---

## 5. Root Cause
1. **Aplikasi:** Penulisan log audit detail level debug langsung ke file lokal tanpa mekanisme log rotation (seperti `winston-daily-rotate-file` atau logrotate).
2. **Infrastruktur Docker:** File `docker-compose.yml` tidak mendefinisikan logging driver options (`max-size` dan `max-file`), sehingga file log stdout/stderr container dan volume lokal diizinkan tumbuh tak terbatas hingga kapasitas hard disk habis.

---

## 6. Resolusi dan Recovery

### Tindakan Pemulihan Cepat (Immediate Mitigation)
1. Memotong (truncate) file log yang membesar tanpa me-lock atau me-restart proses aplikasi:
   ```bash
   curl.exe -s -X POST http://localhost:3000/simulations/clean-disk
   # atau via CLI container:
   docker exec polisku-app-1 truncate -s 0 /app/logs/audit-debug.log
   ```
   *Catatan SRE:* Jangan gunakan `rm file.log` jika proses masih membuka file descriptor (karena ruang disk tidak akan terbebaskan sampai proses dimatikan, terlihat di `lsof | grep deleted`). Selalu gunakan `truncate -s 0`.
2. Verifikasi ukuran file kembali menjadi 0 MB (`/simulations/disk-stats`).

### Perbaikan Permanen (Permanent Fix)
Menambahkan konfigurasi rotasi log pada service di `docker-compose.yml`:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 7. Pencegahan (Action Items)

| No | Tindakan Pencegahan | Kategori | Owner | Target Waktu |
|---|---|---|---|---|
| 1 | Wajibkan konfigurasi rotasi log (`max-size: 10m`, `max-file: 3`) pada seluruh service di `docker-compose.yml`. | Infra | DevOps Team | Selesai |
| 2 | Tambahkan alert Prometheus `DiskSpaceUsageAbove80` jika kapasitas partisi menyentuh 80% selama 1 menit. | Monitoring | SRE Team | Selesai |
| 3 | Larang penulisan file log ke direktori lokal container; alirkan seluruh log ke stdout/stderr untuk diteruskan ke log collector (Loki / Fluentd). | Arsitektur | App Team | Sprint 1 |
| 4 | Siapkan cron job pembersihan berkala `docker system prune --volumes -f` pada VM host untuk membersihkan dangling volumes dan build cache. | Maintenance | SRE Team | Sprint 1 |

---

## 8. Komunikasi ke Stakeholder
Dokumentasi pesan komunikasi (Awal, Update, Resolusi) tercatat di [communications.md](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-004/communications.md).

---

## 9. Pelajaran (Key Takeaways)
1. **Bedakan `rm` vs `truncate`:** Menghapus file log yang sedang ditulis oleh proses aktif (`rm`) akan menyembunyikan file dari `ls` namun ruang disk TETAP TERPAKAi di Linux kernel karena file descriptor masih terbuka (`lsof | grep deleted`). Menggunakan `truncate -s 0` adalah cara benar membebaskan ruang disk seketika tanpa downtime.
2. **Jangan Pernah Mengandalkan Default Logging Docker:** Default Docker tidak membatasi ukuran log. Satu proses yang mencetak ribuan baris log debug per detik dapat menenggelamkan seluruh server dalam beberapa jam.
