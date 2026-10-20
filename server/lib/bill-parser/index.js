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

    // 3. Identifiers (Consumer No, Account No, Phone No)
    let identifiers = {};
    const accMatch = text.match(/(?:a\/c|account|acct|consumer|cons)\s*(?:no|num|id|#)?[\s.:-]*([A-Za-z0-9•\*-]+)/i);
    if (accMatch && accMatch[1].length >= 2) {
        identifiers.account = accMatch[1];
    }
    const phoneMatch = text.match(/(?:phone|mobile|tel|landline|contact)\s*(?:no|num|id|#)?[\s.:-]*([0-9-]{6,15})/i);
    if (phoneMatch) {
        identifiers.phone = phoneMatch[1];
    }

    if (!amountData && !date) return null; // Too vague

    const providerName = provider ? provider.name : null;
    const parts = [`${providerName || 'Utility'} Bill`];
    if (identifiers.phone) parts.push(`Phone: ${identifiers.phone}`);
    else if (identifiers.account) parts.push(`A/c: ${identifiers.account}`);
    if (date) parts.push(`Due: ${date}`);
    const description = parts.join(' - ');

    return {
        type: 'BILL',
        category: provider ? provider.category : 'Utility',
        providerName: providerName,
        amount: amountData ? amountData.amount : null,
        dueDate: date,
        description: description,
        identifiers,
        raw: text
    };
}

module.exports = { parseBillSMS };
