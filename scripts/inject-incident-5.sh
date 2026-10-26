#!/bin/bash
# inject-incident-5.sh - Downstream Timeout (INC-005)

set -e

TARGET_URL="${1:-http://localhost:3000}"
CONNECTIONS="${2:-10}"
DURATION="${3:-15}"

echo "=========================================================="
echo "  Simulasi Insiden 5: Downstream Timeout (INC-005)"
echo "=========================================================="

echo "[1/4] Memeriksa in-flight requests awal..."
curl -s "$TARGET_URL/metrics" | grep "polisku_http_in_flight_requests" || true

echo "[2/4] Mengirimkan beban trafik tanpa timeout ($CONNECTIONS connections, ${DURATION}s)..."
autocannon -c "$CONNECTIONS" -d "$DURATION" -p 1 "$TARGET_URL/simulations/external-claim-verification" || true

echo "[3/4] Memeriksa in-flight requests..."
curl -s "$TARGET_URL/metrics" | grep "polisku_http_in_flight_requests" || true

echo "[4/4] Menguji pemulihan via timeout 2000ms & fallback..."
curl -s "$TARGET_URL/simulations/external-claim-verification?withTimeout=true&timeoutMs=2000"
echo ""

echo "=========================================================="
