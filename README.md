[![Pytest](https://github.com/GabrielKuz/AegisSummerInterns2026/actions/workflows/pytest.yml/badge.svg?event=push)](https://github.com/GabrielKuz/AegisSummerInterns2026/actions/workflows/pytest.yml)

# UploaderV3

Customer file upload application developed by the Aegis Software Summer 2026 internship team.

## Overview

This application provides a secure mechanism for customers to upload files associated with support cases. The system supports chunked uploads, Microsoft Entra authentication for internal users, Azure File Storage, and automatic routing of ITAR data to the appropriate storage region.

## Features

- Secure customer file uploads
- Chunked upload support
- Microsoft Entra authentication
- Azure File Storage integration
- Automatic ITAR data routing
- REST API with Swagger documentation
---
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
> These setup steps are only written for Windows. They can be adapted to support other operating systems.  
### Prerequisites

- Docker Desktop
- Git
- mkcert
- PowerShell (Windows)

### Clone the Repository

Clone the repository to access it locally:

```bash
git clone https://github.com/GabrielKuz/AegisUploaderV3.git
```

### Generate TLS/SSL certificates

Install mkcert to generate locally trusted SSL certificates which allows us to use MSAL.js and Microsoft EntraID:
```bash
winget install -e --id FiloSottile.mkcert
```

Run the script to generate the certificates:

```powershell
Scripts/generateCert.ps1
```
### Configure Environment Variables

Copy the example environment file:

```bash
copy .env.example .env
```

Then fill in the required values, including Azure Storage credentials, PostgreSQL configuration, and Microsoft Entra application settings.

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

## Local Application URLs

- Frontend: https://localhost
- Backend API: https://localhost/api
- Swagger: https://localhost/api/docs
---
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
docker compose exec backend sh
docker compose exec postgres psql -U <username> -d <Database>
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

## Repository Structure

```
.
├── backend/
│   ├── migrations/      # Alembic database migrations
│   ├── modules/         # FastAPI application code
│   ├── tests/           # Backend tests
│   └── main.py          # Entrypoint into backend
├── frontend/
│   ├── public/          # Static assets
│   └── src/             # React application
├── nginx/               # Reverse proxy configuration
├── Scripts/             # Development scripts
├── .github/
│   └── workflows/       # CI/CD workflows
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

Stop containers:

```bash
docker compose down
```

Stop containers and delete volumes (Including database volume):

```bash
docker compose down -v
```
