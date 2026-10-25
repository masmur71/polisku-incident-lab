# Bukti Monitoring & Observability Stack

Dokumentasi dan tangkapan layar (*evidence*) dari implementasi stack monitoring PolisKu, mencakup instrumentasi metrik aplikasi, scraping Prometheus, alert rules, dan dashboard visualisasi Grafana.

---

## Rincian Bukti Tangkapan Layar

### 1. `01-grafana-dashboard.png` — Main Monitoring Dashboard
- **URL:** `http://localhost:3001/d/polisku-main/polisku-main-incident-lab-dashboard`
- **Fungsi & Informasi yang Ditampilkan:**
  - **HTTP Request Rate & 5xx Error Rate:** Menampilkan throughput total (RPS) serta persentase error status 5xx secara real-time.
  - **Latency Percentiles (p50, p95, p99):** Mengukur distribusi waktu respons request API menggunakan histogram Prometheus (`histogram_quantile`).
  - **Database Connection Pool Status:** Memantau kapasitas pool PostgreSQL (Total Connections, Idle Connections, dan Waiting Requests).
  - **Node.js Runtime Saturation:** Memantau penggunaan memori heap (`heap_used` vs `heap_total`) serta *event loop lag* untuk deteksi bottleneck thread sinkron.

### 2. `02-prometheus-targets.png` — Scrape Targets & Health
- **URL:** `http://localhost:9090/targets`
- **Fungsi & Informasi yang Ditampilkan:**
  - Membuktikan Prometheus aktif menarik data (*scraping*) dari service API (`app:3000/metrics`) setiap 5 detik dengan status **UP** tanpa kendala koneksi (*zero scrape errors*).

### 3. `03-prometheus-alerts.png` — Active Alert Rules
- **URL:** `http://localhost:9090/alerts`
- **Fungsi & Informasi yang Ditampilkan:**
  - Menampilkan aturan ambang batas (*threshold alerts*) yang sedang dievaluasi otomatis:
    1. **`HighErrorRate`**: Memicu alert jika rasio error 5xx melebihi 5% selama 1 menit.
    2. **`HighHeapMemoryUsage`**: Memicu alert jika penggunaan RAM heap Node.js melampaui 85% alokasi.
    3. **`DatabasePoolExhausted`**: Memicu alert saat antrean koneksi database terbentuk (`waiting_connections > 0`) selama 30 detik.

### 4. `04-app-metrics-endpoint.png` — Raw Application Metrics Endpoint
- **URL:** `http://localhost:3000/metrics`
- **Fungsi & Informasi yang Ditampilkan:**
  - Format data teks ekspos metrik standar Prometheus yang dihasilkan langsung oleh library `prom-client` dari dalam aplikasi PolisKu.
