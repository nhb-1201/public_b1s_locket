# Watchdog-Tunnel.ps1 — keeps cloudflared b1steam-mitm alive (ONSTART SYSTEM).
$ErrorActionPreference = 'Continue'
$repo = 'D:\gcmo-project\public_b1s_locket'
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$tokenPath = "$env:USERPROFILE\.cloudflared\b1steam-mitm.token"
$logDir = 'C:\ProgramData\B1sTeam-LocketGold'
$logPath = Join-Path $logDir 'mitm-tunnel.log'

if (-not (Test-Path $cloudflared)) { throw "cloudflared not found at $cloudflared" }
if (-not (Test-Path $tokenPath)) { throw "token missing at $tokenPath" }
New-Item -ItemType Directory -Force $logDir | Out-Null
$token = (Get-Content $tokenPath -Raw -ErrorAction Stop).Trim()
if (-not $token) { throw "token empty at $tokenPath" }

function Write-Log([string]$msg) {
  try {
    $ts = [DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss UTC')
    Add-Content -Path $logPath -Value ($ts + ' ' + $msg) -Encoding UTF8
  } catch { }
}

Write-Log 'tunnel start (b1steam-mitm) -> http://127.0.0.1:8443'
while ($true) {
  try {
    & $cloudflared --no-autoupdate --metrics 127.0.0.1:0 tunnel run --token $token 2>&1 | ForEach-Object { Write-Log $_ }
    Write-Log ('tunnel exited {0} - restart in 5s' -f $LASTEXITCODE)
  } catch {
    Write-Log ('ERROR: ' + $_.Exception.Message + ' - restart in 5s')
  }
  Start-Sleep -Seconds 5
}
