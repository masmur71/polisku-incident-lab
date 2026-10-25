# PolisKu Incident Lab

Simulasi monitoring dan incident response untuk aplikasi polis asuransi jiwa **PolisKu**.

## Apa Ini

Proyek latihan support engineer: membangun aplikasi, memasang monitoring, membuat insiden sengaja, lalu mendiagnosis dan mendokumentasikan setiap insiden secara profesional.

## Arsitektur

```
[k6 / autocannon] --> [PolisKu (Express + TS)] --> [PostgreSQL]
                              |
                           /metrics
                              |
                        [Prometheus] --> [Alertmanager]
                              |
                          [Grafana]
```

Semua berjalan lewat Docker Compose.

## Cara Menjalankan

```bash
docker compose up -d
```

Aplikasi: `http://localhost:3000`
Grafana: `http://localhost:3001`

## Daftar Insiden

| # | Insiden | Report |
|---|---------|--------|
| 1 | Connection pool habis | [INC-001](docs/incidents/INC-001-connection-pool.md) |
| 2 | Memory leak | [INC-002](docs/incidents/INC-002-memory-leak.md) |
| 3 | Slow query | [INC-003](docs/incidents/INC-003-slow-query.md) |
| 4 | Disk penuh | [INC-004](docs/incidents/INC-004-disk-full.md) |
| 5 | Downstream timeout | [INC-005](docs/incidents/INC-005-downstream-timeout.md) |

## Screenshot Dashboard

*(akan ditambahkan)*

## Pelajaran

*(akan ditambahkan setelah semua insiden selesai)*
