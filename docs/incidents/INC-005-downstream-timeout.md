# INC-005: Deadline verifikasi partner

- **Jenis:** simulasi lokal, bukan insiden nasabah nyata.
- **Severity:** P2 kegagalan dependensi simulasi.
- **Run:** 2026-10-28T09-26-51-924Z. Timestamp artefak UTC; WIB = UTC+7.
- **Status:** direproduksi dan diverifikasi. Identitas HEAD dan working tree tersedia di summary.json.

## Dampak yang teramati

Mock partner merespons sekitar 12 detik; deadline 2 detik menghasilkan HTTP 504 dan queued=false.

## Hipotesis dan diagnosis

Panggilan tanpa deadline bisnis selesai dengan 200 setelah 12052 ms. Dengan deadline 2000 ms, hasil menjadi 504 setelah 2016 ms dan queued=false. Perbandingan ini menunjukkan batas waktu respons klien, bukan partner yang menjadi lebih cepat.

Mock berada dalam proses aplikasi yang sama. Run ini tidak mengisolasi masalah jaringan/TLS, kapasitas socket, atau pembatalan pekerjaan di sisi partner. Tidak ada bukti antrean persisten, retry atau circuit breaker; respons gagal tidak boleh dianggap klaim diterima.

Penjelasan ini merupakan rekonstruksi dari artefak dan kode saat review, bukan catatan hipotesis sebelum injeksi. Run berikutnya perlu mencatat prediksi dan keputusan saat kejadian sesuai [runbook](../runbook.md).

## Root cause dan recovery

Tanpa deadline bisnis, respons menunggu mock partner sekitar 12 detik. AbortController membatasi waktu tunggu fetch dan body; timer dibersihkan dalam finally. Mitigasi mengembalikan kegagalan eksplisit, bukan keberhasilan transaksi.

Mitigasi: `AbortController dengan timer dibersihkan dalam finally, mencakup fetch dan body`. Jalankan reset sebelum pindah skenario. Reset akhir memverifikasi health, baca polis, persistensi klaim uji dan pembersihan klaim uji, state fault kosong, serta target aplikasi Prometheus UP. Data lama dipertahankan. Reset default memilih baseline tanpa index; `--indexed` memilih kondisi query sesudah perbaikan.

## Bukti

[Indeks run dan waktu observasi](../evidence/revalidation/README.md). Timestamp artefak bukan waktu deteksi manusia atau MTTR.

- [INC-005-timeout.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-005-timeout.json)
- [summary.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/summary.json)
- [reset.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/reset.json)

## Pencegahan dan batas pembuktian

| Tindakan | Owner latihan | Status |
|---|---|---|
| Pertahankan deadline dan respons gagal tanpa pengakuan queue | Pemilik repo | Diimplementasikan; 504 dan queued=false terverifikasi |
| Uji partner terpisah serta kegagalan koneksi/body lambat | Pemilik repo | Pending; mock sekarang satu proses |

Respons 202 historis hanya pesan: tidak ada queue atau circuit breaker. Implementasi baru memakai 504 untuk timeout, 502 untuk kegagalan partner, dan tidak menyatakan klaim diterima.

Artefak 26 Oktober dipertahankan sebagai sejarah. Ringkasan interpretatif di berkas benchmark lama bukan output mentah. Run terbaru di atas menjadi acuan verifikasi saat ini. Tidak ada klaim OOM, socket exhaustion, atau gangguan nasabah jika tidak dibuktikan.

## Komunikasi dan pelajaran

[Draft awal/update/resolusi](../evidence/INC-005/communications.md). Tidak ada pesan yang dikirim ke Slack/email. Bedakan dampak teramati, hipotesis, risiko, dan rencana pencegahan.
