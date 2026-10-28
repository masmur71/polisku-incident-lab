# INC-005: Deadline verifikasi partner

- **Jenis:** simulasi lokal, bukan insiden nasabah nyata.
- **Severity:** P2 kegagalan dependensi simulasi.
- **Run:** 2026-10-28T09-26-51-924Z. Timestamp artefak UTC; WIB = UTC+7.
- **Status:** direproduksi dan diverifikasi. Identitas HEAD dan working tree tersedia di summary.json.

## Dampak yang teramati

Mock partner merespons sekitar 12 detik; deadline 2 detik menghasilkan HTTP 504 dan queued=false.

## Hipotesis dan diagnosis

Tanpa deadline bisnis, pengguna menunggu partner. Mock berjalan dalam proses yang sama; in-flight 10 tidak membuktikan kapasitas socket maksimum.

Hipotesis pembanding: database mati, pool habis, query tidak efisien, alokasi memori biasa, atau partner lambat. Pilih berdasarkan gejala insiden dan cocokkan statistik runtime dengan hasil CLI. Hipotesis di laporan ini direkonstruksi saat review, bukan catatan bertimestamp sebelum injeksi. Run berikutnya harus mencatat prediksi sebelum injeksi sesuai [runbook](../runbook.md).

## Root cause dan recovery

Tanpa deadline bisnis, pengguna menunggu partner. Mock berjalan dalam proses yang sama; in-flight 10 tidak membuktikan kapasitas socket maksimum.

Mitigasi: `AbortController dengan timer dibersihkan dalam finally, mencakup fetch dan body`. Jalankan reset sebelum pindah skenario. Reset akhir memverifikasi health, baca polis, persistensi klaim uji dan pembersihan klaim uji, state fault kosong, serta target aplikasi Prometheus UP. Data lama dipertahankan. Reset default memilih baseline tanpa index; `--indexed` memilih kondisi query sesudah perbaikan.

## Bukti

- [INC-005-timeout.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-005-timeout.json)
- [summary.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/summary.json)
- [reset.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/reset.json)

## Pencegahan dan batas pembuktian

| Tindakan | Owner latihan | Status |
|---|---|---|
| Mode lab eksplisit, port localhost, deadline dan batas sumber daya | Pemilik repo | Diimplementasikan dan diuji lokal |
| Reproduksi dan verifikasi transaksi setelah recovery | Pemilik repo | Lulus verify-lab.js |
| Host exporter, notifikasi eksternal dan cloud | Pemilik repo | Belum dilakukan |

Respons 202 historis hanya pesan: tidak ada queue atau circuit breaker. Implementasi baru memakai 504 untuk timeout, 502 untuk kegagalan partner, dan tidak menyatakan klaim diterima.

Artefak 26 Oktober dipertahankan sebagai sejarah. Ringkasan interpretatif di berkas benchmark lama bukan output mentah. Run terbaru di atas menjadi acuan verifikasi saat ini. Tidak ada klaim OOM, socket exhaustion, atau gangguan nasabah jika tidak dibuktikan.

## Komunikasi dan pelajaran

[Draft awal/update/resolusi](../evidence/INC-005/communications.md). Tidak ada pesan yang dikirim ke Slack/email. Bedakan dampak teramati, hipotesis, risiko, dan rencana pencegahan.
