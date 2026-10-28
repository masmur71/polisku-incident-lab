#Requires -Version 7.0
<#
.SYNOPSIS
  Injeksi Insiden 5: Downstream Timeout (INC-005)
.DESCRIPTION
  Memanggil layanan eksternal rekanan (mock partner gateway) yang lambat (delay 12s)
  tanpa konfigurasi timeout, memicu penumpukan in-flight request, kelambatan request,
  tanpa mengklaim batas kapasitas socket server. Kemudian memverifikasi pemulihan menggunakan AbortController timeout.
#>

param(
    [string]$TargetUrl = "http://localhost:3000",
    [int]$Connections = 10,
    [int]$Duration = 15
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Simulasi Insiden 5: Downstream Timeout (INC-005)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Periksa metrik in-flight requests awal
Write-Host "`n[1/4] Memeriksa status in-flight requests awal..." -ForegroundColor Cyan
try {
    $metric = curl.exe -s "$TargetUrl/metrics" | Select-String "polisku_http_in_flight_requests"
    Write-Host "Metrik Awal: $metric" -ForegroundColor Green
} catch {
    Write-Error "Gagal menghubungi $TargetUrl. Pastikan container app berjalan."
    exit 1
}

# 2. Beri beban request ke endpoint downstream TANPA timeout (kondisi insiden)
Write-Host "`n[2/4] Mengirimkan request ke endpoint downstream TANPA TIMEOUT ($Connections connections, ${Duration}s)..." -ForegroundColor Yellow
Write-Host "Setiap request akan menggantung selama 12 detik menunggu downstream partner API!" -ForegroundColor Red

$autocannonCmd = "autocannon -c $Connections -d $Duration -p 1 $TargetUrl/simulations/external-claim-verification"
Write-Host "Menjalankan: $autocannonCmd`n" -ForegroundColor DarkGray
& autocannon -c $Connections -d $Duration -p 1 $TargetUrl/simulations/external-claim-verification
if ($LASTEXITCODE -ne 0) { throw 'autocannon failed' }

# 3. Ambil metrik in-flight requests saat request sedang menggantung
Write-Host "`n[3/4] Mengambil metrik in-flight requests saat penumpukan..." -ForegroundColor Cyan
$inFlightMetric = curl.exe -s "$TargetUrl/metrics" | Select-String "polisku_http_in_flight_requests"
Write-Host "In-Flight Requests: $inFlightMetric" -ForegroundColor Magenta

# 4. Uji pemulihan menggunakan Timeout (AbortController 2000ms) dan HTTP 504
Write-Host "`n[4/4] Menguji pemulihan dengan Timeout 2000ms & HTTP 504 (no claim queued)..." -ForegroundColor Cyan
$testUrl = "$TargetUrl/simulations/external-claim-verification?withTimeout=true&timeoutMs=2000"
Write-Host "Memanggil: $testUrl" -ForegroundColor DarkGray
$recoveryRes = Invoke-WebRequest -Uri $testUrl -TimeoutSec 5 -SkipHttpErrorCheck
if ($recoveryRes.StatusCode -ne 504) { throw 'Expected HTTP 504' }
Write-Host "Hasil Fallback: $($recoveryRes.StatusCode) - $($recoveryRes.Content)" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  Injeksi & Verifikasi Insiden 5 Selesai!" -ForegroundColor Green
Write-Host "  Langkah berikutnya:" -ForegroundColor Yellow
Write-Host "  1. Simpan output bukti diagnosis ke docs/evidence/INC-005/" -ForegroundColor Yellow
Write-Host "  2. Lengkapi Incident Report di docs/incidents/INC-005-downstream-timeout.md" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
