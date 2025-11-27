$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServiceDir = Split-Path -Parent $ScriptDir
$VenvDir = Join-Path $ServiceDir ".venv"
$Uvicorn = Join-Path $VenvDir "Scripts/uvicorn.exe"

if (-not (Test-Path $Uvicorn)) {
    Write-Error "[ml_service] Missing uvicorn at $Uvicorn. Run scripts/setup_ml_env.ps1 first."
    exit 1
}

$HostAddr = if ($env:ML_SERVICE_HOST) { $env:ML_SERVICE_HOST } else { "0.0.0.0" }
$Port = if ($env:ML_SERVICE_PORT) { $env:ML_SERVICE_PORT } else { "8001" }

# Ensure Python can import from the service root when started inside this script
if ($env:PYTHONPATH) {
    $env:PYTHONPATH = "$ServiceDir;$env:PYTHONPATH"
} else {
    $env:PYTHONPATH = $ServiceDir
}

Push-Location $ServiceDir
try {
    & $Uvicorn "src.app.main:app" --host $HostAddr --port $Port @args
} finally {
    Pop-Location
}
