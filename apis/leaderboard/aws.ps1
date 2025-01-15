# PowerShell script for deploying Lambda function

# Function to check if a command exists
function Test-CommandExists {
    param ($command)
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'stop'
    try {
        if (Get-Command $command) { return $true }
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $oldPreference
    }
}

# Check and install AWS SAM CLI if not present
if (-not (Test-CommandExists sam)) {
    Write-Host "AWS SAM CLI not found. Installing..."
    # Download AWS SAM CLI installer
    $installerUrl = "https://github.com/aws/aws-sam-cli/releases/latest/download/AWS_SAM_CLI_64_PY3.msi"
    $installerPath = "$env:TEMP\AWS_SAM_CLI_64_PY3.msi"
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath
    
    # Install AWS SAM CLI
    Start-Process msiexec.exe -Wait -ArgumentList "/i $installerPath /quiet"
    Remove-Item $installerPath
    
    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Load environment variables from .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1]
        $value = $matches[2]
        Set-Item -Path "env:$key" -Value $value
    }
}

# Create lambda directory if it doesn't exist
if (-not (Test-Path lambda)) {
    New-Item -ItemType Directory -Path lambda
}

# Navigate to lambda directory
Set-Location lambda

# Install npm dependencies
npm install

# Update AWS deployment script for new API endpoints

# Deploy the new leaderboard API endpoints
function Deploy-LeaderboardAPI {
    Write-Host "Deploying Leaderboard API endpoints..."
    # Add commands to deploy the new API Gateway endpoints
    # Ensure to update the Lambda function configuration if necessary
}

Deploy-LeaderboardAPI

# Return to original directory
Set-Location ..