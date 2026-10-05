/**
 * Step 9: Merchant / Person Identification & Normalization
 * 
 * Logic: 
 * 1. Extract raw merchant from keywords (at, to, used at, etc.)
 * 2. NORMALIZE: Prefix Removal -> Gateway Cleanup -> Location Removal -> ID Removal -> Brand Resolution
 */

const EXTRACT_KEYWORDS = [' at ', ' to ', ' from ', ' via ', ' payee ', ' vpa ', ' spent on ', ' by ', ' sent to ', ' paid to ', ' trf to ', ' for ', ' on '];

// Step 2: Payment Prefixes
const PREFIX_REGEX = /^(paytm|phonepe|razorpay|payu|google\s*pay|gpay|amazon\s*pay|pay|pos|upi|imps|neft|rtgs|ecom|card|txn|trx|py|pmt)\s*[*\-]?\s*/i;

// Step 3: Gateways 
const GATEWAY_REGEX = /\b(razorpay|payu|cashfree|ccavenue|billdesk|stripe|paypal|google\s*pay|gpay|amazon\s*pay)\b/i;

// Step 4: Locations / Country Codes
const LOCATION_REGEX = /\b(in|ind|india|us|uk|eu|sg|ae|bangalore|bengaluru|mumbai|delhi|new\s*delhi|chennai|hyderabad|kolkata|pune)\b/gi;

// Step 5: Random IDs / Hashes 
// Relaxed to catch short IDs (3+) if preceded by special chars or space
const ID_REGEX = /[\*\-\s]+[A-Z0-9]{4,}$/i;

// UPI VPA Regex: username@bank
const UPI_REGEX = /[\w.-]+@[\w.-]+/;


// Step 6 & 7: Canonical Map & Brand Resolution
const CANONICAL_MAP = {
    'AMZN': 'AMAZON',
    'AMZN MKTP': 'AMAZON',
    'FLPKRT': 'FLIPKART',
    'SWIGY': 'SWIGGY',
    'ZOMAT': 'ZOMATO',
    'MYNTR': 'MYNTRA',
    'BLINK': 'BLINKIT',
    'BIGBKT': 'BIGBASKET',
    'IRCTC LTD': 'IRCTC',
    'NETFLIX.COM': 'NETFLIX',
    'SPOTIFY USA': 'SPOTIFY',
    'UBER INDIA': 'UBER',
    'OLA CABS': 'OLA'
};

const BRAND_KEYWORDS = [
    'ZOMATO', 'SWIGGY', 'AMAZON', 'FLIPKART', 'MYNTRA', 'BLINKIT', 'BIGBASKET',
    'IRCTC', 'NETFLIX', 'SPOTIFY', 'UBER', 'OLA', 'BOOKMYSHOW', 'STARBUCKS',
    'DOMINOS', 'PIZZA HUT', 'MCDONALDS', 'KFC', 'DUNKIN', 'SUBWAY'
];

function normalizeMerchant(raw) {
    if (!raw) return null;
    let clean = raw.trim();

    // Preserve UPI IDs as is (lowercase is fine)
    if (UPI_REGEX.test(clean)) {
        return clean.toLowerCase();
    }

    // Step 2: Remove Prefixes 
    clean = clean.replace(PREFIX_REGEX, '');

    // Step 3: Remove Gateway Names
    clean = clean.replace(GATEWAY_REGEX, '').trim();

    // Step 4: Remove Locations
    clean = clean.replace(LOCATION_REGEX, '').trim();

    // Step 5: Remove Random IDs
    // We execute this BEFORE stripping noise to capture *X9K8 pattern
    clean = clean.replace(ID_REGEX, '').trim();

    // Remove noise chars & trailing dots
    clean = clean.replace(/[^\w\s\.\-&@]/gi, '') // Added @ for emails/UPIs
        .replace(/\s+/g, ' ')
        .replace(/[.,:;]+$/, '')
        .trim();

    // Uppercase for map lookup
    let upper = clean.toUpperCase();

    // Step 6: Direct Map Lookup
    if (CANONICAL_MAP[upper]) {
        return CANONICAL_MAP[upper];
    }

    // Step 7: Brand Resolution
    for (const brand of BRAND_KEYWORDS) {
        if (upper.includes(brand)) {
            return brand;
        }
    }

    return upper || raw.toUpperCase();
}

module.exports = function extractMerchant(text) {
    const lower = text.toLowerCase() + " ";

    // 0. Manual Entry Heuristic (Start of string)
    // Matches "Uber 500" or "Lunch 200"
    // Heuristic: Start of string + Alpha chars + Space + Number
    // BUT we must be careful not to catch "Rs. 500" as Merchant "Rs"
    const manualStartRegex = /^([a-zA-Z\s]{3,20})\s+\d+/;
    const manualMatch = text.match(manualStartRegex);
    if (manualMatch) {
        const candidate = manualMatch[1].trim();
        // Filter out currency words
        if (!/^(rs|inr|usd|spent|paid|amount)/i.test(candidate)) {
            return normalizeMerchant(candidate);
        }
    }

    // Priority: 'used at', 'paid at', 'to'
    const orderedKeywords = [...EXTRACT_KEYWORDS];

    for (const kw of EXTRACT_KEYWORDS) {
        const idx = lower.indexOf(kw);
        if (idx !== -1) {
            let candidate = text.substring(idx + kw.length).trim();

            const stopWords = [' on ', ' using ', ' ref ', ' txn ', ' avl ', ' alert', ' info', ' via ', ' refno ', ' ending ', ' and '];
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

            if (candidate.length > 2 && candidate.length < 50) {
                if (/credit\s?card|debit\s?card|account|acct|salary|refund|emi|loan|balance|limit/i.test(candidate)) continue;

                // Fix for 'on' check: Only ignore if it LOOKS like a date (DD-Mon or YYYY-MM)
                if (kw.trim() === 'on') {
                    // Check for date patterns like "27-Dec", "2025-12", "Dec 25"
                    if (/\d{1,2}[-\s][A-Za-z]{3}|\d{4}-\d{2}|[A-Za-z]{3}\s\d{1,2}/.test(candidate)) continue;
                }

                if (kw.trim() === 'on' && /^card/i.test(candidate)) continue;

                return normalizeMerchant(candidate);
            }
        }
    }

    return null;
};
