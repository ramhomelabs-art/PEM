/**
 * Bill Intent Detection
 * Distinguishes BILL (Future) from TRANSACTION (Past)
 */

const BILL_KEYWORDS = [
    'bill', 'due', 'payable', 'last date', 'outstanding', 'payment due', 'reminder', 'pay before'
];

const TRANSACTION_KEYWORDS = [
    'debited', 'credited', 'paid', 'spent', 'withdrawn', 'sent', 'received', 'refund'
];

module.exports = function analyzeBillIntent(text) {
    const lower = text.toLowerCase();

    // 1. Must contain Bill Keywords
    const hasBill = BILL_KEYWORDS.some(k => lower.includes(k));
    if (!hasBill) return { isBill: false };

    // 2. Must NOT contain Transaction Keywords that imply completion
    // Exception: "Bill Paid" message? 
    // Spec says: "Does NOT confirm money was debited or credited".
    // If "Bill Paid successfully", it's a notification of payment, not a bill due.
    // So we reject "paid".
    // BUT "To be paid" or "Amount to be paid" contains "paid".
    // Check context?
    // "paid to" -> Transaction.
    // "to be paid" -> Bill.

    // Simplification: If "successfully" or "debited" or "credited" -> Reject.
    // "paid" is tricky. "Amount paid: 0. Amount due: 500". This is a bill.
    // "Bill of Rs 500 is paid". This is a receipt.

    // Strict Reject List:
    const STRICT_REJECT = ['debited', 'credited', 'successful', 'received', 'sent to', 'refund'];
    if (STRICT_REJECT.some(k => lower.includes(k))) return { isBill: false };

    // Soft Reject "paid" if not "payable"
    if (lower.includes(' paid ') && !lower.includes('payable') && !lower.includes('to be paid')) {
        // "Bill paid". "Paid bill".
        return { isBill: false };
    }

    return { isBill: true };
};
