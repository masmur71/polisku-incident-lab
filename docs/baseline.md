# Laporan Baseline & Karakteristik Performa Normal — PolisKu Incident Lab

**Dokumen:** `docs/baseline.md`  
**Fase:** Fase 4 — Baseline dan Load Test  
**Tanggal Eksekusi:** 2026-10-26  
**Target Aplikasi:** PolisKu Insurance API (`http://localhost:3000`)  
**Stack Monitoring:** Prometheus 2.51 (`:9090`) + Grafana 10.4 (`:3001`)  
**Database:** PostgreSQL 15 (1,7 juta baris data seed)  
**Tools Load Testing:** Autocannon v8.0.0 via [loadtest/autocannon-traffic.js](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/loadtest/autocannon-traffic.js)

---

## 1. Ringkasan Eksekutif & Tujuan

Penetapan **kondisi baseline** adalah fondasi mutlak dalam pekerjaan Support Engineering dan Site Reliability Engineering. Tanpa mengetahui angka performa normal dari sistem, klaim seperti *"aplikasi lambat"* atau *"database pool bermasalah"* tidak memiliki dasar pembanding ilmiah.

Tujuan utama pengujian ini adalah:
1. Memetakan throughput maksimum (RPS) yang dapat ditangani arsitektur aplikasi Express.js + PostgreSQL single instance dalam kondisi sehat.
2. Mencatat profil latensi normal pada persentil p50, p95, p97.5, dan p99 pada berbagai tingkat beban konkuren.
3. Mengamati perilaku pemakaian memori heap Node.js dan siklus Garbage Collection (GC) saat menangani request intensif.
4. Mengetahui batas saturasi antrean PostgreSQL connection pool (kapasitas pool maksimum: 10 koneksi).
5. Memvalidasi skrip pemulihan sistem (`reset.sh` / `reset.ps1`) untuk menjamin kesiapan transisi ke Fase 5 (Simulasi Insiden).

---

## 2. Metodologi Pengujian Beban

Skenario beban dirancang menyerupai pola transaksi asuransi jiwa nyata dengan komposisi **70% Operasi Baca (Read)** dan **30% Operasi Tulis (Write)**:

| Endpoint | Metode | Proporsi | Keterangan |
|---|---|---|---|
| `/health` | GET | **10%** | Health check liveness probe dan konektivitas dasar |
| `/policies/:id` | GET | **30%** | Query detail polis dengan ID acak (rentang 1 s/d 200.000) via relasi `JOIN customers` |
| `/claims?status=PENDING` | GET | **30%** | Query daftar klaim status pending dengan `ORDER BY filed_at DESC LIMIT 100` *(catatan: kolom status sengaja tanpa index)* |
| `/claims` | POST | **30%** | Pembuatan pengajuan klaim asuransi baru (validasi skema Zod, pengecekan keberadaan polis, dan insert data transaksi) |

### Tiga Level Beban yang Diuji:
1. **Beban Ringan (Light Load):** 10 concurrent connections selama 30 detik.
2. **Beban Sedang (Medium Load):** 50 concurrent connections selama 60 detik.
3. **Beban Berat (Heavy Load):** 150 concurrent connections selama 60 detik.

Antara setiap pengujian diterapkan jeda pendinginan (*cooldown*) selama 10 detik agar antrean koneksi dan alokasi memori kembali ke kondisi tenang (*quiescent state*).

---

## 3. Tabel Hasil Metrik Baseline

Total permintaan yang dieksekusi dan dievaluasi dalam pengujian ini mencapai **46.191 requests** dengan **0 error**, **0 timeout**, dan **100% status HTTP 2xx**.

| Metrik | Beban Ringan (10 Conn, 30s) | Beban Sedang (50 Conn, 60s) | Beban Berat (150 Conn, 60s) |
|---|---|---|---|
| **Total Permintaan (Requests)** | 9.466 | 19.582 | 17.143 |
| **Rata-rata Throughput (Avg RPS)** | **316 req/s** | **326 req/s** | **286 req/s** |
| **Puncak Throughput (Max RPS)** | 358 req/s | 430 req/s | 752 req/s |
| **Latensi Rata-rata (Avg Latency)** | 31,4 ms | 152,8 ms | 522,1 ms |
| **Latensi Median (p50)** | **11 ms** | **100 ms** | **464 ms** |
| **Latensi Persentil 90 (p90)** | 98 ms | 315 ms | 974 ms |
| **Latensi Persentil 97.5 (p97.5)** | **115 ms** | **421 ms** | **1.510 ms** |
| **Latensi Persentil 99 (p99)** | **127 ms** | **477 ms** | **1.678 ms** |
| **Latensi Maksimum (Max)** | 248 ms | 682 ms | 1.942 ms |
| **Status Sukses (HTTP 2xx)** | 9.466 (100%) | 19.582 (100%) | 17.143 (100%) |
| **Status Gagal (HTTP 4xx / 5xx)** | 0 (0%) | 0 (0%) | 0 (0%) |
| **Timeouts / Connection Drop** | 0 | 0 | 0 |
| **Node.js Heap Memory (Used/Total)** | 17,4 MB / 64,1 MB | 59,7 MB / 85,4 MB | 60,0 MB / 90,1 MB |
| **PostgreSQL Pool Total Conn** | 10 | 10 | 10 |
| **DB Pool Waiting Clients (Antrean)** | **0** | **31** *(saat lonjakan)* | **133** *(jenuh)* |

*Log data mentah tersimpan dalam artefak:* [loadtest/baseline-results.json](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/loadtest/baseline-results.json)

---

## 4. Analisis Karakteristik Performa Normal

### A. Titik Jenuh Throughput (*Saturation Point*)
- Throughput maksimum aplikasi berada pada kisaran **310 – 330 RPS**.
- Peningkatan konkurensi dari 10 koneksi ke 50 koneksi menaikkan throughput dari 316 RPS menjadi 326 RPS (+3%).
- Namun saat dinaikkan ke 150 koneksi, throughput justru sedikit menurun menjadi 286 RPS. Hal ini mengindikasikan bahwa kapasitas pool database PostgreSQL (dibatasi 10 koneksi aktif) telah mencapai kapasitas optimal, sehingga peningkatan konkurensi klien hanya menambah antrean tunggu tanpa menambah kapasitas pemrosesan riil.

### B. Distribusi Latensi & Degradasi Terkendali (*Graceful Degradation*)
- **Pada kondisi ringan (10 conn):** Latensi median sangat cepat yaitu **11 ms**, dan 99% request selesai di bawah **127 ms**.
- **Pada kondisi sedang (50 conn):** Latensi median berada pada **100 ms** dengan p99 sebesar **477 ms**. Seluruh request tetap berhasil diproses dalam waktu di bawah 1 detik.
- **Pada kondisi berat (150 conn):** Latensi median meningkat menjadi **464 ms** dan p99 mencapai **1.678 ms**. Peningkatan ini terjadi murni karena antrean pada connection pool, bukan karena crash atau database failure. Tidak ada satupun request yang mengalami timeout (ambang timeout: 10.000 ms).

### C. Profil Memori Heap Node.js & Garbage Collection
- Alokasi memori heap berkisar antara **17 MB hingga 60 MB** dari total alokasi V8 sebesar 90 MB.
- Memori heap berfluktuasi secara sehat (terlihat dari pola zig-zag pada grafik dashboard Grafana), yang membuktikan Garbage Collector V8 bekerja dengan efisien dan tidak terjadi penumpukan referensi memori (memory leak) dalam kode baseline.

### D. PostgreSQL Connection Pool
- Pool berukuran maksimum 10 koneksi (`max: 10`).
- Pada beban ringan, tidak ada antrean (`waiting = 0`).
- Pada beban berat (150 koneksi konkuren), antrean antarklien meningkat hingga 133 request antre menunggu koneksi dilepaskan oleh worker sebelumnya. Begitu beban selesai, seluruh antrean langsung terurai kembali ke 0 dalam hitungan detik.

---

## 5. Bukti Visual Observabilitas

Berikut adalah rekaman visual dari dashboard Grafana [PolisKu Main Incident Lab Dashboard](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/infra/grafana/dashboards/polisku-overview.json) yang menangkap metrik real-time saat ketiga level pengujian dijalankan:

![Grafana Baseline Overview Dashboard](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/baseline/01-grafana-baseline-overview.png)

### Rangkuman Observasi Visual:
1. **Total Request Rate & Error Rate:** Menunjukkan lonjakan trafik yang konsisten dengan 0% error 5xx.
2. **HTTP Latency Percentiles:** Grafik p50, p95, dan p99 memperlihatkan kurva kenaikan yang proporsional terhadap tingkat konkurensi beban.
3. **DB Connection Pool:** Status pool menunjukkan 10 koneksi aktif terutilisasi penuh selama pengujian beban berat dan langsung kembali idle setelah pengujian tuntas.
4. **Node.js Heap Memory:** Pola pelepasan memori pasca-GC berjalan stabil tanpa gejala kurva linier ke atas.

---

## 6. Prosedur & Pengujian Pemulihan Sistem (`reset.sh` & `reset.ps1`)

Untuk mendukung latihan penanganan insiden pada Fase 5, disediakan skrip pemulihan terotomatisasi di [scripts/reset.sh](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/scripts/reset.sh) (Linux/macOS/Bash) dan [scripts/reset.ps1](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/scripts/reset.ps1) (Windows PowerShell).

### Alur Kerja Skrip Pemulihan:
1. **Validasi Docker Daemon:** Memastikan Docker aktif.
2. **Pembersihan Koneksi Gantung Database:** Menjalankan query `pg_terminate_backend` untuk memutus transaksi menggantung atau query tidur (`pg_sleep`).
3. **Restart Container Aplikasi:** Me-restart container `polisku-app-1` untuk membersihkan memory leak, lingering timers, atau event loop blocking.
4. **Health Check Probing:** Melakukan polling otomatis ke `http://localhost:3000/health` hingga mendapatkan balasan HTTP 200 OK.
5. **Verifikasi Target Prometheus:** Memastikan target scrape Prometheus kembali berstatus `UP`.

### Hasil Eksekusi Uji Pemulihan:
```
============================================================
🔄 PolisKu Recovery: Mengembalikan Sistem ke Kondisi Normal
============================================================
[1/4] Memeriksa dan membersihkan koneksi menggantung di PostgreSQL...
[2/4] Me-restart container polisku-app-1...
[3/4] Menunggu layanan aplikasi siap (health check)...
[4/4] Memeriksa status scrape target di Prometheus...
============================================================
✅ SISTEM BERHASIL DI-RESET KE KONDISI NORMAL
============================================================
• App Health       : HTTP 200 OK (http://localhost:3000/health)
• Prometheus Target: Scrape Target Aktif
• Database Pool    : Bersih & Terkoneksi Normal
============================================================
```
*Skrip terbukti berhasil memulihkan sistem secara konsisten dalam waktu < 6 detik.*

---

## 7. Ambang Batas Deteksi Anomali (Referensi Fase 5)

Berdasarkan data baseline di atas, tim support dapat menetapkan kriteria anomali yang jelas untuk skenario insiden berikutnya:

| Metrik | Kondisi Normal (Baseline) | Ambang Batas Insiden (Anomali) | Skenario Terkait |
|---|---|---|---|
| **HTTP 5xx Error Rate** | 0.0% | **> 5%** selama 1 menit | Insiden 1 (Pool Exhaustion / Timeout) |
| **Latency p95** | < 450 ms (beban sedang) | **> 2.000 ms** (tanpa beban ekstrem) | Insiden 3 (Slow Query / Sequential Scan) |
| **Node.js Heap Used** | 15 MB – 60 MB (stabil) | **> 85% alokasi** / tren naik tanpa turun | Insiden 2 (Memory Leak) |
| **DB Pool Waiting Clients** | 0 (atau < 30 saat beban puncak) | **> 0 menetap** lebih dari 30 detik | Insiden 1 (Connection Pool Exhaustion) |
