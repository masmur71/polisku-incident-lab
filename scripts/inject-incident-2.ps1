<#
.SYNOPSIS
  Injeksi Insiden 2: Memory Leak (INC-002)
.DESCRIPTION
  Mengirimkan beban request ke endpoint kebocoran memori (array global tanpa GC),
  memicu peningkatan drastis V8 Heap memory, lonjakan frekuensi Garbage Collection (GC pause),
  dan menghasilkan Heap Snapshot via SIGUSR2 untuk diagnosis Chrome DevTools.
#>

param(
    [string]$TargetUrl = "http://localhost:3000",
    [int]$Iterations = 8,
    [int]$ItemsPerBatch = 8000,
    [int]$SizeKb = 8
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Simulasi Insiden 2: Node.js Memory Leak (INC-002)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Periksa kondisi memori awal
Write-Host "`n[1/4] Memeriksa kondisi memori awal aplikasi..." -ForegroundColor Cyan
try {
    $initialStats = Invoke-RestMethod -Uri "$TargetUrl/simulations/stats" -TimeoutSec 3
    Write-Host "Memori Awal:" -ForegroundColor Green
    Write-Host "  Heap Used : $($initialStats.memory.heapUsedMb) MB" -ForegroundColor Green
    Write-Host "  Heap Total: $($initialStats.memory.heapTotalMb) MB" -ForegroundColor Green
    Write-Host "  RSS       : $($initialStats.memory.rssMb) MB" -ForegroundColor Green
} catch {
    Write-Error "Gagal menghubungi $TargetUrl. Pastikan container app berjalan."
    exit 1
}

# 2. Injeksi kebocoran memori secara bertahap
Write-Host "`n[2/4] Menginjeksi penumpukan objek ke array global ($Iterations batch x $ItemsPerBatch items x ${SizeKb}KB)..." -ForegroundColor Yellow

$bodyObj = @{
    items = $ItemsPerBatch
    sizeKb = $SizeKb
}
$jsonBody = $bodyObj | ConvertTo-Json

for ($i = 1; $i -le $Iterations; $i++) {
    try {
        $res = Invoke-RestMethod -Uri "$TargetUrl/simulations/memory-leak" -Method Post -Body $jsonBody -ContentType "application/json" -TimeoutSec 10
        Write-Host "  Batch $i/$Iterations -> Total Leaked Objects: $($res.totalLeakedItems) | Heap Used: $($res.memory.heapUsedMb) MB | RSS: $($res.memory.rssMb) MB" -ForegroundColor Magenta
    } catch {
        Write-Host "  Batch $i gagal: $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 400
}

# 3. Beri trafik normal sembari memori membengkak untuk mengamati GC pause
Write-Host "`n[3/4] Mengirimkan trafik normal sembari mengamati latensi dan GC activity..." -ForegroundColor Cyan
$autocannonCmd = "autocannon -c 20 -d 15 -p 5 $TargetUrl/policies/1"
Write-Host "Menjalankan: $autocannonCmd`n" -ForegroundColor DarkGray
Invoke-Expression $autocannonCmd

# 4. Ambil Heap Snapshot dari V8 Engine via signal SIGUSR2
Write-Host "`n[4/4] Memicu V8 Heap Snapshot via SIGUSR2 ke container Node.js..." -ForegroundColor Yellow
try {
    docker kill --signal=SIGUSR2 polisku-app-1
    Write-Host "Sinyal SIGUSR2 berhasil dikirim ke polisku-app-1. V8 Heap Snapshot sedang digenerate." -ForegroundColor Green
    Start-Sleep -Seconds 2
} catch {
    Write-Host "Peringatan: Gagal mengirimkan SIGUSR2 via docker: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Verifikasi kondisi memori akhir insiden
$finalStats = Invoke-RestMethod -Uri "$TargetUrl/simulations/stats" -TimeoutSec 3
Write-Host "`nStatus Memori Puncak Insiden:" -ForegroundColor Red
Write-Host "  Heap Used : $($finalStats.memory.heapUsedMb) MB (Naik dari $($initialStats.memory.heapUsedMb) MB)" -ForegroundColor Red
Write-Host "  Heap Total: $($finalStats.memory.heapTotalMb) MB" -ForegroundColor Red
Write-Host "  RSS       : $($finalStats.memory.rssMb) MB" -ForegroundColor Red
Write-Host "  Leak Store: $($finalStats.memory.leakArrayLength) objek tersimpan" -ForegroundColor Red

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  Injeksi Selesai. Kondisi Memory Leak Berhasil Terbentuk!" -ForegroundColor Red
Write-Host "  Langkah berikutnya:" -ForegroundColor Yellow
Write-Host "  1. Amati grafik Memory Heap di Grafana: http://localhost:3001" -ForegroundColor Yellow
Write-Host "  2. Ambil file .heapsnapshot dari container: docker cp polisku-app-1:/app/ docs/evidence/INC-002/" -ForegroundColor Yellow
Write-Host "  3. Bersihkan leak via POST /simulations/clear-memory-leak atau reset.ps1" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
