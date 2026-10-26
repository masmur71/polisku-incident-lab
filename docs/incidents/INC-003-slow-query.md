# INC-003: Degradasi Latensi Ekstrem Akibat Ketiadaan Index (Slow Query pada Modul Klaim)
- **Severity:** P2 (Major - Performance Degradation)
- **Waktu mulai / terdeteksi / selesai:** 2026-10-26 12:38:50 WIB / 2026-10-26 12:39:10 WIB / 2026-10-26 12:40:30 WIB
- **Durasi dampak:** 1 menit 40 detik
- **Dampak ke pengguna:** Pengguna yang mengakses filter klaim (`GET /claims?status=PENDING`) mengalami respons sangat lambat dengan rata-rata latensi mencapai **1.926 ms (~1,9 detik)** dan latensi persentil 99 mencapai **2.460 ms (~2,5 detik)**. Kapasitas throughput sistem anjlok hingga hanya 97 req/s karena antrean koneksi database menumpuk.

---

## 1. Ringkasan
Pada pukul 12:38 WIB, modul klaim PolisKu mengalami lonjakan latensi tajam saat melayani request filter klaim berdasarkan status. Investigasi CLI menggunakan `EXPLAIN ANALYZE` membuktikan bahwa ketiadaan indeks pada kolom `claims.status` dan urutan `filed_at DESC` memaksa PostgreSQL melakukan `Parallel Seq Scan` terhadap seluruh 429.191 baris data di tabel `claims`. Setiap query mengonsumsi waktu eksekusi database 65–118 ms, yang di bawah beban 40 klien konkuren langsung menghabiskan 10 koneksi pool aplikasi. Masalah berhasil diselesaikan secara zero-downtime dengan membuat composite index `CREATE INDEX CONCURRENTLY idx_claims_status_filed_at ON claims (status, filed_at DESC)`. Waktu eksekusi query database langsung drop dari 118,8 ms menjadi **0,35 ms (340x lebih cepat)** dan throughput API melonjak **5,5x lebih tinggi**.

---

## 2. Timeline

| Waktu (WIB) | Aktivitas / Peristiwa |
|---|---|
| **12:38:50** | Diberikan beban 40 koneksi konkuren ke endpoint `GET /claims?status=PENDING` pada database berisi 429.191 baris. |
| **12:39:05** | Terjadi antrean penumpukan request di database pool (`waitingCount` naik); latensi p50 melonjak hingga 1.967 ms. |
| **12:39:10** | Tim Support mendeteksi anomali pada grafik latency p95/p99 Grafana; Pesan Awal insiden dikirim ke stakeholder. |
| **12:39:20** | Investigasi query database dijalankan via CLI `EXPLAIN ANALYZE`: terdeteksi `Parallel Seq Scan` dengan `cost=0.00..8114.57` dan pembacaan 429k baris. |
| **12:39:35** | Hasil benchmark beban unindexed disimpan ke `docs/evidence/INC-003/02-autocannon-unindexed-slow.txt`. |
| **12:39:50** | Solusi diterapkan secara non-blocking via `CREATE INDEX CONCURRENTLY idx_claims_status_filed_at ON claims (status, filed_at DESC)`. Index selesai dibuat dalam hitungan detik. |
| **12:39:55** | Verifikasi ulang `EXPLAIN ANALYZE`: metode pemindaian beralih ke `Index Scan` dengan execution time 0,349 ms. |
| **12:40:20** | Uji beban verifikasi pasca-indexing: latensi p50 drop menjadi 360 ms dan throughput melonjak ke 534 req/s. |
| **12:40:30** | Seluruh artefak bukti perbandingan disimpan ke `docs/evidence/INC-003/05-before-after-comparison.md`; Pesan Resolusi dikirimkan. |

---

## 3. Gejala dan Cara Deteksi

### Gejala yang Teramati
1. **Latensi Melonjak Drastis:** Rata-rata latensi mencapai **1.926,47 ms**, dengan p99 mencapai **2.460 ms**.
2. **Throughput Terhambat:** Di bawah beban 40 koneksi, sistem hanya sanggup memproses **97,87 req/s** (hanya 2.000 request selesai dalam 15 detik).
3. **Database Pool Bottleneck:** Karena setiap query query memakan waktu ~120 ms di PostgreSQL, 10 koneksi pool selalu terisi penuh, menyebabkan request baru harus mengantre.

### Cara Deteksi
- **Grafana Latency Panel:** Panel *Request Latency (p95)* menunjukkan lonjakan tajam melewati 1.500 ms khusus pada route `/claims`.
- **Ekstrak Plan Database:** Eksekusi `EXPLAIN ANALYZE` pada psql secara jelas menunjukkan `Parallel Seq Scan` pada tabel `claims`.

---

## 4. Investigasi (Langkah, Perintah, Temuan)

### Langkah 1: Memeriksa Struktur Index Tabel
Dijalankan pemeriksaan skema index pada PostgreSQL:
```bash
docker exec polisku-postgres-1 psql -U postgres -d poliskudb -c "\d claims"
```
**Temuan:**
Hanya terdapat `claims_pkey (id)` dan `idx_claims_policy_id (policy_id)`. **Kolom `status` sama sekali tidak memiliki index.**

### Langkah 2: Mengukur Rencana Eksekusi Query (EXPLAIN ANALYZE)
Dijalankan perintah explain analyze langsung ke database:
```bash
docker exec polisku-postgres-1 psql -U postgres -d poliskudb -c \
  "EXPLAIN ANALYZE SELECT id, policy_id, claim_type, description, amount, status, filed_at, resolved_at FROM claims WHERE status = 'PENDING' ORDER BY filed_at DESC LIMIT 100;"
```
**Temuan ([01-explain-analyze-before.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-003/01-explain-analyze-before.txt)):**
```text
-> Parallel Seq Scan on claims  (cost=0.00..8114.57 rows=87932 width=86) (actual time=0.028..39.610 rows=76397 loops=3)
     Filter: ((status)::text = 'PENDING'::text)
     Rows Removed by Filter: 66667
Planning Time: 1.759 ms
Execution Time: 65.133 ms - 118.829 ms
```
PostgreSQL harus membaca seluruh 429.191 baris data dan melakukan in-memory sort untuk mendapatkan 100 baris terbaru.

---

## 5. Root Cause
Query pada endpoint `GET /claims?status=PENDING` melakukan filtering berdasarkan klausa `WHERE status = $1` dan pengurutan `ORDER BY filed_at DESC LIMIT 100`. Karena kolom `status` dan `filed_at` tidak diindeks secara bersamaan, PostgreSQL tidak dapat memanfaatkan index traversal dan terpaksa melakukan Sequential Scan (full table scan) terhadap 429k baris untuk setiap request tunggal.

---

## 6. Resolusi dan Recovery

### Tindakan Pemulihan (Resolution)
Dibuat composite B-Tree index secara online tanpa me-lock tabel operasional (`CONCURRENTLY`):
```sql
CREATE INDEX CONCURRENTLY idx_claims_status_filed_at ON claims (status, filed_at DESC);
```

### Hasil Verifikasi Pasca-Resolusi
1. **Query Plan Database ([03-explain-analyze-after.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-003/03-explain-analyze-after.txt)):**
   ```text
   -> Index Scan using idx_claims_status_filed_at on claims (actual time=0.149..0.241 rows=100 loops=1)
   Planning Time: 3.158 ms
   Execution Time: 0.349 ms
   ```
   Waktu eksekusi database drop dari **118,8 ms** menjadi **0,35 ms (340x lebih cepat)**.
2. **Benchmark Beban Klien ([04-autocannon-indexed-fast.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-003/04-autocannon-indexed-fast.txt)):**
   - Rata-rata latensi HTTP turun dari **1.926 ms** menjadi **369 ms** (**turun 80,8%**).
   - Throughput melonjak dari **97,8 req/s** menjadi **534,4 req/s** (**naik 5,5x lipat**).
   - Total request selesai dalam 15s naik dari 2.000 menjadi 8.000 request dengan 0 error.

---

## 7. Pencegahan (Action Items)

| No | Tindakan Pencegahan | Kategori | Owner | Target Waktu |
|---|---|---|---|---|
| 1 | Daftarkan composite index `idx_claims_status_filed_at` ke dalam file migrasi skema database utama (`scripts/001_init.sql`). | DB Schema | App Team | Hari ini (Selesai) |
| 2 | Wajibkan pembuatan composite index untuk query yang menggabungkan klausa `WHERE` dan `ORDER BY` pada tabel yang berpotensi memiliki >100.000 baris. | Database Policy | App Team | Berlaku segera |
| 3 | Aktifkan ekstensi `pg_stat_statements` di PostgreSQL dan buat dashboard Grafana pemantau top 10 query terlama. | Monitoring | DBA Team | Sprint 1 |
| 4 | Tambahkan alert Prometheus untuk latensi p95 HTTP jika melebihi 500 ms selama 2 menit. | Monitoring | SRE Team | Sprint 1 |

---

## 8. Komunikasi ke Stakeholder
Dokumentasi pesan komunikasi (Awal, Update, Resolusi) tercatat di [communications.md](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-003/communications.md).

---

## 9. Pelajaran (Key Takeaways)
1. **Index adalah Pembeda Skala:** Query yang tampak cepat di database kecil (1.000 baris) akan menjadi bom waktu saat tabel mencapai ratusan ribu baris jika kolom filter tidak diindeks.
2. **Composite Index untuk Filter + Sort:** Mengindeks hanya `status` saja masih memerlukan in-memory sort. Mengindeks kombinasi `(status, filed_at DESC)` memungkinkan PostgreSQL melakukan *Index Scan* murni tanpa sort sama sekali.
3. **Selalu Gunakan `CONCURRENTLY` di Produksi:** Membuat index biasa pada tabel besar akan me-lock operasi DML (`INSERT`/`UPDATE`). Penggunaan keyword `CONCURRENTLY` adalah standar SRE/DBA untuk menghindari downtime.
