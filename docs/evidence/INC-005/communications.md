# Komunikasi Stakeholder — INC-005 (Downstream Timeout & Socket Starvation)

## 1. Pesan Awal (Saat Insiden Terdeteksi)
**Waktu Kirim:** 2026-10-26 12:48:40 WIB  
**Saluran:** Slack #incident-response & Email StatusPage internal  
**Target:** Tim Internal, Customer Operations, Manajemen  

```text
[INCIDENT] [P2] Kelambatan Layanan Verifikasi Klaim Eksternal PolisKu

Dampak: Pengajuan klaim yang membutuhkan verifikasi ke gateway eksternal (rekanan asuransi jiwa / cek fraud) mengalami respon menggantung dan timeout. Nasabah mengalami layar memuat (loading) terus-menerus hingga terputus. Modul lain yang tidak membutuhkan integrasi eksternal masih berjalan normal.
Waktu terdeteksi: 2026-10-26 12:48 WIB
Status: Sedang diinvestigasi (P2 - Major)

Tim Support Engineer sedang menganalisis network latency dan ketersediaan downstream API rekanan. Update selanjutnya dalam 10 menit.

— Tim Support PolisKu
```

---

## 2. Pesan Update (Selama Investigasi)
**Waktu Kirim:** 2026-10-26 12:49:15 WIB  
**Saluran:** Slack #incident-response & Email StatusPage internal  

```text
[UPDATE] [P2] Insiden PolisKu - Downstream Partner API Timeout

Status: Akar masalah teridentifikasi, konfigurasi circuit breaker dan timeout fallback sedang diterapkan.
Temuan sementara: 
- Layanan eksternal rekanan mengalami kelambatan respon ekstrem (>12 detik per request).
- Klien HTTP pada aplikasi PolisKu tidak memiliki batas timeout (infinite wait), menyebabkan request menumpuk di antrean in-flight sockets dan mengunci koneksi gateway.
- Metrik in-flight requests melonjak hingga batas concurrency maksimum.

Tindakan yang sedang dilakukan:
1. Menerapkan deadline timeout 2.000 ms via AbortSignal pada seluruh pemanggilan downstream HTTP.
2. Mengaktifkan fallback non-blocking (HTTP 202 DEFERRED_TO_MANUAL_REVIEW) agar pengajuan klaim nasabah tetap diterima dan diproses secara asinkron.

Estimasi pemulihan: 3 menit.

— Tim Support PolisKu
```

---

## 3. Pesan Resolusi (Setelah Pulih)
**Waktu Kirim:** 2026-10-26 12:50:30 WIB  
**Saluran:** Slack #incident-response, Email All-Stakeholders  

```text
[RESOLVED] [P2] Insiden PolisKu - Downstream Partner API Timeout & Circuit Breaker

Waktu mulai: 2026-10-26 12:48 WIB
Waktu selesai: 2026-10-26 12:50 WIB
Durasi dampak: 2 menit

Penyebab: 
Kegagalan performa pada gateway downstream pihak ketiga yang memakan waktu respon >12 detik, diperparah oleh ketiadaan batas timeout pada klien internal sehingga seluruh koneksi in-flight terkunci.

Tindakan yang dilakukan:
1. Menerapkan batas waktu timeout ketat 2 detik (2.000 ms) pada seluruh outgoing HTTP client.
2. Menerapkan pola graceful fallback: jika rekanan lambat, sistem merespons HTTP 202 Accepted dan memasukkan klaim ke antrean rekonsiliasi asinkron alih-alih menggantungkan pengguna.
3. Mengonfirmasi in-flight requests kembali turun ke 0 dan latensi stabil.

Pencegahan:
1. Wajibkan implementasi timeout (maks 2.500 ms) dan circuit breaker (Opossum library) untuk seluruh dependensi eksternal (Owner: App Team, Target: Sprint 1).
2. Sediakan dead-letter queue (DLQ) dan retry otomatis dengan exponential backoff untuk request yang gagal rekonsiliasi (Owner: App Team, Target: Sprint 1).
3. Tambahkan alert Prometheus untuk tingkat kegagalan pemanggilan downstream API rekanan (Owner: SRE Team, Target: Hari ini).

Layanan verifikasi klaim telah kembali beroperasi lancar dengan perlindungan circuit breaker aktif.

— Tim Support PolisKu
```
