# INC-005: Downstream Partner Timeout dan Socket Starvation
- **Severity:** P2 (Major - Partial Outage / Cascading Delay)
- **Waktu mulai / terdeteksi / selesai:** 2026-10-26 12:48:30 WIB / 2026-10-26 12:48:45 WIB / 2026-10-26 12:50:30 WIB
- **Durasi dampak:** 2 menit 0 detik
- **Dampak ke pengguna:** Pengajuan klaim nasabah yang memerlukan verifikasi data ke gateway eksternal pihak ketiga (misal: Dukcapil / fraud check rekanan asuransi jiwa) mengalami loading tanpa akhir (hang) hingga akhirnya terputus dengan error timeout. Sebanyak 100% request ke fitur tersebut gagal, dan throughput anjlok ke 0 req/s.

---

## 1. Ringkasan
Pada pukul 12:48 WIB, layanan verifikasi eksternal PolisKu mengalami penumpukan antrean koneksi. Layanan downstream pihak ketiga mengalami degradasi performa ekstrem dengan latensi respon >12 detik per panggilan. Karena klien HTTP di aplikasi Express tidak mengonfigurasi batas timeout (*infinite blocking wait*), setiap request yang masuk menahan socket TCP dan antrean in-flight requests (`polisku_http_in_flight_requests` mencapai batas saturasi 10). Tim Support mengidentifikasi akar masalah melalui metrik in-flight request dan log aplikasi, kemudian menerapkan perbaikan arsitektural berupa batas timeout 2.000 ms via `AbortSignal` serta pola *graceful fallback* (merespons HTTP 202 `DEFERRED_TO_MANUAL_REVIEW` ke antrean rekonsiliasi asinkron).

---

## 2. Timeline

| Waktu (WIB) | Aktivitas / Peristiwa |
|---|---|
| **12:48:30** | Layanan downstream rekanan mengalami latensi ekstrem (12 detik per respons). |
| **12:48:40** | Trafik pengguna masuk ke endpoint verifikasi klaim eksternal. Klien HTTP menggantung tanpa batas waktu. |
| **12:48:45** | Tim Support mendeteksi antrean request menggantung; Pesan Awal insiden dikirimkan ke stakeholder. |
| **12:48:55** | Pemeriksaan metrik Prometheus membuktikan `polisku_http_in_flight_requests` terkunci di angka maksimal 10. |
| **12:49:00** | Autocannon load test mencatat 10 error timeout dan 0 bytes read akibat pemanggilan downstream yang tak kunjung selesai. |
| **12:49:15** | Pesan Update dikirimkan bahwa akar masalah kelambatan downstream telah terlokalisasi dan solusi timeout/fallback sedang diverifikasi. |
| **12:49:30** | Penerapan perbaikan: timeout 2.000 ms (`AbortController`) dan fallback HTTP 202. |
| **12:49:40** | Verifikasi respon: request diputus bersih pada detik ke-2, mengembalikan respon `DEFERRED_TO_MANUAL_REVIEW`, dan membebaskan socket in-flight. |
| **12:50:30** | Seluruh metrik in-flight kembali ke 0; Pesan Resolusi dikirimkan ke stakeholder. |

---

## 3. Gejala dan Cara Deteksi

### Gejala yang Teramati
1. **Request Menggantung dan Client Timeout:** Seluruh 10 request konkuren menggantung selama 12-15 detik hingga menabrak timeout klien/gateway.
2. **Throughput Drop ke 0 Req/Sec:** Tidak ada request yang berhasil selesai dalam jendela waktu operasional normal.
3. **In-Flight Requests Saturated:** Metrik `polisku_http_in_flight_requests` melonjak dari 0 ke 10 dan bertahan statis.

### Cara Deteksi
- **Prometheus Metric:** Metrik gauge `polisku_http_in_flight_requests` menunjukkan retensi koneksi aktif tanpa penurunan.
- **Log Aplikasi:** Log pino mencatat panggilan keluar ke partner API tanpa adanya respons log balik dalam rentang waktu wajar.

---

## 4. Investigasi (Langkah, Perintah, Temuan)

### Langkah 1: Memeriksa Jumlah In-Flight Request
```bash
curl.exe -s http://localhost:3000/metrics | findstr "polisku_http_in_flight_requests"
```
**Temuan ([02-in-flight-requests-metric.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-005/02-in-flight-requests-metric.txt)):**
```text
# HELP polisku_http_in_flight_requests Current number of HTTP requests being processed
# TYPE polisku_http_in_flight_requests gauge
polisku_http_in_flight_requests 10
```
Seluruh slot concurrency sedang tertahan menunggu I/O eksternal.

### Langkah 2: Menguji Perilaku Respons Downstream
```bash
autocannon -c 10 -d 15 -p 1 http://localhost:3000/simulations/external-claim-verification
```
**Temuan ([01-autocannon-downstream-hanging.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-005/01-autocannon-downstream-hanging.txt)):**
10 timeouts terjadi, 0 bytes dibaca, membuktikan server tidak mengirimkan header respons apa pun hingga batas waktu pengujian habis.

### Langkah 3: Analisis Kode Pemanggilan HTTP
Ditemukan bahwa pemanggilan `fetch(partnerUrl)` dieksekusi tanpa menyertakan `signal: AbortSignal.timeout(...)`. Di Node.js, `fetch` bawaan secara *default* tidak memiliki timeout, sehingga koneksi TCP akan terbuka tanpa batas sampai sistem operasi memutus socket (*keep-alive timeout*).

---

## 5. Root Cause
1. **Ketiadaan Timeout:** Kode aplikasi memanggil third-party API menggunakan `fetch()` tanpa `AbortController` atau parameter timeout.
2. **Ketergantungan Sinkron yang Rapuh (Tight Coupling):** Operasi verifikasi eksternal dijalankan secara *blocking* pada jalur request pengguna. Saat downstream lambat, kelambatan tersebut langsung merembet menjadi kelambatan aplikasi utama (*cascading failure*).

---

## 6. Resolusi dan Recovery

### Tindakan Pemulihan (Resolution)
1. Menambahkan batas waktu eksekusi ketat (2.000 ms) menggunakan `AbortController`:
   ```typescript
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), 2000);
   const response = await fetch(partnerUrl, { signal: controller.signal });
   clearTimeout(timer);
   ```
2. Menerapkan pola *Graceful Degradation / Fallback*:
   Jika pemanggilan downstream gagal atau timeout setelah 2 detik, sistem tidak melemparkan error 504, melainkan merespons `HTTP 202 Accepted` dan memasukkan data ke antrean rekonsiliasi manual/asinkron:
   ```json
   {
     "status": "DEFERRED_TO_MANUAL_REVIEW",
     "message": "External gateway unresponsive within 2000ms. Claim queued for async reconciliation."
   }
   ```
3. Hasil Verifikasi ([03-autocannon-with-timeout-recovery.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-005/03-autocannon-with-timeout-recovery.txt)):
   - Latensi terpotong rapi pada **2.008 ms**.
   - Respon berhasil diterima klien dalam status 202.
   - Metrik in-flight requests kembali bersih ke 0.

---

## 7. Pencegahan (Action Items)

| No | Tindakan Pencegahan | Kategori | Owner | Target Waktu |
|---|---|---|---|---|
| 1 | Wajibkan seluruh outgoing HTTP call memiliki `timeout` maksimal 2.500 ms melalui wrapper HTTP client standar. | Code Quality | App Team | Selesai |
| 2 | Pasang pustaka Circuit Breaker (misalnya `opossum`) agar jika tingkat kegagalan downstream melebihi 50%, panggilan langsung di-short-circuit tanpa membebani network. | Resilience | App Team | Sprint 1 |
| 3 | Alihkan seluruh verifikasi pihak ketiga yang tidak krusial ke sistem antrean asinkron (Message Broker / BullMQ / RabbitMQ). | Arsitektur | App Team | Sprint 2 |
| 4 | Tambahkan metrik dan alert Prometheus untuk durasi panggilan downstream API (`polisku_downstream_duration_seconds`). | Monitoring | SRE Team | Hari ini |

---

## 8. Komunikasi ke Stakeholder
Dokumentasi pesan komunikasi (Awal, Update, Resolusi) tercatat di [communications.md](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-005/communications.md).

---

## 9. Pelajaran (Key Takeaways)
1. **Never Trust Third-Party Latency:** Jangan pernah berasumsi layanan eksternal akan selalu merespons cepat. Setiap panggilan keluar WAJIB memiliki timeout dan fallback plan.
2. **Fail Fast Lebih Baik Daripada Hanging:** Lebih baik membatalkan panggilan dalam 2 detik dan memberi tahu pengguna bahwa data sedang diproses secara asinkron daripada membiarkan pengguna menatap layar loading selama 30 detik sebelum gagal.
3. **Pentingnya Metrik In-Flight:** Metrik `in_flight_requests` sangat efektif untuk membedakan apakah lonjakan latensi disebabkan oleh kelambatan CPU lokal atau socket yang tertahan menunggu downstream I/O.
