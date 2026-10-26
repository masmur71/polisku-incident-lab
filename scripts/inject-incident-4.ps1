<#
.SYNOPSIS
  Injeksi Insiden 4: Disk Full / Unrotated Debug Logs (INC-004)
.DESCRIPTION
  Mensimulasikan kebocoran logging debug tanpa rotasi yang memakan kapasitas disk,
  menyebabkan akumulasi file log besar di /app/logs/audit-debug.log, dan menganalisis
  ketiadaan konfigurasi rotasi log Docker (max-size/max-file).
#>

param(
    [string]$TargetUrl = "http://localhost:3000",
    [int]$MegabytesToFill = 150
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Simulasi Insiden 4: Disk Penuh / Log Bloat (INC-004)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Periksa kondisi disk awal
Write-Host "`n[1/4] Memeriksa kapasitas disk dan ukuran log awal..." -ForegroundColor Cyan
try {
    $initialStats = Invoke-RestMethod -Uri "$TargetUrl/simulations/disk-stats" -TimeoutSec 3
    Write-Host "Status Log Awal : $($initialStats.fileSizeMb) MB (Exists: $($initialStats.exists))" -ForegroundColor Green
    docker exec polisku-app-1 df -h /app
} catch {
    Write-Error "Gagal menghubungi $TargetUrl. Pastikan container app berjalan."
    exit 1
}

# 2. Injeksi penulisan log debug masal tanpa rotasi
Write-Host "`n[2/4] Menginjeksi penulisan log debug berlebih ($MegabytesToFill MB) tanpa batas rotasi..." -ForegroundColor Yellow
$body = @{ megabytes = $MegabytesToFill } | ConvertTo-Json
$res = Invoke-RestMethod -Uri "$TargetUrl/simulations/fill-disk" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30

Write-Host "Hasil Injeksi:" -ForegroundColor Magenta
Write-Host "  Log File   : $($res.logPath)" -ForegroundColor Magenta
Write-Host "  Ukuran File: $($res.fileSizeMb) MB" -ForegroundColor Magenta

# 3. Diagnosis ukuran file di dalam container
Write-Host "`n[3/4] Melakukan diagnosis kapasitas disk dan file terbesar via CLI..." -ForegroundColor Cyan
Write-Host "`n>> Perintah: df -h /app" -ForegroundColor DarkGray
docker exec polisku-app-1 df -h /app

Write-Host "`n>> Perintah: du -sh /app/logs/*" -ForegroundColor DarkGray
docker exec polisku-app-1 du -sh /app/logs/audit-debug.log

Write-Host "`n>> Perintah: docker inspect LogConfig (Cek rotasi log Docker)" -ForegroundColor DarkGray
docker inspect --format '{{json .HostConfig.LogConfig}}' polisku-app-1

# 4. Beri trafik ke aplikasi
Write-Host "`n[4/4] Memberikan beban trafik normal sembari memantau disk..." -ForegroundColor Cyan
$autocannonCmd = "autocannon -c 10 -d 10 -p 5 $TargetUrl/health"
Write-Host "Menjalankan: $autocannonCmd`n" -ForegroundColor DarkGray
Invoke-Expression $autocannonCmd

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  Injeksi Insiden 4 Selesai!" -ForegroundColor Red
Write-Host "  Langkah berikutnya:" -ForegroundColor Yellow
Write-Host "  1. Simpan output diagnosis ke docs/evidence/INC-004/" -ForegroundColor Yellow
Write-Host "  2. Konfigurasi log rotation pada docker-compose.yml (max-size: 10m, max-file: 3)" -ForegroundColor Yellow
Write-Host "  3. Bersihkan file log via POST /simulations/clean-disk atau truncate" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
