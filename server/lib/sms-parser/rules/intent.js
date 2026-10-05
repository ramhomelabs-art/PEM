/**
 * Step 1: Intent Filter (Ignore non-financial SMS)
 * Step 2: Transaction Direction (Debit vs Credit)
 */

// these are ALWAYS ignored, regardless of other text
const CRITICAL_IGNORE_KEYWORDS = [
    'otp', 'one time password', 'verification code',
    'statement generated', 'bill generated', 'bill reminder',
    'offer', 'reward points', 'promotion', 'loan offer', 'approved for',
    'fail', 'declined', 'requested', 'request received'
];

// these are ignored ONLY IF no debit/credit action is found
const WEAK_IGNORE_KEYWORDS = [
    'minimum due', 'outstanding due', 'credit limit', 'available balance', 'avl bal',
    'bill of', 'due date'
];

const DEBIT_KEYWORDS = [
    'debited', 'spent', 'paid', 'purchase', 'withdrawn', 'used', 'charged', 'sent',
    'dr', 'txn of', 'payment of', 'deducted', 'transferred to'
];

const CREDIT_KEYWORDS = [
    'credited', 'received', 'deposited', 'refund', 'reversal', 'salary',
    'interest', 'cash deposit', 'credit of', 'cr', 'added to'
];

module.exports = function analyzeIntent(text) {
    const lower = text.toLowerCase();

    // 1. Critical Ignore (Absolute Showstoppers)
    if (CRITICAL_IGNORE_KEYWORDS.some(k => lower.includes(k))) {
        return { type: 'IGNORE', nature: 'NONE' };
    }

    // 2. Check Direction (Debit vs Credit)
    const hasDebit = DEBIT_KEYWORDS.some(k => lower.includes(k));
    const hasCredit = CREDIT_KEYWORDS.some(k => lower.includes(k));

    // 3. Evalute Context
    if (hasDebit || hasCredit) {
        // It has transaction keywords, so we KEEP it even if it says "Avl Bal"
        if (hasDebit && hasCredit) {
            // Priority Rule: "Debited... for Credit Card Bill" -> Debit wins
            return { type: 'DEBIT', nature: 'EXPENSE' };
        }
        if (hasDebit) return { type: 'DEBIT', nature: 'EXPENSE' };
        if (hasCredit) return { type: 'CREDIT', nature: 'INCOME' };
    }

    // 4. Weak Ignore (If no transaction keywords found, and matches weak ignore, then drop)
    if (WEAK_IGNORE_KEYWORDS.some(k => lower.includes(k))) {
        return { type: 'IGNORE', nature: 'NONE' };
    }

    // Default Fallback
    return { type: 'UNKNOWN', nature: 'NONE' };
};
