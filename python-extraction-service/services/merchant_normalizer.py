import re

# Merchant normalization rules
NORMALIZATION_RULES = {
    # Payment gateways
    r'PAY\*ZOMATO.*': 'ZOMATO',
    r'PAY\*SWIGGY.*': 'SWIGGY',
    r'UPI-.*RAZORPAY.*': 'RAZORPAY',
    r'UPI-.*PAYTM.*': 'PAYTM',
    r'UPI-.*PHONEPE.*': 'PHONEPE',
    r'UPI-.*GPAY.*': 'GOOGLE PAY',
    
    # E-commerce
    r'POS.*AMAZON.*': 'AMAZON',
    r'POS.*FLIPKART.*': 'FLIPKART',
    r'AMAZON.*': 'AMAZON',
    r'FLIPKART.*': 'FLIPKART',
    
    # Food delivery
    r'ZOMATO.*': 'ZOMATO',
    r'SWIGGY.*': 'SWIGGY',
    r'DOMINOS.*': 'DOMINOS',
    r'MCDONALD.*': 'MCDONALDS',
    r'KFC.*': 'KFC',
    
    # Transport
    r'UBER.*': 'UBER',
    r'OLA.*': 'OLA',
    r'RAPIDO.*': 'RAPIDO',
    
    # Entertainment
    r'NETFLIX.*': 'NETFLIX',
    r'AMAZON\s+PRIME.*': 'AMAZON PRIME',
    r'HOTSTAR.*': 'HOTSTAR',
    r'SPOTIFY.*': 'SPOTIFY',
    
    # Utilities
    r'AIRTEL.*': 'AIRTEL',
    r'JIO.*': 'JIO',
    r'VODAFONE.*': 'VODAFONE',
    
    # Fuel
    r'INDIAN\s+OIL.*': 'INDIAN OIL',
    r'BHARAT\s+PETROLEUM.*': 'BHARAT PETROLEUM',
    r'HP\s+PETROL.*': 'HP',
}

def normalize_merchant(raw_description):
    """
    Normalize merchant name from raw transaction description
    
    Args:
        raw_description: Raw transaction description
        
    Returns:
        str: Normalized merchant name
    """
    if not raw_description:
        return 'UNKNOWN'
    
    # Convert to uppercase for matching
    desc_upper = raw_description.upper().strip()
    
    # Apply normalization rules
    for pattern, merchant in NORMALIZATION_RULES.items():
        if re.search(pattern, desc_upper):
            return merchant
    
    # Remove common prefixes
    cleaned = remove_common_prefixes(desc_upper)
    
    # Extract merchant name (first meaningful word)
    merchant = extract_merchant_name(cleaned)
    
    return merchant if merchant else 'UNKNOWN'

def remove_common_prefixes(text):
    """Remove common transaction prefixes"""
    prefixes = [
        r'^UPI-',
        r'^PAY\*',
        r'^POS\s+\d+\s+',
        r'^ATM\s+',
        r'^NEFT\s+',
        r'^IMPS\s+',
        r'^RTGS\s+',
        r'^DEBIT\s+CARD\s+',
        r'^CREDIT\s+CARD\s+',
    ]
    
    cleaned = text
    for prefix in prefixes:
        cleaned = re.sub(prefix, '', cleaned)
    
    return cleaned.strip()

def extract_merchant_name(text):
    """Extract merchant name from cleaned text"""
    # Remove transaction IDs and reference numbers
    text = re.sub(r'\d{10,}', '', text)
    text = re.sub(r'[A-Z0-9]{15,}', '', text)
    
    # Split by common separators to check for noise, but prefer keeping the full name
    # Logic change: Return the full cleaned text instead of just the first word
    # But still strip obvious junk like dates or reference numbers if they remain
    
    # Remove special chars but keep spaces
    cleaned = re.sub(r'[^\w\s\*\.-]', ' ', text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    if len(cleaned) > 3:
        return cleaned
    
    return text[:30].strip()  # Fallback to first 30 chars

# Export
__all__ = ['normalize_merchant']
