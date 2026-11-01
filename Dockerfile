# Multi-arch Dockerfile for Rekola GPX & Map Motion Graphics Studio
FROM python:3.10-slim

# Install system dependencies: FFmpeg with ProRes support, SQLite3, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    sqlite3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency requirements first for efficient layer caching
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . /app

# Create persistent storage directories
RUN mkdir -p /app/data /app/exports /app/assets

# Volumes for Portainer persistence
VOLUME ["/app/data", "/app/exports"]

# Expose web studio port
EXPOSE 8000

ENV PYTHONUNBUFFERED=1

# Run FastAPI backend with Uvicorn
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
