$ErrorActionPreference = 'Stop'
$searchRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'search-service'
$secretFile = Join-Path $searchRoot '.env'
if (-not (Test-Path -LiteralPath $secretFile)) {
  $secret = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
  [IO.File]::WriteAllText($secretFile, "SALES_SEARCH_SECRET=$secret`n")
}
docker compose --project-directory $searchRoot -f (Join-Path $searchRoot 'compose.yaml') up -d
if ($LASTEXITCODE -ne 0) { throw 'Could not start local search. Make sure Docker Desktop is running.' }
Write-Output 'Local search is starting on 127.0.0.1:7080. Sales OS stays on port 7000.'
