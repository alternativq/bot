# Production Dockerfile for VeiloraVPN Bot & Mini App API
FROM python:3.11-slim

# Установка системных зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копирование требований и установка зависимостей Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование исходного кода проекта
COPY . .

# Переменные окружения по умолчанию
ENV PYTHONUNBUFFERED=1 \
    SUB_SERVER_HOST=0.0.0.0 \
    SUB_SERVER_PORT=8081

# Порт для REST API и единого подписочного сервера
EXPOSE 8081

# Команда запуска приложения
CMD ["python", "main.py"]
