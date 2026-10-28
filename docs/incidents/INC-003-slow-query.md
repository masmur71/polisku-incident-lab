# INC-003: Slow query dan composite index

- **Jenis:** simulasi lokal, bukan insiden nasabah nyata.
- **Severity:** P2 degradasi performa.
- **Run:** 2026-10-28T09-26-51-924Z. Timestamp artefak UTC; WIB = UTC+7.
- **Status:** direproduksi dan diverifikasi. Identitas HEAD dan working tree tersedia di summary.json.

## Dampak yang teramati

Query dan benchmark dengan 20 koneksi, pipelining 1, durasi 10 detik diukur sebelum dan sesudah index.

## Hipotesis dan diagnosis

Filter status dan ORDER BY filed_at DESC tanpa composite index memerlukan scan/sort. Bandingkan plan dengan beban dan ukuran pool tetap.

Hipotesis pembanding: database mati, pool habis, query tidak efisien, alokasi memori biasa, atau partner lambat. Pilih berdasarkan gejala insiden dan cocokkan statistik runtime dengan hasil CLI. Hipotesis di laporan ini direkonstruksi saat review, bukan catatan bertimestamp sebelum injeksi. Run berikutnya harus mencatat prediksi sebelum injeksi sesuai [runbook](../runbook.md).

## Hasil kuantitatif run terbaru

EXPLAIN/BUFFERS: 77,962 ms sebelum index menjadi 0,199 ms sesudah index. Pada benchmark HTTP 20 koneksi, throughput 92 menjadi 376,6 req/s dan mean latency 215,88 menjadi 52,56 ms, tanpa error. Gunakan output benchmark JSON untuk detail; query execution time tidak sama dengan latency HTTP atau waktu tunggu pool.

## Root cause dan recovery

Filter status dan ORDER BY filed_at DESC tanpa composite index memerlukan scan/sort. Bandingkan plan dengan beban dan ukuran pool tetap.

Mitigasi: `CREATE INDEX CONCURRENTLY idx_claims_status_filed_at ON claims(status,filed_at DESC)`. Jalankan reset sebelum pindah skenario. Reset akhir memverifikasi health, baca polis, persistensi klaim uji dan pembersihan klaim uji, state fault kosong, serta target aplikasi Prometheus UP. Data lama dipertahankan. Reset default memilih baseline tanpa index; `--indexed` memilih kondisi query sesudah perbaikan.

## Bukti

- [INC-003-before-plan.txt](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-003-before-plan.txt)
- [INC-003-after-plan.txt](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-003-after-plan.txt)
- [INC-003-before-load.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-003-before-load.json)
- [INC-003-after-load.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-003-after-load.json)
- [summary.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/summary.json)
- [reset.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/reset.json)

## Pencegahan dan batas pembuktian

| Tindakan | Owner latihan | Status |
|---|---|---|
| Mode lab eksplisit, port localhost, deadline dan batas sumber daya | Pemilik repo | Diimplementasikan dan diuji lokal |
| Reproduksi dan verifikasi transaksi setelah recovery | Pemilik repo | Lulus verify-lab.js |
| Host exporter, notifikasi eksternal dan cloud | Pemilik repo | Belum dilakukan |

Plan historis yang tersimpan mencatat 101,697 ms menjadi 0,247 ms; angka 118,829/0,349 ms pada ringkasan lama tidak memiliki pasangan plan mentah. Index sengaja tidak dimasukkan ke migrasi baseline.

Artefak 26 Oktober dipertahankan sebagai sejarah. Ringkasan interpretatif di berkas benchmark lama bukan output mentah. Run terbaru di atas menjadi acuan verifikasi saat ini. Tidak ada klaim OOM, socket exhaustion, atau gangguan nasabah jika tidak dibuktikan.

## Komunikasi dan pelajaran

[Draft awal/update/resolusi](../evidence/INC-003/communications.md). Tidak ada pesan yang dikirim ke Slack/email. Bedakan dampak teramati, hipotesis, risiko, dan rencana pencegahan.
