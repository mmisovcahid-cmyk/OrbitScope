# OrbitScope backend (FastAPI + astropy/photutils)
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# libglib2.0-0 is needed by opencv-python-headless
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY run.py .

# Persistent data lives in /data (mount a volume there): SPHEREx cutout cache + candidate DB.
ENV SPHEREX_CACHE_DIR=/data/cache \
    ORBITSCOPE_DB_PATH=/data/db/orbitscope.db \
    DEBUG=false \
    LOG_LEVEL=INFO
VOLUME ["/data"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
