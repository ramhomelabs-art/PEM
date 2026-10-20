/**
 * Step 1: Intent Filter (Ignore non-financial SMS)
 * Step 2: Transaction Direction (Debit vs Credit)
 */

// these are ALWAYS ignored, regardless of other text
const CRITICAL_IGNORE_KEYWORDS = [
    'otp', 'one time password', 'verification code',
    'offer', 'reward points', 'promotion', 'loan offer', 'approved for',
    'fail', 'declined', 'requested', 'request received'
];

// these are ignored ONLY IF no debit/credit/bill action is found
const WEAK_IGNORE_KEYWORDS = [
    'credit limit', 'available balance', 'avl bal'
];

const DEBIT_REGEXES = [
    /\b(debited|spent|purchase|withdrawn|used\s+at|charged|sent|deducted|transferred\s+to|transferred\s+from|paid\s+from|paid\s+to|paid|successfully\s+paid)\b/i,
    /\btxn\s+of\b/i,
    /\bpayment\s+of\b/i,
    /\bautopay\s+for\b/i,
    /\bdr\b/i
];

const CREDIT_REGEXES = [
    /\b(credited|received\s*(?:a\s*)?payment|received\s+payment|payment\s*received|deposited|refund|reversal|salary|interest|cash\s*deposit)\b/i,
    /\bcredit\s+of\b/i,
    /\badded\s+to\b/i,
    /\bcr\b/i
];

module.exports = function analyzeIntent(text) {
    if (!text) return { type: 'IGNORE', nature: 'NONE' };
    const lower = text.toLowerCase();

    // 1. Critical Ignore (Absolute Showstoppers)
    if (CRITICAL_IGNORE_KEYWORDS.some(k => lower.includes(k))) {
        return { type: 'IGNORE', nature: 'NONE' };
    }

    // Clean conditional phrases like "Please ignore if paid" so "paid" does not falsely trigger debit
    const cleaned = lower.replace(/ignore\s*if\s*(?:already\s*)?paid/gi, '');

    // 2. Specific Credit Card Payment Received Check
    // E.g.: "we have received a payment of INR 3551.64 for credit card ending 7241"
    if (/\b(?:received\s*(?:a\s*)?payment|payment\s*received|payment\s*of\s*.*?for\s*credit\s*card\s*.*received)\b/i.test(cleaned)) {
        return { type: 'CREDIT', nature: 'INCOME', isCardPayment: true };
    }

    // 2b. Scheduled Mandate / AutoPay Reminder
    // E.g. "Your HSBC UPI AutoPay for 195.00 towards APPLE MEDIA SERVICES is scheduled on 21/10/2026. Please ensure sufficient balance in your account."
    if (/\b(?:is\s*scheduled\s*(?:on|for)|scheduled\s*(?:on|for)|ensure\s*sufficient\s*balance|mandate\s*scheduled)\b/i.test(cleaned)) {
        return { type: 'DEBIT', nature: 'EXPENSE', isScheduledMandate: true, isBill: true };
    }

    // 2c. Bill Payment Receipt / Confirmation (Completed Payment, NOT an unpaid bill!)
    // E.g. "Thank You for making payment of Rs 707.00/- on 20-OCT-26 for your BSNL Landline bill... from BILLDESK(BDD)"
    if (/\b(?:thank\s*you\s*for\s*making\s*payment|payment\s*of\s*.*?for\s*(?:your\s*)?(?:.*?\s*)?bill|download\s*receipt|receipt\s*on\s*your\s*whatsapp)\b/i.test(cleaned)) {
        return { type: 'DEBIT', nature: 'EXPENSE', isBillPaymentReceipt: true, isBill: false };
    }

    // 3. Statement / Due Bill Check (Bills are expenses / debits)
    // E.g. "YES BANK Credit Card XX3588 OCT-26 statement: Total due INR 15501.92"
    // E.g. "Your statement for Axis Bank Credit Card no. XX3318 is generated."
    // E.g. "HSBC Credit Card ending 7241 : Total due: 111443.32"
    // E.g. "Your LazyPay outstanding of Rs. 3177.00 is due for payment today."
    const isStatement = /\b(?:statement(?:\s*(?:is\s*)?generated|:|\s*for)|total\s*due|due\s*(?:by|on)|min(?:imum)?\s*due|outstanding\s*of)\b/i.test(cleaned);

    // 4. Direction (Debit vs Credit)
    const hasDebit = DEBIT_REGEXES.some(r => r.test(cleaned));
    const hasCredit = CREDIT_REGEXES.some(r => r.test(cleaned));

    if (hasDebit || hasCredit) {
        if (hasDebit && hasCredit) {
            if (/\b(?:received|refund|credited|deposited)\b/i.test(cleaned) && !/\b(?:spent|debited|sent)\b/i.test(cleaned)) {
                return { type: 'CREDIT', nature: 'INCOME' };
            }
            return { type: 'DEBIT', nature: 'EXPENSE' };
        }
        if (hasDebit) return { type: 'DEBIT', nature: 'EXPENSE' };
        if (hasCredit) return { type: 'CREDIT', nature: 'INCOME' };
    }

    if (isStatement) {
        return { type: 'DEBIT', nature: 'EXPENSE', isBill: true, isStatement: true };
    }

    // 5. Weak Ignore
    if (WEAK_IGNORE_KEYWORDS.some(k => cleaned.includes(k))) {
        return { type: 'IGNORE', nature: 'NONE' };
    }

    return { type: 'UNKNOWN', nature: 'NONE' };
};
