#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting API..."
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4 \
    --proxy-headers