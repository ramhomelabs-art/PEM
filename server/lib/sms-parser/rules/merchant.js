/**
 * Step 9: Merchant / Person Identification & Normalization
 */

const EXTRACT_KEYWORDS = [
    ' @', ' @ ', ' used at ', ' at ', ' sent to ', ' paid to ', ' trf to ', ' to ',
    ' payee ', ' vpa ', ' spent on ', ' by ', ' for ', ' on ', ' towards '
];

// Step 2: Payment Prefixes
const PREFIX_REGEX = /^(paytm|phonepe|razorpay|payu|google\s*pay|gpay|amazon\s*pay|pay|pos|upi|imps|neft|rtgs|ecom|card|txn|trx|py|pmt)\s*[*\-]?\s*/i;

// Step 3: Gateways 
const GATEWAY_REGEX = /\b(razorpay|payu|cashfree|ccavenue|billdesk|stripe|paypal|google\s*pay|gpay|amazon\s*pay)\b/i;

// Step 4: Locations / Country Codes
const LOCATION_REGEX = /\b(in|ind|india|us|uk|eu|sg|ae|bangalore|bengaluru|mumbai|delhi|new\s*delhi|chennai|hyderabad|kolkata|pune)\b/gi;

// Step 5: Random IDs / Hashes 
const ID_REGEX = /[\*\-\s]+[A-Z0-9]{4,}$/i;

// UPI VPA Regex: username@bank
const UPI_REGEX = /[\w.-]+@[\w.-]+/;

// Step 6 & 7: Canonical Map & Brand Resolution
const CANONICAL_MAP = {
    'AMZN': 'AMAZON',
    'AMZN MKTP': 'AMAZON',
    'FLPKRT': 'FLIPKART',
    'SWIGY': 'SWIGGY',
    'SWIGGY PVT LTD': 'SWIGGY',
    'SWIGGY PVT LTD FOOD1': 'SWIGGY',
    'ZOMAT': 'ZOMATO',
    'MYNTR': 'MYNTRA',
    'BLINK': 'BLINKIT',
    'BLINKIT': 'BLINKIT',
    'BLINK COMMERCE': 'BLINKIT',
    'BLINK COMMERCE PRIVATE LIMITED': 'BLINKIT',
    'BIGBKT': 'BIGBASKET',
    'IRCTC LTD': 'IRCTC',
    'NETFLIX.COM': 'NETFLIX',
    'SPOTIFY USA': 'SPOTIFY',
    'UBER INDIA': 'UBER',
    'OLA CABS': 'OLA',
    'BSNL': 'BSNL',
    'BSNL LANDLINE': 'BSNL',
    'AIRTEL': 'AIRTEL',
    'JIO': 'JIO',
    'MYJIO': 'JIO',
    'RELIANCE JIO': 'JIO',
    'VODAFONE': 'VI',
    'IDEA': 'VI',
    'MTNL': 'MTNL',
    'BESCOM': 'BESCOM',
    'TNEB': 'TNEB',
    'TATA PLAY': 'TATA PLAY',
    'TATA SKY': 'TATA PLAY',
    'ACT FIBERNET': 'ACT FIBERNET',
    'DREAMPLUG': 'CRED',
    'DREAMPLUG P': 'CRED',
    'DREAMPLUG SERVICES': 'CRED',
    'DREAMPLUG SERVICE PRIVATE LIMITED': 'CRED',
    'DREAMPLUG PAYTECH': 'CRED',
    'DREAMPLUG PAYTECH S': 'CRED',
    'CRED CLUB': 'CRED',
    'CRED WALLET': 'CRED Wallet',
    'LAZYPAY': 'LAZYPAY',
    'BILLDESK': 'BillDesk',
    'BILLDESK(BDD)': 'BillDesk',
    'YESCRED': 'CRED',
    'APPLE MEDIA SERVICES': 'Apple',
    'APPLE SERVICES': 'Apple',
    'APPLE.COM/BILL': 'Apple',
    'APPLE': 'Apple',
    'ZERODHA': 'Zerodha',
    'GROWW': 'Groww',
    'UPSTOX': 'Upstox'
};

const BRAND_KEYWORDS = [
    'ZOMATO', 'SWIGGY', 'AMAZON', 'FLIPKART', 'MYNTRA', 'BLINKIT', 'BIGBASKET',
    'IRCTC', 'NETFLIX', 'SPOTIFY', 'UBER', 'OLA', 'BOOKMYSHOW', 'STARBUCKS',
    'DOMINOS', 'PIZZA HUT', 'MCDONALDS', 'KFC', 'DUNKIN', 'SUBWAY',
    'BSNL', 'AIRTEL', 'JIO', 'VODAFONE', 'MTNL', 'BESCOM', 'TNEB', 'TATA PLAY', 'ACT FIBERNET',
    'DREAMPLUG', 'CRED', 'LAZYPAY', 'APPLE', 'BILLDESK', 'ZERODHA', 'GROWW', 'UPSTOX'
];

function normalizeMerchant(raw) {
    if (!raw) return null;
    let clean = raw.trim();

    // Preserve UPI IDs as is (lowercase)
    if (UPI_REGEX.test(clean)) {
        return clean.toLowerCase();
    }

    clean = clean.replace(PREFIX_REGEX, '');
    clean = clean.replace(GATEWAY_REGEX, '').trim();
    clean = clean.replace(LOCATION_REGEX, '').trim();
    clean = clean.replace(ID_REGEX, '').trim();

    clean = clean.replace(/[^\w\s\.\-&@]/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/[.,:;]+$/, '')
        .trim();

    let upper = clean.toUpperCase();

    // Direct Map Lookup
    if (CANONICAL_MAP[upper]) {
        return CANONICAL_MAP[upper];
    }

    // Partial Map Lookup
    for (const [key, val] of Object.entries(CANONICAL_MAP)) {
        if (upper.includes(key)) {
            return val;
        }
    }

    // Brand Resolution
    for (const brand of BRAND_KEYWORDS) {
        if (upper.includes(brand)) {
            return CANONICAL_MAP[brand] || brand;
        }
    }

    return upper || raw.toUpperCase();
}

module.exports = function extractMerchant(text) {
    if (!text) return null;

    let cleanText = text
        .replace(/https?:\/\/[^\s]+/gi, '')
        .replace(/uid=[\w•\s\*-]+/gi, '')
        .replace(/(?:please\s*)?dial\s*1930[^\.]*/gi, '')
        .replace(/(?:to\s*)?report\s*(?:cyber\s*crime|fraud)[^\.]*/gi, '')
        .replace(/cyber\s*crime\s*(?:team|cell)?[^\.]*/gi, '')
        .replace(/please\s*ignore\s*if\s*(?:already\s*)?paid[^\.]*/gi, '')
        .replace(/if\s*not\s*(?:done|you)[^\.]*/gi, '')
        .replace(/not\s*you\?[^\.]*/gi, '')
        .replace(/sms\s*blkcc[^\.]*/gi, '')
        .replace(/sms\s*block[^\.]*/gi, '')
        .replace(/call\s*(?:1800|\+91|\d{6,})[^\.]*/gi, '')
        .replace(/customer\s*care\b[^\.]*/gi, '')
        .replace(/toll\s*free\b[^\.]*/gi, '');

    // 1. Credit Card Statement / Bill Header Pattern
    // E.g.: "YES BANK Credit Card XX3588 OCT-26 statement", "HSBC Credit Card ending 7241 : Total due", "Your statement for Axis Bank Credit Card"
    const statementMatch = cleanText.match(/\b([A-Za-z\s]+?)\s*(?:credit\s*card|card)\b.*?(?:statement|total\s*due|due\s*on)/i);
    if (statementMatch) {
        const bankOrCard = statementMatch[1].replace(/your\s*statement\s*for/i, '').trim();
        if (bankOrCard && !/^(total|min|due)\b/i.test(bankOrCard)) {
            return `${normalizeMerchant(bankOrCard)} Credit Card`;
        }
    }

    // 2. Credit Card Payment Received Pattern
    // E.g.: "we have received a payment of INR 3551.64 for credit card ending 7241 ... HSBC"
    if (/\b(?:received\s*(?:a\s*)?payment|payment\s*received)\b/i.test(cleanText)) {
        const bankMatch = cleanText.match(/\b(HSBC|HDFC|SBI|ICICI|AXIS|YES\s*BANK|KOTAK|RBL|CITI|AMEX)\b/i);
        const bankName = bankMatch ? normalizeMerchant(bankMatch[1]) : 'Credit Card';
        return `${bankName} - Payment Received`;
    }

    // 3. Wallet / BNPL Payment Pattern:
    // E.g.: "Dear LazyPay Customer, your payment of Rs. 360.00 for txn TXN607408632 on Blink Commerce Private Limited was successful."
    const bnplPaymentMatch = cleanText.match(/payment\s+of\s+.*?on\s+([A-Za-z0-9\s&-]+?)\s+was\s+successful/i);
    if (bnplPaymentMatch) {
        return normalizeMerchant(bnplPaymentMatch[1]);
    }

    // 3b. Wallet Update / Header Pattern:
    // E.g.: "Update from CRED wallet: You have successfully paid Rs.200.0..."
    const walletMatch = cleanText.match(/(?:update\s+from|from)\s+([A-Za-z0-9\s&-]+?\s*wallet)/i);
    if (walletMatch) {
        return normalizeMerchant(walletMatch[1]);
    }

    // 3c. AutoPay / Mandate / Towards Pattern:
    // E.g.: "Your HSBC UPI AutoPay for 195.00 towards APPLE MEDIA SERVICES is scheduled on 21/10/2026."
    const towardsMatch = cleanText.match(/towards\s+([A-Za-z0-9\s&.-]+?)(?:\s+(?:is|on|ref|with|using|from|via)\b|$)/i);
    if (towardsMatch) {
        const cand = towardsMatch[1].trim();
        if (cand.length >= 2 && cand.length <= 40 && !/^(account|acct|card|due)\b/i.test(cand)) {
            return normalizeMerchant(cand);
        }
    }

    // 3d. Bill Payment Receipt Pattern:
    // E.g.: "Thank You for making payment of Rs 707.00/- on 20-OCT-26 for your BSNL Landline bill for Telephone No..."
    const billReceiptMatch = cleanText.match(/for\s+(?:your\s+)?([A-Za-z0-9\s&-]+?)\s+(?:bill|recharge|landline|broadband|fiber)/i);
    if (billReceiptMatch) {
        const cand = billReceiptMatch[1].trim();
        if (cand.length >= 2 && cand.length <= 30 && !/^(the|our|your)\b/i.test(cand)) {
            return normalizeMerchant(cand);
        }
    }

    // 4. Multiline Axis Bank Card Pattern:
    // "Spent INR 5175\nAxis Bank Card no. XX3318\n23-07-26 12:15:48 IST\nDreamplug P\nAvl Limit: INR 6876.83"
    const axisMultilineMatch = cleanText.match(/\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\s*IST)?\s*\n\s*([A-Za-z0-9\s&-]+?)\s*\n\s*Avl\s*Limit/i);
    if (axisMultilineMatch) {
        return normalizeMerchant(axisMultilineMatch[1]);
    }

    // 5. Multiline HDFC Bank UPI Pattern:
    // "Sent Rs.39.00\nFrom HDFC Bank A/C *0489\nTo MYJIO\nOn 07/10/26"
    const hdfcMultilineMatch = cleanText.match(/\n\s*To\s+([A-Za-z0-9\s&-]+?)(?:\s*\n|\s+On\s+)/i);
    if (hdfcMultilineMatch) {
        return normalizeMerchant(hdfcMultilineMatch[1]);
    }

    // 6. Bank Account Transfer to Beneficiary:
    // E.g.: "INR 40000.00 is paid from HSBC account XXXXXX0006 to VIJAYA LAKSHMI R M on 05-Oct-26 with ref 664407409314"
    const transferMatch = cleanText.match(/paid\s+from\s+.*?account\s+.*?\s+to\s+([A-Za-z\s\.\-]+?)\s+(?:on\s+\d|with\s+ref)/i);
    if (transferMatch) {
        return normalizeMerchant(transferMatch[1]);
    }

    // 6b. UPI Narration / Info Pattern:
    // E.g.: "Info: UPI-ZERODHA BROKING-zerodha@hdfcbank-123456789012"
    const upiInfoMatch = cleanText.match(/\b(?:info|desc|narr)?[:\s]*upi-([A-Za-z0-9\s&.-]+?)-/i);
    if (upiInfoMatch) {
        const cand = upiInfoMatch[1].trim();
        if (cand.length >= 2 && cand.length <= 40) {
            return normalizeMerchant(cand);
        }
    }

    // 7. Provider Greeting / Bill Header Pattern: "Dear BSNL Customer", "Your LazyPay outstanding of..."
    if (/\blazypay\b/i.test(cleanText) && /\b(?:outstanding|due\s*for\s*payment)\b/i.test(cleanText)) {
        return 'LAZYPAY';
    }

    const greetingMatch = cleanText.match(/(?:dear|your|from)\s+([A-Za-z0-9\s&-]+?)\s+(?:customer|consumer|subscriber|user|bill|broadband|fiber|landline|service)\b/i);
    if (greetingMatch) {
        const candidate = greetingMatch[1].trim();
        const EXCLUDED_GREETINGS = /^(our|valued|prestige|prime|all|the|lazypay|sbi|hdfc|icici|axis|hsbc|kotak|pnb|bob|yes\s*bank|canara|union|idfc|indusind|federal|bank)\b/i;
        if (!EXCLUDED_GREETINGS.test(candidate) && candidate.length >= 2 && candidate.length <= 30) {
            return normalizeMerchant(candidate);
        }
    }

    // 8. Known Indian Utility / Telecom Brands in text
    const brandMatch = cleanText.match(/\b(BSNL|AIRTEL|JIO(?:\s*FIBER)?|VODAFONE|IDEA|MTNL|BESCOM|TNEB|ACT\s*FIBERNET|TATA\s*PLAY|TATA\s*SKY|DISH\s*TV)\b/i);
    if (brandMatch && /\b(bill|recharge|due|plan|broadband|fiber|landline)\b/i.test(cleanText)) {
        return normalizeMerchant(brandMatch[1]);
    }

    const lower = cleanText.toLowerCase() + " ";

    // 9. Standard Prefix Scan (' @', ' at ', ' to ', etc.)
    for (const kw of EXTRACT_KEYWORDS) {
        const idx = lower.indexOf(kw);
        if (idx !== -1) {
            let candidate = cleanText.substring(idx + kw.length).trim();

            const stopWords = [' on ', ' using ', ' ref ', ' txn ', ' avl ', ' alert', ' info', ' via ', ' refno ', ' ending ', ' and ', ' with ref ', ' is ', ' scheduled ', ' please '];
            if (kw.trim() !== 'for') stopWords.push(' for ');

            let cutoffIndex = candidate.length;
            for (const stop of stopWords) {
                if (stop.trim() === kw.trim()) continue;

                const sIdx = candidate.toLowerCase().indexOf(stop);
                if (sIdx !== -1 && sIdx < cutoffIndex) {
                    cutoffIndex = sIdx;
                }
            }

            candidate = candidate.substring(0, cutoffIndex).trim();

            // Strip trailing timestamps (e.g. "17-10-2026 01:26:39 pm")
            candidate = candidate.replace(/\s+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}.*$/, '');

            // Strip trailing upi / vpa / wallet / ref / pmt
            candidate = candidate.replace(/\s+(?:upi|vpa|wallet|ref|txn|pmt)\s*$/i, '').trim();

            if (candidate.length > 2 && candidate.length < 50) {
                if (/credit\s?card|debit\s?card|account|acct|salary|refund|emi|loan|balance|limit/i.test(candidate)) continue;
                if (/^(?:report|cyber|fraud|dispute|call|dial|helpline|toll|customer\s*care|team\b)/i.test(candidate) ||
                    /\b(cyber\s*crime|1930|1800|helpline|dispute|fraud|customer\s*care)\b/i.test(candidate)) {
                    continue;
                }
                if (kw.trim() === 'on') {
                    if (/\d{1,2}[-\s][A-Za-z]{3}|\d{4}-\d{2}|[A-Za-z]{3}\s\d{1,2}/.test(candidate)) continue;
                    if (/^card/i.test(candidate)) continue;
                }

                return normalizeMerchant(candidate);
            }
        }
    }

    return null;
};
