# Komunikasi Stakeholder — INC-002 (Node.js Memory Leak)

## 1. Pesan Awal (Saat Insiden Terdeteksi)
**Waktu Kirim:** 2026-10-26 12:36:15 WIB  
**Saluran:** Slack #incident-response & Email StatusPage internal  
**Target:** Tim Internal, Customer Operations, Manajemen  

```text
[INCIDENT] [P2] Peningkatan Konsumsi Memori & Latensi pada Layanan PolisKu

Dampak: Kami mendeteksi anomali peningkatan konsumsi memori (Node.js V8 Heap & RSS) yang meningkat terus-menerus tanpa adanya pembebasan oleh Garbage Collector. Terjadi peningkatan frekuensi jeda pembersihan memori (GC pause) yang berdampak pada fluktuasi latensi response API. Layanan masih dapat melayani request tetapi berada dalam status degradasi performa.
Waktu terdeteksi: 2026-10-26 12:36 WIB
Status: Sedang diinvestigasi (P2 - Major)

Tim SRE & Support Engineer sedang mengumpulkan heap snapshot untuk mengidentifikasi referensi objek yang bocor. Update selanjutnya dalam 15 menit.

— Tim Support PolisKu
```

---

## 2. Pesan Update (Selama Investigasi)
**Waktu Kirim:** 2026-10-26 12:38:00 WIB  
**Saluran:** Slack #incident-response & Email StatusPage internal  

```text
[UPDATE] [P2] Insiden PolisKu - Node.js Memory Leak

Status: Akar masalah teridentifikasi, proses mitigasi dan pembersihan memori sedang berlangsung.
Temuan sementara: 
- Analisis heap snapshot V8 menunjukkan retensi lebih dari 48.000 objek data yang tersimpan di dalam struktur array global tanpa mekanisme TTL / batas maksimum pembersihan.
- Konsumsi memori Resident Set Size (RSS) meningkat tajam dari 61 MB menjadi 111+ MB.
- Siklus Garbage Collection Mark-Sweep-Compact berjalan intensif namun gagal membebaskan memori karena adanya referensi aktif ke objek global tersebut.

Tindakan yang sedang dilakukan:
1. Mengeksekusi instruksi pembersihan referensi array global yang bocor.
2. Memaksa pembersihan memori dan memeriksa stabilisasi heap.
3. Menyiapkan hotfix untuk menghapus referensi global tak terbatas dan menambahkan limit alokasi container.

Estimasi pemulihan: 5 menit.

— Tim Support PolisKu
```

---

## 3. Pesan Resolusi (Setelah Pulih)
**Waktu Kirim:** 2026-10-26 12:42:00 WIB  
**Saluran:** Slack #incident-response, Email All-Stakeholders  

```text
[RESOLVED] [P2] Insiden PolisKu - Node.js Memory Leak

Waktu mulai: 2026-10-26 12:35 WIB
Waktu selesai: 2026-10-26 12:41 WIB
Durasi dampak: 6 menit

Penyebab: 
Adanya retensi data objek pada array global di level modul tanpa batas retensi atau mekanisme eviction, sehingga objek tidak dapat dibersihkan oleh V8 Garbage Collector dan menyebabkan memori Heap dan RSS terus membengkak seiring bertambahnya request.

Tindakan yang dilakukan:
1. Mengosongkan data referensi statis yang menahan alokasi memori.
2. Memverifikasi metrik heap usage kembali normal dan stabil di kisaran 12-15 MB.
3. Mengonfirmasi siklus Garbage Collection berjalan normal tanpa lonjakan pause time.

Pencegahan:
1. Audit kode untuk memastikan tidak ada data request atau cache yang disimpan di modul array/objek global tanpa LRU eviction policy (Owner: App Team, Target: Besok).
2. Konfigurasi limit memori container Docker (`mem_limit: 512m`) dan batas V8 heap `--max-old-space-size` agar sistem terlindungi dari crash tak terkontrol (Owner: DevOps Team, Target: Sprint ini).
3. Aktivasi alert Prometheus `HighHeapMemoryUsage` dengan threshold 85% untuk mendeteksi tren kebocoran lebih awal (Owner: SRE Team, Target: Selesai).

Layanan telah beroperasi normal dengan performa memori yang stabil.

— Tim Support PolisKu
```
