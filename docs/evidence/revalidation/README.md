# Revalidasi lokal

Direktori bertimestamp dibuat oleh `node scripts/verify-lab.js`. JSON menyimpan status HTTP, durasi, metrik, alert, dan hasil benchmark. EXPLAIN disimpan langsung dari psql. summary.json ditandai passed hanya setelah seluruh assertion berhasil.

HEAD menunjukkan commit sebelum perubahan di-commit; workingTreeDirty=true menyatakan hasil menguji perubahan lokal yang kemudian di-commit. Bukti sintetis promtool berbeda dari alert live. UTC +7 = WIB. Jangan menjalankan dua sesi injeksi/load test bersamaan. Data PostgreSQL lama dipertahankan dan benchmark dapat menambah klaim.

## Riwayat validasi sesi ini

- Run 09-10: lima skenario lulus sebelum pembaruan Zod.
- Run 09-22: gagal pada assertion disk alert yang masih pending; recovery otomatis lulus. Bukti gagal dipertahankan. Penyebabnya jeda tetap yang tidak mengikuti jadwal scrape/evaluasi.
- Run 09-26: sesudah perbaikan polling firing, lima skenario lulus dengan lockfile Zod final. Kode runtime disimpan pada commit 8590919; HEAD saat awal run masih commit sebelumnya dengan dirty state yang dinyatakan eksplisit.

Audit produksi tidak menemukan vulnerability pada waktu pengujian. Dependency development masih memiliki enam temuan low dari npm; tidak dilakukan pembaruan major paksa. Rekaman demo dan walkthrough clone bersih oleh orang lain tetap pekerjaan berikutnya.
