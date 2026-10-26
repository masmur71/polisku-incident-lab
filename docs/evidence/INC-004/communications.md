# Komunikasi Stakeholder — INC-004 (Disk Penuh / Log Bloat Tanpa Rotasi)

## 1. Pesan Awal (Saat Insiden Terdeteksi)
**Waktu Kirim:** 2026-10-26 12:46:30 WIB  
**Saluran:** Slack #incident-response & Email StatusPage internal  
**Target:** Tim Internal, Customer Operations, Manajemen  

```text
[INCIDENT] [P1] Peringatan Kapasitas Penyimpanan Disk Host Menipis (Storage Warning)

Dampak: Kami mendeteksi laju konsumsi disk yang tidak terkontrol pada node container aplikasi. Kapasitas partisi log mendekati batas kritis akibat akumulasi berkas log aplikasi tanpa mekanisme rotasi. Jika dibiarkan penuh, aplikasi dan database PostgreSQL tidak akan dapat menulis data transaksi baru (Disk I/O Write Failure).
Waktu terdeteksi: 2026-10-26 12:46 WIB
Status: Sedang diinvestigasi & proses mitigasi (P1 - Critical)

Tim SRE sedang mengidentifikasi direktori dengan penggunaan disk terbesar dan menyiapkan pembersihan darurat. Update selanjutnya dalam 10 menit.

— Tim Support PolisKu
```

---

## 2. Pesan Update (Selama Investigasi)
**Waktu Kirim:** 2026-10-26 12:47:30 WIB  
**Saluran:** Slack #incident-response & Email StatusPage internal  

```text
[UPDATE] [P1] Insiden PolisKu - Akumulasi Log Debug Tanpa Rotasi

Status: Akar masalah teridentifikasi, proses pembersihan dan rekonfigurasi logging sedang berjalan.
Temuan sementara: 
- Ditemukan file log debug `/app/logs/audit-debug.log` membengkak hingga ratusan megabyte dalam waktu singkat akibat logging debug verbose tanpa batas ukuran.
- Inspeksi konfigurasi container (`docker inspect`) membuktikan ketiadaan batas rotasi log (`max-size` dan `max-file` bernilai kosong/unlimited).

Tindakan yang sedang dilakukan:
1. Memotong (truncate) file log audit yang memakan ruang penyimpanan secara aman tanpa mematikan proses.
2. Mengonfigurasi rotasi log standar pada `docker-compose.yml` (`max-size: 10m`, `max-file: 3`).
3. Memastikan pemulihan ruang disk kembali di atas ambang batas aman.

Estimasi pemulihan: 5 menit.

— Tim Support PolisKu
```

---

## 3. Pesan Resolusi (Setelah Pulih)
**Waktu Kirim:** 2026-10-26 12:49:00 WIB  
**Saluran:** Slack #incident-response, Email All-Stakeholders  

```text
[RESOLVED] [P1] Insiden PolisKu - Disk Storage Restored & Log Rotation Configured

Waktu mulai: 2026-10-26 12:46 WIB
Waktu selesai: 2026-10-26 12:48 WIB
Durasi dampak: 2 menit

Penyebab: 
Penulisan berkas audit log level debug ke disk lokal tanpa konfigurasi pemotongan atau rotasi berkala, ditambah konfigurasi Docker logging driver default yang tidak membatasi ukuran maksimum file log.

Tindakan yang dilakukan:
1. Truncate berkas log bloated ke ukuran 0 byte.
2. Menerapkan konfigurasi rotasi log resmi pada Docker Compose (`max-size: 10m`, `max-file: 3`).
3. Menambahkan rule alert Prometheus `DiskSpaceUsageAbove80` untuk memicu notifikasi proaktif jika kapasitas disk menyentuh 80%.

Pencegahan:
1. Larang penulisan file log mentah ke filesystem container di produksi; alirkan seluruh stdout/stderr terpusat ke collector (Owner: DevOps Team, Target: Sprint 1).
2. Terapkan konfigurasi rotasi log Docker global di `/etc/docker/daemon.json` untuk seluruh node (Owner: Infra Team, Target: Besok).
3. Buat skrip pembersih otomatis cron job untuk partisi `/var/log` dan `/var/lib/docker` (Owner: SRE Team, Target: Sprint 1).

Kapasitas penyimpanan telah kembali aman dan stabil.

— Tim Support PolisKu
```
