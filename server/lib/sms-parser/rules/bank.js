/**
 * Step 11: Bank & Provider Identification
 */

const BANKS = [
    { name: 'YES BANK', match: ['YES BANK', 'YESBANK', 'YES BNK', 'BLKCC'] },
    { name: 'HSBC', match: ['HSBC', 'HSBCIM'] },
    { name: 'HDFC', match: ['HDFC', 'HDFCBANK'] },
    { name: 'SBI', match: ['SBI', 'SBICARD', 'STATE BANK'] },
    { name: 'ICICI', match: ['ICICI', 'ICICIBANK'] },
    { name: 'AXIS', match: ['AXIS', 'AXISBK', 'AXISBANK'] },
    { name: 'KOTAK', match: ['KOTAK', 'KOTAKBANK'] },
    { name: 'RBL', match: ['RBL', 'RBLBANK'] },
    { name: 'INDUSIND', match: ['INDUSIND'] },
    { name: 'IDFC', match: ['IDFC', 'IDFCFIRST'] },
    { name: 'CITI', match: ['CITI', 'CITIBANK'] },
    { name: 'AMEX', match: ['AMEX', 'AMERICAN EXPRESS'] },
    { name: 'BOB', match: ['BOB', 'BANK OF BARODA'] },
    { name: 'PNB', match: ['PNB', 'PUNJAB NATIONAL'] },
    { name: 'FEDERAL', match: ['FEDERAL BANK'] },
    { name: 'CANARA', match: ['CANARA'] },
    { name: 'UNION', match: ['UNION BANK'] },
    { name: 'AU BANK', match: ['AU BANK', 'AUBANK'] },
    { name: 'LAZYPAY', match: ['LAZYPAY'] },
    { name: 'CRED', match: ['CRED'] }
];

module.exports = function detectBank(text, senderId = '') {
    const combined = `${senderId || ''} ${text || ''}`.toUpperCase();

    for (const b of BANKS) {
        if (b.match.some(m => combined.includes(m))) {
            return b.name;
        }
    }
    return null;
};
