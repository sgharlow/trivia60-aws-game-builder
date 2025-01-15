# Trivia60 Docker Configuration

This directory contains the Docker configuration for all Trivia60 APIs.

## Services

- PostgreSQL Database (port 5432)
- Get Questions API (port 4001)
- Add Questions API (port 4002)
- Leaderboard API (port 4003)

## Setup

1. Copy `env-example` to `.env`:
   ```powershell
   Copy-Item env-example .env
   ```

2. Edit `.env` with your desired configuration

## Usage

The `manage-services.ps1` script provides a unified interface to manage all services:

### Commands

```powershell
# Start all services
.\manage-services.ps1 -Action start -Service all

# Start a specific service
.\manage-services.ps1 -Action start -Service leaderboard

# Stop all services
.\manage-services.ps1 -Action stop -Service all

# Restart a specific service
.\manage-services.ps1 -Action restart -Service get-questions

# View status of all services
.\manage-services.ps1 -Action status

# View logs of a specific service
.\manage-services.ps1 -Action logs -Service add-questions

# Rebuild all services
.\manage-services.ps1 -Action build -Service all
```

### Available Services

- `postgres`
- `get-questions`
- `add-questions`
- `leaderboard`
- `frontend`
- `all` (affects all services)

### Available Actions

- `start`: Start services
- `stop`: Stop services
- `restart`: Restart services
- `status`: Show service status
- `logs`: View service logs
- `build`: Rebuild services

## Development

To modify service configurations:

1. Edit the base Dockerfile in `Dockerfile.node`
2. Update environment variables in `env-example`
3. Update service configurations in `docker-compose.yml`

## Latest changes
Add Frontend Web App (port 8080) to the Services list
Add frontend as an available service in the examples
