FROM python:3.12-slim

# Dépendances système (tesseract pour OCR, build tools pour certaines libs Python)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-fra \
    libgl1 \
    libglib2.0-0 \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installer dépendances Python en premier (cache Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code
COPY . .

# Créer les dossiers de données (montés via volume en prod)
RUN mkdir -p /app/data/ged /app/data/chromadb /app/data/bm25_index \
              /app/data/local_db /app/data/uploads /app/data/templates

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
