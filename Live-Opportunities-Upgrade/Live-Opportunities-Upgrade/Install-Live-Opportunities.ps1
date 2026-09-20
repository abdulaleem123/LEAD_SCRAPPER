param([string]$AppFolder = 'C:\leads_gen')
$ErrorActionPreference = 'Stop'
$taskTarget = [IO.Path]::GetFullPath($AppFolder).TrimEnd('\')
$taskPayload = Join-Path $PSScriptRoot 'payload'
$taskManifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
if (-not (Test-Path -LiteralPath (Join-Path $taskTarget 'package.json'))) { throw 'Choose the existing Sales OS app folder.' }
$taskFiles = @($taskManifest.files)
foreach ($taskFile in $taskFiles) {
    $taskDest = [IO.Path]::GetFullPath((Join-Path $taskTarget $taskFile.path))
    if (-not $taskDest.StartsWith($taskTarget + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid target path.' }
    $taskSource = Join-Path $taskPayload $taskFile.path
    if ((Get-FileHash -LiteralPath $taskSource).Hash -ne $taskFile.sha256) { throw "Package integrity check failed: $($taskFile.path)" }
    if (Test-Path -LiteralPath $taskDest) {
        $taskExistingHash = (Get-FileHash -LiteralPath $taskDest).Hash
        if ($taskExistingHash -eq $taskFile.sha256) { continue }
        if ($taskFile.path -ne 'src\components\Nav.tsx' -or $taskExistingHash -ne $taskManifest.originalNavigationSha256) {
            throw "This file has changes the installer does not recognize: $($taskFile.path). No files have been installed."
        }
    }
}
$taskBackup = Join-Path $taskTarget ('upgrade-backups\live-opportunities-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $taskBackup -Force | Out-Null
$taskOriginalNav = Join-Path $taskTarget 'src\components\Nav.tsx'
if (Test-Path -LiteralPath $taskOriginalNav) { Copy-Item -LiteralPath $taskOriginalNav -Destination (Join-Path $taskBackup 'Nav.tsx') }
foreach ($taskFile in $taskFiles) {
    $taskDest = Join-Path $taskTarget $taskFile.path
    New-Item -ItemType Directory -Path (Split-Path -Parent $taskDest) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $taskPayload $taskFile.path) -Destination $taskDest -Force
    if ((Get-FileHash -LiteralPath $taskDest).Hash -ne $taskFile.sha256) { throw "Installed-file check failed: $($taskFile.path)" }
}
Write-Host 'Live Opportunities installed. Restart Sales OS, then open Live Opportunities in the top navigation.'
Write-Host 'Existing CRM data and scraping code were not replaced. Monitoring starts paused.'
Write-Host "Navigation backup: $taskBackup"
