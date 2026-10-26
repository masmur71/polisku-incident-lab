# Perbandingan Performa Sebelum vs Sesudah Indexing — INC-003

## Ringkasan Eksekutif
Insiden **INC-003 (Slow Query)** berhasil didiagnosis dan diatasi melalui pembuatan composite index `idx_claims_status_filed_at ON claims (status, filed_at DESC)`.

Pengujian dilakukan menggunakan beban identik: **40 koneksi konkuren, 5 pipelining, selama 15 detik** terhadap endpoint `GET /claims?status=PENDING` pada database PostgreSQL dengan **429.191 baris data klaim**.

---

## 1. Perbandingan Metrik HTTP (Autocannon)

| Metrik Performa | SEBELUM Indexing (Insiden) | SESUDAH Indexing (Resolusi) | Delta / Peningkatan |
|---|---|---|---|
| **Rata-rata Latensi (Avg)** | **1.926,47 ms** (~1,9 detik) | **369,83 ms** | **Turun 80,8% (5,2x lebih cepat)** |
| **Median Latensi (p50)** | **1.967,00 ms** | **360,00 ms** | **Turun 81,7% (5,5x lebih cepat)** |
| **Latensi Persentil 97.5%** | **2.266,00 ms** | **450,00 ms** | **Turun 80,1%** |
| **Latensi Persentil 99% (p99)** | **2.460,00 ms** (~2,5 detik) | **567,00 ms** | **Turun 77,0% (4,3x lebih cepat)** |
| **Latensi Maksimum** | **2.590,00 ms** | **1.005,00 ms** | **Turun 61,2%** |
| **Throughput (Req/Sec)** | **97,87 req/s** | **534,40 req/s** | **Naik +446% (5,5x lebih tinggi)** |
| **Total Request Berhasil (15s)**| **2.000 requests** | **8.000 requests** | **+300% kapasitas pemrosesan** |
| **Volume Data Terlayani** | 27 MB | 148 MB | 5,5x volume data |

---

## 2. Perbandingan Eksekusi Database (EXPLAIN ANALYZE)

```sql
-- Query yang Diuji:
SELECT id, policy_id, claim_type, description, amount, status, filed_at, resolved_at 
FROM claims 
WHERE status = 'PENDING' 
ORDER BY filed_at DESC 
LIMIT 100;
```

### Sebelum Indexing (Sequential Scan Masal):
```text
Limit  (cost=12475.29..12486.96 rows=100 width=86) (actual time=57.452..64.745 rows=100 loops=1)
  -> Gather Merge  (cost=12475.29..32994.19 rows=175864 width=86) (actual time=57.450..64.734 rows=100 loops=1)
       Workers Planned: 2
       Workers Launched: 2
       -> Sort  (cost=11475.27..11695.10 rows=87932 width=86)
            Sort Key: filed_at DESC
            -> Parallel Seq Scan on claims  (cost=0.00..8114.57 rows=87932 width=86)
                 Filter: ((status)::text = 'PENDING'::text)
                 Rows Removed by Filter: 66667
Planning Time: 1.759 ms
Execution Time: 65.133 ms - 118.829 ms
```

### Sesudah Indexing (Direct Index Scan):
```text
Limit  (cost=0.42..13.01 rows=100 width=86) (actual time=0.151..0.252 rows=100 loops=1)
  -> Index Scan using idx_claims_status_filed_at on claims  (cost=0.42..27108.67 rows=215354 width=86) (actual time=0.149..0.241 rows=100 loops=1)
       Index Cond: ((status)::text = 'PENDING'::text)
Planning Time: 3.158 ms
Execution Time: 0.349 ms
```

### Analisis Database Engineer:
1. **Perubahan Metode Pemindaian:** Dari `Parallel Seq Scan` (membaca seluruh 429.191 tuple dari disk/buffer dan membuang 66.667 baris) menjadi `Index Scan` (langsung melompat ke 100 baris terbaru berstatus `PENDING` pada B-Tree index).
2. **Execution Time:** Drop dari **118,8 ms** menjadi **0,35 ms** (**340x lebih cepat**).
3. **Efek Pool Connection:** Sebelum indexing, setiap request menahan 1 koneksi database selama 120 ms. Dengan pool hanya berkapasitas 10 koneksi, batas throughput fisik adalah 83 req/s. Sesudah indexing, koneksi hanya dipakai selama 0,35 ms, sehingga 10 koneksi sanggup melayani lebih dari 1.000 req/s tanpa antrean!
