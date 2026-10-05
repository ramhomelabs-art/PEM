# Merchant-to-category mapping
MERCHANT_CATEGORIES = {
    # Food & Dining
    'ZOMATO': 'Food',
    'SWIGGY': 'Food',
    'DOMINOS': 'Food',
    'MCDONALDS': 'Food',
    'KFC': 'Food',
    'SUBWAY': 'Food',
    'STARBUCKS': 'Food',
    
    # Shopping
    'AMAZON': 'Shopping',
    'FLIPKART': 'Shopping',
    'MYNTRA': 'Shopping',
    'AJIO': 'Shopping',
    'MAGICPIN': 'Shopping',
    'AMAZON': 'Shopping',
    'UBER': 'Travel',
    'OLA': 'Travel',
    'RAPIDO': 'Travel',
    'IRCTC': 'Travel',
    
    # Entertainment
    'NETFLIX': 'Entertainment',
    'AMAZON PRIME': 'Entertainment',
    'HOTSTAR': 'Entertainment',
    'SPOTIFY': 'Entertainment',
    'BOOKMYSHOW': 'Entertainment',
    
    # Utilities
    'AIRTEL': 'Utility',
    'JIO': 'Utility',
    'VODAFONE': 'Utility',
    'ELECTRICITY': 'Utility',
    'GAS': 'Utility',
    
    # Fuel
    'INDIAN OIL': 'Travel',
    'BHARAT PETROLEUM': 'Travel',
    'HP': 'Travel',
}

# Keyword-based category detection
CATEGORY_KEYWORDS = {
    'Food': ['restaurant', 'cafe', 'food', 'dining', 'pizza', 'burger'],
    'Shopping': ['shop', 'store', 'mart', 'retail', 'mall'],
    'Travel': ['taxi', 'cab', 'fuel', 'petrol', 'diesel', 'flight', 'train'],
    'Entertainment': ['movie', 'cinema', 'theatre', 'music', 'game'],
    'Utility': ['electric', 'water', 'gas', 'mobile', 'internet', 'broadband'],
    'Medical': ['hospital', 'clinic', 'pharmacy', 'medical', 'doctor'],
}

def detect_category(merchant, description):
    """
    Auto-detect transaction category
    
    Args:
        merchant: Normalized merchant name
        description: Raw transaction description
        
    Returns:
        tuple: (category, confidence)
    """
    # Check merchant database first (high confidence)
    merchant_upper = merchant.upper()
    for key, category in MERCHANT_CATEGORIES.items():
        if key.upper() in merchant_upper:
            return category, 0.95
    
    # Check keywords in description (medium confidence)
    desc_lower = description.lower()
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in desc_lower:
                return category, 0.75
    
    # Default category (low confidence)
    return 'Other', 0.5

# Export
__all__ = ['detect_category']
