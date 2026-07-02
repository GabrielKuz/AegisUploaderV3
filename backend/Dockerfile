# python 3.14 with minimal packages on debian
FROM python:3.14.6-slim-bookworm 

#prevent python from writing bytecode to disk and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
# Install dependencies and create a non-root user to run the application
RUN groupadd --system app \
    && useradd --system --gid app --home /app app \
    && pip install --no-cache-dir uv \
    && chown app:app /app
#Move the copy of pyproject.toml and uv.lock to the working directory and install dependencies in a venv
COPY --chown=app:app pyproject.toml uv.lock ./

# switch to non-root user and install dependencies in a venv
USER app 
RUN uv sync --frozen --no-dev
#copy the rest of the application code to the working directory
COPY --chown=app:app . .
#expose 8000 for the uvicorn server so nginx can proxy requests to it
EXPOSE 8000
# run the uvicorn server with the main app module and listen on all interfaces
CMD [ "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]