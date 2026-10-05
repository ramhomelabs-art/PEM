"""
ML SMS Parser Prediction Script
Uses the trained DistilBERT NER model to parse SMS
"""

import os
import json
import torch
import re
from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline

# Path to the trained model
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'sms-ner-final')

def load_model():
    """Load the trained model and tokenizer"""
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}. Please train the model first.")
    
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForTokenClassification.from_pretrained(MODEL_PATH)
    
    # Create the NER pipeline
    # aggregation_strategy="simple" will merge sub-tokens back into whole words
    return pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy="simple")

def parse_sms_ml(sms_text, nlp_pipeline=None):
    """
    Parse a given SMS text using the ML model
    """
    if nlp_pipeline is None:
        nlp_pipeline = load_model()
        
    # Get NER predictions
    entities = nlp_pipeline(sms_text)
    
    # DEBUG: Print raw entities
    print(f"\nRaw entities for: {sms_text[:50]}...")
    for ent in entities:
        print(f"  {ent['entity_group']}: {ent['word']} ({ent['score']:.4f})")
    
    # Initialize the structured result
    result = {
        'amount': None,
        'type': None,
        'merchant': None,
        'payment_mode': None,
        'account': None,
        'bank': None,
        'date': None,
        'reference': None,
        'confidence': 0.0
    }
    
    # Track scores to calculate average confidence
    scores = []
    
    for entity in entities:
        label = entity['entity_group']
        word = entity['word'].strip()
        score = float(entity['score'])
        scores.append(score)
        
        if label == 'AMOUNT' and result['amount'] is None:
            # Clean up the amount - handle cases like "Rs.70.00" or "Rs. 1002" or "Rs:1903"
            # Remove non-numeric characters except for the decimal point
            clean_word = word.replace('Rs.', '').replace('Rs:', '').replace('INR', '').replace(',', '').strip()
            # Special case: don't pick up "Avl Lmt" or other text as amount
            if not any(c.isdigit() for c in clean_word):
                continue
                
            clean_word = re.sub(r'[^\d\.]', '', clean_word)
            try:
                if clean_word.count('.') > 1:
                    parts = clean_word.split('.')
                    clean_word = parts[0] + '.' + ''.join(parts[1:])
                if clean_word:
                    result['amount'] = float(clean_word)
            except ValueError:
                pass
        elif label == 'TYPE' and result['type'] is None:
            word_lower = word.lower()
            if any(k in word_lower for k in ['credit', 'receive']):
                result['type'] = 'credit'
            elif any(k in word_lower for k in ['debit', 'spent', 'paid', 'sent']):
                result['type'] = 'debit'
            else:
                result['type'] = word_lower
        elif label == 'MERCHANT' and result['merchant'] is None:
            # Clean up merchant (remove prefixes like "To ", "from ", "@")
            clean_word = re.sub(r'^(To\s+|from\s+|at\s+|@\s*|At\s+)', '', word, flags=re.IGNORECASE)
            # Basic validation: ensure it's not just a number
            if clean_word.strip() and not clean_word.strip().isdigit():
                result['merchant'] = clean_word.strip()
        elif label == 'MODE' and result['payment_mode'] is None:
            result['payment_mode'] = word
        elif label == 'ACCOUNT' and result['account'] is None:
            # Keep only the digits for account
            clean_word = re.sub(r'[^\d]', '', word)
            if clean_word:
                result['account'] = clean_word
        elif label == 'BANK' and result['bank'] is None:
            result['bank'] = word
        elif label == 'DATE' and result['date'] is None:
            # Simple date validation: should have at least some chars
            if len(word) > 2:
                result['date'] = word
        elif label == 'REFERENCE' and result['reference'] is None:
            result['reference'] = word
            
    if scores:
        result['confidence'] = sum(scores) / len(scores)
        
    return result

if __name__ == "__main__":
    # Test cases
    test_sms = [
        "Credit Alert! Rs.3600.00 credited to HDFC Bank A/c XX0489 on 05-01-26 from VPA sureshdrlzzz01@okhdfcbank (UPI 116735714569)",
        "Sent Rs.70.00 From HDFC Bank A/C *0489 To RUPESH On 30/12/26 Ref 637816313645",
        "Spent Rs.1002 On HDFC Bank Card 4129 At AIRPLAZA RETAIL HOLDIN On 2025-12-27:18:32:03",
        "Dear UPI user A/C X3534 debited by 19.0 on date 26Jan25 trf to Jio Prepaid Rech Refno 502623989723"
    ]
    
    # Load model once
    print("Loading model...")
    nlp = load_model()
    print("Model loaded successfully.\n")
    
    final_results = []
    for i, sms in enumerate(test_sms):
        print(f"--- Test Case {i+1} ---")
        parsed = parse_sms_ml(sms, nlp)
        final_results.append({
            "sms": sms,
            "parsed": parsed
        })
        print(f"Confidence: {parsed['confidence']:.4f}")
        print(f"Type: {parsed['type']}, Amount: {parsed['amount']}")
    
    # Save to file to avoid console mess
    with open('test_results.json', 'w') as f:
        json.dump(final_results, f, indent=2)
    print(f"\n✅ All results saved to test_results.json")
