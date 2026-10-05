# AI Statement Extraction Service

Python microservice for extracting transactions from bank/credit card statements using AI-level document understanding.

## Features

- **PDF Text Extraction** - Extract from digital PDFs
- **OCR Support** - Handle scanned documents
- **Table Detection** - Identify and parse transaction tables
- **Merchant Normalization** - Clean merchant names
- **Auto-Categorization** - Detect transaction categories
- **Confidence Scoring** - Rate extraction accuracy

## Installation

### Prerequisites

- Python 3.8+
- Tesseract OCR (for scanned PDFs)

### Install Tesseract

**Windows:**
```bash
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
# Install and add to PATH
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr
```

**Mac:**
```bash
brew install tesseract
```

### Install Python Dependencies

```bash
cd python-extraction-service
pip install -r requirements.txt
```

## Running the Service

### Development Mode

```bash
python app.py
```

Service will start on `http://localhost:5002`

### Production Mode

```bash
gunicorn -w 4 -b 0.0.0.0:5002 app:app
```

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "AI Statement Extraction Service",
  "version": "1.0.0"
}
```

### Extract Statement

```
POST /api/extract/statement
Content-Type: multipart/form-data
```

Request:
- `file`: PDF file (max 50MB)

Response:
```json
{
  "metadata": {
    "bank_name": "HDFC",
    "account_type": "credit_card",
    "currency": "INR",
    "statement_period": "01/12/2024 to 31/12/2024"
  },
  "transactions": [
    {
      "date": "2024-12-01",
      "merchant": "ZOMATO",
      "raw_description": "PAY*ZOMATO*BLR",
      "amount": 450.00,
      "type": "expense",
      "category": "Food",
      "confidence": 0.95
    }
  ],
  "confidence": 0.92,
  "total_transactions": 45
}
```

### Validate Extraction

```
POST /api/extract/validate
Content-Type: application/json
```

Request:
```json
{
  "transactions": [...]
}
```

Response:
```json
{
  "is_valid": true,
  "errors": [],
  "warnings": [],
  "statistics": {
    "total_transactions": 45,
    "high_confidence": 40,
    "medium_confidence": 3,
    "low_confidence": 2
  }
}
```

## Architecture

```
python-extraction-service/
├── app.py                          # Flask application
├── requirements.txt                # Dependencies
├── .env                            # Configuration
├── services/
│   ├── pdf_extractor.py            # Main extraction logic
│   ├── ocr_engine.py               # OCR processing
│   ├── table_detector.py           # Table detection
│   ├── merchant_normalizer.py      # Merchant name cleanup
│   ├── category_detector.py        # Auto-categorization
│   └── validator.py                # Data validation
└── temp_uploads/                   # Temporary file storage
```

## Supported Banks

### Indian Banks
- HDFC Bank
- ICICI Bank
- State Bank of India (SBI)
- Axis Bank
- Kotak Mahindra Bank
- RBL Bank

### International Banks
- Chase
- American Express
- Citibank
- (More to be added)

## Configuration

Edit `.env` file:

```env
PORT=5002
FLASK_ENV=development
TESSERACT_CMD=tesseract
MIN_CONFIDENCE=0.6
HIGH_CONFIDENCE=0.9
```

## Testing

```bash
# Test with sample PDF
curl -X POST http://localhost:5002/api/extract/statement \
  -F "file=@sample_statement.pdf"
```

## Deployment

### With Gunicorn

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5002 app:app
```

### With Docker (Optional)

```dockerfile
FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5002", "app:app"]
```

## Troubleshooting

### Tesseract not found
```bash
# Set path in .env
TESSERACT_CMD=/usr/bin/tesseract
```

### Camelot errors
```bash
# Install system dependencies
sudo apt-get install ghostscript python3-tk
```

## License

MIT
