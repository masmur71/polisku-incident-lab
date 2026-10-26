# INC-001: Connection Pool Exhaustion pada Layanan PolisKu
- **Severity:** P1 (Critical - Outage)
- **Waktu mulai / terdeteksi / selesai:** 2026-10-26 12:18:40 WIB / 2026-10-26 12:19:11 WIB / 2026-10-26 12:34:00 WIB
- **Durasi dampak:** 15 menit 20 detik
- **Dampak ke pengguna:** Seluruh permintaan API PolisKu (`GET /health`, `GET /policies/:id`, `POST /claims`) gagal dengan HTTP 500/503 dan mengalami timeout ~5 detik. Nasabah dan agen asuransi tidak dapat mengakses data polis atau memproses klaim baru. Tingkat kegagalan request mencapai 100% pada saat beban puncak insiden.

---

## 1. Ringkasan
Pada pukul 12:18 WIB, terjadi lonjakan latensi ekstrem (>5.100 ms) dan kegagalan masal request HTTP ke API PolisKu. Health check container gagal (`Database unreachable`) dan Prometheus memicu alert `HighErrorRate` dengan nilai error rate 98.55%. Investigasi melalui diagnosis database PostgreSQL (`pg_stat_activity`) dan log aplikasi menemukan bahwa seluruh 10 slot koneksi yang dialokasikan oleh Node.js connection pool (`pg.Pool`) tertahan (unreleased client checkout), menyebabkan antrean request baru macet total hingga menabrak `connectionTimeoutMillis` (5.000 ms). Sistem dipulihkan melalui pelepasan koneksi dan eksekusi skrip pemulihan `scripts/reset.ps1`.

---

## 2. Timeline

| Waktu (WIB) | Aktivitas / Peristiwa |
|---|---|
| **12:18:40** | Terjadi lonjakan checkout koneksi database tanpa pelepasan (`unreleased client checkout`) menghabiskan 10 slot pool maksimum. |
| **12:18:46** | Trafik beban masuk ke API. Seluruh request yang membutuhkan database terblokir dan masuk antrean `waitingCount`. |
| **12:18:51** | Request pertama mulai menabrak timeout batas 5.000 ms (`PG_CONN_TIMEOUT`). Aplikasi memuntahkan error log `timeout exceeded when trying to connect`. |
| **12:19:11** | Prometheus alert rule **`HighErrorRate`** aktif (state: *firing*, error rate 98.55%). |
| **12:19:15** | Engineer on-call menerima notifikasi alert, memulai investigasi CLI ke container PostgreSQL dan Express. |
| **12:19:16** | Eksekusi `SELECT pid, state, query ... FROM pg_stat_activity` mengonfirmasi 10 koneksi dari host aplikasi (`172.19.0.5`) tertahan dalam status `idle`. |
| **12:19:20** | Log container `polisku-app-1` mengonfirmasi puluhan baris `Health check failed` dengan stack trace `Error: timeout exceeded when trying to connect`. |
| **12:26:00** | Pesan Update dikirimkan ke stakeholder bahwa akar masalah telah diidentifikasi dan perbaikan sedang dieksekusi. |
| **12:33:30** | Pengambilan artefak bukti investigasi lengkap ke `docs/evidence/INC-001/`. |
| **12:34:00** | Pemulihan dieksekusi via `scripts/reset.ps1`: terminasi koneksi gantung, restart container aplikasi, verifikasi health check HTTP 200, dan verifikasi Prometheus target `UP`. |
| **12:35:00** | Pesan Resolusi dikirimkan ke stakeholder; layanan dinyatakan pulih normal 100%. |

---

## 3. Gejala dan Cara Deteksi

### Gejala yang Teramati
1. **Latensi Melonjak Drastis:** Rata-rata latensi melonjak dari **11 ms** (baseline normal) menjadi **5.121 ms** (lonjakan 460x).
2. **Kegagalan Total Request:** Hasil pengujian beban `autocannon` mencatat **0 responses 2xx** dan **200 responses non-2xx (HTTP 503)** dari total 300 request dalam 15 detik.
3. **Health Check Down:** Panggilan ke `GET /health` merespons status `503 Service Unavailable` dengan payload:
   ```json
   {"status":"error","message":"Database unreachable"}
   ```

### Cara Deteksi
- **Prometheus Alert:** Alert `HighErrorRate` (severity: *critical*) aktif di Prometheus dashboard (`http://localhost:9090/alerts`) dengan nilai 98.55%.
- **Grafana Metrik:** Metrik `polisku_pg_pool_idle_connections` drop ke angka **0**, sedangkan `polisku_pg_pool_total_connections` berada pada batas maksimal **10**.

---

## 4. Investigasi (Langkah, Perintah, Temuan)

### Langkah 1: Memeriksa Aktivitas Koneksi di PostgreSQL
Dijalankan perintah psql di dalam container PostgreSQL:
```bash
docker exec polisku-postgres-1 psql -U postgres -d poliskudb -c \
  "SELECT pid, usename, client_addr, state, query, age(clock_timestamp(), query_start) as query_age, age(clock_timestamp(), state_change) as state_age FROM pg_stat_activity WHERE datname = 'poliskudb';"
```
**Temuan CLI ([02-pg_stat_activity.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-001/02-pg_stat_activity.txt)):**
Terdapat tepat 10 koneksi dari IP aplikasi (`172.19.0.5`) yang berstatus `idle` dengan `state_age` lebih dari 28 detik. Tidak ada koneksi yang dilepaskan kembali ke pool.

### Langkah 2: Memeriksa Log Aplikasi Node.js
Dijalankan pemeriksaan log error di container aplikasi:
```bash
docker logs --tail 40 polisku-app-1
```
**Temuan Log ([03-app-timeout-errors.log](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-001/03-app-timeout-errors.log)):**
Muncul puluhan entri log level `50` (error) dengan pesan:
```json
{"level":50,"time":1792991949608,"err":{"type":"Error","message":"timeout exceeded when trying to connect","stack":"Error: timeout exceeded when trying to connect\n    at /app/node_modules/pg-pool/index.js:45:11..."},"msg":"Health check failed"}
```

### Langkah 3: Memeriksa Metrik Prometheus
Dijalankan pemeriksaan langsung metrik aplikasi:
```bash
curl.exe -s http://localhost:3000/metrics | findstr "polisku_pg_pool"
```
**Temuan Metrik ([04-prometheus-metrics-pool.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-001/04-prometheus-metrics-pool.txt)):**
```text
polisku_pg_pool_total_connections 10
polisku_pg_pool_idle_connections 0
polisku_pg_pool_waiting_connections 0
```
Pool dalam keadaan *fully exhausted* (10 total, 0 idle).

---

## 5. Root Cause
Aplikasi mengonfigurasi batas pool PostgreSQL sebesar `PG_POOL_MAX=10` dan timeout perolehan koneksi `PG_CONN_TIMEOUT=5000ms`. Terjadi kegagalan pelepasan objek koneksi (`client.release()`) setelah `pool.connect()` diakuisisi (akibat unhandled exception atau ketiadaan blok `try...finally`). 

Setelah seluruh 10 koneksi terpakai dan tidak dikembalikan, request baru apa pun yang membutuhkan koneksi database (termasuk health check berkala) terpaksa mengantre di `waitingCount`. Setelah 5 detik antre tanpa ada koneksi yang bebas, pustaka `pg-pool` melempar `Error: timeout exceeded when trying to connect`, menghasilkan respons HTTP 500 / 503 ke klien.

---

## 6. Resolusi dan Recovery

### Tindakan Pemulihan (Immediate Mitigation)
1. Memutus koneksi gantung di database PostgreSQL dengan query:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
   WHERE datname = 'poliskudb' AND pid <> pg_backend_pid();
   ```
2. Me-restart container `polisku-app-1` untuk me-reset state pool aplikasi:
   ```bash
   docker restart polisku-app-1
   ```
3. Alternatif dynamic release via endpoint simulasi:
   `POST /simulations/release-leaks` melepaskan seluruh klien tertahan tanpa restart.
4. Verifikasi sistem:
   - `GET /health` merespons `HTTP 200 OK` (`{"status":"ok"}`).
   - Latensi p50 kembali normal ke **11 ms** dengan 0% error.

---

## 7. Pencegahan (Action Items)

| No | Tindakan Pencegahan | Kategori | Owner | Target Waktu |
|---|---|---|---|---|
| 1 | Wajibkan penggunaan `pool.query(...)` langsung untuk operasi tunggal, atau bungkus pemanggilan `pool.connect()` dengan `try { ... } finally { client.release(); }`. | Code Quality | App Team | Hari ini (Selesai) |
| 2 | Tambahkan alert rule Prometheus baru `PostgresPoolExhausted` jika `polisku_pg_pool_idle_connections == 0` selama > 1 menit. | Monitoring | SRE Team | Sprint 1 |
| 3 | Evaluasi peningkatan kapasitas pool (`PG_POOL_MAX` dinaikkan dari 10 ke 20-25) disesuaikan dengan `max_connections` PostgreSQL dan spesifikasi memori VM. | Kapasitas | DevOps Team | Sprint 1 |
| 4 | Turunkan `PG_CONN_TIMEOUT` dari 5000ms ke 2000ms agar aplikasi fail-fast daripada menahan request klien terlalu lama. | Resilience | App Team | Sprint 1 |

---

## 8. Komunikasi ke Stakeholder
Dokumentasi lengkap pesan komunikasi (Awal, Update, Resolusi) tercatat di [communications.md](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-001/communications.md).

---

## 9. Pelajaran (Key Takeaways)
1. **Pentingnya Metrik Koneksi Database:** Tanpa metrik `polisku_pg_pool_idle_connections` dan `waitingCount`, diagnosis akan jauh lebih lama karena engineer bisa salah menduga bahwa database PostgreSQL sedang crash atau kehabisan CPU/RAM.
2. **Blok `finally` adalah Kewajiban:** Pada arsitektur Node.js dengan database relational, kebocoran koneksi (connection leak) adalah salah satu jenis outage paling mematikan karena efeknya instan dan melumpuhkan seluruh endpoint.
3. **Fail-fast Lebih Baik Daripada Hanging:** Menunggu 5 detik per request sebelum timeout menyebabkan penumpukan antrean koneksi di gateway dan membuat pengalaman pengguna terasa sangat buruk (seolah-olah aplikasi mati suri).
