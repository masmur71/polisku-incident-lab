#!/bin/bash
# inject-incident-1.sh - Connection Pool Exhaustion (INC-001)

set -e

TARGET_URL="${1:-http://localhost:3000}"
CONNECTIONS_TO_LEAK="${2:-10}"
TRAFFIC_DURATION="${3:-20}"

echo "=========================================================="
echo "  Simulasi Insiden 1: Connection Pool Exhaustion (INC-001)"
echo "=========================================================="

echo "[1/3] Memeriksa status awal sistem..."
curl -s "$TARGET_URL/simulations/stats" | grep -o '"pool":{[^}]*}' || true
echo ""

echo "[2/3] Menginjeksi kebocoran koneksi ($CONNECTIONS_TO_LEAK koneksi)..."
for i in $(seq 1 $CONNECTIONS_TO_LEAK); do
  curl -s "$TARGET_URL/simulations/leak-connection" > /dev/null || true
  echo -n "."
done
echo " Selesai!"

echo "Status pool setelah injeksi:"
curl -s "$TARGET_URL/simulations/stats"
echo ""

echo "[3/3] Memberikan trafik request ke API selama $TRAFFIC_DURATION detik..."
autocannon -c 10 -d "$TRAFFIC_DURATION" -p 10 "$TARGET_URL/health" || true

echo "=========================================================="
echo "  Injeksi selesai. Silakan periksa dashboard dan logs!"
echo "=========================================================="
