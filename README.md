[![Pytest](https://github.com/GabrielKuz/AegisSummerInterns2026/actions/workflows/pytest.yml/badge.svg?event=push)](https://github.com/GabrielKuz/AegisSummerInterns2026/actions/workflows/pytest.yml)
# AegisSummerInterns2026
Project of Aegis Software interns during the summer of 2026

# Tech stack
## Backend
- Python 3.14.5
- nginx
- Docker
- uv
- Alembic
- Azure/Azurite
- PostgreSQL

Run backend with `docker compose up --build`
Run backend tests with `docker compose exec backend uv run pytest -v` after running the container in detached mode
To run a single file seperate from the rest of the backend start the detached container `docker compose up -d --build` then run the file `docker compose exec {container} {command}` (eg `docker compose exec backend python test.py` or `docker compose backend exec ls`)

Backend and frontend are behind nginx, so frontend can directly call apis with `fetch("/api/health")` and ignore the preceeding url. Nginx strips the leading /api so the call routes to the FastAPI /health endpoint.

To migrate db after changing models run `Scripts/migrateDB.ps1 "migrationName"` with the container up then `docker compose down -v` 

If git doesn't pull alembic run `git checkout origin/main backend\migrations\versions` from top level dir
