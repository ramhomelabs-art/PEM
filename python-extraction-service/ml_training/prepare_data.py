"""
Data Preparation Script for SMS NER Training
Uses user's 15 real SMS samples + synthetic data generation (FREE approach)
No Kaggle download needed - generates training data from seed samples
"""

import json
import re
import random
import sys
import os
from typing import List, Dict, Tuple

# Add data directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'data'))
from user_sms_samples import sms_samples

# Entity label definitions
LABELS = [
    'O',  # Outside any entity
    'B-AMOUNT', 'I-AMOUNT',
    'B-TYPE', 'I-TYPE',
    'B-MERCHANT', 'I-MERCHANT',
    'B-MODE', 'I-MODE',
    'B-ACCOUNT', 'I-ACCOUNT',
    'B-BANK', 'I-BANK',
    'B-DATE', 'I-DATE',
    'B-REFERENCE', 'I-REFERENCE'
]

# Regex patterns for entity detection
PATTERNS = {
    'AMOUNT': [
        r'Rs\.?\s*(\d+(?:,\d+)*(?:\.\d{2})?)',
        r'Rs:(\d+(?:,\d+)*(?:\.\d{2})?)', # For Union Bank
        r'INR\s*(\d+(?:,\d+)*(?:\.\d{2})?)',
        r'(?:debited|credited|paid|spent|by)\s+(\d+(?:\.\d{2})?)\b',
        r'\b(\d+(?:\.\d{2})?)\b(?=\s+is paid)'
    ],
    'TYPE': [
        r'\b(credited|debited|spent|paid|sent|received|Credited|Debited|Spent|Paid|Sent|Received)\b'
    ],
    'MERCHANT': [
        r'(?:to|at|At|trf to)\s+([A-Z][A-Za-z0-9\s@\.]+?)(?:\s+on|\s+with|\s+\(|\s+Refno|\s+ref|$)',
        r'To\s+([A-Z\s]+?)(?:\s+On)',
        r'@\s*([A-Z\s]+?)(?:\s+\d|$)',  # Match @MERCHANT format
        r'by\s+([A-Za-z\s]+?)(?:\s+ref\s+no)', # For Mob Bk
    ],
    'MODE': [
        r'\b(UPI|NEFT|RTGS|IMPS|ATM|Card|CC|DC|VPA|Credit Card|Mob Bk|Mobile Banking)\b'
    ],
    'ACCOUNT': [
        r'A/[Cc]\s*[*X]*(\d+)',
        r'account\s+[X]*(\d+)',
        r'SB-[x]*(\d+)',
        r'Bank\s+Card\s+(\d+)',
        r'X(\d+)\b' # For Card X3588
    ],
    'BANK': [
        r'\b(HDFC Bank|SBI|HSBC|ICICI|AXIS|IOB|Kotak|IDFC|YES BANK|Union Bank of India)\b'
    ],
    'DATE': [
        r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b',
        r'\b(\d{1,2}[A-Za-z]{3}\d{2})\b',
        r'on\s+(\d{1,2}-[A-Za-z]{3}-\d{2})'
    ],
    'REFERENCE': [
        r'Ref(?:no)?\s+(\d+)',
        r'ref\s+(\d+)',
        r'\(UPI\s+(\d+)\)'
    ]
}

def tokenize_sms(sms: str) -> List[str]:
    """Granular tokenization - split by anything non-alphanumeric but keep it"""
    # This ensures that punctuation like '@' is its own token
    # and doesn't 'sticky' to the merchant name, which helps auto-annotation alignment.
    tokens = []
    for word in sms.split():
        # Granular split: keep Alphanumeric groups, and every single punctuation char as its own token
        parts = re.findall(r'[A-Za-z0-9]+|[^\w\s]', word)
        tokens.extend(parts)
    return tokens

def auto_annotate(sms: str) -> List[Tuple[str, str]]:
    """
    Auto-annotate SMS using regex patterns with precise token alignment
    """
    tokens = tokenize_sms(sms)
    labels = ['O'] * len(tokens)
    labeled = [False] * len(tokens)
    
    # Apply patterns for each entity type
    for entity_type, patterns in PATTERNS.items():
        for pattern in patterns:
            for match in re.finditer(pattern, sms):
                # Use the first capturing group if it exists, otherwise use the whole match
                if match.groups():
                    start_pos = match.start(1)
                    end_pos = match.end(1)
                else:
                    start_pos = match.start()
                    end_pos = match.end()
                
                # Precise token tracking
                current_sms_pos = 0
                for i, token in enumerate(tokens):
                    # Find token's start position in the original SMS (ignoring extra spaces)
                    # We look for the token starting from current_sms_pos
                    found_pos = sms.find(token, current_sms_pos)
                    if found_pos == -1: continue
                    
                    token_end = found_pos + len(token)
                    
                    # If this token falls within the match range, label it
                    if found_pos >= start_pos and token_end <= end_pos:
                        if not labeled[i]:
                            # Assign B- or I- tag
                            # It's B- if it's the first token of this specific match
                            is_start = (found_pos == start_pos)
                            labels[i] = f'B-{entity_type}' if is_start else f'I-{entity_type}'
                            labeled[i] = True
                    
                    current_sms_pos = token_end
    
    return list(zip(tokens, labels))

def generate_variations(sms: str, num_variations: int = 5) -> List[str]:
    """
    Generate variations of SMS by changing amounts, dates, names
    This creates synthetic training data for FREE
    """
    variations = [sms]  # Include original
    
    # Variation templates
    amounts = ['100.00', '500.00', '1000.00', '2500.00', '5000.00', '10000.00']
    merchants = ['AMAZON', 'FLIPKART', 'SWIGGY', 'ZOMATO', 'UBER', 'OLA', 'PAYTM']
    dates = ['01-01-26', '15-02-26', '20-03-26', '10-04-26']
    
    for _ in range(num_variations):
        var = sms
        
        # Replace amount
        var = re.sub(r'Rs\.?\s*\d+(?:,\d+)*(?:\.\d{2})?', 
                     f'Rs.{random.choice(amounts)}', var, count=1)
        
        # Replace date if present
        var = re.sub(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', 
                     random.choice(dates), var, count=1)
        
        variations.append(var)
    
    return variations

def create_training_dataset(seed_sms: List[str], variations_per_sms: int = 10) -> List[Dict]:
    """
    Create training dataset from seed SMS samples
    Generates synthetic variations to increase dataset size
    """
    training_data = []
    
    print(f"Processing {len(seed_sms)} seed SMS samples...")
    
    for sms in seed_sms:
        # Generate variations
        variations = generate_variations(sms, variations_per_sms)
        
        for var_sms in variations:
            # Auto-annotate
            annotated = auto_annotate(var_sms)
            
            tokens = [t[0] for t in annotated]
            ner_tags = [t[1] for t in annotated]
            
            training_data.append({
                'tokens': tokens,
                'ner_tags': ner_tags,
                'original_sms': var_sms
            })
    
    print(f"Generated {len(training_data)} training samples")
    return training_data

def split_dataset(data: List[Dict], train_ratio=0.7, val_ratio=0.15):
    """Split data into train/val/test sets"""
    random.shuffle(data)
    
    n = len(data)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))
    
    return {
        'train': data[:train_end],
        'validation': data[train_end:val_end],
        'test': data[val_end:]
    }

def save_dataset(dataset: Dict[str, List], output_dir: str = './data'):
    """Save dataset to JSON files"""
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    for split_name, split_data in dataset.items():
        output_path = os.path.join(output_dir, f'{split_name}.json')
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(split_data, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(split_data)} samples to {output_path}")

def main():
    """Main data preparation pipeline"""
    print("=" * 60)
    print("SMS NER Data Preparation (FREE - No Kaggle Download)")
    print("=" * 60)
    
    # Step 1: Create training data from seed samples
    print("\n[1/3] Generating training data from 15 seed SMS samples...")
    training_data = create_training_dataset(sms_samples, variations_per_sms=100)
    
    # Step 2: Split into train/val/test
    print("\n[2/3] Splitting dataset...")
    dataset = split_dataset(training_data)
    
    print(f"  Train: {len(dataset['train'])} samples")
    print(f"  Validation: {len(dataset['validation'])} samples")
    print(f"  Test: {len(dataset['test'])} samples")
    
    # Step 3: Save to files
    print("\n[3/3] Saving dataset...")
    save_dataset(dataset)
    
    print("\n" + "=" * 60)
    print("✅ Data preparation complete!")
    print("=" * 60)
    print("\nNext step: Run 'python train_model.py' to train the model")

if __name__ == '__main__':
    main()
