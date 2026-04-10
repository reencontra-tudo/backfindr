FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ .

# Create uploads directory
RUN mkdir -p uploads/objects

# Set PYTHONPATH to include the app directory
ENV PYTHONPATH=/app:$PYTHONPATH

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
# Build: Fri Apr 10 05:41:55 EDT 2026
