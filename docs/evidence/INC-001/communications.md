# Komunikasi Stakeholder — INC-001 (Connection Pool Exhaustion)

## 1. Pesan Awal (Saat Insiden Terdeteksi)
**Waktu Kirim:** 2026-10-26 12:19:10 WIB  
**Saluran:** Slack #incident-response & Email StatusPage internal  
**Target:** Tim Internal, Customer Operations, Manajemen  

```text
[INCIDENT] [P1] Gangguan Akses API PolisKu & Health Check Service Unreachable

Dampak: Endpoint PolisKu (GET /health, GET /policies/:id, POST /claims) mengalami kegagalan akses (HTTP 503/500) dan latensi tinggi (>5 detik). Nasabah dan agen asuransi saat ini tidak dapat memuat polis atau mengajukan klaim baru.
Waktu terdeteksi: 2026-10-26 12:19 WIB
Status: Sedang diinvestigasi (P1 - Critical)

Tim SRE & Support Engineer sedang menginvestigasi log aplikasi dan status database PostgreSQL. Update berikutnya akan disampaikan dalam 15 menit atau segera setelah ada perkembangan signifikan.

— Tim Support PolisKu
```

---

## 2. Pesan Update (Selama Investigasi)
**Waktu Kirim:** 2026-10-26 12:26:00 WIB  
**Saluran:** Slack #incident-response & Email StatusPage internal  

```text
[UPDATE] [P1] Insiden PolisKu - Kegagalan Koneksi Database (Connection Pool Exhaustion)

Status: Penyebab teridentifikasi, proses pemulihan (mitigasi) sedang berlangsung.
Temuan sementara: 
- Seluruh 10 koneksi pada PostgreSQL connection pool aplikasi tertahan (idle in transaction / unreleased checkout) akibat bug pada handler rilis koneksi.
- Permintaan API baru mengalami antrean (waiting queue) dan timeout setelah 5.000 ms.
- Metrik error rate tercatat mencapai 98.55% dan alert Prometheus 'HighErrorRate' aktif.

Tindakan yang sedang dilakukan:
1. Memutus koneksi gantung di database PostgreSQL via pg_terminate_backend.
2. Merilis koneksi tertahan dan me-restart container aplikasi polisku-app-1.
3. Memastikan health check kembali merespons HTTP 200.

Estimasi pemulihan: 5 menit.

— Tim Support PolisKu
```

---

## 3. Pesan Resolusi (Setelah Pulih)
**Waktu Kirim:** 2026-10-26 12:35:00 WIB  
**Saluran:** Slack #incident-response, Email All-Stakeholders  

```text
[RESOLVED] [P1] Insiden PolisKu - Kegagalan Koneksi Database (Connection Pool Exhaustion)

Waktu mulai: 2026-10-26 12:18 WIB
Waktu selesai: 2026-10-26 12:34 WIB
Durasi dampak: 16 menit

Penyebab: 
Connection pool PostgreSQL (kapasitas 10 koneksi) mengalami exhaustion karena adanya pemanggilan koneksi yang tidak dilepaskan kembali ke pool (unreleased client checkout) pada saat eksekusi endpoint, sehingga seluruh request berikutnya terblokir hingga menabrak connectionTimeoutMillis (5000 ms).

Tindakan yang dilakukan:
1. Menjalankan skrip pemulihan otomatis untuk terminasi koneksi gantung di PostgreSQL.
2. Memuat ulang instans aplikasi dan memverifikasi ketersediaan pool.
3. Melakukan uji beban verifikasi; throughput normal kembali mencapai 300+ req/s dengan latensi p50 = 11 ms dan 0% error.

Pencegahan:
1. Menambahkan blok try...finally wajib di seluruh query direct client acquisition (Owner: App Team, Target: Hari ini).
2. Menambahkan alert Prometheus baru 'PGPoolExhausted' jika pool idle connections = 0 selama lebih dari 1 menit (Owner: SRE Team, Target: Besok).
3. Penyesuaian ukuran default PG_POOL_MAX dan idleTimeoutMillis pada environment produksi (Owner: DevOps Team, Target: Sprint ini).

Layanan telah kembali normal sepenuhnya. Kami mohon maaf atas ketidaknyamanan yang ditimbulkan.

— Tim Support PolisKu
```
