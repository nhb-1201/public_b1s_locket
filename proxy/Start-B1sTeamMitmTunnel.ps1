# Start-B1sTeamMitmTunnel.ps1 — register + start B1sTeam-Mitm-Tunnel.
$ErrorActionPreference = 'Stop'
$action = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"D:\gcmo-project\public_b1s_locket\proxy\Watchdog-Tunnel.ps1`""
schtasks /delete /tn 'B1sTeam-Mitm-Tunnel' /f 2>&1 | Out-Null
schtasks /create /tn 'B1sTeam-Mitm-Tunnel' /sc ONSTART /ru SYSTEM /rl HIGHEST /tr $action /f | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'schtasks create failed - run as Administrator' }
Write-Output 'Task B1sTeam-Mitm-Tunnel created (ONSTART, SYSTEM)'
schtasks /run /tn 'B1sTeam-Mitm-Tunnel' | Out-Null
Write-Output 'Triggered. Log: C:\ProgramData\B1sTeam-LocketGold\mitm-tunnel.log'
