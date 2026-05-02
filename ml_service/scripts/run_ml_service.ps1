$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServiceDir = Split-Path -Parent $ScriptDir
$VenvDir = Join-Path $ServiceDir ".venv"
$VenvPython = Join-Path $VenvDir "Scripts/python.exe"

if (-not (Test-Path $VenvPython)) {
    & (Join-Path $ScriptDir "setup_ml_env.ps1")
}

if (-not (Test-Path $VenvPython)) {
    Write-Error "[ml_service] Missing Python at $VenvPython after setup."
    exit 1
}

try {
    & $VenvPython -m uvicorn --version *> $null
} catch {
    & (Join-Path $ScriptDir "setup_ml_env.ps1")
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
    & $VenvPython -m uvicorn "src.app.main:app" --host $HostAddr --port $Port @args
} finally {
    Pop-Location
}
