import pandas as pd
import re
from datetime import datetime

def parse_from_dataframe(df):
    """
    Parse a pandas DataFrame containing statement data into standard transaction format.
    
    Args:
        df: pandas DataFrame extracted from PDF
        
    Returns:
        list of transaction dicts
    """
    transactions = []
    
    # 1. Clean Data
    # Drop empty rows/cols
    df = df.dropna(how='all').dropna(axis=1, how='all')
    
    # 2. Identify Columns
    # We need to find which column corresponds to Date, Description, Amount (Cr/Dr)
    columns = identify_columns(df)
    
    if not columns['date'] or not columns['description']:
        print("CSV Parser: Critical columns not found. Falling back.")
        return []
        
    # 3. Iterate and Extract
    for index, row in df.iterrows():
        try:
            # Extract raw values
            raw_date = str(row[columns['date']]).strip()
            # If everything is mapped to the same column (merged), raw_desc is the same as raw_date
            raw_desc = str(row[columns['description']]).strip()
            
            # --- START SINGLE COLUMN PARSING LOGIC ---
            # If Date, Desc, and Amount point to same col (or just Date/Desc), try Regex Split
            if columns['date'] == columns['description']:
                # HDFC Format: Date | Time Desc Amount Cr/Dr
                # Regex to find Amount at the end
                # Look for patterns like "10,000.00" or "10,000.00 Cr" at end
                
                # 1. Extract Amount from end
                amount_match = re.search(r'((?:Rs\.?|INR|₹)?\s*[\d,]+\.\d{2})\s*([A-Za-z]+)?\s*l?$', raw_desc)
                # Note: 'l' is a common artifact in HDFC pdf tables at end of line
                
                if amount_match:
                    amount_str = amount_match.group(1)
                    suffix = amount_match.group(2) or ""
                    
                    amount = parse_amount(amount_str)
                    
                    # Determine type
                    if 'Cr' in suffix or 'CR' in suffix:
                        txn_type = 'credit'
                    elif '+' in raw_desc: # Explicit plus sign
                         txn_type = 'credit'
                    else:
                        txn_type = 'debit'
                        
                    # 2. Extract Date from start
                    date_match = re.match(r'(\d{2}[/-]\d{2}[/-]\d{4})', raw_desc)
                    if date_match:
                        date = parse_date(date_match.group(1))
                        
                        # 3. Description is everything in between
                        # Start after date (+ optional time)
                        start_idx = date_match.end()
                        
                        # Skip time if present " | 00:00 "
                        time_match = re.match(r'\s*[|]?\s*\d{2}:\d{2}\s*', raw_desc[start_idx:])
                        if time_match:
                            start_idx += time_match.end()
                            
                        end_idx = amount_match.start()
                        clean_desc = raw_desc[start_idx:end_idx].strip()
                        
                        # Remove leading pipe
                        if clean_desc.startswith('|'): clean_desc = clean_desc[1:].strip()
                        
                        # Fix: Remove trailing 'C', 'Cr', 'Dr', 'D', 'l' which are common artifacts
                        # Using regex to ensure we only remove standalone indicators at the end
                        clean_desc = re.sub(r'\s+(?:C|D|Cr|Dr|l)$', '', clean_desc, flags=re.IGNORECASE).strip()
                        
                        if amount > 0:
                            transactions.append({
                                'date': date,
                                'raw_description': clean_desc,
                                'merchant': clean_desc,
                                'amount': amount,
                                'type': txn_type,
                                'category': 'Other',
                                'confidence': 0.85,
                                'source': 'csv_regex'
                            })
                        continue # Successfully parsed via regex
            
            # --- END SINGLE COLUMN PARSING LOGIC ---

            # Extract Date (Standard Column)
            date = parse_date(raw_date)
            if not date:
                continue # not a transaction row
                
            # Extract Description
            if len(raw_desc) < 3 or raw_desc.lower() in ['opening balance', 'total', 'page total']:
                continue
                
            # Extract Amount
            amount = 0.0
            txn_type = 'debit'
            
            # Case A: Separate Credit/Debit columns
            if columns['debit'] and columns['credit']:
                debit_val = parse_amount(str(row[columns['debit']]))
                credit_val = parse_amount(str(row[columns['credit']]))
                
                if debit_val > 0:
                    amount = debit_val
                    txn_type = 'debit'
                elif credit_val > 0:
                    amount = credit_val
                    txn_type = 'credit'
            
            # Case B: Single Amount column with Type/Sign indicator
            elif columns['amount']:
                val = parse_amount(str(row[columns['amount']]))
                # Check for Cr/Dr indicators in row or negative signs
                if val < 0:
                    amount = abs(val)
                    txn_type = 'credit'
                else: # Default assumption, refining needed based on headers
                     # Look for "Cr" text in amount or other cols
                     raw_amt_str = str(row[columns['amount']]).upper()
                     if 'CR' in raw_amt_str:
                         txn_type = 'credit'
                     else:
                         txn_type = 'debit'
                     amount = val
            
            if amount > 0:
                transactions.append({
                    'date': date,
                    'raw_description': raw_desc,
                    'merchant': raw_desc, # Normalizer will handle this later
                    'amount': amount,
                    'type': txn_type,
                    'category': 'Other',
                    'confidence': 0.95,
                    'source': 'csv_parser'
                })
                
        except Exception as e:
            # print(f"Row parse error: {e}")
            continue
            
    return transactions

def identify_columns(df):
    """
    Heuristic to identify columns based on content and headers
    """
    mapping = {
        'date': None,
        'description': None,
        'amount': None,
        'debit': None,
        'credit': None
    }
    
    # 1. Check Header Row (if it exists)
    # This is tricky because the dataframe might not have proper headers yet
    # We'll treat the first valid row of strings as potential headers
    
    # Simple Content Analysis on first 15 rows (increased sample)
    for col in df.columns:
        col_data = df[col].astype(str).head(15).tolist()
        
        # Check for Date
        date_score = sum(1 for x in col_data if re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}', x))
        if date_score > 3:
            mapping['date'] = col
            
        # Check for Keywords in Header/Content (Debit/Credit/Amount)
        header_text = str(col).lower() # Use column name if it came from pdfplumber
        
        # Or look at content if no useful header
        content_text = " ".join(col_data).lower()
        
        if 'debit' in header_text or 'dr' in header_text:
            mapping['debit'] = col
        elif 'credit' in header_text or 'cr' in header_text:
            mapping['credit'] = col
        elif 'amount' in header_text:
            mapping['amount'] = col
        elif 'description' in header_text or 'particulars' in header_text or 'details' in header_text or 'merchant' in header_text:
            mapping['description'] = col
        
        # Fallback: Description is usually the longest string column that isn't date/amount
        # (Implemented roughly above)
    
    # Fallback Description Logic
    if not mapping['description']:
        # Find column with longest average string length that isn't mapped
        max_len = 0
        desc_col = None
        for col in df.columns:
            if col in mapping.values(): continue
            avg_len = df[col].astype(str).str.len().mean()
            if avg_len > max_len:
                max_len = avg_len
                desc_col = col
        mapping['description'] = desc_col
        
    # CRITICAL FALLBACK: If we have a 'date' column but no 'amount' or 'description', it's likely a merged single-column table.
    # In this case, map EVERYTHING to that column so the parser can try regex on it.
    if mapping['date'] is not None and (mapping['amount'] is None or mapping['description'] is None):
        print("CSV Parser: Detected potential single-column merged table. enabling regex fallback.")
        mapping['description'] = mapping['date']
        mapping['amount'] = mapping['date']
        
    return mapping

def parse_date(date_str):
    """Parse date string to ISO format"""
    date_str = re.sub(r'[^\d/\-\.:\s]', '', date_str).strip()
    formats = ['%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d-%m-%y']
    for fmt in formats:
        try:
            # Handle timestamps in date column (e.g. 12/01/2024 14:30)
            if ' ' in date_str:
                 clean_d = date_str.split(' ')[0]
            else:
                 clean_d = date_str
                 
            dt = datetime.strptime(clean_d, fmt)
            return dt.strftime('%Y-%m-%d')
        except:
            continue
    return None

def parse_amount(amount_str):
    """Parse amount string to float"""
    try:
        # Remove currency symbols and commas, keep dots and signs
        cleaned = re.sub(r'[^\d\.\-\+]', '', amount_str)
        if not cleaned: return 0.0
        return float(cleaned)
    except:
        return 0.0
