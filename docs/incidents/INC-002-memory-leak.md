# INC-002: Node.js Memory Leak dan Peningkatan Garbage Collection Pauses
- **Severity:** P2 (Major - Performance Degradation)
- **Waktu mulai / terdeteksi / selesai:** 2026-10-26 12:35:40 WIB / 2026-10-26 12:36:15 WIB / 2026-10-26 12:41:30 WIB
- **Durasi dampak:** 5 menit 50 detik
- **Dampak ke pengguna:** Layanan API PolisKu mengalami degradasi performa bertahap. Terjadi peningkatan variasi latensi (p99 mencapai 178 ms, max 326 ms) akibat jeda eksekusi Garbage Collection (stop-the-world GC pauses). Meskipun request belum gagal secara masal, proses Node.js berisiko fatal mengalami crash mendadak akibat Out Of Memory (OOM Killer) jika kebocoran dibiarkan berlanjut di bawah beban produksi.

---

## 1. Ringkasan
Pada pukul 12:35 WIB, sistem monitoring mendeteksi tren kenaikan memori Resident Set Size (RSS) dan V8 Heap yang tidak wajar pada container `polisku-app-1`. Dalam waktu singkat, RSS melonjak dari baseline 61.5 MB ke 111.7 MB (+81.5%), dan Heap Used meningkat lebih dari 100% tanpa pernah turun kembali meskipun siklus Garbage Collector berjalan. Tim Support menginjeksi sinyal `SIGUSR2` untuk mengambil V8 Heap Snapshot langsung dari container yang sedang berjalan, menganalisis struktur retainer objek, mengidentifikasi kebocoran referensi array global, serta melakukan pembersihan memori.

---

## 2. Timeline

| Waktu (WIB) | Aktivitas / Peristiwa |
|---|---|
| **12:35:40** | Terjadi injeksi kebocoran memori berupa penumpukan 48.000 objek data ke struktur array di level modul tanpa batas retensi. |
| **12:36:00** | Memori Heap Used melonjak dari 12.08 MB ke 23.41 MB; RSS membengkak ke 79.39 MB. |
| **12:36:15** | Tim Support mendeteksi anomali memori pada dashboard Grafana (panel Node.js Heap) dan log peringatan memory leak. |
| **12:36:20** | Uji beban trafik 17.000 request dikirimkan ke `GET /policies/1` untuk mengamati perilaku V8 Garbage Collector saat heap terisi data bocor. |
| **12:36:33** | Sinyal `SIGUSR2` dikirimkan ke container via `docker kill --signal=SIGUSR2 polisku-app-1`. V8 Engine secara otomatis menghasilkan file heap snapshot berukuran 33 MB (`Heap.20261026.053633.1.0.001.heapsnapshot`). |
| **12:36:45** | File `.heapsnapshot` disalin dari container ke direktori bukti `docs/evidence/INC-002/` untuk analisis Chrome DevTools Memory Profiler. |
| **12:37:00** | Metrik heap memory dan GC duration diekstrak dan disimpan sebagai bukti diagnosis. |
| **12:38:00** | Pesan Update dikirimkan ke stakeholder mengenai temuan retainer array global dan rencana mitigasi. |
| **12:41:00** | Pembersihan referensi memori dieksekusi via `POST /simulations/clear-memory-leak` dan verifikasi pemulihan memori. |
| **12:41:30** | Memori stabil kembali pada 12-14 MB; layanan dinyatakan pulih normal dan Pesan Resolusi dikirim. |

---

## 3. Gejala dan Cara Deteksi

### Gejala yang Teramati
1. **Peningkatan Memori Monotonik:** Memori RSS naik tajam dari 61.5 MB ke 111.7 MB. Heap Used naik dari 12.08 MB ke 24.46 MB (pada batch pengujian lokal) dan akan terus naik tak terbatas seiring berjalannya trafik.
2. **GC Tidak Efektif:** Siklus V8 GC (`Scavenge` dan `MarkSweepCompact`) berjalan berulang kali namun `heap_size_used_bytes` pasca-GC tidak pernah kembali ke baseline, menandakan objek-objek tersebut masih memiliki active reference (retained).
3. **Fluktuasi Latensi:** Latensi maksimum mencapai 326 ms akibat siklus major GC yang menghentikan eksekusi event loop sesaat.

### Cara Deteksi
- **Grafana Panel:** Panel *Node.js Heap Memory* di Grafana Dashboard menunjukkan grafik dengan pola tangga naik (staircase pattern) tanpa penurunan kembali.
- **Log Aplikasi:** Log pino merekam warning penambahan elemen kebocoran memori (`Simulation: Memory leak increased`).
- **Prometheus Metrik:** Metrik `polisku_nodejs_heap_size_used_bytes` dan `polisku_nodejs_gc_duration_seconds` mengalami kenaikan berkesinambungan.

---

## 4. Investigasi (Langkah, Perintah, Temuan)

### Langkah 1: Memeriksa Runtime Memory Stats
Dijalankan pemeriksaan statistik memori proses Node.js:
```bash
powershell -Command "Invoke-RestMethod -Uri http://localhost:3000/simulations/stats | ConvertTo-Json"
```
**Temuan ([01-memory-stats.json](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-002/01-memory-stats.json)):**
- `heapUsedMb`: 24.46 MB (puncak insiden)
- `heapTotalMb`: 27.04 MB
- `rssMb`: 111.69 MB
- `leakArrayLength`: 48.000 entri objek menumpuk di memori.

### Langkah 2: Mengambil Heap Snapshot Menggunakan Sinyal OS
Container Node.js 20 dikonfigurasi dengan flag `--heapsnapshot-signal=SIGUSR2`. Tim Support mengirimkan sinyal ke proses container:
```bash
docker kill --signal=SIGUSR2 polisku-app-1
```
Node.js menghasilkan file snapshot V8 di dalam container `/app/Heap.20261026.053633.1.0.001.heapsnapshot` (33 MB). Snapshot kemudian disalin ke host:
```bash
docker cp polisku-app-1:/app/Heap.20261026.053633.1.0.001.heapsnapshot docs/evidence/INC-002/heap-snapshot-leak.heapsnapshot
```

### Langkah 3: Analisis Retainers Tree
Ketika file `.heapsnapshot` dibuka di tab **Memory** Chrome DevTools:
1. Constructor `Object` dan `(closure)` mendominasi persentase *Retained Size*.
2. Pohon referensi (*Retainer graph*) menunjukkan bahwa seluruh 48.000 objek terikat pada variabel array modul `leakedMemoryStore` yang tidak pernah dibersihkan.
3. Objek string padding 8 KB (`payloadChunk`) tertahan di root context sehingga tidak eligible untuk diklaim kembali oleh V8 Garbage Collector.

### Langkah 4: Memeriksa Metrik Garbage Collection di Prometheus
```bash
curl.exe -s http://localhost:3000/metrics | findstr "nodejs_gc"
```
**Temuan ([03-gc-metrics.txt](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-002/03-gc-metrics.txt)):**
Metrik histogram `polisku_nodejs_gc_duration_seconds` mencatat akumulasi waktu GC meningkat tajam pada jenis GC `major` (Mark-Sweep-Compact), mengindikasikan V8 berusaha keras mencari ruang kosong di Old Space Heap.

---

## 5. Root Cause
Terdapat struktur data array global di level modul (`leakedMemoryStore`) yang terus-menerus menampung objek data tanpa batas kapasitas (*unbounded growth*) dan tanpa mekanisme kedaluwarsa (*Time-To-Live / TTL*). Karena array tersebut berada di scope global yang tetap hidup sepanjang siklus hidup proses Node.js, V8 Garbage Collector menganggap seluruh elemen di dalamnya sebagai objek yang masih aktif (*reachable from GC root*), sehingga memori tidak pernah dibebaskan.

---

## 6. Resolusi dan Recovery

### Tindakan Pemulihan (Immediate Mitigation)
1. Mengeksekusi pembersihan referensi array global:
   ```bash
   curl.exe -X POST http://localhost:3000/simulations/clear-memory-leak
   ```
2. Memverifikasi metrik memori setelah pembersihan:
   - `heapUsedMb` turun drastis kembali ke **12.5 MB**.
   - `rssMb` stabil di kisaran **60-70 MB**.
3. Jika insiden terjadi di lingkungan produksi tanpa endpoint pembersih dinamis, langkah mitigasi darurat tercepat adalah melakukan rolling restart container:
   ```bash
   powershell -File scripts/reset.ps1
   ```

---

## 7. Pencegahan (Action Items)

| No | Tindakan Pencegahan | Kategori | Owner | Target Waktu |
|---|---|---|---|---|
| 1 | Wajibkan penggunaan in-memory cache dengan eviction policy (misal: `lru-cache` dengan `max` dan `ttl`) alih-alih array atau plain object global. | Code Quality | App Team | Sprint 1 |
| 2 | Tambahkan limit memori pada service `app` di `docker-compose.yml` (`mem_limit: 512m`) untuk mencegah kebocoran memori menenggelamkan host VM. | Infra | DevOps Team | Hari ini |
| 3 | Tambahkan opsi Node.js `--max-old-space-size=384` di container agar V8 memicu crash terkontrol sebelum sistem host kehabisan RAM. | Runtime | DevOps Team | Sprint 1 |
| 4 | Aktifkan alert Prometheus `HighHeapMemoryUsage` (>85% heap total) agar tim engineer mendapatkan peringatan dini sebelum proses terkena OOM kill. | Monitoring | SRE Team | Selesai |

---

## 8. Komunikasi ke Stakeholder
Dokumentasi pesan komunikasi (Awal, Update, Resolusi) tercatat di [communications.md](file:///c:/Users/masmu/OneDrive/Documents/PersProject/Polisku/docs/evidence/INC-002/communications.md).

---

## 9. Pelajaran (Key Takeaways)
1. **Node.js Heap Snapshot via Sinyal OS adalah Lifesaver:** Mengetahui cara mengambil heap snapshot di production tanpa me-restart proses (via `--heapsnapshot-signal=SIGUSR2`) adalah keahlian troubleshooting krusial yang memungkinkan diagnosis mendalam hingga ke baris objek yang bocor.
2. **Garbage Collector Bukan Sihir:** Garbage Collector hanya bisa membersihkan objek yang sudah tidak memiliki referensi. Objek apa pun yang tersambung ke closure global atau event listener yang lupa di-remove akan menjadi zombie memory leak.
3. **Pentingnya Membatasi Kapasitas Cache:** Jangan pernah membuat array atau map lokal sebagai cache sementara tanpa membatasi ukuran maksimumnya.
