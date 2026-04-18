FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg2 (Postgres driver) and bcrypt compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Firebase service account is injected at runtime via FIREBASE_SERVICE_ACCOUNT_B64
# env var (see app/firebase.py) — no service account file baked into image.

EXPOSE 8050

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8050"]
