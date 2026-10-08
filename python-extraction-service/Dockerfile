FROM python:3.11-slim
WORKDIR /app

# System dependencies for OCR & image processing
RUN apt-get update && apt-get install -y --no-install-recommends     tesseract-ocr     libtesseract-dev     poppler-utils     libgl1     libglib2.0-0     build-essential     && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=5002

EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3   CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5002/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5002"]
