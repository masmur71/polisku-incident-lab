# Draft komunikasi latihan — INC-001

**Contoh pesan; tidak dikirim.** Waktu pengujian ada di [laporan](../../incidents/INC-001-connection-pool.md); tidak ada nasabah nyata.

## Awal

[INC-001] Kami mendeteksi gangguan pada skenario Connection pool exhaustion. Sepuluh koneksi lab ditahan; permintaan health gagal 503. Alert HighErrorRate live terbukti firing. Investigasi berjalan; update berikutnya dalam 10 menit atau jika ada temuan penting.

## Update

[INC-001] Temuan terverifikasi: Checkout simulasi tidak dilepas; PostgreSQL masih hidup. Cocokkan pg_stat_activity dengan statistik pool, karena koneksi idle sendiri bukan bukti leak. Mitigasi: POST /simulations/release-leaks. ETA belum ditetapkan sampai pemeriksaan recovery selesai.

## Resolusi

[INC-001] Pengujian dan mitigasi lokal selesai sesuai artefak. Setelah reset, baca polis dan persistensi klaim uji berhasil; target monitoring sehat. Batas pembuktian dan tindak lanjut tercatat pada laporan. Deployment GCP belum dilakukan.
