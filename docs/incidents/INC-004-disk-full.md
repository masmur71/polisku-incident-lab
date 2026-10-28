# INC-004: Filesystem lab penuh akibat log

- **Jenis:** simulasi lokal, bukan insiden nasabah nyata.
- **Severity:** P2 pada filesystem simulasi.
- **Run:** 2026-10-28T09-26-51-924Z. Timestamp artefak UTC; WIB = UTC+7.
- **Status:** direproduksi dan diverifikasi. Identitas HEAD dan working tree tersedia di summary.json.

## Dampak yang teramati

Tmpfs khusus 32 MiB. Penulisan 28 MiB memicu alert live >80%; penambahan 8 MiB menghasilkan ENOSPC/507. Health bisnis tetap 200.

## Hipotesis dan diagnosis

Artefak penuh menunjukkan sizeBytes=33554432, availableBytes=0, fileSizeBytes=33554432 dan error ENOSPC/HTTP 507. Alert DiskSpaceUsageAbove80 juga tercatat firing. Ini membedakan kehabisan kapasitas filesystem simulasi dari sekadar file log membesar atau dugaan permission denied.

File audit aplikasi berada pada tmpfs khusus. Rotasi stdout/stderr Docker tidak membatasi file tersebut. Health bisnis tetap 200 menurut assertion run; tidak ada dasar menyimpulkan disk host, WAL PostgreSQL atau layanan bisnis seluruhnya gagal.

Penjelasan ini merupakan rekonstruksi dari artefak dan kode saat review, bukan catatan hipotesis sebelum injeksi. Run berikutnya perlu mencatat prediksi dan keputusan saat kejadian sesuai [runbook](../runbook.md).

## Root cause dan recovery

Penulisan file audit tanpa batas menghabiskan kapasitas tmpfs khusus. Truncate memulihkan ruang file tersebut; rotasi logging driver Docker hanya menangani stdout/stderr.

Mitigasi: `POST /simulations/clean-disk`. Jalankan reset sebelum pindah skenario. Reset akhir memverifikasi health, baca polis, persistensi klaim uji dan pembersihan klaim uji, state fault kosong, serta target aplikasi Prometheus UP. Data lama dipertahankan. Reset default memilih baseline tanpa index; `--indexed` memilih kondisi query sesudah perbaikan.

## Bukti

[Indeks run dan waktu observasi](../evidence/revalidation/README.md). Timestamp artefak bukan waktu deteksi manusia atau MTTR.

- [INC-004-alerts.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-004-alerts.json)
- [INC-004-full.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-004-full.json)
- [INC-004-recovered.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-004-recovered.json)
- [summary.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/summary.json)
- [reset.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/reset.json)

## Pencegahan dan batas pembuktian

| Tindakan | Owner latihan | Status |
|---|---|---|
| Batasi/rotasi file audit pada writer aplikasi | Pemilik repo | Rekomendasi; truncate saat ini merupakan mitigasi lab |
| Uji perilaku writer saat ENOSPC dan pemulihan ruang | Pemilik repo | ENOSPC/507 dan truncate terverifikasi lokal |

Eksperimen historis menulis 150 MB saat disk hanya 1% terpakai: bukti log bloat, bukan disk penuh atau P1. Simulasi baru tidak mengklaim disk host atau WAL PostgreSQL penuh. Jangan menjadwalkan prune volume sebagai pencegahan.

Artefak 26 Oktober dipertahankan sebagai sejarah. Ringkasan interpretatif di berkas benchmark lama bukan output mentah. Run terbaru di atas menjadi acuan verifikasi saat ini. Tidak ada klaim OOM, socket exhaustion, atau gangguan nasabah jika tidak dibuktikan.

## Komunikasi dan pelajaran

[Draft awal/update/resolusi](../evidence/INC-004/communications.md). Tidak ada pesan yang dikirim ke Slack/email. Bedakan dampak teramati, hipotesis, risiko, dan rencana pencegahan.
