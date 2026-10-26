#!/bin/bash
# inject-incident-3.sh - Slow Query on Unindexed Column (INC-003)

set -e

TARGET_URL="${1:-http://localhost:3000}"
CONNECTIONS="${2:-40}"
DURATION="${3:-20}"

echo "=========================================================="
echo "  Simulasi Insiden 3: Slow Query / Missing Index (INC-003)"
echo "=========================================================="

echo "[1/3] Memastikan tidak ada index pada claims(status)..."
docker exec polisku-postgres-1 psql -U postgres -d poliskudb -c \
  "DROP INDEX IF EXISTS idx_claims_status; DROP INDEX IF EXISTS idx_claims_status_filed_at;" || true

echo "[2/3] Mengecek execution plan sebelum indexing..."
docker exec polisku-postgres-1 psql -U postgres -d poliskudb -c \
  "EXPLAIN ANALYZE SELECT id, policy_id, claim_type, description, amount, status, filed_at, resolved_at FROM claims WHERE status = 'PENDING' ORDER BY filed_at DESC LIMIT 100;"

echo "[3/3] Memberikan beban trafik masal ke GET /claims?status=PENDING..."
autocannon -c "$CONNECTIONS" -d "$DURATION" -p 5 "$TARGET_URL/claims?status=PENDING" || true

echo "=========================================================="
