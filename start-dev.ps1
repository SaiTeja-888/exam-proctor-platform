$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Logs = Join-Path $Root "logs"
$VenvPython = Join-Path $Backend "venv\Scripts\python.exe"

New-Item -ItemType Directory -Force -Path $Logs | Out-Null

if (-not (Test-Path $VenvPython)) {
    Write-Host "Creating backend virtual environment..."
    Push-Location $Backend
    python -m venv venv
    & $VenvPython -m pip install -r requirements.txt
    Pop-Location
}

if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $Frontend
    npm install
    Pop-Location
}

Write-Host "Starting backend on http://127.0.0.1:8000"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd `"$Backend`"; .\venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"
)

Write-Host "Starting frontend on http://127.0.0.1:3000"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd `"$Frontend`"; `$env:VITE_API_URL='http://127.0.0.1:8000'; npm run dev -- --host 127.0.0.1 --port 3000"
)

Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:3000"

Write-Host ""
Write-Host "App is starting."
Write-Host "Frontend: http://127.0.0.1:3000"
Write-Host "Backend:  http://127.0.0.1:8000"
Write-Host "Admin:    admin / admin123"
Write-Host "Invite:   EXAM-DEMO-2026"
