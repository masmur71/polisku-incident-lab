# INC-001: Connection pool exhaustion

- **Jenis:** simulasi lokal, bukan insiden nasabah nyata.
- **Severity:** P1 untuk endpoint database.
- **Run:** 2026-10-28T09-26-51-924Z. Timestamp artefak UTC; WIB = UTC+7.
- **Status:** direproduksi dan diverifikasi. Identitas HEAD dan working tree tersedia di summary.json.

## Dampak yang teramati

Sepuluh koneksi lab ditahan; permintaan health gagal 503. Alert HighErrorRate live terbukti firing.

## Hipotesis dan diagnosis

Statistik pada run ini menunjukkan totalCount=10, idleCount=0, waitingCount=5 dan simulatedLeakedCount=10. Ini mendukung checkout yang tertahan di aplikasi; antrean saja tidak cukup untuk menyimpulkan leak. HighErrorRate dan DatabasePoolExhausted tercatat firing.

Alternatif DB mati dibedakan dengan pemeriksaan konektivitas dan pg_stat_activity; run otomatis membuktikan health kembali 200 setelah release tanpa restart database. Output pg_stat_activity khusus run ini belum dilampirkan, sehingga jangan mengklaim analisis sesi SQL lengkap. Query lambat juga dapat menghabiskan pool, tetapi counter checkout simulasi dan pemulihan setelah release mendukung penyebab yang diinjeksi.

Penjelasan ini merupakan rekonstruksi dari artefak dan kode saat review, bukan catatan hipotesis sebelum injeksi. Run berikutnya perlu mencatat prediksi dan keputusan saat kejadian sesuai [runbook](../runbook.md).

## Root cause dan recovery

Koneksi yang di-checkout oleh rute simulasi disimpan tanpa release sampai mitigasi dijalankan. Melepas checkout mengembalikan kapasitas pool; memperbesar pool saja tidak menghilangkan sumber retensi.

Mitigasi: `POST /simulations/release-leaks`. Jalankan reset sebelum pindah skenario. Reset akhir memverifikasi health, baca polis, persistensi klaim uji dan pembersihan klaim uji, state fault kosong, serta target aplikasi Prometheus UP. Data lama dipertahankan. Reset default memilih baseline tanpa index; `--indexed` memilih kondisi query sesudah perbaikan.

## Bukti

[Indeks run dan waktu observasi](../evidence/revalidation/README.md). Timestamp artefak bukan waktu deteksi manusia atau MTTR.

- [INC-001-pool.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-001-pool.json)
- [INC-001-alerts.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/INC-001-alerts.json)
- [summary.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/summary.json)
- [reset.json](../evidence/revalidation/2026-10-28T09-26-51-924Z/reset.json)

## Pencegahan dan batas pembuktian

| Tindakan | Owner latihan | Status |
|---|---|---|
| Audit jalur checkout agar release selalu dijalankan dalam finally | Pemilik repo | Rencana review lanjutan; injeksi leak tetap disengaja |
| Uji release pada jalur error dan pantau waktu tunggu akuisisi | Pemilik repo | Belum ada pengujian khusus seluruh jalur checkout |

Bukti alert historis berisi HighHeapMemoryUsage, bukan HighErrorRate. Klaim error rate 98,55% tidak didukung JSON historis tersebut.

Artefak 26 Oktober dipertahankan sebagai sejarah. Ringkasan interpretatif di berkas benchmark lama bukan output mentah. Run terbaru di atas menjadi acuan verifikasi saat ini. Tidak ada klaim OOM, socket exhaustion, atau gangguan nasabah jika tidak dibuktikan.

## Komunikasi dan pelajaran

[Draft awal/update/resolusi](../evidence/INC-001/communications.md). Tidak ada pesan yang dikirim ke Slack/email. Bedakan dampak teramati, hipotesis, risiko, dan rencana pencegahan.
