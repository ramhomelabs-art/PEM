/**
 * Bill Provider & Type Identification
 */

const PROVIDERS = [
    // Utility
    { name: 'BESCOM', category: 'Electricity', keywords: ['bescom', 'electricity', 'power bill'] },
    { name: 'TATA POWER', category: 'Electricity', keywords: ['tata power', 'tatapower'] },
    { name: 'BWSSB', category: 'Water', keywords: ['bwssb', 'water bill', 'jal board'] },
    { name: 'IGL', category: 'Gas', keywords: ['igl', 'indraprastha gas', 'gas bill', 'mahanagar gas'] },

    // Mobile / Internet
    { name: 'Jio', category: 'Mobile', keywords: ['jio', 'reliance jio'] },
    { name: 'Airtel', category: 'Mobile', keywords: ['airtel'] },
    { name: 'Vi', category: 'Mobile', keywords: ['vodafone', 'idea', 'vi '], exclude: ['via'] }, // 'vi' vs 'via'
    { name: 'ACT Fibernet', category: 'Broadband', keywords: ['act fibernet', 'broadband', 'internet bill'] },

    // Subscriptions
    { name: 'Netflix', category: 'Subscription', keywords: ['netflix'] },
    { name: 'Spotify', category: 'Subscription', keywords: ['spotify'] },

    // Financial
    { name: 'HDFC Life', category: 'Insurance', keywords: ['hdfc life', 'insurance premium'] },
    { name: 'LIC', category: 'Insurance', keywords: ['lic ', 'lic of india'] },
    { name: 'SBI Card', category: 'Credit Card', keywords: ['sbi card', 'credit card due'] },
];

module.exports = function extractProvider(text) {
    const lower = text.toLowerCase();

    for (const p of PROVIDERS) {
        // Check exclusion first
        if (p.exclude && p.exclude.some(ex => lower.includes(ex))) continue;

        if (p.keywords.some(k => lower.includes(k))) {
            return { name: p.name, category: p.category };
        }
    }

    // Keyword fallback
    if (lower.includes('electricity')) return { name: null, category: 'Electricity' };
    if (lower.includes('water')) return { name: null, category: 'Water' };
    if (lower.includes('gas')) return { name: null, category: 'Gas' };
    if (lower.includes('broadband') || lower.includes('fiber')) return { name: null, category: 'Broadband' };
    if (lower.includes('mobile') || lower.includes('postpaid')) return { name: null, category: 'Mobile' };

    return null;
};
