# Install-AutoStart.ps1 — B1sTeam LocketGold MITM Proxy on Windows
# Registers Task Scheduler task "B1sTeam-Proxy-Watchdog":
#   • Runs at boot (ONSTART) as SYSTEM, account must have NetworkService? SYSTEM có quyền admin — bắt buộc cho port 443 + sửa file cert temp.
#   • If watchdog dies, Task Scheduler restarts it (restart on failure).
# Run elevated: right-click → Run with PowerShell (Admin), or:
#   powershell -ExecutionPolicy Bypass -File Install-AutoStart.ps1
# Remove:  powershell -ExecutionPolicy Bypass -File Install-AutoStart.ps1 -Remove

param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$repo   = 'D:\gcmo-project\public_b1s_locket'
$wd     = Join-Path $repo 'proxy\watchdog.py'
$python = (Get-Command pythonw.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
if (-not $python) { $python = (Get-Command python.exe -ErrorAction Stop | Select-Object -First 1 -ExpandProperty Source) }
$pythonw = $python
if ($pythonw -like '*python.exe') { $pythonw = $pythonw -ireplace 'python.exe$', 'pythonw.exe' }

if ($Remove) {
  schtasks /delete /tn 'B1sTeam-Proxy-Watchdog' /f | Out-Null
  Write-Output 'Da go task B1sTeam-Proxy-Watchdog.'
  return
}

if (-not (Test-Path $wd))     { throw "Khong thay watchdog: $wd" }
if (-not (Test-Path (Join-Path $repo 'ca\b1steam-root-ca.crt'))) { throw 'Chua co ca\b1steam-root-ca.crt' }
if (-not (Test-Path (Join-Path $repo 'ca\b1steam-root-ca.key'))) { throw 'Chua co ca\b1steam-root-ca.key — KHONG tu sinh, lien he B1sTeam.' }
if (-not (Test-Path (Join-Path $repo 'proxy\proxy.env'))) { Write-Output 'CANH BAO: proxy\proxy.env chua co — PROXY_SHARED_KEY vang mat, khung se khong ve. Copy tu proxy.env.example va dien.' }

# Chay task voi quyen SYSTEM; -AllowStartIfOnBatteries / dont stop on battery cho laptop
$action  = "`"$pythonw`" `"$wd`""
schtasks /create /tn 'B1sTeam-Proxy-Watchdog' /sc ONSTART /ru SYSTEM /rl HIGHEST /tr $action /f | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'schtasks failed — hay chay PowerShell bang quyen Administrator.' }

# Restart khi fail toi da 999 lan, giua cac lan 60s — watchdog tu restart proxy
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Set-ScheduledTask -TaskName 'B1sTeam-Proxy-Watchdog' -Settings $settings | Out-Null

Write-Output 'Task B1sTeam-Proxy-Watchdog da dang ky (ONSTART, SYSTEM).'
Write-Output 'Kick bat dau ngay: schtasks /run /tn B1sTeam-Proxy-Watchdog'
Write-Output 'Kiem tra log : Get-Content D:\gcmo-project\public_b1s_locket\proxy\watchdog.log -Tail 20'
