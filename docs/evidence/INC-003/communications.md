# Komunikasi Stakeholder — INC-003 (Slow Query / Missing Index)

## 1. Pesan Awal (Saat Insiden Terdeteksi)
**Waktu Kirim:** 2026-10-26 12:39:10 WIB  
**Saluran:** Slack #incident-response & Email StatusPage internal  
**Target:** Tim Internal, Customer Operations, Manajemen  

```text
[INCIDENT] [P2] Lonjakan Latensi Ekstrem pada Fitur Daftar Klaim PolisKu

Dampak: Pengguna dan tim operasional klaim mengalami keterlambatan respon (latensi mencapai 2–2,5 detik) saat membuka atau memfilter daftar klaim aktif (GET /claims?status=PENDING). Layanan masih dapat diakses namun mengalami kelambatan signifikan.
Waktu terdeteksi: 2026-10-26 12:39 WIB
Status: Sedang diinvestigasi (P2 - Major)

Tim Support Engineer sedang menganalisis beban query database PostgreSQL dan metrik latensi p95/p99. Update berikutnya akan disampaikan dalam 15 menit.

— Tim Support PolisKu
```

---

## 2. Pesan Update (Selama Investigasi)
**Waktu Kirim:** 2026-10-26 12:39:50 WIB  
**Saluran:** Slack #incident-response & Email StatusPage internal  

```text
[UPDATE] [P2] Insiden PolisKu - Slow Query pada Modul Klaim

Status: Akar masalah teridentifikasi, tindakan perbaikan indeks database sedang dieksekusi secara non-blocking.
Temuan sementara: 
- Analisis query plan (EXPLAIN ANALYZE) menemukan ketiadaan indeks pada kolom claims.status.
- Setiap pemanggilan filter klaim memicu Full Sequential Scan terhadap 429.000+ baris data klaim, memakan waktu 118 ms per query dan menyebabkan antrean koneksi di database pool.
- Latensi rata-rata berada pada 1.926 ms di bawah beban antrean.

Tindakan yang sedang dilakukan:
Membuat composite index secara konkuren (CREATE INDEX CONCURRENTLY) di PostgreSQL tanpa mengunci tabel operasional.

Estimasi pemulihan: 3 menit.

— Tim Support PolisKu
```

---

## 3. Pesan Resolusi (Setelah Pulih)
**Waktu Kirim:** 2026-10-26 12:41:00 WIB  
**Saluran:** Slack #incident-response, Email All-Stakeholders  

```text
[RESOLVED] [P2] Insiden PolisKu - Slow Query pada Modul Klaim

Waktu mulai: 2026-10-26 12:38 WIB
Waktu selesai: 2026-10-26 12:40 WIB
Durasi dampak: 2 menit

Penyebab: 
Ketiadaan indeks pada kombinasi kolom status dan waktu pengajuan (status, filed_at) di tabel claims yang telah bertumbuh mencapai 429.191 baris data, mengakibatkan PostgreSQL mengeksekusi Sequential Scan berat untuk setiap request.

Tindakan yang dilakukan:
1. Pembuatan composite index secara online via `CREATE INDEX CONCURRENTLY idx_claims_status_filed_at ON claims (status, filed_at DESC)`.
2. Verifikasi rencana eksekusi database: metode pemindaian beralih ke Index Scan dengan waktu eksekusi drop dari 118,8 ms ke 0,35 ms (340x lebih cepat).
3. Pengujian beban pasca-resolusi mengonfirmasi latensi rata-rata turun 80,8% (dari 1.926 ms ke 369 ms pada beban tinggi) dan throughput meningkat 5,5x (mencapai 534 req/s).

Pencegahan:
1. Menambahkan audit query berkala menggunakan ekstensi `pg_stat_statements` untuk mendeteksi query dengan total_exec_time tertinggi (Owner: DBA Team, Target: Sprint 1).
2. Menetapkan policy review skema database wajib untuk seluruh filter query sebelum rilis ke produksi (Owner: App Team, Target: Berlaku segera).
3. Menambahkan alert Prometheus jika latensi p95 melebihi 500 ms selama 2 menit berturut-turut (Owner: SRE Team, Target: Hari ini).

Layanan filter klaim telah kembali beroperasi dengan kecepatan optimal.

— Tim Support PolisKu
```
