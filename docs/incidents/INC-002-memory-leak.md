# INC-002: Retensi objek Node.js

- **Jenis:** simulasi lokal, bukan insiden nasabah nyata.
- **Severity:** P2 simulasi tekanan memori.
- **Run:** 2026-10-28T09-26-51-924Z. Timestamp artefak UTC; WIB = UTC+7.
- **Status:** direproduksi dan diverifikasi. Identitas HEAD dan working tree tersedia di summary.json.

## Dampak yang teramati

Sebanyak 64.000 objek ditahan lalu referensinya dibersihkan. Before/during/after tersedia.

## Hipotesis dan diagnosis

Heap used berubah 17,77 → 31,31 → 29,96 MiB, sementara jumlah referensi 0 → 64000 → 0. Pertumbuhan ini konsisten dengan objek yang disimpan pada array modul; padding string dapat berbagi penyimpanan, sehingga items × sizeKb bukan ukuran retained heap.

Alternatif alokasi sementara belum dapat dibedakan hanya dari satu sampel heap. Counter referensi dan kode injeksi menunjukkan retensi yang disengaja, tetapi analisis dominator/retainer belum dipublikasikan. Sesudah clear, RSS 83,52 MiB belum kembali ke 67,8 MiB awal; hasil membuktikan pelepasan referensi, bukan pemulihan seluruh memori proses.

Penjelasan ini merupakan rekonstruksi dari artefak dan kode saat review, bukan catatan hipotesis sebelum injeksi. Run berikutnya perlu mencatat prediksi dan keputusan saat kejadian sesuai [runbook](../runbook.md).

## Root cause dan recovery

Array modul mempertahankan objek yang masih reachable. Membersihkan array melepaskan referensi aplikasi; garbage collector dan allocator menentukan kapan heap/RSS berubah.

Mitigasi: `POST /simulations/clear-memory-leak`. Jalankan reset sebelum pindah skenario. Reset akhir memverifikasi health, baca polis, persistensi klaim uji dan pembersihan klaim uji, state fault kosong, serta target aplikasi Prometheus UP. Data lama dipertahankan. Reset default memilih baseline tanpa index; `--indexed` memilih kondisi query sesudah perbaikan.

## Bukti

[Indeks run dan waktu observasi](../evidence/revalidation/README.md). Timestamp artefak bukan waktu deteksi manusia atau MTTR.

- [INC-002-memory.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-002-memory.json)
- [summary.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/summary.json)
- [reset.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/reset.json)

## Pencegahan dan batas pembuktian

| Tindakan | Owner latihan | Status |
|---|---|---|
| Publikasikan screenshot dominator/retainer dengan data dummy | Pemilik repo | Pending; snapshot mentah tetap lokal |
| Ulangi beban terkontrol untuk membedakan retensi, GC dan latency | Pemilik repo | Pending; alert heap baru diuji sintetis |

Snapshot historis 33 MB tetap lokal. Belum ada screenshot retainer DevTools untuk publik. Referensi kosong tidak menjamin RSS langsung turun; penyebab latensi akibat GC belum dibuktikan dengan kontrol beban. Alert heap baru diuji sintetis dengan promtool, tidak dipaksa firing live.

Artefak 26 Oktober dipertahankan sebagai sejarah. Ringkasan interpretatif di berkas benchmark lama bukan output mentah. Run terbaru di atas menjadi acuan verifikasi saat ini. Tidak ada klaim OOM, socket exhaustion, atau gangguan nasabah jika tidak dibuktikan.

## Komunikasi dan pelajaran

[Draft awal/update/resolusi](../evidence/INC-002/communications.md). Tidak ada pesan yang dikirim ke Slack/email. Bedakan dampak teramati, hipotesis, risiko, dan rencana pencegahan.
