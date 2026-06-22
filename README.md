# AegisSummerInterns2026
Project of Aegis Software interns during the summer of 2026

# Tech stack
## Backend
- Python 3.14.5

Run backend with `docker compose up --build`
Run backend tests with `uv run pytest -v` (cd into /backend first)
To run a single file seperate from the rest of the backend start the detached container `docker compose up -d --build` then run the file `docker compose exec {container} {command}` (eg `docker compose exec backend python test.py` or `docker compose backend exec ls`)