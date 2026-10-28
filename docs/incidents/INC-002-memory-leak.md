# INC-002: Retensi objek Node.js

- **Jenis:** simulasi lokal, bukan insiden nasabah nyata.
- **Severity:** P2 simulasi tekanan memori.
- **Run:** 2026-10-28T09-26-51-924Z. Timestamp artefak UTC; WIB = UTC+7.
- **Status:** direproduksi dan diverifikasi. Identitas HEAD dan working tree tersedia di summary.json.

## Dampak yang teramati

Sebanyak 64.000 objek ditahan lalu referensinya dibersihkan. Before/during/after tersedia.

## Hipotesis dan diagnosis

Array modul menahan objek reachable. Padding string dapat berbagi penyimpanan; jumlah objek dikalikan sizeKb bukan retained heap terukur.

Hipotesis pembanding: database mati, pool habis, query tidak efisien, alokasi memori biasa, atau partner lambat. Pilih berdasarkan gejala insiden dan cocokkan statistik runtime dengan hasil CLI. Hipotesis di laporan ini direkonstruksi saat review, bukan catatan bertimestamp sebelum injeksi. Run berikutnya harus mencatat prediksi sebelum injeksi sesuai [runbook](../runbook.md).

## Root cause dan recovery

Array modul menahan objek reachable. Padding string dapat berbagi penyimpanan; jumlah objek dikalikan sizeKb bukan retained heap terukur.

Mitigasi: `POST /simulations/clear-memory-leak`. Jalankan reset sebelum pindah skenario. Reset akhir memverifikasi health, baca polis, persistensi klaim uji dan pembersihan klaim uji, state fault kosong, serta target aplikasi Prometheus UP. Data lama dipertahankan. Reset default memilih baseline tanpa index; `--indexed` memilih kondisi query sesudah perbaikan.

## Bukti

- [INC-002-memory.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-002-memory.json)
- [summary.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/summary.json)
- [reset.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/reset.json)

## Pencegahan dan batas pembuktian

| Tindakan | Owner latihan | Status |
|---|---|---|
| Mode lab eksplisit, port localhost, deadline dan batas sumber daya | Pemilik repo | Diimplementasikan dan diuji lokal |
| Reproduksi dan verifikasi transaksi setelah recovery | Pemilik repo | Lulus verify-lab.js |
| Host exporter, notifikasi eksternal dan cloud | Pemilik repo | Belum dilakukan |

Snapshot historis 33 MB tetap lokal. Belum ada screenshot retainer DevTools untuk publik. Referensi kosong tidak menjamin RSS langsung turun; penyebab latensi akibat GC belum dibuktikan dengan kontrol beban. Alert heap baru diuji sintetis dengan promtool, tidak dipaksa firing live.

Artefak 26 Oktober dipertahankan sebagai sejarah. Ringkasan interpretatif di berkas benchmark lama bukan output mentah. Run terbaru di atas menjadi acuan verifikasi saat ini. Tidak ada klaim OOM, socket exhaustion, atau gangguan nasabah jika tidak dibuktikan.

## Komunikasi dan pelajaran

[Draft awal/update/resolusi](../evidence/INC-002/communications.md). Tidak ada pesan yang dikirim ke Slack/email. Bedakan dampak teramati, hipotesis, risiko, dan rencana pencegahan.
