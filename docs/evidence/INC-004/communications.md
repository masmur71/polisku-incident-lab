# Draft komunikasi latihan — INC-004

**Contoh pesan; tidak dikirim.** Waktu pengujian ada di [laporan](../../incidents/INC-004-disk-full.md); tidak ada nasabah nyata.

## Awal

[INC-004] Kami mendeteksi gangguan pada skenario Filesystem lab penuh akibat log. Tmpfs khusus 32 MiB. Penulisan 28 MiB memicu alert live >80%; penambahan 8 MiB menghasilkan ENOSPC/507. Health bisnis tetap 200. Investigasi berjalan; update berikutnya dalam 10 menit atau jika ada temuan penting.

## Update

[INC-004] Temuan terverifikasi: File audit ditulis tanpa batas. Docker logging hanya merotasi stdout/stderr, bukan file aplikasi ini. Driver local Docker memiliki rotasi default. Mitigasi: POST /simulations/clean-disk. ETA belum ditetapkan sampai pemeriksaan recovery selesai.

## Resolusi

[INC-004] Pengujian dan mitigasi lokal selesai sesuai artefak. Setelah reset, baca polis dan persistensi klaim uji berhasil; target monitoring sehat. Batas pembuktian dan tindak lanjut tercatat pada laporan. Deployment GCP belum dilakukan.
