# Bukti Eksekusi Baseline & Load Testing (Fase 4)

Folder ini menyimpan artefak dan bukti visual pengerjaan Fase 4 (Baseline dan Load Test) untuk PolisKu Incident Lab.

## Daftar Bukti

| File | Keterangan |
|---|---|
| `01-grafana-baseline-overview.png` | Screenshot visual dashboard Grafana selama dan setelah pengerjaan 3 level pengujian beban (Light, Medium, Heavy). Menampilkan grafik throughput, status kode 200/201, persentil latensi p50/p95/p99, pool koneksi database, dan stabilitas memori heap Node.js. |
| `../../loadtest/baseline-results.json` | Log artefak metrik kuantitatif hasil benchmarking autocannon dalam format terstruktur JSON. |
| `../../docs/baseline.md` | Dokumen laporan analisis performa normal (baseline) lengkap dengan tabel pembanding dan karakteristik sistem. |
