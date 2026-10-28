# Revalidasi lokal

## Mulai dari run acuan

**Run terpilih: 2026-10-28T09-26-51-924Z — passed.** Buka [summary.json](2026-10-28T09-26-51-924Z/summary.json) untuk lima assertion skenario dan identitas sumber; lalu [reset.json](2026-10-28T09-26-51-924Z/reset.json) untuk hasil verifikasi baca/tulis setelah recovery. Ini run acuan laporan, bukan klaim bahwa setiap berkas pada seluruh direktori adalah pengujian terbaru yang lulus.

| Investigasi | Bukti utama | Cara membaca |
|---|---|---|
| INC-001 | [Pool](2026-10-28T09-26-51-924Z/INC-001-pool.json), [alert](2026-10-28T09-26-51-924Z/INC-001-alerts.json) | 10 checkout tertahan, 5 menunggu; HighErrorRate dan DatabasePoolExhausted firing |
| INC-002 | [Memory](2026-10-28T09-26-51-924Z/INC-002-memory.json) | Bandingkan before/during/after; referensi kosong tidak berarti RSS kembali baseline |
| INC-003 | [Plan sebelum](2026-10-28T09-26-51-924Z/INC-003-before-plan.txt), [sesudah](2026-10-28T09-26-51-924Z/INC-003-after-plan.txt); [HTTP sebelum](2026-10-28T09-26-51-924Z/INC-003-before-load.json), [sesudah](2026-10-28T09-26-51-924Z/INC-003-after-load.json) | Bandingkan scan/sort, execution time dan buffers; HTTP diukur terpisah dengan konfigurasi sama |
| INC-004 | [Alert](2026-10-28T09-26-51-924Z/INC-004-alerts.json), [penuh](2026-10-28T09-26-51-924Z/INC-004-full.json), [pulih](2026-10-28T09-26-51-924Z/INC-004-recovered.json) | ENOSPC/507 dan ruang kembali tersedia pada tmpfs 32 MiB |
| INC-005 | [Deadline](2026-10-28T09-26-51-924Z/INC-005-timeout.json) | 12052 ms/200 dibanding 2016 ms/504; queued=false |

[Environment](2026-10-28T09-26-51-924Z/environment.txt) mencatat jumlah data dan container saat run. [Skrip verifier](../../../scripts/verify-lab.js) memperlihatkan assertion, termasuk health 503 saat pool habis dan 200 setelah release; status tersebut tidak semuanya disimpan sebagai response JSON tersendiri. [Laporan insiden](../../../README.md) menjelaskan interpretasi dan batasnya.

## Urutan observasi yang tersimpan

Semua waktu berikut tanggal 28 Oktober 2026 dalam UTC (tambahkan 7 jam untuk WIB). Ini urutan pengujian otomatis, bukan timeline deteksi/keputusan operator atau pengukuran MTTR. Field at pada response dicatat setelah respons dibaca; activeAt pada alert bukan waktu pasti mulai firing.

| Waktu UTC | Observasi | Sumber |
|---|---|---|
| 09:26:51.924 | Metadata awal run | summary.json |
| 09:27:35.639 | Sampel pool: 10 tertahan, 5 menunggu | INC-001-pool.json |
| 09:28:25.906–09:28:26.113 | Sampel memory before/during/after | INC-002-memory.json |
| 09:28:29.434–09:28:39.532 | Benchmark HTTP sebelum index | INC-003-before-load.json |
| 09:28:41.569–09:28:51.601 | Benchmark HTTP sesudah index | INC-003-after-load.json |
| 09:30:02.033 / 09:30:02.081 | Respons disk penuh / sampel setelah truncate | INC-004-full.json / INC-004-recovered.json |
| 09:30:14.135 / 09:30:16.151 | Respons partner tanpa / dengan deadline | INC-005-timeout.json |
| 09:30:35.123 | Reset dan verifikasi baca/tulis berhasil | reset.json |

Timestamp tidak mendukung durasi investigasi manusia. Untuk run manual berikutnya, catat hipotesis sebelum injeksi, waktu deteksi, alasan memilih mitigasi dan waktu pemulihan bisnis secara langsung.

## Provenance dan batas bukti

Direktori bertimestamp dibuat oleh `node scripts/verify-lab.js`. JSON menyimpan status HTTP, durasi, metrik, alert, dan hasil benchmark. EXPLAIN disimpan langsung dari psql. summary.json ditandai passed hanya setelah seluruh assertion berhasil.

HEAD menunjukkan commit sebelum perubahan di-commit; workingTreeDirty=true menyatakan hasil menguji perubahan lokal yang kemudian di-commit. Bukti sintetis promtool berbeda dari alert live. UTC +7 = WIB. Jangan menjalankan dua sesi injeksi/load test bersamaan. Data PostgreSQL lama dipertahankan dan benchmark dapat menambah klaim.

Seri [baseline](../../baseline.md) memakai run terpisah; jangan memakai angka baseline sebagai pengganti benchmark insiden. File mentah dipertahankan saat dokumentasi diperbaiki. Analisis retainer publik, demo rekaman, walkthrough independen dan bukti GCP masih pending.

## Riwayat validasi sesi ini

- Run 09-10: lima skenario lulus sebelum pembaruan Zod.
- Run 09-22: gagal pada assertion disk alert yang masih pending; recovery otomatis lulus. Bukti gagal dipertahankan. Penyebabnya jeda tetap yang tidak mengikuti jadwal scrape/evaluasi.
- Run 09-26: sesudah perbaikan polling firing, lima skenario lulus dengan lockfile Zod final. Kode runtime disimpan pada commit 8590919; HEAD saat awal run masih commit sebelumnya dengan dirty state yang dinyatakan eksplisit.

Audit produksi tidak menemukan vulnerability pada waktu pengujian. Dependency development masih memiliki enam temuan low dari npm; tidak dilakukan pembaruan major paksa. Rekaman demo dan walkthrough clone bersih oleh orang lain tetap pekerjaan berikutnya.
