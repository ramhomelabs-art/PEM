import re

# 1. Bank Specific Regex Map
# 1. Bank Specific Regex Map (Updated for Indian Context)
BANK_REGEX_MAP = {
    'HDFC': re.compile(
        r'(?P<date>\d{2}-\d{2}-\d{2,4})?' # Optional Date
        r'.*?'
        r'(?:Rs\.?|INR)\s*(?P<amount>[\d,]+\.\d{2})'
        r'.*?'
        r'(?P<crdr>debited|credited|spent|received|transferred)'
        r'.*?'
        r'(?:to|at|from)\s+(?P<description>.+?)(?:\s+on\s+|$)',
        re.IGNORECASE | re.DOTALL
    ),
    'SBI': re.compile(
        r'(?:Rs\.?|INR)\s*(?P<amount>[\d,]+(?:\.\d{2})?)'
        r'.*?'
        r'(?P<crdr>debited|credited|spent|received)'
        r'.*?'
        r'(?:from|to|at)\s+(?P<description>.+?)(?:\s+on\s+|$)',
        re.IGNORECASE | re.DOTALL
    ),
    'ICICI': re.compile(
        r'(?:Acct\s+XX\d+|CC\s+XX\d+)'
        r'.*?'
        r'(?P<crdr>debited|credited)'
        r'.*?'
        r'(?:Rs\.?|INR)\s*(?P<amount>[\d,]+\.\d{2})'
        r'.*?'
        r'(?:on\s+(?P<date>\d{2}-[A-Za-z]{3}-\d{2}))'
        r'.*?'
        r'(?:Info:\s*(?P<description>.+?))?$',
        re.IGNORECASE | re.DOTALL
    ),
    'AXIS': re.compile(
        r'(?:INR|Rs\.?)\s*(?P<amount>[\d,]+(?:\.\d{2})?)'
        r'.*?'
        r'(?P<crdr>debited|credited)'
        r'.*?'
        r'(?:from|to)\s+A/c'
        r'.*?'
        r'(?:at|to|info)\s+(?P<description>.+?)(?:\s+on\s+|$)',
        re.IGNORECASE | re.DOTALL
    ),
    'KOTAK': re.compile(
        r'(?:Rs\.?|INR)\s*(?P<amount>[\d,]+\.\d{2})'
        r'.*?'
        r'(?P<crdr>spent|debited|credited)'
        r'.*?'
        r'(?:on|at)\s+(?P<description>.+?)'
        r'(?:\s+on\s+(?P<date>\d{2}-\d{2}-\d{2,4}))?',
        re.IGNORECASE | re.DOTALL
    ),
     'IDFC': re.compile(
        r'(?:Rs\.?|INR)\s*(?P<amount>[\d,]+\.\d{2})'
        r'.*?'
        r'(?P<crdr>debited|credited)'
        r'.*?'
        r'(?:at|to)\s+(?P<description>.+?)(?:\s+on\s+|$)',
        re.IGNORECASE | re.DOTALL
    )
}

# 2. Universal / Fallback Regex
# Matches: Date ... Description ... Amount ... CR/DR(opt)
UNIVERSAL_REGEX = re.compile(
    r'(?P<date>\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+'
    r'(?P<description>[A-Z0-9\*\-\._\/\s]{3,})\s+'
    r'(?P<amount>[\d,]+\.\d{2})\s*'
    r'(?P<crdr>CR|DR)?',
    re.IGNORECASE
)

# 3. Manual Entry Regex (Advanced)
# Pattern 1: Amount ... for/to/at ... Merchant ... (Source/Method) ... - Description
# Example: "500 for Lunch (Cash) - Team treat"
MANUAL_REGEX_COMPLEX = re.compile(
    r'^(?P<amount>[\d,]+(?:\.\d{2})?)\s+'                              # Amount (Start)
    r'(?:for|to|at|on)\s+'                                           # Preposition
    r'(?P<description>.+?)'                                          # Merchant/Desc
    r'(?:\s+\((?P<method>cash|upi|card|cc|gpay|paytm|online)\))?'    # Optional Method in parens
    r'(?:\s+-\s+(?P<note>.*))?$',                                    # Optional Note
    re.IGNORECASE
)

# Pattern 2: Merchant ... Amount ... (Category/Method)
# Example: "Uber 500 Travel"
MANUAL_REGEX_LOOSE = re.compile(
    r'^(?P<description>.+?)\s+'                                      # Merchant (Start)
    r'(?P<amount>[\d,]+(?:\.\d{2})?)'                                # Amount
    r'(?:\s+(?P<category>food|travel|bills|health|shopping|ent|groceries))?' # Optional Category
    r'(?:\s+(?P<method>cash|upi|card|cc))?$',                        # Optional Method
    re.IGNORECASE
)

# 4. Classifiers
GST_REGEX = re.compile(r'\b(GST|CGST|SGST|IGST)\b', re.IGNORECASE)
EMI_REGEX = re.compile(r'\b(EMI|INSTALMENT|LOAN|MONTHLY)\b', re.IGNORECASE)
FUEL_REGEX = re.compile(r'\b(IOCL|BPCL|HPCL|FUEL|PETROL)\b', re.IGNORECASE)

# Keywords
PAYMENT_KEYWORDS = re.compile(r'(CR|CREDIT|REFUND|CASHBACK|PAYMENT|BPPY|RECEIVED|ADDED|INCOME)\b', re.IGNORECASE)
DEBIT_KEYWORDS = re.compile(r'(DR|DEBIT|PURCHASE|SPENT|PAID|SENT|WITHDRAWN|EXPENSE)\b', re.IGNORECASE)

METHOD_KEYWORDS = re.compile(r'\b(UPI|CASH|CARD|CC|DC|GPAY|PAYTM|PHONEPE|NETBANKING)\b', re.IGNORECASE)

def normalize_amount(amount_str, crdr=None, description=""):
    """
    Returns (abs_amount, type_str)
    """
    try:
        clean = float(re.sub(r'[^\d.]', '', str(amount_str).replace(',', '')))
    except:
        return 0.0, 'debit'

    # Determine Type - Default to debit
    txn_type = 'debit'
    
    desc_upper = description.upper() if description else ""
    crdr_upper = crdr.strip().upper() if crdr else ""

    # 1. Check crdr field first (from regex capture group)
    if crdr_upper:
        # INCOME keywords
        if any(keyword in crdr_upper for keyword in ['CREDIT', 'RECEIVED', 'ADDED', 'INCOME', 'REFUND', 'CASHBACK']):
            txn_type = 'credit'
        # EXPENSE keywords  
        elif any(keyword in crdr_upper for keyword in ['DEBIT', 'SPENT', 'PAID', 'SENT', 'EXPENSE', 'WITHDRAWN', 'PURCHASE']):
            txn_type = 'debit'
            
    # 2. If crdr didn't match, check description for keywords
    if not crdr_upper or txn_type == 'debit':  # Only check description if crdr didn't give us credit
        if any(keyword in desc_upper for keyword in ['CREDITED', 'RECEIVED', 'REFUND', 'CASHBACK', 'INCOME', 'SALARY', 'PAYMENT RECEIVED']):
            txn_type = 'credit'
        elif any(keyword in desc_upper for keyword in ['DEBITED', 'SPENT', 'PAID', 'PURCHASE', 'WITHDRAWN']):
            txn_type = 'debit'
    
    return clean, txn_type

def calculate_confidence(txn):
    """
    +0.4 date match
    +0.3 amount match
    +0.2 known merchant (category != Other/Unknown)
    +0.1 bank format match (if regex was bank-specific)
    """
    score = 0.0
    
    # 1. Amount exists
    if txn.get('amount') and txn.get('amount') > 0:
        score += 0.5
        
    # 2. Known Merchant
    if txn.get('category') not in ['Unknown', 'Other']:
        score += 0.2
        
    # 3. Bank/Manual Format Match
    extractor = txn.get('extractor_type', '')
    if extractor in ['bank_specific', 'manual_complex', 'manual_loose']:
        score += 0.3
        
    return min(1.0, score)

def extract_manual_details(text):
    """
    Try to extract structured data from manual text using new regexes
    """
    # 1. Complex
    match = MANUAL_REGEX_COMPLEX.search(text)
    if match:
        data = match.groupdict()
        data['extractor'] = 'manual_complex'
        return data
        
    # 2. Loose
    match = MANUAL_REGEX_LOOSE.search(text)
    if match:
        data = match.groupdict()
        data['extractor'] = 'manual_loose'
        return data
        
    return None

__all__ = ['BANK_REGEX_MAP', 'UNIVERSAL_REGEX', 'normalize_amount', 'calculate_confidence', 'extract_manual_details', 'METHOD_KEYWORDS']
