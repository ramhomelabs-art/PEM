from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Header, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import shutil
import uuid
from typing import Optional

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="AI Statement Extraction Service",
    description="ChatGPT-level document understanding for bank statements",
    version="2.0.0"
)

# Configure logging globally for the application
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("extraction_service.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# CORS Configuration — restrict to explicitly configured origins.
_allowed_origins = [o.strip() for o in os.getenv("PYTHON_CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,  # e.g. "http://localhost:5174,http://192.168.1.10:5174"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared secret guarding service-control endpoints (e.g. /restart).
SERVICE_API_KEY = os.getenv("PYTHON_API_KEY", "pem_internal_service_key_2026")


async def require_api_key(x_api_key: Optional[str] = Header(None)):
    if not SERVICE_API_KEY:
        raise HTTPException(status_code=403, detail="Service control is disabled (PYTHON_API_KEY not configured)")
    if x_api_key != SERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

# Configuration
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
UPLOAD_FOLDER = 'temp_uploads'

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Import services
from services.pdf_extractor import extract_statement
from services.validator import validate_extraction

# Level 3 ML SMS Parser Initialization
try:
    from ml_training.predict import load_model, parse_sms_ml
    logger.info("Loading Level 3 ML SMS Parser model...")
    ml_nlp_pipeline = load_model()
    logger.info("Level 3 ML SMS Parser loaded successfully!")
except Exception as e:
    logger.warning(f"Failed to load Level 3 ML SMS Parser: {str(e)}. Falling back to Level 2.")
    ml_nlp_pipeline = None

# Pydantic models
class ValidationRequest(BaseModel):
    metadata: dict
    transactions: list
    confidence: Optional[float] = 0.0

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        'status': 'healthy',
        'service': 'AI Statement Extraction Service',
        'version': '2.0.0',
        'capabilities': [
            'PDF text extraction',
            'OCR for scanned documents',
            'Table detection',
            'Layout understanding',
            'Merchant normalization',
            'Auto-categorization',
            'Confidence scoring'
        ]
    }

@app.post("/api/extract/statement")
async def extract_statement_endpoint(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None)
):
    """
    Extract transactions from uploaded PDF statement
    
    Args:
        file: PDF file upload
        password: Optional password for encrypted PDFs
    
    Returns: {
        metadata: {...},
        transactions: [...],
        confidence: 0.95
    }
    """
    try:
        # Validate file type
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Check file size
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 50MB")
        
        # Save file temporarily under a random, safe name (never trust client filename)
        filepath = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4().hex}.pdf")
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Debug logging
        print(f"Password received: {'Yes' if password else 'No'}")
        if password:
            print(f"Password length: {len(password)}")
        
        # Extract transactions (pass password if provided)
        # RUN IN THREADPOOL to avoid blocking the async event loop
        import asyncio
        from functools import partial
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, 
            partial(extract_statement, filepath, password=password)
        )
        
        # Clean up temporary file
        try:
            os.remove(filepath)
        except:
            pass
        
        return result
        
    except ValueError as e:
        # Check for password error explicitly
        if str(e) == "PASSWORD_REQUIRED":
            return JSONResponse(
                status_code=401, 
                content={"error": "PDF is password protected", "encrypted": True}
            )
        elif str(e) == "INVALID_PASSWORD":
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid password", "encrypted": True}
            )
        return JSONResponse(status_code=422, content={"error": str(e)})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TextExtractionRequest(BaseModel):
    text: str
    mode: Optional[str] = "sms" # sms, manual, email

@app.post("/api/extract/text")
async def extract_text_endpoint(request: TextExtractionRequest):
    """
    Extract transaction from raw text (SMS/Manual Entry)
    """
    try:
        from services.regex_rules import UNIVERSAL_REGEX, normalize_amount, calculate_confidence, BANK_REGEX_MAP, extract_manual_details
        from services.category_detector import detect_category
        from services.merchant_normalizer import normalize_merchant
        import re

        text = request.text
        matched_txn = None
        extractor_type = 'unknown'

        # 0. Try Level 3 ML SMS Parser (NEW!)
        if ml_nlp_pipeline and request.mode != 'manual':
            try:
                ml_parsed = parse_sms_ml(text, ml_nlp_pipeline)
                if ml_parsed.get('confidence', 0) > 0.85:
                    # Use ML result if high confidence
                    merchant = ml_parsed.get('merchant', 'Unknown')
                    
                    # Smart Payment Method Logic
                    payment_method = ml_parsed.get('payment_mode')
                    if not payment_method:
                        # Fallback to keyword search in raw text
                        u_text = text.upper()
                        if any(k in u_text for k in ['UPI', 'VPA', 'G-PAY', 'GPAY', 'PAYTM', 'PHONEPE']):
                            payment_method = 'UPI'
                        elif any(k in u_text for k in ['CARD', 'VISA', 'MASTERCARD', 'ATM']):
                            payment_method = 'Card'
                        elif 'NEFT' in u_text or 'IMPS' in u_text or 'RTGS' in u_text:
                            payment_method = 'Transfer'
                        else:
                            payment_method = 'Card'

                    result = {
                        "amount": ml_parsed.get('amount', 0),
                        "type": ml_parsed.get('type', 'debit'),
                        "merchant": merchant,
                        "category": detect_category(merchant, text)[0],
                        "date": ml_parsed.get('date'),
                        "description": text[:100],
                        "paymentMethod": payment_method,
                        "raw_message": text,
                        "confidence": ml_parsed.get('confidence', 0.9),
                        "extractor": "ml_bert_ner"
                    }
                    logger.info(f"Level 3 ML Parser SUCCESS (conf: {result['confidence']:.2f}, mode: {payment_method})")
                    return result
            except Exception as e:
                logger.warning(f"Level 3 ML Parser failed: {str(e)}, falling back to Level 2")

        # 1. Try Node.js SMS Parser Service (Level 2 - Advanced Regex)
        try:
            import requests
            node_response = requests.post('http://localhost:5003/parse', 
                json={'text': text}, 
                timeout=2
            )
            if node_response.status_code == 200:
                node_data = node_response.json()
                if node_data.get('success') and node_data.get('data'):
                    parsed = node_data['data']
                    # Use Node.js parser result directly
                    result = {
                        "amount": parsed.get('amount', 0),
                        "type": parsed.get('type', 'debit'),  # Already 'credit' or 'debit'
                        "merchant": parsed.get('merchant', 'Unknown'),
                        "category": detect_category(parsed.get('merchant', ''), text)[0],
                        "date": matched_txn.get('date') if matched_txn else None,
                        "description": text[:100],
                        "paymentMethod": parsed.get('paymentMethod', 'Card'),
                        "raw_message": text,
                        "confidence": 0.9,  # High confidence for Node parser
                        "extractor": "node_sms_parser"
                    }
                    return result
        except Exception as e:
            logger.warning(f"Node.js parser service unavailable: {str(e)}, falling back to Python")

        # 2. Manual Entry check (High Priority for 'manual' mode or natural language)
        if request.mode == 'manual':
             manual_data = extract_manual_details(text)
             if manual_data:
                 matched_txn = manual_data
                 extractor_type = matched_txn.pop('extractor', 'manual')
        
        # 3. Try Specific Bank Regex (if not already matched)
        if not matched_txn:
            for bank, regex in BANK_REGEX_MAP.items():
                if bank.lower() in text.lower():
                    match = regex.search(text)
                    if match:
                        matched_txn = match.groupdict()
                        extractor_type = 'bank_specific'
                        matched_txn['bank'] = bank
                        break

        # 4. Manual Regex Fallback (even if mode != manual, maybe user sent manual text to SMS webhook)
        if not matched_txn:
             manual_data = extract_manual_details(text)
             if manual_data:
                 matched_txn = manual_data
                 extractor_type = matched_txn.pop('extractor', 'manual_fallback')

        # 5. Universal Regex Fallback
        if not matched_txn:
            match = UNIVERSAL_REGEX.search(text)
            if match:
                matched_txn = match.groupdict()
                extractor_type = 'universal_regex'

        if not matched_txn:
             return JSONResponse(content={"status": "failed", "reason": "No pattern matched"}, status_code=200)

        # 6. Clean & Normalize (Python fallback path)
        amount, type_str = normalize_amount(matched_txn.get('amount'), matched_txn.get('crdr'), text)
        
        # Method / Source handling - Smart Detection
        method = matched_txn.get('method')
        
        # If no method from regex, detect from text
        # IMPORTANT: Check in order of specificity (most specific first)
        if not method:
            text_upper = text.upper()
            # 1. UPI (most specific - check first!)
            if 'UPI' in text_upper or any(keyword in text_upper for keyword in ['GPAY', 'PHONEPE', 'PAYTM', 'BHIM', 'VPA']):
                method = 'UPI'
            # 2. Card payments
            elif any(keyword in text_upper for keyword in ['CREDIT CARD', 'CC-']):
                method = 'Credit Card'
            elif any(keyword in text_upper for keyword in ['DEBIT CARD', 'DC-', 'ATM']):
                method = 'Debit Card'
            # 3. Bank transfers (less specific)
            elif any(keyword in text_upper for keyword in ['NEFT', 'RTGS', 'IMPS']):
                method = 'Bank Transfer'
            # 4. Cash
            elif 'CASH' in text_upper:
                method = 'Cash'
            # 5. Default fallback
            else:
                # If it mentions A/C or account but no other method, it's likely bank transfer
                if 'A/C' in text_upper or 'ACCOUNT' in text_upper:
                    method = 'Bank Transfer'
                else:
                    # Final default based on transaction type
                    method = 'Bank Transfer' if type_str == 'credit' else 'Card'
        
        # Description / Merchant handling
        raw_desc = matched_txn.get('description', matched_txn.get('note', 'Unknown'))
        merchant = normalize_merchant(raw_desc)
        
        # Category
        category = matched_txn.get('category')
        if not category:
            category, _ = predict_category(merchant, raw_desc)
        
        result = {
            "amount": amount,
            "type": type_str,
            "merchant": merchant,
            "category": category,
            "date": matched_txn.get('date'),
            "description": raw_desc,
            "paymentMethod": method,
            "raw_message": text,  # ADD FULL RAW MESSAGE
            "confidence": calculate_confidence({
                "amount": amount, 
                "date": matched_txn.get('date'), 
                "category": category,
                "extractor_type": extractor_type
            }),
            "extractor": extractor_type
        }

        return result

    except Exception as e:
        logger.error(f"Text extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract/validate")
async def validate_extraction_endpoint(data: ValidationRequest):
    """
    Validate extracted transactions
    
    Returns: validation results
    """
    try:
        validation_result = validate_extraction(data.dict())
        return validation_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/restart")
async def restart_service(_: bool = Depends(require_api_key)):
    """
    Restart the Python service
    """
    import sys
    import threading
    
    def restart():
        import time
        time.sleep(1) # Give time for response to be sent
        os.execv(sys.executable, ['python'] + sys.argv)
        
    # Run in background thread to allow returning response
    threading.Thread(target=restart).start()
    
    return {"status": "restarting", "message": "Service is restarting..."}


if __name__ == '__main__':
    import uvicorn
    port = int(os.getenv('PORT', 5002))
    
    print(f"Starting AI Extraction Service on port {port}")
    print(f"API Documentation: http://localhost:{port}/docs")
    
    uvicorn.run(
        "app:app",
        host='0.0.0.0',
        port=port
    )

# Reload triggered for Docling migration
