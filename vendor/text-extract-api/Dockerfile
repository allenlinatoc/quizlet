FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgl1 poppler-utils libmagic1 libmagic-dev libpoppler-cpp-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY upstream/ /app/
RUN pip install --no-cache-dir --upgrade pip setuptools && pip install --no-cache-dir .
ENV PYTHONPATH=/app:/app/text_extract_api
