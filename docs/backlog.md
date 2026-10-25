# Backlog Insiden PolisKu

Status: 🔲 Backlog | 🔄 Doing | ✅ Done

## Tiket

### INC-001: Connection Pool Habis
- **Status:** 🔲 Backlog
- **Prioritas:** High
- **Deskripsi:** Pool max 5, endpoint yang menahan koneksi, load test → request menggantung, timeout
- **Alat diagnosis:** Metrik pool, `pg_stat_activity`, log pino
- **Acceptance criteria:** Incident report lengkap dengan output asli, bisa direproduksi dengan script

### INC-002: Memory Leak
- **Status:** 🔲 Backlog
- **Prioritas:** High
- **Deskripsi:** Endpoint menyimpan data ke array global → heap naik terus, GC sering, OOM kill
- **Alat diagnosis:** Grafana heap, `process.memoryUsage()`, heap snapshot, `clinic`
- **Acceptance criteria:** Incident report lengkap dengan output asli, bisa direproduksi dengan script

### INC-003: Slow Query
- **Status:** 🔲 Backlog
- **Prioritas:** High
- **Deskripsi:** Hapus index di `claims.status`, tabel besar → latency p95 melonjak
- **Alat diagnosis:** `EXPLAIN ANALYZE`, `pg_stat_statements`
- **Acceptance criteria:** Incident report lengkap dengan output asli, bisa direproduksi dengan script

### INC-004: Disk Penuh
- **Status:** 🔲 Backlog
- **Prioritas:** Medium
- **Deskripsi:** Log level debug tanpa rotasi → gagal tulis, DB error
- **Alat diagnosis:** `df -h`, `du -sh`, `lsof`
- **Acceptance criteria:** Incident report lengkap dengan output asli, bisa direproduksi dengan script

### INC-005: Downstream Timeout
- **Status:** 🔲 Backlog
- **Prioritas:** Medium
- **Deskripsi:** Endpoint memanggil layanan eksternal palsu lambat tanpa timeout → request menumpuk
- **Alat diagnosis:** Log, metrik in-flight request, konfigurasi timeout
- **Acceptance criteria:** Incident report lengkap dengan output asli, bisa direproduksi dengan script

### BONUS: Event Loop Blocked
- **Status:** 🔲 Backlog
- **Prioritas:** Low (stretch)
- **Deskripsi:** Loop sinkron berat / JSON.parse besar → semua endpoint lambat, CPU DB santai
- **Alat diagnosis:** Metrik event loop lag
- **Acceptance criteria:** Incident report lengkap, diagnosis event loop lag
