# Python 3.14 with minimal packages on Debian
FROM python:3.14.6-slim-bookworm

# Prevent Python from writing bytecode to disk and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install dependencies and create a non-root user
RUN groupadd --system app \
    && useradd --system --gid app --home /app app \
    && pip install --no-cache-dir uv \
    && chown app:app /app

# Copy dependency files first for better layer caching
COPY --chown=app:app pyproject.toml uv.lock ./

# Switch to the non-root user
USER app

# Install Python dependencies
RUN uv sync --frozen --no-dev

# Copy the rest of the application
COPY --chown=app:app . .

# Ensure the startup script is executable
RUN chmod +x /app/startup.sh

# Expose the application port
EXPOSE 8000

# Run the startup script
ENTRYPOINT ["/app/startup.sh"]