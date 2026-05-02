$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[ml_service] Initializing Python virtual environment (Windows)" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServiceDir = Split-Path -Parent $ScriptDir
$VenvDir = Join-Path $ServiceDir ".venv"

function Get-PythonPath {
    # Prefer the Windows Python launcher for a specific version, fallback to generic python
    $candidates = @(
        @{ cmd = "py"; args = "-3.11" },
        @{ cmd = "py"; args = "-3.10" },
        @{ cmd = "py"; args = "-3.9" },
        @{ cmd = "py"; args = "" },
        @{ cmd = "python"; args = "" },
        @{ cmd = "python3"; args = "" }
    )

    foreach ($c in $candidates) {
        if (Get-Command $c.cmd -ErrorAction SilentlyContinue) {
            if ($c.args) {
                try {
                    $ver = & $c.cmd $c.args --version 2>$null
                    if ($LASTEXITCODE -eq 0) { return @($c.cmd, $c.args) }
                } catch { }
            } else {
                try {
                    $ver = & $c.cmd --version 2>$null
                    if ($LASTEXITCODE -eq 0) { return @($c.cmd) }
                } catch { }
            }
        }
    }
    throw "Python not found. Please install Python 3.11+ from https://www.python.org/downloads/ or Microsoft Store."
}

$py = @(Get-PythonPath)

if (-not (Test-Path $VenvDir)) {
    Write-Host "[ml_service] Creating virtual environment at $VenvDir" -ForegroundColor Yellow
    if ($py.Count -gt 1) {
        & $py[0] $py[1] -m venv $VenvDir
        if ($LASTEXITCODE -ne 0) { & $py[0] -m venv $VenvDir }
    } else {
        & $py[0] -m venv $VenvDir
    }
}

$VenvPython = Join-Path $VenvDir "Scripts/python.exe"
if (-not (Test-Path $VenvPython)) {
    throw "Python not found in venv. Expected at $VenvPython"
}

try {
    & $VenvPython -m pip --version *> $null
} catch {
    Write-Host "[ml_service] Bootstrapping pip in venv" -ForegroundColor Yellow
    & $VenvPython -m ensurepip --upgrade
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to bootstrap pip in venv"
    }
}

& $VenvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
    throw "Failed to upgrade pip in venv"
}

& $VenvPython -m pip install -r (Join-Path $ServiceDir "requirements.txt")
if ($LASTEXITCODE -ne 0) {
    throw "Failed to install ML service requirements"
}

Write-Host "[ml_service] Environment ready -> $VenvDir" -ForegroundColor Green
