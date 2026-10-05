const analyzeIntent = require('./rules/intent.js');
const extractAmount = require('./rules/amount.js');
const extractDate = require('./rules/dateTime.js');
const detectMode = require('./rules/mode.js');
const extractMerchant = require('./rules/merchant.js');
const categorize = require('./rules/category.js'); // Updated
const detectBank = require('./rules/bank.js');
const calculateConfidence = require('./utils/confidence.js');

function parseSMS(text, senderId = '') {
    if (!text) return [];

    const lines = text.split(/(?:\r?\n|\.\s+ICICI|\.\s+HDFC|\.\s+SBI)/).filter(l => l.length > 10);
    const results = [];

    for (const line of lines) {
        // Step 1 & 2: Intent & Direction
        const intent = analyzeIntent(line);
        if (intent.type === 'IGNORE') continue;

        const transactionType = intent.type === 'CREDIT' ? 'credit' : 'debit'; // Standardized

        // Step 3 & 4: Amount & Currency
        const amountData = extractAmount(line);
        if (!amountData) continue;

        // Step 5 & 6: Date & Time
        const dateTime = extractDate(line);

        // Step 7 & 8: Mode
        const modeData = detectMode(line);

        // Step 9: Merchant
        const merchant = extractMerchant(line);

        // Step 10: Category (NOW PASSING TYPE CORRECTLY)
        const category = categorize(line, merchant, transactionType);

        // Step 11: Bank
        const bank = detectBank(line, senderId);

        // Step 12: Reference
        const refMatch = line.match(/(?:ref|txn|utr|id)[\s:]*([0-9a-zA-Z]+)/i);
        const ref = refMatch ? refMatch[1] : null;

        const result = {
            id: Date.now() + Math.random(),
            original_sender: senderId || 'Unknown',
            date: dateTime.date,
            time: dateTime.time,
            merchant: merchant || 'Unknown',
            description: line.trim(),
            amount: amountData.amount,
            currency: amountData.currency,
            transaction_type: transactionType,
            status: 'Pending',
            category: category,
            source: 'SMS_WEBHOOK',
            mode: modeData.mode,
            paymentMethod: modeData.mode,
            isCreditCard: modeData.isCreditCard,
            bank: bank,
            reference: ref,
            raw_message: line.trim(),
            received_at: new Date().toISOString() // Ensure tracking receipt time
        };

        result.confidence = calculateConfidence(result);
        results.push(result);
    }

    return results;
}

module.exports = { parseSMS, categorize };
