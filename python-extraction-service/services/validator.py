def validate_extraction(data):
    """
    Validate extracted transaction data
    
    Args:
        data: Extracted data dictionary
        
    Returns:
        dict: Validation results
    """
    validation_results = {
        'is_valid': True,
        'errors': [],
        'warnings': [],
        'statistics': {}
    }
    
    # Check if transactions exist
    transactions = data.get('transactions', [])
    
    if not transactions:
        validation_results['is_valid'] = False
        validation_results['errors'].append('No transactions found')
        return validation_results
    
    # Validate each transaction
    for idx, txn in enumerate(transactions):
        # Check required fields
        required_fields = ['date', 'merchant', 'amount']
        for field in required_fields:
            if field not in txn or not txn[field]:
                validation_results['warnings'].append(
                    f"Transaction {idx + 1}: Missing {field}"
                )
        
        # Check amount is positive
        if 'amount' in txn and txn['amount'] <= 0:
            validation_results['warnings'].append(
                f"Transaction {idx + 1}: Invalid amount {txn['amount']}"
            )
        
        # Check confidence
        if 'confidence' in txn and txn['confidence'] < 0.5:
            validation_results['warnings'].append(
                f"Transaction {idx + 1}: Low confidence ({txn['confidence']})"
            )
    
    # Calculate statistics
    validation_results['statistics'] = {
        'total_transactions': len(transactions),
        'high_confidence': sum(1 for t in transactions if t.get('confidence', 0) > 0.8),
        'medium_confidence': sum(1 for t in transactions if 0.5 <= t.get('confidence', 0) <= 0.8),
        'low_confidence': sum(1 for t in transactions if t.get('confidence', 0) < 0.5),
        'total_amount': sum(t.get('amount', 0) for t in transactions)
    }
    
    return validation_results

# Export
__all__ = ['validate_extraction']
