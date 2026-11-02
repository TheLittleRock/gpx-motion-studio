# Multi-arch capable Dockerfile for GPX Motion Graphics Studio
FROM python:3.10-slim

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies (FFmpeg for ProRes/WebM/MP4 encoding, SQLite, and network utilities)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    sqlite3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code and assets
COPY . .

# Ensure storage directories exist with appropriate permissions
RUN mkdir -p /app/data /app/exports /app/assets

# Expose web server port
EXPOSE 8000

# Health check to ensure service responsiveness
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/version || exit 1

# Run FastAPI server
CMD ["python3", "server.py"]
