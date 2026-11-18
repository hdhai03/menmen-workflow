# Cài MenMen Workflow ở chế độ dev trên Windows: bật PlayerDebugMode + junction vào thư mục CEP extensions.
# Chạy: powershell -ExecutionPolicy Bypass -File scripts\install-dev-win.ps1
$ErrorActionPreference = "Stop"

$src = Resolve-Path (Join-Path $PSScriptRoot "..")
$destDir = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$dest = Join-Path $destDir "com.menmen.workflow"

foreach ($v in 9, 10, 11, 12) {
  $key = "HKCU:\Software\Adobe\CSXS.$v"
  if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
  Set-ItemProperty -Path $key -Name "PlayerDebugMode" -Value "1" -Type String
}
Write-Host "OK  Da bat PlayerDebugMode (CSXS 9-12)"

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
if (Test-Path $dest) {
  Write-Host "--  $dest da ton tai (bo qua). Neu muon link lai, hay tu xoa thu muc do."
} else {
  New-Item -ItemType Junction -Path $dest -Target $src | Out-Null
  Write-Host "OK  Da link $src -> $dest"
}
Write-Host "Khoi dong lai After Effects, roi mo Window > Extensions > MenMen Workflow 1..4"
