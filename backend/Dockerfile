FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt requirements-dev.txt ./
RUN python -m pip install --no-cache-dir -r requirements-dev.txt
COPY requirements-report.txt ./
RUN python -m pip install --no-cache-dir -r requirements-report.txt
COPY . .
RUN useradd --system --create-home forestguard && mkdir -p /app/media /app/staticfiles && chown -R forestguard:forestguard /app
USER forestguard
EXPOSE 8000
CMD ["gunicorn", "backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]
