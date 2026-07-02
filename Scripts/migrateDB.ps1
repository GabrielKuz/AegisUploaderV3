param(
    [Parameter(Mandatory = $true)]
    [string]$Message
)

$ErrorActionPreference = "Stop"

Write-Host "generating migration"

docker compose exec backend uv run alembic revision --autogenerate -m "$Message"

if ($LASTEXITCODE -ne 0) {
    throw "failed to generate migration."
}

Write-Host "verifying migration"

$filename = (docker compose exec backend sh -c "ls -t /app/migrations/versions/*.py | head -n1").Trim()

if (-not $filename) {
    throw "migration file cant be found"
}

Write-Host "copying from container tmp to host"

docker compose cp "backend:$filename" "./backend/migrations/versions/"

if ($LASTEXITCODE -ne 0) {
    throw "failed to copy"
}

Write-Host ""
Write-Host "migration generated"
