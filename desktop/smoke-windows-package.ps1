$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$releaseDir = Join-Path $repoRoot 'release'
$packageVersion = (Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'package.json') | ConvertFrom-Json).version
$executable = Join-Path $releaseDir "SubSync-$packageVersion.exe"
$webServer = Join-Path $releaseDir 'win-unpacked\resources\runtime\web\apps\web\server.js'
$nextRuntime = Join-Path $releaseDir 'win-unpacked\resources\runtime\web\node_modules\next\package.json'

foreach ($requiredPath in @($executable, $webServer, $nextRuntime)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Missing packaged runtime file: $requiredPath"
  }
}

$tempRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$userData = Join-Path $tempRoot ("subsync-package-smoke-{0}" -f [guid]::NewGuid().ToString('N'))
$process = $null

try {
  $process = Start-Process -FilePath $executable `
    -ArgumentList "--user-data-dir=$userData" `
    -WindowStyle Hidden `
    -PassThru

  $deadline = (Get-Date).AddSeconds(60)
  $apiReady = $false
  $webReady = $false

  do {
    if ($process.HasExited) {
      throw "Packaged app exited before becoming ready (exit code $($process.ExitCode))."
    }

    try {
      $apiResponse = Invoke-WebRequest -UseBasicParsing `
        -Uri 'http://127.0.0.1:43100/api/services' -TimeoutSec 2
      $apiReady = $apiResponse.StatusCode -eq 200
    } catch {
      $apiReady = $false
    }

    if ($apiReady) {
      try {
        $webResponse = Invoke-WebRequest -UseBasicParsing `
          -Uri 'http://127.0.0.1:43101/dashboard' -TimeoutSec 3
        $webReady = $webResponse.StatusCode -eq 200
      } catch {
        $webReady = $false
      }
    }

    if (-not ($apiReady -and $webReady)) {
      Start-Sleep -Milliseconds 500
    }
  } while ((Get-Date) -lt $deadline -and -not ($apiReady -and $webReady))

  if (-not ($apiReady -and $webReady)) {
    throw 'Packaged app did not serve both the API and dashboard within 60 seconds.'
  }

  Write-Output 'Packaged Windows smoke test passed (API 200, dashboard 200).'
} finally {
  $targets = Get-CimInstance Win32_Process | Where-Object {
    ($process -and $_.ProcessId -eq $process.Id) -or
    ($_.CommandLine -and $_.CommandLine.Contains($userData))
  }
  foreach ($target in ($targets | Sort-Object ProcessId -Descending)) {
    Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue
  }

  $resolvedTempRoot = [IO.Path]::GetFullPath($tempRoot).TrimEnd('\')
  $resolvedUserData = [IO.Path]::GetFullPath($userData)
  if ($resolvedUserData.StartsWith("$resolvedTempRoot\", [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedUserData -Recurse -Force -ErrorAction SilentlyContinue
  }
}
