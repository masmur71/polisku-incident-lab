# Bukti observability

[05-local-dashboard-verified.png](05-local-dashboard-verified.png) adalah screenshot aktual dashboard lokal dengan 15 panel diagnosis: HTTP, latency per route, pool, heap/limit, event loop, in-flight, filesystem insiden, RSS/CPU proses, outcome partner dan disconnect klien.

Disk adalah tmpfs khusus 32 MiB, bukan disk Windows host. CPU adalah proses Node. Dashboard tidak membuktikan notifikasi eksternal; tidak ada Alertmanager dalam stack.

Berkas 01–04 adalah bukti historis. Secara khusus, screenshot 01 menunjukkan No data/error dan tidak dipakai sebagai bukti dashboard sehat. Screenshot targets lama membuktikan scrape pada waktu tangkapan, bukan kondisi saat ini. Gunakan JSON alert live dan hasil reset pada direktori revalidation untuk bukti terkini.
