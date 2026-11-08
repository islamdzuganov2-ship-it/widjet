# location-audit.ps1
# Читает ШТАТНЫЙ журнал Windows "какие приложения обращались к геолокации"
# (CapabilityAccessManager\ConsentStore\location) и отдаёт JSON.
# Ничего не меняет. Только чтение.
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Convert-FileTime([object]$v) {
  if ($null -eq $v) { return $null }
  try {
    [int64]$t = [int64]$v
    if ($t -le 0) { return $null }
    return [DateTime]::FromFileTime($t).ToString('o')
  } catch { return $null }
}

# Красивое имя из "C:#Program Files#App#app.exe" -> "app.exe (C:\Program Files\App\app.exe)"
function Get-Win32Name([string]$key) {
  $full = $key -replace '#', '\'
  $leaf = Split-Path $full -Leaf
  return @{ display = $leaf; path = $full }
}

$roots = @(
  @{ hive = 'HKCU'; base = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location' },
  @{ hive = 'HKLM'; base = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location' }
)

$results = New-Object System.Collections.ArrayList

foreach ($root in $roots) {
  if (-not (Test-Path $root.base)) { continue }

  # Общий тумблер "Разрешить приложениям доступ к расположению"
  $globalVal = (Get-ItemProperty -Path $root.base -Name 'Value').Value
  if ($globalVal) {
    [void]$results.Add([pscustomobject]@{
      id        = "$($root.hive)|__GLOBAL__"
      hive      = $root.hive
      regPath   = $root.base
      type      = 'global'
      display   = 'Системный доступ к геолокации'
      path      = ''
      value     = $globalVal
      lastStart = $null
      lastStop  = $null
      inUse     = $false
      canToggle = ($root.hive -eq 'HKCU')
    })
  }

  # Упакованные приложения (Store/UWP) — прямые подключи
  Get-ChildItem -Path $root.base | Where-Object { $_.PSChildName -ne 'NonPackaged' } | ForEach-Object {
    $p = $_.PSPath
    $props = Get-ItemProperty -Path $p
    $start = Convert-FileTime $props.LastUsedTimeStart
    $stop  = Convert-FileTime $props.LastUsedTimeStop
    [void]$results.Add([pscustomobject]@{
      id        = "$($root.hive)|packaged|$($_.PSChildName)"
      hive      = $root.hive
      regPath   = ($p -replace 'Microsoft\.PowerShell\.Core\\Registry::', '')
      type      = 'packaged'
      display   = $_.PSChildName
      path      = ''
      value     = $props.Value
      lastStart = $start
      lastStop  = $stop
      inUse     = ($null -ne $start -and $null -eq $stop)
      canToggle = ($root.hive -eq 'HKCU')
    })
  }

  # Классические (Win32) приложения
  $np = Join-Path $root.base 'NonPackaged'
  if (Test-Path $np) {
    Get-ChildItem -Path $np | ForEach-Object {
      $p = $_.PSPath
      $props = Get-ItemProperty -Path $p
      $name = Get-Win32Name $_.PSChildName
      $start = Convert-FileTime $props.LastUsedTimeStart
      $stop  = Convert-FileTime $props.LastUsedTimeStop
      [void]$results.Add([pscustomobject]@{
        id        = "$($root.hive)|win32|$($_.PSChildName)"
        hive      = $root.hive
        regPath   = ($p -replace 'Microsoft\.PowerShell\.Core\\Registry::', '')
        type      = 'win32'
        display   = $name.display
        path      = $name.path
        value     = $props.Value
        lastStart = $start
        lastStop  = $stop
        inUse     = ($null -ne $start -and $null -eq $stop)
        canToggle = ($root.hive -eq 'HKCU')
      })
    }
  }
}

$results | ConvertTo-Json -Depth 4 -Compress
