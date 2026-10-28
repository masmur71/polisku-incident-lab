# INC-001: Connection pool exhaustion

- **Jenis:** simulasi lokal, bukan insiden nasabah nyata.
- **Severity:** P1 untuk endpoint database.
- **Run:** 2026-10-28T09-26-51-924Z. Timestamp artefak UTC; WIB = UTC+7.
- **Status:** direproduksi dan diverifikasi. Identitas HEAD dan working tree tersedia di summary.json.

## Dampak yang teramati

Sepuluh koneksi lab ditahan; permintaan health gagal 503. Alert HighErrorRate live terbukti firing.

## Hipotesis dan diagnosis

Checkout simulasi tidak dilepas; PostgreSQL masih hidup. Cocokkan pg_stat_activity dengan statistik pool, karena koneksi idle sendiri bukan bukti leak.

Hipotesis pembanding: database mati, pool habis, query tidak efisien, alokasi memori biasa, atau partner lambat. Pilih berdasarkan gejala insiden dan cocokkan statistik runtime dengan hasil CLI. Hipotesis di laporan ini direkonstruksi saat review, bukan catatan bertimestamp sebelum injeksi. Run berikutnya harus mencatat prediksi sebelum injeksi sesuai [runbook](../runbook.md).

## Root cause dan recovery

Checkout simulasi tidak dilepas; PostgreSQL masih hidup. Cocokkan pg_stat_activity dengan statistik pool, karena koneksi idle sendiri bukan bukti leak.

Mitigasi: `POST /simulations/release-leaks`. Jalankan reset sebelum pindah skenario. Reset akhir memverifikasi health, baca polis, persistensi klaim uji dan pembersihan klaim uji, state fault kosong, serta target aplikasi Prometheus UP. Data lama dipertahankan. Reset default memilih baseline tanpa index; `--indexed` memilih kondisi query sesudah perbaikan.

## Bukti

- [INC-001-pool.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-001-pool.json)
- [INC-001-alerts.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-001-alerts.json)
- [summary.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/summary.json)
- [reset.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/reset.json)

## Pencegahan dan batas pembuktian

| Tindakan | Owner latihan | Status |
|---|---|---|
| Mode lab eksplisit, port localhost, deadline dan batas sumber daya | Pemilik repo | Diimplementasikan dan diuji lokal |
| Reproduksi dan verifikasi transaksi setelah recovery | Pemilik repo | Lulus verify-lab.js |
| Host exporter, notifikasi eksternal dan cloud | Pemilik repo | Belum dilakukan |

Bukti alert historis berisi HighHeapMemoryUsage, bukan HighErrorRate. Klaim error rate 98,55% tidak didukung JSON historis tersebut.

Artefak 26 Oktober dipertahankan sebagai sejarah. Ringkasan interpretatif di berkas benchmark lama bukan output mentah. Run terbaru di atas menjadi acuan verifikasi saat ini. Tidak ada klaim OOM, socket exhaustion, atau gangguan nasabah jika tidak dibuktikan.

## Komunikasi dan pelajaran

[Draft awal/update/resolusi](../evidence/INC-001/communications.md). Tidak ada pesan yang dikirim ke Slack/email. Bedakan dampak teramati, hipotesis, risiko, dan rencana pencegahan.
