try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

import re
from datetime import datetime
from .merchant_normalizer import normalize_merchant
from .category_detector import detect_category

# Try to import pandas
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    print("Warning: pandas not available, CSV features disabled")

# Import new CSV parser (Handle import error if pandas missing might break it)
try:
    from .csv_parser import parse_from_dataframe
except ImportError:
    pass

def extract_statement(pdf_path, password=None):
    """
    Main extraction function
    Orchestrates the entire extraction pipeline
    
    Args:
        pdf_path: Path to PDF file
        password: Optional password for encrypted PDFs
        
    Returns:
        dict: {
            metadata: {...},
            transactions: [...],
            confidence: float
        }
    """
    display_path = str(pdf_path)
    print(f"Processing statement: {display_path}")

    if not PYMUPDF_AVAILABLE and not PDFPLUMBER_AVAILABLE:
        raise ImportError("PDF extraction libraries (results) are not installed. Please install PyMuPDF or pdfplumber.")
    
    decrypted_path = None
    
    # Step 0: Check Encryption and Handle Password
    try:
        if PYMUPDF_AVAILABLE:
            doc = fitz.open(pdf_path)
        if doc.needs_pass:
            if not password:
                doc.close()
                raise ValueError("PASSWORD_REQUIRED")
            # Try to authenticate with password
            auth_result = doc.authenticate(password)
            if not auth_result:
                doc.close()
                raise ValueError("INVALID_PASSWORD")
            print(f"PDF unlocked successfully with password")
            
            # Create decrypted copy for other tools to use
            decrypted_path = pdf_path.replace('.pdf', '_decrypted.pdf')
            doc.save(decrypted_path)
            doc.close()
            
            # Use decrypted version for extraction
            pdf_path = decrypted_path
        else:
            doc.close()
    except ValueError as ve:
        # Re-raise our custom errors
        raise ve
    except Exception as e:
        print(f"Error checking PDF encryption: {e}")
        pass # Continue to standard checks if basic open fails

    try:
        # Step 1: Detect if PDF is text-based or scanned
        is_text_based = check_if_text_based(pdf_path)
    
        # Step 2: Extract metadata
        metadata = extract_metadata(pdf_path)
        
        # Step 3: Extract transactions
        # Step 3: Extract transactions (FORCE TEXT/REGEX EXTRACTION)
        print("Using Advanced Python Extraction (Text/Regex)...")
        transactions = extract_from_text(pdf_path)
        
        # Double check: If frame extraction failed, try raw lines specifically
        if not transactions:
            print("DataFrame extraction yielded no results, trying Raw Regex...")
            transactions = extract_from_raw_lines(pdf_path, metadata)
        
        # Step 4: Normalize and categorize
        transactions = normalize_transactions(transactions)
        
        # Step 5: Calculate confidence
        overall_confidence = calculate_confidence(transactions)
        
        return {
            'metadata': metadata,
            'transactions': transactions,
            'confidence': overall_confidence,
            'total_transactions': len(transactions)
        }
    
    finally:
        # Clean up decrypted file if it was created
        if decrypted_path:
            try:
                import os
                os.remove(decrypted_path)
                print(f"Cleaned up decrypted file: {decrypted_path}")
            except Exception as e:
                print(f"Failed to clean up decrypted file: {e}")

def check_if_text_based(pdf_path):
    """Check if PDF contains extractable text"""
    if not PDFPLUMBER_AVAILABLE: return False
    try:
        with pdfplumber.open(pdf_path) as pdf:
            first_page = pdf.pages[0]
            text = first_page.extract_text()
            
            # If we get substantial text, it's text-based
            return text and len(text.strip()) > 100
    except:
        return False

def extract_metadata(pdf_path):
    """Extract statement metadata"""
    metadata = {
        'bank_name': 'Unknown',
        'account_type': 'credit_card',
        'currency': 'INR',
        'statement_period': None,
        'account_number': None
    }
    
    if not PDFPLUMBER_AVAILABLE: return metadata

    try:
        with pdfplumber.open(pdf_path) as pdf:
            first_page_text = pdf.pages[0].extract_text()
            
            # Detect bank name
            bank_patterns = {
                'HDFC': r'HDFC\s+Bank',
                'ICICI': r'ICICI\s+Bank',
                'SBI': r'State\s+Bank',
                'AXIS': r'Axis\s+Bank',
                'KOTAK': r'Kotak\s+Mahindra'
            }
            
            for bank, pattern in bank_patterns.items():
                if re.search(pattern, first_page_text, re.IGNORECASE):
                    metadata['bank_name'] = bank
                    break
            
            # Detect statement period
            period_match = re.search(r'(\d{2}[/-]\d{2}[/-]\d{4})\s+to\s+(\d{2}[/-]\d{4})', first_page_text)
            if period_match:
                metadata['statement_period'] = f"{period_match.group(1)} to {period_match.group(2)}"
            
            # Detect account number (masked)
            account_match = re.search(r'[X*]{8,12}\d{4}', first_page_text)
            if account_match:
                metadata['account_number'] = account_match.group(0)
    
    except Exception as e:
        print(f"Metadata extraction error: {e}")
    
    # NEW: Extract Summary Metrics (Total Due, Min Due, Due Date)
    try:
        with pdfplumber.open(pdf_path) as pdf:
            # Extract text
            text = pdf.pages[0].extract_text()


            # Helper to find pattern with potential newlines/spaces between label and value
            def find_value(patterns, text):
                for p in patterns:
                    # dotall=True allows . to match newlines
                    match = re.search(p, text, re.IGNORECASE | re.DOTALL)
                    if match:
                        return match.group(1)
                return None

            # 1. Total Due
            # Look for "Total Amount Due" followed by amount closer to it
            total_due_val = find_value([
                r'(?:Total\s+(?:Amount\s+)?(?:Due|Payable)|Payment\s+Due).*?((?:Rs\.?|₹)?\s*[\d,]+\.\d{2})',
                r'(?:Total\s+Due).*?((?:Rs\.?|₹)?\s*[\d,]+\.\d{2})'
            ], text)
            if total_due_val:
                metadata['totalDue'] = parse_amount(total_due_val)
            
            # 2. Minimum Due
            min_due_val = find_value([
                r'(?:Min(?:imum)?\s+(?:Amount\s+)?(?:Due|Payment)).*?((?:Rs\.?|₹)?\s*[\d,]+\.\d{2})'
            ], text)
            if min_due_val:
                metadata['minPayment'] = parse_amount(min_due_val)

            # 3. Payment Due Date
            due_date_val = find_value([
                r'(?:Payment\s+)?Due\s+Date.*?(\d{2}[/-]\d{2}[/-]\d{2,4})'
            ], text)
            if due_date_val:
                metadata['paymentDueDate'] = parse_date(due_date_val)

            # 4. Credit Limit
            credit_limit_val = find_value([
                r'(?:Credit\s+Limit|Total\s+Limit).*?((?:Rs\.?|₹)?\s*[\d,]+\.\d{2})'
            ], text)
            if credit_limit_val:
                metadata['credit_limit'] = parse_amount(credit_limit_val)

            # 5. Available Credit
            avail_credit_val = find_value([
                r'(?:Available\s+Credit|Avail\s+Limit).*?((?:Rs\.?|₹)?\s*[\d,]+\.\d{2})',
                r'Avlbl\s+Limit.*?((?:Rs\.?|₹)?\s*[\d,]+\.\d{2})'
            ], text)
            if avail_credit_val:
                metadata['available_credit'] = parse_amount(avail_credit_val)

    except Exception as e:
        print(f"Summary extraction error: {e}")

    return metadata

def extract_from_text(pdf_path):
    """Extract transactions from text-based PDF using DataFrames"""
    transactions = []
    
    if PANDAS_AVAILABLE:
        print("Using Pandas DataFrame Extraction...")
        try:
            # 1. Extract ALL tables from PDF into a single DataFrame
            df = extract_as_dataframe(pdf_path)
            
            if df is not None and not df.empty:
                # 2. Parse using CSV Parser
                transactions = parse_from_dataframe(df)
                if len(transactions) > 0:
                    print(f"Successfully extracted {len(transactions)} transactions via DataFrame")
                    return transactions
                    
        except Exception as e:
            print(f"DataFrame extraction failed: {e}")
            # Fall through to legacy method
            
    # Legacy / Fallback
    print("Falling back to Legacy Regex Extraction...")
    if not transactions or len(transactions) == 0:
        transactions = extract_from_raw_lines(pdf_path)

    return transactions

def extract_as_dataframe(pdf_path):
    """
    Extracts all table data from PDF and combines into a single DataFrame.
    Intelligently handles headers and multi-page tables.
    """
    if not PDFPLUMBER_AVAILABLE or not PANDAS_AVAILABLE: return None

    all_tables = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            # Extract tables
            tables = page.extract_tables()
            
            for table in tables:
                # Convert to DataFrame
                # We initially treat first row as data, not header, to avoid losing data
                # if the header detection fails or headers are only on page 1
                df = pd.DataFrame(table)
                all_tables.append(df)
                
    if not all_tables:
        return None
        
    # Concatenate all frames
    # Aligning columns by index (assuming structure is consistent across pages)
    full_df = pd.concat(all_tables, ignore_index=True)
    
    return full_df

def extract_with_pdfplumber(pdf_path):
    """Fallback extraction using pdfplumber"""
    transactions = []
    if not PDFPLUMBER_AVAILABLE: return transactions
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                
                for table in tables:
                    for row in table[1:]:  # Skip header
                        transaction = parse_transaction_row(row)
                        if transaction:
                            transactions.append(transaction)
    
    except Exception as e:
        print(f"Pdfplumber extraction error: {e}")
    
    return transactions

def extract_from_raw_lines(pdf_path, metadata=None):
    """
    Cascading Extraction Strategy:
    1. Bank-Specific Regex (if bank known)
    2. Universal Regex
    3. Fallback Heuristic
    """
    from .regex_rules import (
        BANK_REGEX_MAP, UNIVERSAL_REGEX, 
        normalize_amount, calculate_confidence, 
        GST_REGEX, EMI_REGEX, FUEL_REGEX
    )
    
    print("Fallback: Using Cascading Regex Line Parsing...")
    transactions = []
    
    # helper for bank detection if metadata missing
    bank_name = metadata.get('bank_name', 'Unknown') if metadata else 'Unknown'
    bank_regex = BANK_REGEX_MAP.get(bank_name)
    
    if bank_regex:
        print(f"Using Bank-Specific Rules for: {bank_name}")

    try:
        # Get Text
        full_text = ""
        if PDFPLUMBER_AVAILABLE:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    txt = page.extract_text()
                    if txt: full_text += txt + "\n"
        
        # PyMuPDF Fallback
        if len(full_text.strip()) < 10 and PYMUPDF_AVAILABLE:
             # import fitz # Already imported
             doc = fitz.open(pdf_path)
             for page in doc:
                 full_text += page.get_text() + "\n"
        
        print(f"DEBUG: Scanned {len(full_text)} characters")

        for line in full_text.split('\n'):
            line = line.strip()
            if not line: continue
            
            # Skip noise lines usually
            if len(line) < 10: continue

            txn = None
            extractor_type = 'unknown'
            
            # --- STRATEGY 1: BANK SPECIFIC ---
            if bank_regex:
                match = bank_regex.search(line)
                if match:
                    data = match.groupdict()
                    amount, txn_type = normalize_amount(data['amount'], data.get('crdr'), data['description'])
                    txn = {
                        "date": parse_date(data['date']),
                        "raw_description": data['description'].strip(),
                        "amount": amount,
                        "type": txn_type,
                        "extractor_type": "bank_specific",
                        "original_row": line
                    }

            # --- STRATEGY 2: UNIVERSAL REGEX ---
            if not txn:
                match = UNIVERSAL_REGEX.search(line)
                if match:
                    data = match.groupdict()
                    amount, txn_type = normalize_amount(data['amount'], data.get('crdr'), data['description'])
                    txn = {
                        "date": parse_date(data['date']),
                        "raw_description": data['description'].strip(),
                        "amount": amount,
                        "type": txn_type,
                        "extractor_type": "universal",
                        "original_row": line
                    }

            # --- STRATEGY 3: FALLBACK HEURISTIC ---
            # If line has amount and date but regex failed
            if not txn:
                # Basic check: Has date-like and amount-like string?
                # This is "Deep Fallback"
                # splitting by spaces
                parts = line.split()
                # Find amount (last token usually numeric with dot?)
                # This is risky, only do if we are desperate or strict pattern failed
                # For now, let's stick to the user's explicit request:
                # "Line contains amount? -> yes. Extract amount first. Find nearest date."
                
                # Simple implementation of heuristic:
                try:
                    # Find amount
                    amt_matches = re.findall(r'[\d,]+\.\d{2}', line)
                    if amt_matches:
                        amount_str = amt_matches[-1] # Take last one usually
                        clean_amt, _ = normalize_amount(amount_str)
                        
                        # Find date
                        date_matches = re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}', line)
                        if date_matches:
                            date_str = date_matches.group(0)
                            
                            # Description is everything else
                            desc = line.replace(amount_str, '').replace(date_str, '').strip()
                            # Clean up loose chars
                            desc = re.sub(r'\s+', ' ', desc)
                            
                            if clean_amt > 0:
                                txn = {
                                    "date": parse_date(date_str),
                                    "raw_description": desc,
                                    "amount": clean_amt,
                                    "type": "debit", # Default to debit in fallback
                                    "extractor_type": "fallback_heuristic",
                                    "original_row": line
                                }
                except:
                    pass

            # --- POST PROCESSING ---
            if txn:
                # Merchant & Category
                merchant = txn['raw_description']
                category = "Other"
                
                if GST_REGEX.search(merchant): category = "GST"
                elif EMI_REGEX.search(merchant): category = "Loan Repayment"
                elif FUEL_REGEX.search(merchant): category = "Fuel"
                
                txn['merchant'] = normalize_merchant(merchant)
                txn['category'] = category # will be refined by normalizer later too
                txn['confidence'] = calculate_confidence(txn)
                
                transactions.append(txn)
                
    except Exception as e:
        print(f"Regex Parsing Error: {e}")
        import traceback
        traceback.print_exc()
        
    return transactions

def parse_transaction_row(row):
    """Parse a single transaction row"""
    try:
        # Basic parsing logic (will be enhanced)
        if len(row) < 3:
            return None
        
        # Try to find date, description, amount
        date = None
        description = None
        amount = None
        
        for cell in row:
            if not cell:
                continue
            
            cell_str = str(cell).strip()
            
            # Try to parse date and time
            date_time_match = re.match(r'(\d{2}[/-]\d{2}[/-]\d{4})(?:\s*\|\s*(\d{2}:\d{2}))?', cell_str)
            if not date and date_time_match:
                date = parse_date(date_time_match.group(1))
                if date_time_match.group(2):
                    date += "T" + date_time_match.group(2)
            
            # Try to parse amount
            elif not amount and re.search(r'[\d,]+\.\d{2}', cell_str):
                amount = parse_amount(cell_str)
            
            # Description
            elif not description and len(cell_str) > 3:
                description = cell_str
        
        if date and description and amount:
            return {
                'date': date,
                'raw_description': description,
                'merchant': description,  # Will be normalized later
                'amount': amount,
                'type': 'expense',  # Will be determined later
                'category': 'Other',  # Will be auto-detected
                'confidence': 0.8
            }
    
    except Exception as e:
        print(f"Row parsing error: {e}")
    
    return None

def parse_date(date_str):
    """Parse date string to ISO format"""
    formats = ['%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d-%m-%y']
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            # Check if original string had more info (like time) but keeping it simple for now
            return dt.strftime('%Y-%m-%d')
        except:
            continue
    
    return date_str

def parse_amount(amount_str):
    """Parse amount string to float"""
    try:
        # Remove currency symbols and commas
        cleaned = re.sub(r'[₹$,]', '', amount_str)
        return float(cleaned)
    except:
        return 0.0

def normalize_transactions(transactions):
    """Normalize merchant names and detect categories"""
    for txn in transactions:
        # Normalize merchant
        txn['merchant'] = normalize_merchant(txn['raw_description'])
        
        # Detect category
        category, confidence = detect_category(txn['merchant'], txn['raw_description'])
        txn['category'] = category
        txn['category_confidence'] = confidence
    
    return transactions

def calculate_confidence(transactions):
    """Calculate overall extraction confidence"""
    if not transactions:
        return 0.0
    
    total_confidence = sum(txn.get('confidence', 0.5) for txn in transactions)
    return round(total_confidence / len(transactions), 2)

# Export main function
__all__ = ['extract_statement']
