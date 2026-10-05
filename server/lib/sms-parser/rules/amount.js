/**
 * Step 3: Amount Identification
 * Step 4: Currency Identification
 */

const CURRENCY_MAP = {
    '₹': 'INR', 'Rs': 'INR', 'Rs.': 'INR', 'INR': 'INR',
    '$': 'USD', 'USD': 'USD',
    '€': 'EUR', 'EUR': 'EUR',
    '£': 'GBP', 'GBP': 'GBP',
    'AED': 'AED',
    'SGD': 'SGD',
    '¥': 'JPY', 'JPY': 'JPY'
};

const IGNORE_CONTEXTS = [
    'avl bal', 'available balance', 'bal', 'limit', 'outstanding', 'due'
];

module.exports = function extractAmount(text) {
    // Regex for various currency formats
    // Matches: Symbol/Code (Optional) + whitespace (Optional) + Number (with commas/decimals)
    // Avoids grabbing years like 2025 as amounts if possible, but strict regex is better.
    // Example: Rs. 1,500.00 | $120.50 | 500.00 | INR 500

    // Strategy: Split by common delimiters to isolate potential money chunks or regex scan
    // We utilize a comprehensive regex that looks for money-like patterns.

    // This regex looks for:
    // 1. Optional Currency (Rs.|INR|$|etc)
    // 2. Space
    // 3. Amount (digits, commas, dots)
    // It purposefully tries to exclude dates (dd-mm-yyyy) but simple numbers might match.
    // We filter "simple numbers" later by checking presence of currency symbol or context.

    const regex = /(?:(Rs\.?|INR|USD|GBP|EUR|AED|SGD|JPY|[₹$€£¥]))?\s?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/gi;

    let match;
    let bestMatch = null;

    // We scan all matches
    while ((match = regex.exec(text)) !== null) {
        let [fullMatch, currencyRaw, amountRaw] = match;

        // Clean up
        if (!amountRaw) continue;

        // Context Check: Look specifically around the match index in the original text
        // to see if it's prefixed by "Balance" or "Limit"
        const index = match.index;
        const prefixWindow = text.substring(Math.max(0, index - 25), index).toLowerCase();
        const suffixWindow = text.substring(index + fullMatch.length, Math.min(text.length, index + fullMatch.length + 20)).toLowerCase();

        if (IGNORE_CONTEXTS.some(ctx => prefixWindow.includes(ctx))) {
            continue; // Skip this amount, it's a balance
        }

        // OTP/Auth Code Guard
        if (/otp|code|auth|pw|password|pin/i.test(prefixWindow) || /otp|code/i.test(suffixWindow)) {
            continue;
        }

        let amountVal = parseFloat(amountRaw.replace(/,/g, ''));
        if (isNaN(amountVal) || amountVal === 0) continue;

        // Skip years like 2024, 2025 if they appear without currency symbol
        // (Simple heuristic: if integer between 1990-2100 and no symbol, ignore)
        if (!currencyRaw && amountVal >= 1990 && amountVal <= 2100 && Number.isInteger(amountVal)) {
            // But allow IF it looks like manual entry "Lunch 2000" (prefix is specific)
            if (!/lunch|dinner|food|cab|uber|ola|paid|sent/i.test(prefixWindow)) {
                continue;
            }
        }

        // Determine Currency
        let currency = 'INR'; // Default
        if (currencyRaw) {
            const norm = currencyRaw.replace('.', '').toUpperCase();
            currency = CURRENCY_MAP[norm] || CURRENCY_MAP[currencyRaw] || 'INR';
        }

        // If we found a match with a currency symbol, it's high confidence. Return immediately.
        if (currencyRaw) {
            return { amount: amountVal, currency };
        }

        // Otherwise, keep this as a candidate (e.g. just "500.00" without symbol)
        // If we already have a candidate, prefer the one with decimal points or larger value (assumption)
        if (!bestMatch) {
            bestMatch = { amount: amountVal, currency: 'INR' };
        }
    }

    return bestMatch;
};
