try:
    import pytesseract
    from PIL import Image
    import cv2
    import numpy as np
    import pdf2image
except ImportError:
    print("Warning: OCR dependencies not installed. OCR functionality will be limited.")

def extract_with_ocr(pdf_path):
    """
    Extract transactions from scanned PDF using OCR
    
    Args:
        pdf_path: Path to scanned PDF
        
    Returns:
        list: Extracted transactions
    """
    print("Starting OCR extraction...")
    
    try:
        # Convert PDF to images
        images = pdf2image.convert_from_path(pdf_path)
        
        all_transactions = []
        
        for page_num, image in enumerate(images):
            print(f"Processing page {page_num + 1}/{len(images)}")
            
            # Preprocess image
            processed_image = preprocess_image(image)
            
            # Extract text using OCR
            text = pytesseract.image_to_string(processed_image)
            
            # Parse transactions from text
            transactions = parse_ocr_text(text)
            all_transactions.extend(transactions)
        
        return all_transactions
    
    except Exception as e:
        print(f"OCR extraction error: {e}")
        return []

def preprocess_image(image):
    """
    Preprocess image for better OCR accuracy
    
    Args:
        image: PIL Image
        
    Returns:
        numpy array: Preprocessed image
    """
    # Convert PIL to OpenCV format
    img_array = np.array(image)
    
    # Convert to grayscale
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    
    # Apply thresholding
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Denoise
    denoised = cv2.fastNlMeansDenoising(thresh)
    
    return denoised

def parse_ocr_text(text):
    """
    Parse OCR text to extract transactions
    
    Args:
        text: OCR extracted text
        
    Returns:
        list: Parsed transactions
    """
    transactions = []
    
    # Split into lines
    lines = text.split('\n')
    
    # Simple line-by-line parsing (will be enhanced)
    for line in lines:
        if len(line.strip()) < 10:
            continue
        
        # Try to extract transaction data
        # This is a basic implementation
        # Real implementation would use more sophisticated parsing
        
        import re
        
        # Look for date pattern
        date_match = re.search(r'\d{2}[/-]\d{2}[/-]\d{4}', line)
        # Look for amount pattern
        amount_match = re.search(r'[\d,]+\.\d{2}', line)
        
        if date_match and amount_match:
            transactions.append({
                'date': date_match.group(0),
                'raw_description': line,
                'merchant': line,
                'amount': float(amount_match.group(0).replace(',', '')),
                'type': 'expense',
                'category': 'Other',
                'confidence': 0.6  # Lower confidence for OCR
            })
    
    return transactions

# Export
__all__ = ['extract_with_ocr']
