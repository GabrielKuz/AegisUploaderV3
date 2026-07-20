[![Pytest](https://github.com/GabrielKuz/AegisSummerInterns2026/actions/workflows/pytest.yml/badge.svg?event=push)](https://github.com/GabrielKuz/AegisSummerInterns2026/actions/workflows/pytest.yml)

# UploaderV3

Customer file upload application developed by the Aegis Software Summer 2026 internship team.

## Overview

This application provides a secure mechanism for customers to upload files associated with support cases. The system supports chunked uploads, Microsoft Entra authentication for internal users, Azure File Storage, and automatic routing of ITAR data to the appropriate storage region.

## Tech Stack

### Backend

- Python 3.14.5
- FastAPI
- PostgreSQL
- Alembic
- Docker & Docker Compose
- Nginx
- uv
- Azure File Storage

### Frontend

- React
- TypeScript
- Vite

## Getting Started
> These setup steps are written for Windows only.
### Prerequisites

- Docker Desktop
- Git
- mkcert
- PowerShell (Windows)

### Generate TLS/SSL certificates

Install mkcert:
```bash
winget install -e --id FiloSottile.mkcert
```

Run the script to generate the certificates:

```powershell
Scripts/generateCert.ps1
```
### Configure enviroment variables

Copy the example environment file:

```bash
copy .env.example .env
```

Then fill in the required values.

### Start the Development Environment

Build and start all services:

```bash
docker compose up --build
```

To run the application in the background:

```bash
docker compose up -d --build
```

The frontend and backend are both served behind Nginx.

## Application URLs

- Frontend: https://localhost
- Backend API: https://localhost/api
- Swagger: https://localhost/api/docs

## Common Commands

### Run Backend Tests

Containers must already be running.

```bash
docker compose exec backend uv run pytest -v
```

### Execute a Command Inside a Container

```bash
docker compose exec <container> <command>
```

Examples:

```bash
docker compose exec backend python test.py
docker compose exec backend ls
```

### Database Migrations

After modifying SQLAlchemy models, generate a new migration:

```powershell
Scripts/migrateDB.ps1 "MigrationName"
```

Then recreate the local database:

```bash
docker compose down -v
docker compose up --build
```

## API Routing

Frontend requests should use relative API paths:

```javascript
fetch("/api/health")
```

Nginx automatically removes the `/api` prefix before forwarding requests to the FastAPI backend, allowing the frontend to avoid hardcoding backend URLs.

## Project Structure

```
.
├── backend/
├── frontend/
├── nginx/
├── Scripts/
├── docker-compose.yml
└── README.md
```

## Troubleshooting

### Alembic migration files missing after pulling

If new migration files are not pulled correctly:

```bash
git checkout origin/main backend/migrations/versions
```

### Useful Docker Commands

View logs:

```bash
docker compose logs -f
```

Restart containers:

```bash
docker compose restart
```

Stop containers:

```bash
docker compose down
```

Stop containers and remove volumes:

```bash
docker compose down -v
```
