# INC-003: Slow query dan composite index

- **Jenis:** simulasi lokal, bukan insiden nasabah nyata.
- **Severity:** P2 degradasi performa.
- **Run:** 2026-10-28T09-26-51-924Z. Timestamp artefak UTC; WIB = UTC+7.
- **Status:** direproduksi dan diverifikasi. Identitas HEAD dan working tree tersedia di summary.json.

## Dampak yang teramati

Query dan benchmark dengan 20 koneksi, pipelining 1, durasi 10 detik diukur sebelum dan sesudah index.

## Hipotesis dan diagnosis

Plan sebelum index memakai Parallel Seq Scan, filter status dan top-N heapsort untuk ORDER BY filed_at DESC. Plan sesudah index memakai Index Scan pada idx_claims_status_filed_at; shared buffer hits turun dari 6199 menjadi 99. Ini mendukung biaya scan/sort sebagai penyebab pada query yang diuji.

Alternatif antrean pool atau overhead HTTP tidak diukur oleh EXPLAIN. Karena itu benchmark HTTP dibandingkan terpisah dengan query, 20 koneksi, pipelining 1 dan durasi 10 detik yang sama. Hasil mendukung manfaat index pada run ini; belum ada pengulangan statistik atau pengukuran dampak penulisan.

Penjelasan ini merupakan rekonstruksi dari artefak dan kode saat review, bukan catatan hipotesis sebelum injeksi. Run berikutnya perlu mencatat prediksi dan keputusan saat kejadian sesuai [runbook](../runbook.md).

## Hasil kuantitatif run terbaru

| Pengukuran | Sebelum index | Sesudah index |
|---|---|---|
| EXPLAIN execution time | 77,962 ms | 0,199 ms |
| Shared buffer hits | 6199 | 99 |
| HTTP throughput | 92 req/s | 376,6 req/s |
| Mean HTTP latency | 215,88 ms | 52,56 ms |

Benchmark HTTP: 20 koneksi, pipelining 1, 10 detik, tanpa error. Query execution time tidak sama dengan latency HTTP atau waktu tunggu pool. Angka adalah hasil lokal satu pasangan run, bukan jaminan kapasitas produksi.

## Root cause dan recovery

Baseline sengaja tidak memiliki index yang mengikuti filter status dan urutan filed_at. Composite index (status, filed_at DESC) menyediakan akses sesuai query. Index menambah penyimpanan dan biaya pemeliharaan saat write; besarnya belum diukur. CREATE INDEX CONCURRENTLY dipilih untuk pembangunan index tanpa menghalangi write seperti pembangunan biasa, tetapi tetap perlu memantau durasi dan resource.

Mitigasi: `CREATE INDEX CONCURRENTLY idx_claims_status_filed_at ON claims(status,filed_at DESC)`. Jalankan reset sebelum pindah skenario. Reset akhir memverifikasi health, baca polis, persistensi klaim uji dan pembersihan klaim uji, state fault kosong, serta target aplikasi Prometheus UP. Data lama dipertahankan. Reset default memilih baseline tanpa index; `--indexed` memilih kondisi query sesudah perbaikan.

## Bukti

[Indeks run dan waktu observasi](../evidence/revalidation/README.md). Timestamp artefak bukan waktu deteksi manusia atau MTTR.

- [INC-003-before-plan.txt](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-003-before-plan.txt)
- [INC-003-after-plan.txt](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-003-after-plan.txt)
- [INC-003-before-load.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-003-before-load.json)
- [INC-003-after-load.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-003-after-load.json)
- [summary.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/summary.json)
- [reset.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/reset.json)

## Pencegahan dan batas pembuktian

| Tindakan | Owner latihan | Status |
|---|---|---|
| Tinjau query baru terhadap filter, sort dan query plan | Pemilik repo | Rencana review; index baseline tetap sengaja absen |
| Ukur biaya index pada write dan ulangi benchmark setara | Pemilik repo | Pending; hasil saat ini satu pasangan run |

Plan historis yang tersimpan mencatat 101,697 ms menjadi 0,247 ms; angka 118,829/0,349 ms pada ringkasan lama tidak memiliki pasangan plan mentah. Index sengaja tidak dimasukkan ke migrasi baseline.

Artefak 26 Oktober dipertahankan sebagai sejarah. Ringkasan interpretatif di berkas benchmark lama bukan output mentah. Run terbaru di atas menjadi acuan verifikasi saat ini. Tidak ada klaim OOM, socket exhaustion, atau gangguan nasabah jika tidak dibuktikan.

## Komunikasi dan pelajaran

[Draft awal/update/resolusi](../evidence/INC-003/communications.md). Tidak ada pesan yang dikirim ke Slack/email. Bedakan dampak teramati, hipotesis, risiko, dan rencana pencegahan.
