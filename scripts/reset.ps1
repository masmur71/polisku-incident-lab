param([switch]$Indexed)
$ErrorActionPreference = 'Stop'
$arguments = @((Join-Path $PSScriptRoot 'reset.js'))
if ($Indexed) { $arguments += '--indexed' }
Push-Location (Split-Path $PSScriptRoot -Parent)
try { & node @arguments; if ($LASTEXITCODE -ne 0) { throw 'Recovery verification failed' } }
finally { Pop-Location }
