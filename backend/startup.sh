#!/bin/sh
set -e

echo "Running migrations..."
alembic upgrade head

echo "Starting services..."
exec supervisord -c /etc/supervisord.conf