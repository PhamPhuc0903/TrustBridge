# Windows 10/11 preflight: prevent launching against an old API or Vite instance.
$ErrorActionPreference = 'Stop'
$busy = @()
foreach ($port in @(8000, 5173)) {
  $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  foreach ($item in $listeners) {
    $proc = Get-Process -Id $item.OwningProcess -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.ProcessName } else { 'unknown' }
    Write-Host "[PORT BUSY] $port is in use by $name (PID $($item.OwningProcess))." -ForegroundColor Yellow
    $busy += $port
  }
}
if ($busy.Count -gt 0) {
  Write-Host 'Close the old FastAPI / NestJS / Vite server, then run start_windows.bat again.' -ForegroundColor Red
  exit 1
}
Write-Host '[OK] Ports 8000 and 5173 are available.' -ForegroundColor Green
exit 0
