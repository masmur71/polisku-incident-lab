#!/bin/bash
# inject-incident-2.sh - Memory Leak (INC-002)

set -e

TARGET_URL="${1:-http://localhost:3000}"
ITERATIONS="${2:-8}"
ITEMS_PER_BATCH="${3:-8000}"
SIZE_KB="${4:-8}"

echo "=========================================================="
echo "  Simulasi Insiden 2: Node.js Memory Leak (INC-002)"
echo "=========================================================="

echo "[1/4] Memeriksa kondisi memori awal..."
curl -s "$TARGET_URL/simulations/stats" | grep -o '"memory":{[^}]*}' || true
echo ""

echo "[2/4] Menginjeksi kebocoran memori ($ITERATIONS batch)..."
for i in $(seq 1 $ITERATIONS); do
  curl -s -X POST "$TARGET_URL/simulations/memory-leak" \
    -H "Content-Type: application/json" \
    -d "{\"items\": $ITEMS_PER_BATCH, \"sizeKb\": $SIZE_KB}" > /dev/null || true
  echo -n "#"
  sleep 0.4
done
echo " Selesai!"

echo "[3/4] Memberikan beban trafik normal..."
autocannon -c 20 -d 15 -p 5 "$TARGET_URL/policies/1" || true

echo "[4/4] Memicu Heap Snapshot via SIGUSR2..."
docker kill --signal=SIGUSR2 polisku-app-1 || true
sleep 2

echo "Status memori puncak insiden:"
curl -s "$TARGET_URL/simulations/stats" | grep -o '"memory":{[^}]*}' || true
echo ""
echo "=========================================================="
