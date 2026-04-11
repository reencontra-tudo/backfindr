FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY backend/requirements.txt .
RUN pip install --upgrade pip setuptools wheel && pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ .

# Create uploads directory
RUN mkdir -p uploads/objects

# Set PYTHONPATH to include the app directory
ENV PYTHONPATH=/app:$PYTHONPATH

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
# Build: Fri Apr 10 15:45:00 EDT 2026 - Force rebuild with cache clear
# Rebuild trigger Fri Apr 10 15:45:00 EDT 2026
