# Draft komunikasi latihan — INC-003

**Contoh pesan; tidak dikirim.** Waktu pengujian ada di [laporan](../../incidents/INC-003-slow-query.md); tidak ada nasabah nyata.

## Awal

[INC-003] Kami mendeteksi gangguan pada skenario Slow query dan composite index. Query dan benchmark dengan 20 koneksi, pipelining 1, durasi 10 detik diukur sebelum dan sesudah index. Investigasi berjalan; update berikutnya dalam 10 menit atau jika ada temuan penting.

## Update

[INC-003] Temuan terverifikasi: Filter status dan ORDER BY filed_at DESC tanpa composite index memerlukan scan/sort. Bandingkan plan dengan beban dan ukuran pool tetap. Mitigasi: CREATE INDEX CONCURRENTLY idx_claims_status_filed_at ON claims(status,filed_at DESC). ETA belum ditetapkan sampai pemeriksaan recovery selesai.

## Resolusi

[INC-003] Pengujian dan mitigasi lokal selesai sesuai artefak. Setelah reset, baca polis dan persistensi klaim uji berhasil; target monitoring sehat. Batas pembuktian dan tindak lanjut tercatat pada laporan. Deployment GCP belum dilakukan.
