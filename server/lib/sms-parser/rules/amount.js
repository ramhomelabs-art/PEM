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

const BALANCE_LIMIT_CONTEXTS = [
    'avl bal', 'available balance', 'bal:', 'bal is', 'balance is', 'credit limit', 'avl limit', 'avl lmt', 'available limit',
    'wallet balance', 'updated wallet balance', 'wallet bal', 'current balance', 'cur bal', 'a/c balance'
];

module.exports = function extractAmount(text) {
    if (!text) return null;

    // 0. Check for explicit words (Lakh, Crore, etc.)
    // E.g. "Rs 1 Lakh", "INR 1.5 Lakhs", "Rs. 2 Crore", "1.2 Cr", "10 Lacs"
    const wordMatch = text.match(/(?:(Rs\.?|INR|[₹$€£¥]))?\s*([0-9]+(?:\.[0-9]+)?)\s*(lakhs?|lacs?|crores?|cr)\b/i);
    if (wordMatch) {
        const val = parseFloat(wordMatch[2]);
        const unit = wordMatch[3].toLowerCase();
        let multiplier = 100000; // lakh / lac
        if (unit.startsWith('cr')) multiplier = 10000000;
        const totalAmt = val * multiplier;
        const currency = wordMatch[1] ? (CURRENCY_MAP[wordMatch[1].replace('.', '').toUpperCase()] || 'INR') : 'INR';
        return { amount: totalAmt, currency };
    }

    // Enhanced regex matching:
    // 1. Currency code/symbol (Rs, INR, ₹, $, etc.)
    // 2. Optional Dr./Cr. prefix
    // 3. Amount with Indian comma grouping (1,00,000) or Western grouping (100,000) or plain digits
    // 4. Optional /- or Dr./Cr. suffix
    const regex = /(?:(Rs\.?|INR|USD|GBP|EUR|AED|SGD|JPY|[₹$€£¥]))?\s*(?:Dr\.?|Cr\.?)?\s*([0-9]{1,2}(?:,[0-9]{2})+,\s*[0-9]{3}(?:\.[0-9]+)?|[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)(?:\s*(?:\/-|Dr\.?|Cr\.?))?/gi;

    let match;
    let primaryMatch = null;
    let totalDueMatch = null;
    let minDueMatch = null;
    let candidateWithoutSymbol = null;

    while ((match = regex.exec(text)) !== null) {
        let [fullMatch, currencyRaw, amountRaw] = match;
        if (!amountRaw) continue;

        const index = match.index;
        const prefixWindow = text.substring(Math.max(0, index - 35), index).toLowerCase();
        const suffixWindow = text.substring(index + fullMatch.length, Math.min(text.length, index + fullMatch.length + 30)).toLowerCase();

        // Guard against time (e.g. "01:26:39" or "12:15:48")
        if (prefixWindow.endsWith(':') || suffixWindow.startsWith(':')) {
            continue;
        }

        // Guard against dates (e.g. "23-07-26", "17-10-2026", "30-Jul-26")
        if (/[0-9]-$/.test(prefixWindow) || /^-[a-z0-9]/i.test(suffixWindow) || /^\/[0-9]/.test(suffixWindow) || /[0-9]\/$/.test(prefixWindow)) {
            continue;
        }

        // If no currency symbol is present: strict filtering against card numbers, accounts, and dates
        if (!currencyRaw) {
            // Guard against card indicators ("card x3588", "card no. xx3318", "ending 7241", "a/c *0489", "xx7241")
            if (/\b(?:card|card\s*no\.?|a\/c|account|acct|ending|blkcc|block|pin|cvv)\s*(?:no\.?\s*)?[x\*\.]*$/i.test(prefixWindow) ||
                /[x\*\.]\s*$/i.test(prefixWindow)) {
                continue;
            }

            // Guard against phone numbers / helplines / OTP
            if (/\b(?:call|dial|sms|to|helpline|support|toll\s*free|care|otp|code|auth|pin|password)\b/i.test(prefixWindow) ||
                /\b(?:to\s+report|if\s+not\s+you)\b/i.test(suffixWindow)) {
                continue;
            }

            // Skip naked phone numbers
            const numVal = parseFloat(amountRaw.replace(/,/g, ''));
            if (numVal >= 1000000000 && Number.isInteger(numVal)) {
                continue;
            }

            // Skip naked 4-digit numbers that look like years or card digits unless preceded by explicit money verb
            if (numVal >= 1000 && numVal <= 9999 && Number.isInteger(numVal)) {
                if (!/\b(spent|paid|total|due|amt|amount|fee|bill|outstanding|autopay|mandate)\b/i.test(prefixWindow)) {
                    continue;
                }
            }
        }

        // Check if this is an available balance / available limit notice
        if (BALANCE_LIMIT_CONTEXTS.some(ctx => prefixWindow.includes(ctx))) {
            continue; // Skip available limit or balance
        }

        let amountVal = parseFloat(amountRaw.replace(/,/g, ''));
        if (isNaN(amountVal) || amountVal <= 0) continue;

        // Determine currency
        let currency = 'INR';
        if (currencyRaw) {
            const norm = currencyRaw.replace('.', '').toUpperCase();
            currency = CURRENCY_MAP[norm] || CURRENCY_MAP[currencyRaw] || 'INR';
        }

        // Check bill/statement prefixes (e.g. "Total due: 111443.32" or "Total amt: INR Dr. 9558.28")
        const isTotalDue = /\b(?:total\s*(?:due|amt|amount)|tot\s*due)\b/i.test(prefixWindow);
        const isMinDue = /\b(?:min(?:imum)?\s*(?:due|amt|amount|payment))\b/i.test(prefixWindow);

        if (isTotalDue) {
            totalDueMatch = { amount: amountVal, currency };
            continue;
        }

        if (isMinDue) {
            minDueMatch = { amount: amountVal, currency };
            continue;
        }

        if (currencyRaw) {
            // Direct spend / payment with currency symbol is highest priority
            if (!primaryMatch) {
                primaryMatch = { amount: amountVal, currency };
            }
        } else {
            // If preceded by explicit financial terms, save as candidate
            if (/\b(spent|paid|total|due|amount|amt|bill|outstanding|autopay|mandate|towards|scheduled\s+for|scheduled\s+on)\b/i.test(prefixWindow)) {
                if (!candidateWithoutSymbol) {
                    candidateWithoutSymbol = { amount: amountVal, currency: 'INR' };
                }
            }
        }
    }

    // Resolution priority:
    // 1. Direct spend/payment match (e.g. "INR 278.00 spent on YES BANK Card...")
    if (primaryMatch) return primaryMatch;

    // 2. Total due for statements/bills (e.g. "Total due INR 15501.92", "Total due: 111443.32")
    if (totalDueMatch) return totalDueMatch;

    // 3. Candidate without currency symbol but with financial verb
    if (candidateWithoutSymbol) return candidateWithoutSymbol;

    // 4. Minimum due if nothing else
    if (minDueMatch) return minDueMatch;

    return null;
};
