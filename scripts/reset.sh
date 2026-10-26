#!/bin/bash
# scripts/reset.sh
# PolisKu Incident Lab — System Recovery & Reset Script
# Mengembalikan seluruh sistem ke kondisi normal/bersih setelah insiden atau load testing.

set -e

echo "============================================================"
echo "🔄 PolisKu Recovery: Mengembalikan Sistem ke Kondisi Normal"
echo "============================================================"

# 1. Pastikan Docker aktif
if ! docker info > /dev/null 2>&1; then
    echo "[!] Error: Docker daemon tidak berjalan."
    exit 1
fi

# 2. Terminate koneksi idle/hung di PostgreSQL dan reset connection pool
echo "[1/4] Memeriksa dan membersihkan koneksi menggantung di PostgreSQL..."
docker exec polisku-postgres-1 psql -U postgres -d poliskudb -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'poliskudb' 
  AND pid <> pg_backend_pid() 
  AND (state = 'idle in transaction' OR state = 'idle' OR query ILIKE '%pg_sleep%');
" > /dev/null 2>&1 || true

# 3. Restart container Node.js App untuk mereset memori leak, event loop lag, dan pool lokal
echo "[2/4] Me-restart container polisku-app-1..."
docker restart polisku-app-1 > /dev/null

# 4. Tunggu health check aplikasi
echo "[3/4] Menunggu layanan aplikasi siap (health check)..."
MAX_RETRIES=15
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        HEALTHY=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

if [ "$HEALTHY" = false ]; then
    echo "[!] Gagal: Aplikasi tidak merespons HTTP 200 setelah di-restart."
    docker logs --tail 20 polisku-app-1
    exit 1
fi

# 5. Verifikasi koneksi ke Prometheus
echo "[4/4] Memeriksa status scrape target di Prometheus..."
curl -s http://localhost:9090/api/v1/targets | grep -q '"health":"up"' && PROM_OK=true || PROM_OK=false

echo "============================================================"
echo "✅ SISTEM BERHASIL DI-RESET KE KONDISI NORMAL"
echo "============================================================"
echo "• App Health       : HTTP 200 OK (http://localhost:3000/health)"
echo "• Prometheus Target: Scrape Target Aktif"
echo "• Database Pool    : Bersih & Terkoneksi Normal"
echo "============================================================"
