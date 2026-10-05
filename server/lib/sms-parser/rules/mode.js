/**
 * Step 7: Mode Identification (Strict Priority)
 * Step 8: Credit Card Flag
 */

module.exports = function detectMode(text) {
    const lower = text.toLowerCase();

    // Priority 1: CREDIT CARD
    if (
        lower.includes('credit card') ||
        lower.includes('card ending') ||
        lower.match(/\b(visa|amex|mastercard|diners)\b/) ||
        lower.match(/xx+\d{4}/) || // Improved masking match (XX1234, xxxx1234)
        (lower.includes('spent on') && lower.includes('card'))
    ) {
        return { mode: 'CREDIT_CARD', isCreditCard: true };
    }

    // Priority 2: DEBIT CARD
    if (lower.includes('debit card') || lower.includes('atm card')) {
        return { mode: 'DEBIT_CARD', isCreditCard: false };
    }

    // Priority 3: UPI / INSTANT PAY
    if (
        lower.includes('upi') ||
        lower.includes('vpa') ||
        lower.match(/@(?:oksbi|okhdfc|okaxis|ybl|ibl|paytm|axl)/) ||
        lower.includes('gpay') ||
        lower.includes('phonepe')
    ) {
        return { mode: 'UPI', isCreditCard: false };
    }

    // Priority 4: WALLET
    if (lower.includes('wallet') || lower.includes('paytm') || lower.includes('amazon pay')) {
        return { mode: 'WALLET', isCreditCard: false };
    }

    // Priority 5: BANK TRANSFER
    if (
        lower.includes('neft') ||
        lower.includes('rtgs') ||
        lower.includes('imps') ||
        lower.includes('netbanking') ||
        lower.includes('transfer') ||
        lower.includes('debited from') // Generic bank debit usually implies transfer if not card
    ) {
        return { mode: 'BANK_TRANSFER', isCreditCard: false };
    }

    // Priority 6: CASH
    if (lower.includes('cash') || lower.includes('atm wdl')) {
        return { mode: 'CASH', isCreditCard: false };
    }

    // Fallback
    return { mode: 'OTHER', isCreditCard: false };
};
