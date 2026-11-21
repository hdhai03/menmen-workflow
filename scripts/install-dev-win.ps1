# Installs MenMen Workflow for development on Windows: enables PlayerDebugMode + junctions into the CEP extensions folder.
# Run: powershell -ExecutionPolicy Bypass -File scripts\install-dev-win.ps1
$ErrorActionPreference = "Stop"

$src = Resolve-Path (Join-Path $PSScriptRoot "..")
$destDir = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$dest = Join-Path $destDir "com.menmen.workflow"

foreach ($v in 9, 10, 11, 12, 13) {
  $key = "HKCU:\Software\Adobe\CSXS.$v"
  if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
  Set-ItemProperty -Path $key -Name "PlayerDebugMode" -Value "1" -Type String
}
Write-Host "OK  PlayerDebugMode enabled (CSXS 9-13)"

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
if (Test-Path $dest) {
  Write-Host "--  $dest already exists (skipped). To relink, remove that folder yourself first."
} else {
  New-Item -ItemType Junction -Path $dest -Target $src | Out-Null
  Write-Host "OK  Linked $src -> $dest"
}
Write-Host "Restart After Effects, then open Window > Extensions > MenMen Workflow"
