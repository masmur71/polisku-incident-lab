# Draft komunikasi latihan — INC-002

**Contoh pesan; tidak dikirim.** Waktu pengujian ada di [laporan](../../incidents/INC-002-memory-leak.md); tidak ada nasabah nyata.

## Awal

[INC-002] Kami mendeteksi gangguan pada skenario Retensi objek Node.js. Sebanyak 64.000 objek ditahan lalu referensinya dibersihkan. Before/during/after tersedia. Investigasi berjalan; update berikutnya dalam 10 menit atau jika ada temuan penting.

## Update

[INC-002] Temuan terverifikasi: Array modul menahan objek reachable. Padding string dapat berbagi penyimpanan; jumlah objek dikalikan sizeKb bukan retained heap terukur. Mitigasi: POST /simulations/clear-memory-leak. ETA belum ditetapkan sampai pemeriksaan recovery selesai.

## Resolusi

[INC-002] Pengujian dan mitigasi lokal selesai sesuai artefak. Setelah reset, baca polis dan persistensi klaim uji berhasil; target monitoring sehat. Batas pembuktian dan tindak lanjut tercatat pada laporan. Deployment GCP belum dilakukan.
