/**
 * Step 13: Confidence Scoring
 */

module.exports = function calculateConfidence(result) {
    if (result.type === 'IGNORE') return 0;

    let score = 0;

    // 1. Amount Exists (+25)
    if (result.amount) score += 25;

    // 2. Debit/Credit identified (+10)
    if (result.transaction_type && result.transaction_type !== 'UNKNOWN') score += 10;

    // 3. Date Exists (+15)
    if (result.date) score += 15;

    // 4. Mode identified (+15)
    if (result.mode && result.mode !== 'OTHER') score += 15;

    // 5. Merchant identified (+20)
    if (result.merchant) score += 20;

    // 6. Category specific (+15)
    if (result.category && result.category !== 'General') score += 15;

    // Special Rule: Credit Card without merchant cap
    if (result.mode === 'CREDIT_CARD' && !result.merchant) {
        return Math.min(score, 70);
    }

    return Math.min(score, 100);
};
