function stddev(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / (values.length - 1);
    return Math.sqrt(variance);
}

function normalizeKey(txn) {
    const desc = (txn.description || '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (desc) return desc.split(' ').slice(0, 3).join(' ');
    return (txn.category || 'unknown').toLowerCase();
}

function classify(meanDays, cv) {
    if (cv > 0.4) return null;
    if (meanDays >= 25 && meanDays <= 35) return 'monthly';
    if (meanDays >= 6 && meanDays <= 8) return 'weekly';
    if (meanDays >= 12 && meanDays <= 17) return 'biweekly';
    if (meanDays >= 85 && meanDays <= 100) return 'quarterly';
    if (meanDays >= 350 && meanDays <= 380) return 'yearly';
    return null;
}

const CHARGES_PER_YEAR = {
    weekly: 52,
    biweekly: 26,
    monthly: 12,
    quarterly: 4,
    yearly: 1
};

function detect(transactions) {
    const groups = new Map();
    for (const txn of transactions) {
        const key = normalizeKey(txn);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(txn);
    }

    const results = [];
    for (const [key, items] of groups.entries()) {
        if (items.length < 2) continue;

        const sorted = items.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        const intervals = [];
        for (let i = 1; i < sorted.length; i += 1) {
            const days = (new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000;
            if (days >= 5) intervals.push(days);
        }
        if (intervals.length < 1) continue;

        const meanDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const cv = meanDays > 0 ? stddev(intervals) / meanDays : 1;
        const frequency = classify(meanDays, cv);
        if (!frequency) continue;

        const amounts = sorted.map((t) => Number(t.amount)).filter((n) => Number.isFinite(n));
        if (amounts.length === 0) continue;
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

        const last = sorted[sorted.length - 1];
        const nextDue = new Date(new Date(last.date).getTime() + meanDays * 86400000);
        const perYear = CHARGES_PER_YEAR[frequency] || 1;

        results.push({
            key,
            merchant: last.description || last.category || key,
            category: last.category || 'Unknown',
            amount: Math.round(avgAmount * 100) / 100,
            frequency,
            intervalDays: Math.round(meanDays * 10) / 10,
            occurrences: sorted.length,
            lastChargedOn: last.date,
            nextDueOn: nextDue,
            annualCost: Math.round(avgAmount * perYear * 100) / 100
        });
    }

    results.sort((a, b) => new Date(a.nextDueOn) - new Date(b.nextDueOn));
    return results;
}

module.exports = { detect };
