# Draft komunikasi latihan — INC-005

**Contoh pesan; tidak dikirim.** Waktu pengujian ada di [laporan](../../incidents/INC-005-downstream-timeout.md); tidak ada nasabah nyata.

## Awal

[INC-005] Kami mendeteksi gangguan pada skenario Deadline verifikasi partner. Mock partner merespons sekitar 12 detik; deadline 2 detik menghasilkan HTTP 504 dan queued=false. Investigasi berjalan; update berikutnya dalam 10 menit atau jika ada temuan penting.

## Update

[INC-005] Temuan terverifikasi: Tanpa deadline bisnis, pengguna menunggu partner. Mock berjalan dalam proses yang sama; in-flight 10 tidak membuktikan kapasitas socket maksimum. Mitigasi: AbortController dengan timer dibersihkan dalam finally, mencakup fetch dan body. ETA belum ditetapkan sampai pemeriksaan recovery selesai.

## Resolusi

[INC-005] Pengujian dan mitigasi lokal selesai sesuai artefak. Setelah reset, baca polis dan persistensi klaim uji berhasil; target monitoring sehat. Batas pembuktian dan tindak lanjut tercatat pada laporan. Deployment GCP belum dilakukan.
