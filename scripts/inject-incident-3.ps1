<#
.SYNOPSIS
  Injeksi Insiden 3: Slow Query on Unindexed Column (INC-003)
.DESCRIPTION
  Menghapus index pada claims.status (jika ada), kemudian mengirimkan beban trafik
  ke endpoint GET /claims?status=PENDING terhadap tabel berukuran 429.000+ baris.
  Memicu Sequential Scan masal di PostgreSQL, lonjakan latency p95/p99, dan antrean pool.
#>

param(
    [string]$TargetUrl = "http://localhost:3000",
    [int]$Connections = 40,
    [int]$Duration = 20
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Simulasi Insiden 3: Slow Query / Missing Index (INC-003)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Pastikan kolom claims.status TIDAK memiliki index (kondisi missing index)
Write-Host "`n[1/3] Memastikan tidak ada index pada claims(status)..." -ForegroundColor Cyan
try {
    docker exec polisku-postgres-1 psql -U postgres -d poliskudb -c "DROP INDEX IF EXISTS idx_claims_status; DROP INDEX IF EXISTS idx_claims_status_filed_at;"
    Write-Host "Index pada claims.status berhasil dipastikan nihil." -ForegroundColor Green
} catch {
    Write-Host "Peringatan saat memeriksa index: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2. Ambil EXPLAIN ANALYZE query lambat (Sequential Scan)
Write-Host "`n[2/3] Mengecek execution plan (EXPLAIN ANALYZE) sebelum indexing..." -ForegroundColor Cyan
docker exec polisku-postgres-1 psql -U postgres -d poliskudb -c "EXPLAIN ANALYZE SELECT id, policy_id, claim_type, description, amount, status, filed_at, resolved_at FROM claims WHERE status = 'PENDING' ORDER BY filed_at DESC LIMIT 100;"

# 3. Jalankan uji beban trafik pada endpoint GET /claims?status=PENDING
Write-Host "`n[3/3] Memberikan beban trafik masal ke GET /claims?status=PENDING ($Connections connections, ${Duration}s)..." -ForegroundColor Yellow
$autocannonCmd = "autocannon -c $Connections -d $Duration -p 5 $TargetUrl/claims?status=PENDING"
Write-Host "Menjalankan: $autocannonCmd`n" -ForegroundColor DarkGray
Invoke-Expression $autocannonCmd

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  Injeksi Insiden 3 Selesai!" -ForegroundColor Red
Write-Host "  Langkah berikutnya:" -ForegroundColor Yellow
Write-Host "  1. Amati lonjakan Latency p95/p99 di Grafana Dashboard" -ForegroundColor Yellow
Write-Host "  2. Catat bukti EXPLAIN ANALYZE (Parallel Seq Scan pada 429k baris)" -ForegroundColor Yellow
Write-Host "  3. Lakukan resolusi: CREATE INDEX CONCURRENTLY idx_claims_status_filed_at ON claims (status, filed_at DESC);" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
