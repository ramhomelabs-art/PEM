/**
 * creditDebit.js
 * Identifies if the transaction is an Income (CREDIT) or Expense (DEBIT).
 */

module.exports = function detectType(text) {
    const t = text.toLowerCase();

    // Explicit CREDIT qualifiers
    if (t.includes('credited') ||
        t.includes('received') ||
        t.includes('deposited') ||
        t.includes('added to') ||
        t.includes('refund')) {
        return 'CREDIT';
    }

    // Explicit DEBIT qualifiers
    if (t.includes('debited') ||
        t.includes('spent') ||
        t.includes('deducted') ||
        t.includes('paid') ||
        t.includes('sent') ||
        t.includes('withdrawal') ||
        t.includes('used at')) {
        return 'DEBIT';
    }

    return 'DEBIT'; // Default safe assumption for finance tracking
};
