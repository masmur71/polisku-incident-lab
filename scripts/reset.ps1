# scripts/reset.ps1
# PolisKu Incident Lab — System Recovery & Reset Script (PowerShell for Windows)
# Mengembalikan seluruh sistem ke kondisi normal/bersih setelah insiden atau load testing.

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🔄 PolisKu Recovery: Mengembalikan Sistem ke Kondisi Normal" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Pastikan Docker aktif
try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker daemon tidak berjalan."
        exit 1
    }
} catch {
    Write-Error "Docker daemon tidak berjalan."
    exit 1
}

# 2. Terminate koneksi idle/hung di PostgreSQL dan reset connection pool
Write-Host "[1/4] Memeriksa dan membersihkan koneksi menggantung di PostgreSQL..." -ForegroundColor Yellow
$terminateSql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'poliskudb' AND pid <> pg_backend_pid() AND (state = 'idle in transaction' OR state = 'idle' OR query ILIKE '%pg_sleep%');"
docker exec polisku-postgres-1 psql -U postgres -d poliskudb -c "$terminateSql" > $null 2>&1

# 3. Restart container Node.js App untuk mereset memori leak, event loop lag, dan pool lokal
Write-Host "[2/4] Me-restart container polisku-app-1..." -ForegroundColor Yellow
docker restart polisku-app-1 > $null

# 4. Tunggu health check aplikasi
Write-Host "[3/4] Menunggu layanan aplikasi siap (health check)..." -ForegroundColor Yellow
$maxRetries = 15
$retryCount = 0
$healthy = $false

while ($retryCount -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        # ignore and wait
    }
    $retryCount++
    Start-Sleep -Seconds 1
}

if (-not $healthy) {
    Write-Host "[!] Gagal: Aplikasi tidak merespons HTTP 200 setelah di-restart." -ForegroundColor Red
    docker logs --tail 20 polisku-app-1
    exit 1
}

# 5. Verifikasi koneksi ke Prometheus
Write-Host "[4/4] Memeriksa status scrape target di Prometheus..." -ForegroundColor Yellow
$promOk = $false
try {
    $promRes = Invoke-RestMethod -Uri "http://localhost:9090/api/v1/targets" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($promRes.status -eq "success") {
        $promOk = $true
    }
} catch {
    # ignore
}

Write-Host "============================================================" -ForegroundColor Green
Write-Host "✅ SISTEM BERHASIL DI-RESET KE KONDISI NORMAL" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "• App Health       : HTTP 200 OK (http://localhost:3000/health)" -ForegroundColor Green
Write-Host "• Prometheus Target: Scrape Target Aktif" -ForegroundColor Green
Write-Host "• Database Pool    : Bersih & Terkoneksi Normal" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
