# Runbook lokal dan demo wawancara

## Kontrak lab

Gunakan Node.js 20, Docker Desktop Linux containers, dan autocannon global. PowerShell script INC-005 memerlukan PowerShell 7. Semua port bind ke localhost. LAB_MODE=true hanya di Compose; menjalankan server biasa tidak membuka endpoint injeksi.

Database lama dipertahankan. Seed hanya berjalan ketika volume PostgreSQL kosong; jangan menjalankan ulang seed pada database berisi data. Jangan memakai `docker compose down -v`, prune volume terjadwal, atau terminasi semua sesi database untuk reset.

`node scripts/reset.js` mengembalikan baseline **tanpa index status**, sesuai desain INC-003. `node scripts/reset.js --indexed` memilih kondisi setelah perbaikan query. Keduanya membersihkan fault runtime dan disk, memeriksa target aplikasi Prometheus, serta memverifikasi baca polis dan persistensi klaim uji. Hanya klaim smoke milik reset dihapus; data lain dan data load test dipertahankan. Reset bukan restore data atau backup.

## Siklus investigasi

1. Catat timestamp, commit, kondisi index, ukuran tabel, dan hipotesis awal sebelum injeksi. Screenshot normal harus menampilkan data.

2. Jalankan satu skrip `scripts/inject-incident-N.ps1` atau `bash scripts/inject-incident-N.sh`.

3. Catat fakta dari dashboard/alert terlebih dahulu. Bedakan penyebab yang masih diduga dari penyebab yang sudah dibuktikan. Catat alternatif: DB mati, antrean pool, query lambat, CPU, dependency.

4. Simpan perintah dan output mentah. Kirim **draft komunikasi simulasi** awal, update, resolusi; jangan menyatakan pesan benar-benar dikirim.

5. Jalankan mitigasi minimum. Periksa endpoint bisnis dan status data, bukan hanya health. Reset sebelum pindah insiden.

## Diagnosis dan mitigasi

| Insiden | Diagnosis | Mitigasi dan batas pembuktian |
|---|---|---|
| Pool | `/simulations/stats`, `pg_stat_activity`, request 503, alert error | POST `/simulations/release-leaks`; idle pada PostgreSQL sendiri tidak membuktikan leak, cocokkan dengan checkout aplikasi |
| Memory | `/simulations/stats`, heap/RSS, snapshot SIGUSR2, retainer | POST `/simulations/clear-memory-leak`; referensi kosong tidak menjamin RSS langsung turun; jangan menyimpulkan GC penyebab latensi tanpa pengujian setara |
| Query | `EXPLAIN (ANALYZE, BUFFERS)` sebelum/sesudah dan autocannon dengan konfigurasi sama | `CREATE INDEX CONCURRENTLY idx_claims_status_filed_at ON claims(status,filed_at DESC)`; index tidak dimasukkan ke migrasi baseline |
| Disk | `/simulations/disk-stats`, `df -h /incident-disk`, `du -sh /incident-disk/audit-debug.log` | POST `/simulations/clean-disk`; filesystem tmpfs khusus 32 MiB, tidak menyimulasikan kegagalan WAL PostgreSQL |
| Downstream | durasi, outcome partner, in-flight dan disconnect counter | `?withTimeout=true&timeoutMs=2000` menghasilkan 504; tidak menerima atau mengantrekan klaim; mock partner masih dalam proses yang sama |

Untuk disk: injeksi standar 28 MiB menunjukkan >80% lalu tunggu sampai alert firing (biasanya 65–90 detik; polling maksimal 150 detik). Tambahkan 8 MiB untuk membuktikan ENOSPC/507, kemudian bersihkan. Injeksi ditolak jika filesystem lebih besar dari 64 MiB; jangan mengarahkannya ke disk host.

## Pengujian lengkap

```sh
npm --prefix app ci
npm --prefix app test
node scripts/verify-lab.js
node loadtest/autocannon-traffic.js --level all
node scripts/reset.js
```

`verify-lab.js` membutuhkan beberapa menit karena memeriksa alert dengan durasi sesungguhnya. Output bertimestamp disimpan di `docs/evidence/revalidation/`. Jangan menjalankan load test atau injeksi lain bersamaan. Benchmark menambah klaim; jumlah baris berikutnya akan berubah. ID acak mengasumsikan seed polis 1–200000 masih utuh.

## Demo 3–5 menit

Tampilkan diagram dan baseline (30 detik), injeksi pool atau query (45 detik), jelaskan dua hipotesis dan bukti pembeda (60 detik), mitigasi dan verifikasi transaksi (60 detik), lalu satu draft pesan stakeholder dan action item (30 detik). Untuk alert satu menit, siapkan trafik sebelum mulai rekaman dan tampilkan timestamp. Nyatakan seluruh kejadian adalah simulasi.

## Sebelum cloud

Selesaikan bukti lokal dan validasi README dari clone baru. Setelah itu pindahkan versi commit yang sama ke VM dan ulangi satu atau dua insiden. Gunakan SSH tunnel untuk port 3000/3001/9090, jangan membuka endpoint injeksi atau Grafana ke internet. Panduan cloud pribadi belum menjadi bukti deployment. Host CPU/disk Windows tidak diukur oleh gauge disk tmpfs atau metrik CPU proses Node.

## Pengujian alert sintetis

```sh
docker compose cp infra/prometheus/alert.tests.yml prometheus:/tmp/alert.tests.yml
docker compose exec -T prometheus promtool check rules /etc/prometheus/alert.rules.yml
docker compose exec -T prometheus promtool test rules /tmp/alert.tests.yml
```

Kasus normal tidak boleh memicu alert. Kasus disk 93,75%, heap 90% limit, dan target down harus firing setelah durasi rule terpenuhi. Ini menguji evaluasi rule; bukan bukti bahwa insiden host pernah terjadi.

Sesudah reset, alert berbasis rate dapat tetap firing sementara karena jendela historis dua menit. Bedakan waktu pemulihan transaksi dengan waktu alert resolved; jangan menghapus data Prometheus untuk membuat tampilan terlihat sehat.
