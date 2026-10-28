# INC-004: Filesystem lab penuh akibat log

- **Jenis:** simulasi lokal, bukan insiden nasabah nyata.
- **Severity:** P2 pada filesystem simulasi.
- **Run:** 2026-10-28T09-26-51-924Z. Timestamp artefak UTC; WIB = UTC+7.
- **Status:** direproduksi dan diverifikasi. Identitas HEAD dan working tree tersedia di summary.json.

## Dampak yang teramati

Tmpfs khusus 32 MiB. Penulisan 28 MiB memicu alert live >80%; penambahan 8 MiB menghasilkan ENOSPC/507. Health bisnis tetap 200.

## Hipotesis dan diagnosis

File audit ditulis tanpa batas. Docker logging hanya merotasi stdout/stderr, bukan file aplikasi ini. Driver local Docker memiliki rotasi default.

Hipotesis pembanding: database mati, pool habis, query tidak efisien, alokasi memori biasa, atau partner lambat. Pilih berdasarkan gejala insiden dan cocokkan statistik runtime dengan hasil CLI. Hipotesis di laporan ini direkonstruksi saat review, bukan catatan bertimestamp sebelum injeksi. Run berikutnya harus mencatat prediksi sebelum injeksi sesuai [runbook](../runbook.md).

## Root cause dan recovery

File audit ditulis tanpa batas. Docker logging hanya merotasi stdout/stderr, bukan file aplikasi ini. Driver local Docker memiliki rotasi default.

Mitigasi: `POST /simulations/clean-disk`. Jalankan reset sebelum pindah skenario. Reset akhir memverifikasi health, baca polis, persistensi klaim uji dan pembersihan klaim uji, state fault kosong, serta target aplikasi Prometheus UP. Data lama dipertahankan. Reset default memilih baseline tanpa index; `--indexed` memilih kondisi query sesudah perbaikan.

## Bukti

- [INC-004-alerts.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-004-alerts.json)
- [INC-004-full.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-004-full.json)
- [INC-004-recovered.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-004-recovered.json)
- [summary.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/summary.json)
- [reset.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/reset.json)

## Pencegahan dan batas pembuktian

| Tindakan | Owner latihan | Status |
|---|---|---|
| Mode lab eksplisit, port localhost, deadline dan batas sumber daya | Pemilik repo | Diimplementasikan dan diuji lokal |
| Reproduksi dan verifikasi transaksi setelah recovery | Pemilik repo | Lulus verify-lab.js |
| Host exporter, notifikasi eksternal dan cloud | Pemilik repo | Belum dilakukan |

Eksperimen historis menulis 150 MB saat disk hanya 1% terpakai: bukti log bloat, bukan disk penuh atau P1. Simulasi baru tidak mengklaim disk host atau WAL PostgreSQL penuh. Jangan menjadwalkan prune volume sebagai pencegahan.

Artefak 26 Oktober dipertahankan sebagai sejarah. Ringkasan interpretatif di berkas benchmark lama bukan output mentah. Run terbaru di atas menjadi acuan verifikasi saat ini. Tidak ada klaim OOM, socket exhaustion, atau gangguan nasabah jika tidak dibuktikan.

## Komunikasi dan pelajaran

[Draft awal/update/resolusi](../evidence/INC-004/communications.md). Tidak ada pesan yang dikirim ke Slack/email. Bedakan dampak teramati, hipotesis, risiko, dan rencana pencegahan.
