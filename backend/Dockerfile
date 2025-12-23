FROM python:3.11-slim

# Install FFmpeg (Required for pydub/yt-dlp)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Install build essentials potentially needed for some python packages
# RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip
RUN pip install --upgrade pip

# Install Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create temp dir for processing
RUN mkdir -p temp downloads

# Command
# Note: This is overriden by docker-compose for dev mode, but good default for prod.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
