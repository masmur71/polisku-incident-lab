#!/bin/bash
# inject-incident-4.sh - Disk Full / Log Bloat (INC-004)

set -euo pipefail

TARGET_URL="${1:-http://localhost:3000}"
MEGABYTES="${2:-28}"

echo "=========================================================="
echo "  Simulasi Insiden 4: Disk Penuh / Log Bloat (INC-004)"
echo "=========================================================="

echo "[1/4] Memeriksa kapasitas awal..."
docker exec polisku-app-1 df -h /incident-disk

echo "[2/4] Menginjeksi penulisan log berlebih ($MEGABYTES MB)..."
curl --max-time 15 -fsS -X POST "$TARGET_URL/simulations/fill-disk" \
  -H "Content-Type: application/json" \
  -d "{\"megabytes\": $MEGABYTES}"
echo ""

echo "[3/4] Mendiagnosis penggunaan disk via CLI..."
docker exec polisku-app-1 du -sh /incident-disk/audit-debug.log
docker inspect --format '{{json .HostConfig.LogConfig}}' polisku-app-1

echo "[4/4] Memberikan trafik normal..."
autocannon -c 10 -d 10 -p 5 "$TARGET_URL/health"

echo "=========================================================="
