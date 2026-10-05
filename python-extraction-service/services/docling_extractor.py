import os
import logging
from docling.document_converter import DocumentConverter
from datetime import datetime
import re
from .merchant_normalizer import normalize_merchant
from .category_detector import detect_category
import pypdf

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("extraction.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Converter globally to avoid reloading models on every request
try:
    logger.info("Initializing Docling Converter...")
    converter = DocumentConverter()
    logger.info("Docling Converter ready.")
except Exception as e:
    logger.error(f"Failed to initialize Docling: {e}")
    converter = None

def extract_statement(pdf_path, password=None):
    """
    Extracts transactions from a bank statement PDF using Docling.
    """
    temp_decrypted_path = None
    try:
        logger.info(f"Starting Docling extraction for {pdf_path}")
        
        if converter is None:
            raise Exception("Docling Converter is not initialized.")
            
        abs_path = os.path.abspath(pdf_path)
        logger.info(f"Using absolute path: {abs_path}")

        # Check Encryption with pypdf
        try:
            reader = pypdf.PdfReader(abs_path)
            if reader.is_encrypted:
                logger.info("PDF is encrypted.")
                if not password:
                    logger.warning("PDF is encrypted but no password provided.")
                    raise ValueError("PASSWORD_REQUIRED")
                
                # Try to decrypt
                if not reader.decrypt(password):
                     logger.warning("Invalid password provided.")
                     raise ValueError("INVALID_PASSWORD")
                
                # Decrypt to temporary file
                logger.info("Password correct. Decrypting to temporary file...")
                temp_decrypted_path = abs_path.replace(".pdf", "_decrypted.pdf")
                
                # Write decrypted content
                from pypdf import PdfWriter
                writer = PdfWriter()
                for page in reader.pages:
                    writer.add_page(page)
                
                with open(temp_decrypted_path, "wb") as f:
                    writer.write(f)
                
                logger.info(f"Decrypted file saved to {temp_decrypted_path}")
                # Use the decrypted file for Docling
                abs_path = temp_decrypted_path
        except ValueError as ve:
             raise ve
        except Exception as e:
             logger.warning(f"pypdf check failed, attempting direct Docling conversion: {e}")

        # Convert Document
        result = converter.convert(abs_path)
        document = result.document
        
        # Extract Metadata
        metadata = {
            "filename": os.path.basename(pdf_path),
            "page_count": len(document.pages),
            "bank_name": "Unknown", # logic to detect bank name from text
            "account_number": None, # logic to detect account number
            "statement_period": None # logic to detect dates
        }
        
        transactions = []
        
        # Iterate through tables found by Docling
        # Docling is very good at finding tables
        for table in document.tables:
            # We need to identify if this is a transaction table
            # heuristic: look for "Date", "Description", "Debit", "Credit", "Amount" in headers
            
            # Export to dataframe first to check headers safely
            try:
                # Some versions of docling require the document to be passed for proper export
                df = table.export_to_dataframe() 
            except Exception as e:
                logger.warning(f"Failed to export table to dataframe: {e}")
                # Try passing document if available in scope (it is 'document')
                try: 
                     df = table.export_to_dataframe(document)
                except Exception as e2:
                     logger.warning(f"Retry export failed: {e2}")
                     continue

            # Check headers from dataframe columns (safe and compatible)
            headers = [str(col).lower() for col in df.columns]
            header_str = " ".join(headers)
            
            logger.info(f"Table found with headers: {headers}")

            # Relaxed heuristic:
            # 1. Must have a 'date' column (or similar)
            # 2. Must have an 'amount', 'debit', 'credit', or 'balance' column
            has_date = any(x in header_str for x in ['date', 'time', 'dt'])
            has_amount = any(x in header_str for x in ['amount', 'debit', 'credit', 'amt', 'dr', 'cr'])
            
            if has_date and has_amount:
                logger.info(">>> Valid transaction table identified!")
                
                for index, row in df.iterrows():
                    txn = parse_transaction_row(row)
                    if txn:
                        transactions.append(txn)
            else:
                logger.info("Skipping table - missing required columns (Need Date + Amount)")

        # --- REGEX FALLBACK (TEXT ANALYSIS) ---
        # If table extraction yielded nothing, or to supplement it, scan the full text.
        # This is critical for HDFC statements where the format might not look like a standard table.
        
        from .regex_rules import HDFC_ROW_REGEX, normalize_hdfc_amount, calculate_confidence, GST_REGEX, EMI_REGEX, PAYMENT_REGEX
        
        # Export full text (Markdown preserves layout better for line-by-line scanning)
        full_text = converter.convert(abs_path).document.export_to_markdown()
        
        logger.info("Scanning full text for regex matches...")
        regex_transactions = []
        
        for line in full_text.split('\n'):
            line = line.strip()
            if not line: continue
            
            match = HDFC_ROW_REGEX.search(line)
            if match:
                try:
                    data = match.groupdict()
                    amount, txn_type = normalize_hdfc_amount(data['amount'], data['sign'])
                    
                    # Auto-Classification
                    category = "Other"
                    merchant = data['description'].strip()
                    
                    if GST_REGEX.search(merchant):
                        category = "GST"
                    elif EMI_REGEX.search(merchant):
                        category = "Loan Repayment"
                    elif PAYMENT_REGEX.search(merchant):
                        txn_type = 'payment' # Override type if explicit payment keyword
                        category = "Payment"

                    txn = {
                        "date": parse_date(data['date']),
                        "merchant": normalize_merchant(merchant),
                        "raw_description": merchant,
                        "amount": amount,
                        "type": txn_type,
                        "category": category,
                        "confidence": 0.95, # High confidence for regex match
                        "original_row": line
                    }
                    
                    # Calculate final confidence
                    txn['confidence'] = calculate_confidence(txn)
                    
                    regex_transactions.append(txn)
                except Exception as e:
                    logger.warning(f"Regex match failed processing: {line} - {e}")

        if regex_transactions:
            logger.info(f"Found {len(regex_transactions)} transactions via Regex.")
            # Merge with table transactions (simple dedup based on date+desc+amount?)
            # For now, just append if tables failed, or combine. 
            # Given HDFC regex is specific, if matches found, they are likely high quality.
            transactions.extend(regex_transactions)

        return {
            "metadata": metadata,
            "transactions": transactions,
            "confidence": 0.95 if transactions else 0.0
        }

    except Exception as e:
        logger.error(f"Docling extraction failed: {e}")
        raise e
    finally:
        # Cleanup decrypted temp file
        if temp_decrypted_path and os.path.exists(temp_decrypted_path):
            try:
                os.remove(temp_decrypted_path)
                logger.info(f"Cleaned up decrypted file: {temp_decrypted_path}")
            except Exception as cleanup_err:
                 logger.warning(f"Failed to cleanup decrypted file: {cleanup_err}")

def parse_transaction_row(row):
    """
    Parses a single row from the dataframe into a standardized transaction object.
    """
    try:
        # Convert row to dictionary for easier access (handling case insensitive keys is harder here, relying on simple mapping)
        # Normalize column names
        row_dict = {str(k).lower().strip(): v for k, v in row.to_dict().items()}
        
        # Date Extraction
        date_val = None
        for key in row_dict:
            if "date" in key:
                 date_val = row_dict[key]
                 break
        
        if not date_val: return None
        
        # Description Extraction
        desc_val = None
        for key in ['description', 'details', 'narration', 'particulars']:
             if key in row_dict:
                 desc_val = row_dict[key]
                 break
        
        # Amount Extraction
        amount_val = 0.0
        type_val = 'debit' # Default
        
        # Check for Credit/Debit columns
        credit_val = row_dict.get('credit') or row_dict.get('cr') or row_dict.get('deposit')
        debit_val = row_dict.get('debit') or row_dict.get('dr') or row_dict.get('withdrawal')
        
        if credit_val and str(credit_val).strip():
             amount_val = parse_amount(credit_val)
             type_val = 'credit'
        elif debit_val and str(debit_val).strip():
             amount_val = parse_amount(debit_val)
             type_val = 'debit'
        elif 'amount' in row_dict:
             amount_val = parse_amount(row_dict['amount'])
             # Heuristic for type if single amount column: 
             # Positive/Negative check or look for 'cr'/'dr' suffix often found in statement strings
             if str(row_dict['amount']).lower().endswith('cr'):
                 type_val = 'credit'

        if not desc_val or amount_val == 0:
            return None

        # Clean Dates
        formatted_date = parse_date(str(date_val))

        return {
            "date": formatted_date,
            "merchant": str(desc_val).strip(), # Initial merchant is same as description
            "raw_description": str(desc_val).strip(),
            "amount": abs(amount_val),
            "type": type_val,
            "category": "Other",
            "confidence": 0.9,
            "original_row": str(row.values)
        }

    except Exception as e:
        logger.warning(f"Failed to parse row: {row} - {e}")
        return None

def parse_amount(amount_str):
    if isinstance(amount_str, (int, float)):
        return float(amount_str)
    try:
        # Remove currency symbols, commas
        clean = re.sub(r'[^\d.-]', '', str(amount_str))
        return float(clean)
    except:
        return 0.0

def parse_date(date_str):
    # Support various formats
    try:
        # Simple parser using dateutil or patterns
        # returning ISO format YYYY-MM-DD
        from dateutil.parser import parse
        dt = parse(date_str, fuzzy=True)
        return dt.strftime("%Y-%m-%d")
    except:
        return date_str

if __name__ == "__main__":
    # Test block
    pass
