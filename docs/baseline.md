# Baseline lokal — 28 Oktober 2026

Sumber angka: [JSON asli](../loadtest/baseline-results.json). Hasil ini menggantikan tabel 26 Oktober yang memiliki angka berbeda dari artefaknya. Seri acuan terdiri dari runId 2026-10-28T10:58:18.989Z (light), 10:59:29.394Z (medium), dan 11:00:39.990Z (heavy). Timestamp UTC; WIB = UTC+7. Metadata mencatat HEAD 0d1f6fc dan workingTreeDirty=true saat pengukuran, sebelum hasil di-commit.

| Profil | Koneksi / durasi | Respons | RPS rata-rata | p50 ms | p97.5 ms | p99 ms | Error / timeout / non-2xx |
|---|---|---|---|---|---|---|---|
| light | 10 / 30s | 7730 | 257.67 | 14 | 140 | 156 | 0 / 0 / 0 |
| medium | 50 / 60s | 15988 | 266.47 | 123 | 498 | 572 | 0 / 0 / 0 |
| heavy | 150 / 60s | 15668 | 261.14 | 450 | 1354 | 1679 | 0 / 0 / 0 |

Total seri: **39386 respons**, seluruhnya 2xx. [baseline-light.json](../loadtest/baseline-light.json) adalah run terpisah pada 10:55:07.405 UTC dengan 7886 respons, 262,87 RPS dan p99 149 ms; bukan salinan profil light di tabel ini. Jangan menggabungkan kedua run.

## Metode dan batas kesimpulan

Komposisi per siklus: 10% health, 30% baca polis ID acak 1–200000, 30% daftar claims PENDING, 30% POST claims ID polis acak. Callback pengacakan dipasang di setiap request autocannon. Profil dijalankan berurutan dengan cooldown 10 detik, pada baseline tanpa index status. Tidak ada p95 tepat pada JSON autocannon; gunakan p97.5 yang tersedia atau estimasi histogram Grafana yang diberi label jelas.

JSON menyimpan timestamp/runId, HEAD, dirty state, OS, CPU, RAM host, versi Node, konfigurasi profil, metrik awal, sampling per detik selama beban, dan snapshot akhir. RAM host bukan limit Docker VM; Compose menetapkan limit app 512 MiB dan heap 384 MiB. Ini satu seri run pada mesin lokal yang juga menjalankan load generator, bukan janji kapasitas produksi atau batas maksimum universal.

Counter error autocannon sudah termasuk timeout; jangan menjumlahkannya lagi. Snapshot pool/heap setelah load bukan puncak. Sampel per detik dapat melewatkan spike singkat. Jumlah data bertambah karena POST claims; reset tidak menghapusnya. Nilai p95/p99 adalah distribusi request yang selesai, bukan representasi lengkap request yang dibatalkan klien.

## Interpretasi

Bandingkan profil dengan konkurensi yang sama. Antrean pada beban berat menunjukkan saturasi; bukan otomatis bukti connection leak. Query tanpa index adalah kondisi baseline yang sengaja disediakan untuk INC-003. Sesudah perbaikan index, gunakan benchmark insiden dengan query dan konfigurasi yang cocok.

![Dashboard lokal tervalidasi](evidence/observability/05-local-dashboard-verified.png)

[Skrip recovery dan kontrak reset](runbook.md) memeriksa baca dan persistensi klaim, kondisi fault, dan target aplikasi Prometheus. Screenshot baseline lama dipertahankan sebagai sejarah dan tidak menjadi acuan angka terbaru.
