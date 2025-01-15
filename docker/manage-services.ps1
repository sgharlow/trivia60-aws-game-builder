param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'build')]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('all', 'postgres', 'get-questions', 'add-questions', 'leaderboard', 'frontend')]
    [string]$Service = 'all'
)

$ErrorActionPreference = 'Stop'
$dockerComposeFile = "$PSScriptRoot/docker-compose.yml"

# Check if .env file exists, if not copy from example
if (-not (Test-Path "$PSScriptRoot/.env")) {
    Write-Host "No .env file found. Creating from env-example..."
    Copy-Item "$PSScriptRoot/env-example" "$PSScriptRoot/.env"
    Write-Host "Created .env file. Please review and update the values as needed."
    exit
}

function Get-ServiceStatus {
    $services = docker-compose -f $dockerComposeFile ps --format json | ConvertFrom-Json
    foreach ($svc in $services) {
        Write-Host "$($svc.Service): $($svc.State)"
    }
}

function Get-ServiceLogs {
    param([string]$svc)
    if ($svc -eq 'all') {
        docker-compose -f $dockerComposeFile logs --tail=100 -f
    } else {
        docker-compose -f $dockerComposeFile logs --tail=100 -f $svc
    }
}

switch ($Action) {
    'start' {
        if ($Service -eq 'all') {
            Write-Host "Starting all services..."
            docker-compose -f $dockerComposeFile up -d
        } else {
            Write-Host "Starting $Service..."
            docker-compose -f $dockerComposeFile up -d $Service
        }
    }
    'stop' {
        if ($Service -eq 'all') {
            Write-Host "Stopping all services..."
            docker-compose -f $dockerComposeFile down
        } else {
            Write-Host "Stopping $Service..."
            docker-compose -f $dockerComposeFile stop $Service
        }
    }
    'restart' {
        if ($Service -eq 'all') {
            Write-Host "Restarting all services..."
            docker-compose -f $dockerComposeFile restart
        } else {
            Write-Host "Restarting $Service..."
            docker-compose -f $dockerComposeFile restart $Service
        }
    }
    'status' {
        Write-Host "Current service status:"
        Get-ServiceStatus
    }
    'logs' {
        Write-Host "Showing logs for $Service..."
        Get-ServiceLogs $Service
    }
    'build' {
        if ($Service -eq 'all') {
            Write-Host "Building all services..."
            docker-compose -f $dockerComposeFile build --no-cache
        } else {
            Write-Host "Building $Service..."
            docker-compose -f $dockerComposeFile build --no-cache $Service
        }
    }
}
