<#
.SYNOPSIS
  Injeksi Insiden 1: Connection Pool Exhaustion (INC-001)
.DESCRIPTION
  Menghabiskan seluruh koneksi di PostgreSQL pool dengan menahan/me-leak koneksi,
  kemudian mengirimkan trafik untuk memicu penumpukan antrean koneksi (waitingCount)
  dan timeout pada endpoint aplikasi.
#>

param(
    [string]$TargetUrl = "http://localhost:3000",
    [int]$ConnectionsToLeak = 10,
    [int]$TrafficDuration = 20
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Simulasi Insiden 1: Connection Pool Exhaustion (INC-001)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Periksa status awal pool
Write-Host "`n[1/3] Memeriksa status awal sistem..." -ForegroundColor Cyan
try {
    $initialStats = Invoke-RestMethod -Uri "$TargetUrl/simulations/stats" -TimeoutSec 3
    Write-Host "Pool Awal: Total=$($initialStats.pool.totalCount), Idle=$($initialStats.pool.idleCount), Waiting=$($initialStats.pool.waitingCount)" -ForegroundColor Green
} catch {
    Write-Error "Gagal menghubungi $TargetUrl. Pastikan container app berjalan."
    exit 1
}

# 2. Injeksi kebocoran koneksi (menghabiskan seluruh slot pool)
Write-Host "`n[2/3] Menginjeksi kebocoran koneksi (mengkonsumsi $ConnectionsToLeak koneksi pool)..." -ForegroundColor Yellow
for ($i = 1; $i -le $ConnectionsToLeak; $i++) {
    try {
        $res = Invoke-RestMethod -Uri "$TargetUrl/simulations/leak-connection" -TimeoutSec 5
        Write-Host "  -> Koneksi $i berhasil di-checkout tanpa rilis (Total Leaked: $($res.totalLeaked))" -ForegroundColor Gray
    } catch {
        Write-Host "  -> Koneksi $i gagal di-acquire (Pool jenuh): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Verifikasi kondisi pool jenuh
$stats = Invoke-RestMethod -Uri "$TargetUrl/simulations/stats" -TimeoutSec 3
Write-Host "`nStatus Pool Setelah Injeksi:" -ForegroundColor Magenta
Write-Host "  Total Connections  : $($stats.pool.totalCount)" -ForegroundColor Magenta
Write-Host "  Idle Connections   : $($stats.pool.idleCount)" -ForegroundColor Magenta
Write-Host "  Waiting Connections: $($stats.pool.waitingCount)" -ForegroundColor Magenta
Write-Host "  Simulated Leaked   : $($stats.pool.simulatedLeakedCount)" -ForegroundColor Magenta

# 3. Jalankan trafik beban untuk mendemonstrasikan kegagalan request dan alert
Write-Host "`n[3/3] Memberikan trafik request ke API selama $TrafficDuration detik..." -ForegroundColor Cyan
Write-Host "Panggilan normal ke /health dan /policies/1 sekarang akan menunggu dan timeout!" -ForegroundColor Yellow

$autocannonCmd = "autocannon -c 10 -d $TrafficDuration -p 10 -m GET $TargetUrl/health"
Write-Host "Menjalankan: $autocannonCmd`n" -ForegroundColor DarkGray
& autocannon -c 10 -d $TrafficDuration -p 10 -m GET $TargetUrl/health
if ($LASTEXITCODE -ne 0) { throw 'autocannon failed' }

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  Injeksi Selesai. Sistem sekarang dalam kondisi INSIDEN!" -ForegroundColor Red
Write-Host "  Langkah berikutnya:" -ForegroundColor Yellow
Write-Host "  1. Amati Grafana Dashboard: http://localhost:3001" -ForegroundColor Yellow
Write-Host "  2. Amati Prometheus Alerts : http://localhost:9090/alerts" -ForegroundColor Yellow
Write-Host "  3. Lakukan diagnosis CLI menggunakan pg_stat_activity & docker logs" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
