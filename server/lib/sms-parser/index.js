const analyzeIntent = require('./rules/intent.js');
const extractAmount = require('./rules/amount.js');
const extractDate = require('./rules/dateTime.js');
const detectMode = require('./rules/mode.js');
const extractMerchant = require('./rules/merchant.js');
const categorize = require('./rules/category.js');
const detectBank = require('./rules/bank.js');
const calculateConfidence = require('./utils/confidence.js');

function parseSMS(text, senderId = '') {
    if (!text || typeof text !== 'string') return [];

    // Smart chunking: only split by double newlines if multiple chunks actually contain amounts.
    // If an SMS has paragraph spacing (e.g. CRED wallet with greeting and body separated by blank line),
    // keep it as a single SMS so the header/footer isn't discarded.
    let rawChunks = [text.trim()];
    const possibleChunks = text.split(/(?:\r?\n\s*\r?\n|\.\s+(?:ICICI|HDFC|SBI|AXIS|YES\s*BANK)\b)/).map(l => l.trim()).filter(l => l.length > 10);
    if (possibleChunks.length > 1) {
        const chunksWithAmount = possibleChunks.filter(c => extractAmount(c) !== null);
        if (chunksWithAmount.length > 1) {
            rawChunks = possibleChunks;
        }
    }

    const results = [];

    for (const chunk of rawChunks) {
        const fullText = chunk.trim();

        // 1. Intent & Direction
        const intent = analyzeIntent(fullText);
        if (intent.type === 'IGNORE') continue;

        const transactionType = intent.type === 'CREDIT' ? 'credit' : 'debit';

        // 2. Amount & Currency
        const amountData = extractAmount(fullText);
        if (!amountData) continue;

        // 3. Date & Time
        const dateTime = extractDate(fullText);

        // 4. Mode
        const modeData = detectMode(fullText);

        // 5. Merchant
        const merchant = extractMerchant(fullText);

        // 6. Category
        const category = categorize(fullText, merchant, transactionType);

        // 7. Bank
        const bank = detectBank(fullText, senderId);

        // 8. Card Last 4 Extraction
        let cardLast4 = null;
        const cardMatch = fullText.match(/(?:card|card\s*no\.?)\s*(?:ending\s*)?(?:[x\*]{1,}|no\.?\s*)?(\d{4})\b/i) ||
                          fullText.match(/credit\s*card\s*ending\s*(\d{4})\b/i) ||
                          fullText.match(/\b(?:x{1,}|\*{1,})(\d{4})\b/i) ||
                          fullText.match(/ending\s+(\d{4})\b/i);
        if (cardMatch) {
            cardLast4 = cardMatch[1];
        }

        // 9. Account Masked Extraction (Must contain digits or mask characters, and not be common words like Ref/Balance)
        let accountMasked = null;
        const accMatch = fullText.match(/(?:a\/c|account|acct)\s*(?:no|num|id|#)?[\s.:-]*([A-Za-z0-9•\*-]+)/i);
        if (accMatch && accMatch[1].length >= 2) {
            const cand = accMatch[1].trim();
            if (/[\d•\*Xx]/.test(cand) && !/^(ref|balance|holder|limit|name|type|status|is|for)\b/i.test(cand)) {
                accountMasked = cand;
            }
        }

        // 10. Available Limit Extraction
        let availableLimit = null;
        const avlMatch = fullText.match(/(?:avl\s*(?:lmt|limit)|available\s*limit)[\s.:]*(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]+)?)/i);
        if (avlMatch) {
            availableLimit = parseFloat(avlMatch[1].replace(/,/g, ''));
        }

        // 11. Total Due & Min Due Extraction
        let totalDue = null;
        let minDue = null;
        const totalDueMatch = fullText.match(/total\s*(?:due|amt|amount)[\s.:]*(?:inr|rs\.?|₹)?\s*(?:dr\.?|cr\.?)?\s*([0-9,]+(?:\.[0-9]+)?)/i);
        if (totalDueMatch) {
            totalDue = parseFloat(totalDueMatch[1].replace(/,/g, ''));
        }
        const minDueMatch = fullText.match(/min(?:imum)?\s*(?:due|amt|amount|payment)[\s.:]*(?:inr|rs\.?|₹)?\s*(?:dr\.?|cr\.?)?\s*([0-9,]+(?:\.[0-9]+)?)/i);
        if (minDueMatch) {
            minDue = parseFloat(minDueMatch[1].replace(/,/g, ''));
        }

        // 12. Due Date / Scheduled Date Extraction
        let dueDate = null;
        const dueMatch = fullText.match(/(?:due\s*(?:by|date|on)|pay\s*before|last\s*date|pay\s*by)[\s.:-]*(\d{1,2}(?:st|nd|rd|th)?[\s,-]+[A-Za-z]{3,9}[\s,-]+\d{2,4}|\d{1,2}[-\s/]\d{1,2}[-\s/]\d{2,4})/i) ||
                         fullText.match(/scheduled\s*(?:on|for)[\s.:-]*(\d{1,2}(?:st|nd|rd|th)?[\s,-]+[A-Za-z]{3,9}[\s,-]+\d{2,4}|\d{1,2}[-\s/]\d{1,2}[-\s/]\d{2,4})/i);
        if (dueMatch) {
            const parsedDue = extractDate(dueMatch[1]);
            dueDate = parsedDue ? parsedDue.date : null;
        }

        // 13. Reference & Identifiers with strict word boundaries
        const rawRefMatch = fullText.match(/\b(?:ref(?:erence)?\s*(?:no\.?|num\.?|id|#)?|utr|rrn|refno)[\s.:#]*([0-9a-zA-Z@._-]+)\b/i) ||
                            fullText.match(/\btxn\s*(?:id|no\.?|num\.?|#)?[\s.:#]*([0-9a-zA-Z@._-]+)\b/i);
        let ref = null;
        if (rawRefMatch && !/^(to|of|for|on|by|via|in|with|from|and|the)\b/i.test(rawRefMatch[1])) {
            ref = rawRefMatch[1];
        }

        // 14. Determine bill status vs completed payment receipt vs scheduled mandate
        const isBillPaymentReceipt = !!(intent.isBillPaymentReceipt || modeData.isBillPaymentReceipt || /thank\s*you\s*for\s*making\s*payment|view\s*and\s*download\s*receipt/i.test(fullText));
        const isScheduledMandate = !!(intent.isScheduledMandate || /is\s*scheduled\s*(?:on|for)|ensure\s*sufficient\s*balance/i.test(fullText));

        let isBill = false;
        if (!isBillPaymentReceipt) {
            isBill = !!(modeData.isBill || intent.isBill || isScheduledMandate || totalDue !== null || (dueDate !== null && !isBillPaymentReceipt) || /due\s*by|is\s*due|statement/i.test(fullText));
        }
        const isCreditCardBill = !isBillPaymentReceipt && !!(modeData.isCreditCardBill || (isBill && (modeData.isCreditCard || cardLast4 !== null)));

        // If it's a payment receipt, it is completed, not due!
        if (isBillPaymentReceipt) {
            dueDate = null;
        }

        // Primary amount for statement is totalDue if present
        const effectiveAmount = (isCreditCardBill && totalDue) ? totalDue : amountData.amount;

        // 15. Clean Description
        let cleanDescription = fullText;
        if (isCreditCardBill) {
            const parts = [`${bank || 'Credit'} Card${cardLast4 ? ' XX' + cardLast4 : ''} Statement`];
            parts.push(`Total Due ₹${effectiveAmount.toLocaleString('en-IN')}`);
            if (minDue) parts.push(`Min Due ₹${minDue.toLocaleString('en-IN')}`);
            if (dueDate) parts.push(`Due ${dueDate}`);
            cleanDescription = parts.join(' - ');
        } else if (intent.isCardPayment) {
            cleanDescription = `Payment of ₹${amountData.amount.toLocaleString('en-IN')} received for ${bank || 'Credit'} Card${cardLast4 ? ' ending ' + cardLast4 : ''}`;
        } else if (isScheduledMandate) {
            cleanDescription = `Scheduled AutoPay to ${merchant || 'Merchant'}${dueDate ? ' on ' + dueDate : ''}${ref ? ' - Ref: ' + ref : ''}`;
        } else if (isBillPaymentReceipt) {
            cleanDescription = `Payment of ₹${effectiveAmount.toLocaleString('en-IN')} for ${merchant || 'Utility'} Bill${accountMasked ? ' - A/c: ' + accountMasked : ''}`;
        } else if (isBill) {
            const parts = [`${merchant || bank || 'Utility'} Bill`];
            if (accountMasked) parts.push(`A/c: ${accountMasked}`);
            if (dueDate) parts.push(`Due ${dueDate}`);
            cleanDescription = parts.join(' - ');
        } else if (modeData.mode === 'WALLET') {
            cleanDescription = `Paid via ${merchant || 'Wallet'}${ref ? ' - Ref: ' + ref : ''}`;
        } else if (modeData.mode === 'UPI') {
            cleanDescription = `UPI to ${merchant || 'Merchant'}${ref ? ' - Ref: ' + ref : ''}`;
        } else if (modeData.mode === 'BANK_TRANSFER') {
            cleanDescription = `Transfer to ${merchant || 'Beneficiary'}${ref ? ' - Ref: ' + ref : ''}`;
        } else if (modeData.isCreditCard) {
            cleanDescription = `${bank ? bank + ' Card' : 'Card'}${cardLast4 ? ' X' + cardLast4 : ''} @ ${merchant || 'Merchant'}`;
        } else if (modeData.mode === 'BNPL') {
            cleanDescription = `LazyPay @ ${merchant || 'Merchant'}${ref ? ' - Txn: ' + ref : ''}`;
        }

        const result = {
            id: Date.now() + Math.random(),
            original_sender: senderId || bank || 'Unknown',
            date: (isBill && dueDate) ? dueDate : dateTime.date,
            time: dateTime.time,
            merchant: merchant || bank || 'Unknown',
            description: cleanDescription,
            amount: effectiveAmount,
            currency: amountData.currency,
            transaction_type: transactionType,
            status: isScheduledMandate ? 'Scheduled' : 'Pending',
            category: category,
            source: 'SMS_WEBHOOK',
            mode: modeData.mode,
            paymentMethod: modeData.paymentMethod || modeData.mode,
            isCreditCard: modeData.isCreditCard,
            isCreditCardBill: isCreditCardBill,
            isBill: isBill,
            isBillPaymentReceipt: isBillPaymentReceipt,
            isScheduledMandate: isScheduledMandate,
            dueDate: dueDate,
            cardLast4: cardLast4,
            availableLimit: availableLimit,
            totalDue: totalDue || (isCreditCardBill ? effectiveAmount : null),
            minDue: minDue,
            accountMasked: accountMasked,
            bank: bank,
            reference: ref || cardLast4 || accountMasked || null,
            raw_message: fullText,
            received_at: new Date().toISOString()
        };

        result.confidence = calculateConfidence(result);
        results.push(result);
    }

    return results;
}

module.exports = { parseSMS, categorize };
