/**
 * creditCard.js
 * Detects if the transaction involved a Credit Card.
 * Critical for UI highlighting.
 */

module.exports = function detectCreditCard(text) {
    // Explicit keywords
    const isExplicit = /(credit card|creditcard)/i.test(text);

    // Masked Patterns: "card ending xx12", "xxxx1234", "ending 1234"
    // CAUTION: Debit cards also have these, so we rely on explicit keywords OR bank specific logic usually.
    // However, if strict "Credit Card" word isn't present, we look for Card + Spent combination often.

    const hasCardNumber = /(?:card|ending)\s*(?:no|number|ending)?\s*[:.-]?\s*(?:x+|[*]+)(\d{4})/i.test(text) ||
        /(?:x+|[*]+)(\d{4})/i.test(text);

    if (isExplicit) return true;

    // Heuristic: If it says "spent on card" or just "spent" + "card pattern", we often assume CC in generic parsing
    // unless "Debit Card" is explicitly found.
    if (/(debit card|debitcard)/i.test(text)) return false;

    // If just "Card" is mentioned with usage keywords
    if (/spent|charged|due|bill/i.test(text) && /card/i.test(text)) {
        return true;
    }

    return false;
};
