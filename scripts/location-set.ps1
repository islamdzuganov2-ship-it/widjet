# location-set.ps1
# Разрешить / запретить приложению доступ к геолокации.
# Пишет ТОТ ЖЕ самый параметр Value (Allow/Deny), что и системное приложение
# "Параметры > Конфиденциальность > Расположение". Это штатный механизм Windows,
# а не его обход. Работает в области пользователя (HKCU), без прав администратора.
param(
  [Parameter(Mandatory = $true)][string]$RegPath,
  [Parameter(Mandatory = $true)][ValidateSet('Allow', 'Deny')][string]$Value
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if ($RegPath -notlike 'HKEY_CURRENT_USER*' -and $RegPath -notlike 'HKCU*') {
  @{ ok = $false; error = 'Менять можно только пользовательские (HKCU) разрешения' } | ConvertTo-Json -Compress
  exit 1
}

$psPath = $RegPath -replace '^HKEY_CURRENT_USER', 'HKCU:' -replace '^HKCU\\', 'HKCU:\'
if ($psPath -notlike 'HKCU:*') { $psPath = 'HKCU:\' + $psPath }

if (-not (Test-Path $psPath)) {
  @{ ok = $false; error = "Ключ не найден: $psPath" } | ConvertTo-Json -Compress
  exit 1
}

try {
  Set-ItemProperty -Path $psPath -Name 'Value' -Value $Value -Type String
  $now = (Get-Date).ToString('o')
  @{ ok = $true; regPath = $RegPath; value = $Value; at = $now } | ConvertTo-Json -Compress
} catch {
  @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
  exit 1
}
