/**
 * Step 11: Bank Identification
 */

const BANKS = ['HDFC', 'SBI', 'ICICI', 'AXIS', 'KOTAK', 'RBL', 'HSBC', 'CITI', 'AMEX', 'BOB', 'PNB', 'IDFC'];

module.exports = function detectBank(text, senderId) {
    const combined = (senderId + " " + text).toUpperCase();

    for (const bank of BANKS) {
        if (combined.includes(bank)) return bank;
    }
    return null;
};
