/**
 * Bill Provider & Type Identification
 */

const PROVIDERS = [
    // Utility
    { name: 'BESCOM', category: 'Electricity', keywords: ['bescom', 'electricity', 'power bill'] },
    { name: 'TATA POWER', category: 'Electricity', keywords: ['tata power', 'tatapower'] },
    { name: 'BWSSB', category: 'Water', keywords: ['bwssb', 'water bill', 'jal board'] },
    { name: 'IGL', category: 'Gas', keywords: ['igl', 'indraprastha gas', 'gas bill', 'mahanagar gas'] },

    // Mobile / Internet / Telecom
    { name: 'BSNL', category: 'Utility', keywords: ['bsnl', 'bharat sanchar'] },
    { name: 'MTNL', category: 'Utility', keywords: ['mtnl'] },
    { name: 'Jio', category: 'Mobile', keywords: ['jio', 'reliance jio'] },
    { name: 'Airtel', category: 'Mobile', keywords: ['airtel'] },
    { name: 'Vi', category: 'Mobile', keywords: ['vodafone', 'idea', 'vi '], exclude: ['via'] },
    { name: 'ACT Fibernet', category: 'Broadband', keywords: ['act fibernet', 'broadband', 'internet bill'] },
    { name: 'Tata Play', category: 'DTH', keywords: ['tata play', 'tata sky'] },

    // Subscriptions
    { name: 'Netflix', category: 'Subscription', keywords: ['netflix'] },
    { name: 'Spotify', category: 'Subscription', keywords: ['spotify'] },

    // Financial & Credit Cards
    { name: 'YES BANK Credit Card', category: 'Credit Card', keywords: ['yes bank', 'yesbank', 'yesbnk'] },
    { name: 'HSBC Credit Card', category: 'Credit Card', keywords: ['hsbc'] },
    { name: 'Axis Bank Credit Card', category: 'Credit Card', keywords: ['axis bank', 'axisbk', 'axisbank'] },
    { name: 'SBI Card', category: 'Credit Card', keywords: ['sbi card', 'sbicard', 'credit card due'] },
    { name: 'ICICI Bank Credit Card', category: 'Credit Card', keywords: ['icici bank credit', 'icicibank credit'] },
    { name: 'HDFC Bank Credit Card', category: 'Credit Card', keywords: ['hdfc bank credit', 'hdfcbank credit'] },
    { name: 'HDFC Life', category: 'Insurance', keywords: ['hdfc life', 'insurance premium'] },
    { name: 'LIC', category: 'Insurance', keywords: ['lic ', 'lic of india'] },
    { name: 'LazyPay', category: 'Utility', keywords: ['lazypay'] }
];

module.exports = function extractProvider(text) {
    if (!text) return null;
    const lower = text.toLowerCase();

    for (const p of PROVIDERS) {
        if (p.exclude && p.exclude.some(ex => lower.includes(ex))) continue;

        if (p.keywords.some(k => lower.includes(k))) {
            return { name: p.name, category: p.category };
        }
    }

    // Provider greeting detection: "Dear BSNL Customer", "Dear BESCOM Consumer"
    const greetingMatch = text.match(/(?:dear|your|from)\s+([A-Za-z0-9\s&-]+?)\s+(?:customer|consumer|subscriber|user|bill)\b/i);
    if (greetingMatch) {
        const candidate = greetingMatch[1].trim();
        if (!/^(our|valued|prestige|prime|all|the)\b/i.test(candidate) && candidate.length >= 2 && candidate.length <= 25) {
            return { name: candidate.toUpperCase(), category: 'Utility' };
        }
    }

    // Keyword fallback
    if (lower.includes('electricity')) return { name: null, category: 'Electricity' };
    if (lower.includes('water')) return { name: null, category: 'Water' };
    if (lower.includes('gas')) return { name: null, category: 'Gas' };
    if (lower.includes('broadband') || lower.includes('fiber')) return { name: null, category: 'Broadband' };
    if (lower.includes('mobile') || lower.includes('postpaid') || lower.includes('telecom')) return { name: null, category: 'Mobile' };

    return null;
};
