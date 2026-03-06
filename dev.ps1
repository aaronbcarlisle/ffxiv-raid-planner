# FFXIV Raid Planner - Development Server Script (Windows)
# Kills existing servers and starts fresh frontend + backend

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "logs", "")]
    [string]$Action = "start"
)

$ProjectRoot = $PSScriptRoot
$FrontendPort = 5173
$BackendPort = 8000
$LogDir = Join-Path $ProjectRoot ".logs"
$VenvPython = Join-Path $ProjectRoot "backend\venv\Scripts\python.exe"
$VenvUvicorn = Join-Path $ProjectRoot "backend\venv\Scripts\uvicorn.exe"
$PnpmPath = (Get-Command pnpm -ErrorAction SilentlyContinue)?.Source

function Write-Header {
    Write-Host ""
    Write-Host "  FFXIV Raid Planner - Development Servers" -ForegroundColor Cyan
    Write-Host ("  " + "=" * 47) -ForegroundColor Cyan
}

function Stop-Servers {
    Write-Host "  Stopping existing servers..." -ForegroundColor Yellow
    $stopped = $false

    # Kill processes on backend port
    $backendProcs = Get-NetTCPConnection -LocalPort $BackendPort -ErrorAction SilentlyContinue |
        Where-Object State -eq 'Listen' |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $backendProcs) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        $stopped = $true
    }

    # Kill processes on frontend port
    $frontendProcs = Get-NetTCPConnection -LocalPort $FrontendPort -ErrorAction SilentlyContinue |
        Where-Object State -eq 'Listen' |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $frontendProcs) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        $stopped = $true
    }

    if ($stopped) {
        Start-Sleep -Seconds 1
    }
    Write-Host "  Done" -ForegroundColor Green
}

function Start-Servers {
    # Ensure log directory exists
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

    # Check prerequisites
    if (-not (Test-Path $VenvUvicorn)) {
        Write-Host "  ERROR: Backend venv not found. Run:" -ForegroundColor Red
        Write-Host "    cd backend" -ForegroundColor Yellow
        Write-Host "    python -m venv venv" -ForegroundColor Yellow
        Write-Host "    venv\Scripts\pip.exe install -r requirements.txt" -ForegroundColor Yellow
        return
    }

    # Check for .env
    $envFile = Join-Path $ProjectRoot "backend\.env"
    if (-not (Test-Path $envFile)) {
        Write-Host "  WARNING: No backend/.env file found. Copy from .env.example" -ForegroundColor Yellow
    }

    # Start backend
    Write-Host "  Starting backend server..." -ForegroundColor Yellow
    $backendLog = Join-Path $LogDir "backend.log"
    $backendProc = Start-Process -FilePath $VenvUvicorn `
        -ArgumentList "app.main:app", "--reload", "--port", $BackendPort `
        -WorkingDirectory (Join-Path $ProjectRoot "backend") `
        -RedirectStandardOutput $backendLog `
        -RedirectStandardError (Join-Path $LogDir "backend-error.log") `
        -NoNewWindow -PassThru
    Write-Host "  Backend started (PID: $($backendProc.Id), Port: $BackendPort)" -ForegroundColor Green

    # Start frontend
    Write-Host "  Starting frontend server..." -ForegroundColor Yellow
    $frontendLog = Join-Path $LogDir "frontend.log"
    if ($PnpmPath) {
        $frontendProc = Start-Process -FilePath $PnpmPath `
            -ArgumentList "dev" `
            -WorkingDirectory (Join-Path $ProjectRoot "frontend") `
            -RedirectStandardOutput $frontendLog `
            -RedirectStandardError (Join-Path $LogDir "frontend-error.log") `
            -NoNewWindow -PassThru
    } else {
        $frontendProc = Start-Process -FilePath "npm" `
            -ArgumentList "run", "dev" `
            -WorkingDirectory (Join-Path $ProjectRoot "frontend") `
            -RedirectStandardOutput $frontendLog `
            -RedirectStandardError (Join-Path $LogDir "frontend-error.log") `
            -NoNewWindow -PassThru
    }
    Write-Host "  Frontend started (PID: $($frontendProc.Id), Port: $FrontendPort)" -ForegroundColor Green

    # Wait and check
    Start-Sleep -Seconds 3

    Write-Host ""
    Write-Host "  Server Status" -ForegroundColor Cyan
    Write-Host ("  " + "-" * 40) -ForegroundColor Cyan

    $backendOk = Get-NetTCPConnection -LocalPort $BackendPort -ErrorAction SilentlyContinue |
        Where-Object State -eq 'Listen'
    $frontendOk = Get-NetTCPConnection -LocalPort $FrontendPort -ErrorAction SilentlyContinue |
        Where-Object State -eq 'Listen'

    if ($backendOk) {
        Write-Host "  [OK] Backend:  http://localhost:$BackendPort" -ForegroundColor Green
    } else {
        Write-Host "  [X]  Backend:  Failed (check $LogDir\backend-error.log)" -ForegroundColor Red
    }

    if ($frontendOk) {
        Write-Host "  [OK] Frontend: http://localhost:$FrontendPort" -ForegroundColor Green
    } else {
        Write-Host "  [X]  Frontend: Failed (check $LogDir\frontend-error.log)" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "  Commands:" -ForegroundColor Cyan
    Write-Host "    View backend logs:  Get-Content $LogDir\backend.log -Tail 50 -Wait" -ForegroundColor Yellow
    Write-Host "    View frontend logs: Get-Content $LogDir\frontend.log -Tail 50 -Wait" -ForegroundColor Yellow
    Write-Host "    Stop servers:       .\dev.ps1 stop" -ForegroundColor Yellow
    Write-Host ""
}

function Show-Logs {
    $backendLog = Join-Path $LogDir "backend.log"
    $backendErrorLog = Join-Path $LogDir "backend-error.log"

    if (Test-Path $backendErrorLog) {
        Write-Host "=== Backend Error Log ===" -ForegroundColor Yellow
        Get-Content $backendErrorLog -Tail 30
    }
    if (Test-Path $backendLog) {
        Write-Host "=== Backend Log ===" -ForegroundColor Cyan
        Get-Content $backendLog -Tail 30
    }

    $frontendLog = Join-Path $LogDir "frontend.log"
    $frontendErrorLog = Join-Path $LogDir "frontend-error.log"

    if (Test-Path $frontendErrorLog) {
        Write-Host "=== Frontend Error Log ===" -ForegroundColor Yellow
        Get-Content $frontendErrorLog -Tail 30
    }
    if (Test-Path $frontendLog) {
        Write-Host "=== Frontend Log ===" -ForegroundColor Cyan
        Get-Content $frontendLog -Tail 30
    }
}

# Main
Write-Header

switch ($Action) {
    "stop" {
        Stop-Servers
    }
    "logs" {
        Show-Logs
    }
    default {
        Stop-Servers
        Start-Servers
    }
}
