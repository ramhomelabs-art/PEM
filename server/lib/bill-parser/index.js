const analyzeIntent = require('./rules/intent');
const extractProvider = require('./rules/provider');
const extractDate = require('./rules/date');
// Reuse amount extraction from SMS parser if possible, or duplicate logic
const extractAmount = require('../sms-parser/rules/amount');

/**
 * Main Bill Parser Entry Point
 */
function parseBillSMS(text) {
    // 1. Check Intent
    const intent = analyzeIntent(text);
    if (!intent.isBill) return null;

    // 2. Extract Details
    const provider = extractProvider(text);
    const date = extractDate(text);
    const amountData = extractAmount(text);

    // 3. Identifiers (Consumer No, Account No)
    // Simple regex for now. Strict: Must contain at least one digit to avoid "your", "this" etc.
    let identifiers = {};
    const accMatch = text.match(/(?:account|acct|consumer|cons|bill)\s*(?:no|num|id|#|for)?[\s:-]*([A-Z0-9-]*\d[A-Z0-9-]*)/i);
    if (accMatch) {
        identifiers.account = accMatch[1];
    }

    if (!amountData && !date) return null; // Too vague

    return {
        type: 'BILL',
        category: provider ? provider.category : 'General',
        providerName: provider ? provider.name : null,
        amount: amountData ? amountData.amount : null,
        dueDate: date,
        identifiers,
        raw: text
    };
}

module.exports = { parseBillSMS };
