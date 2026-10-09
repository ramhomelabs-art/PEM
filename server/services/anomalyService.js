const { Op } = require('sequelize');
const { Transaction } = require('../models');
const alertService = require('./alertService');

const DEFAULT_WINDOW_DAYS = 120;

function mean(values) {
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values) {
    if (values.length < 2) return 0;
    const m = mean(values);
    const variance = values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (values.length - 1);
    return Math.sqrt(variance);
}

/**
 * Detect spend anomalies for a user from their recent expense transactions.
 * Returns objects with `referenceId`, title, body, severity, amount, category.
 */
async function detect(userId, windowDays = 120) {
    const days = Math.max(7, Math.min(Number(windowDays) || 120, 365));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await Transaction.findAll({
        where: { userId, type: 'expense', date: { [Op.gte]: since } },
        order: [['date', 'DESC']],
        limit: 1000
    });
    const txns = rows.map((r) => r.toJSON());

    const byCategory = new Map();
    txns.forEach((t) => {
        const key = (t.category || 'General').toLowerCase();
        if (!byCategory.has(key)) byCategory.set(key, []);
        byCategory.get(key).push(Number(t.amount) || 0);
    });

    const anomalies = [];

    // 1. Amount spikes relative to the user's own history for that category.
    txns.forEach((t) => {
        const key = (t.category || 'General').toLowerCase();
        const series = byCategory.get(key) || [];
        if (series.length < 5) return;
        const mean = series.reduce((a, b) => a + b, 0) / series.length;
        const variance = series.reduce((a, b) => a + (b - mean) * (b - mean), 0) / series.length;
        const sd = Math.sqrt(variance);
        const amount = Number(t.amount) || 0;
        if (sd > 0 && amount > mean + 3 * sd && amount > mean * 1.5) {
            anomalies.push({
                type: 'AMOUNT_SPIKE',
                severity: amount > mean + 5 * sd ? 'critical' : 'warning',
                title: `Unusual ${t.category} spend`,
                body: `Rs ${amount.toFixed(2)} is well above your typical ${t.category} of ~Rs ${mean.toFixed(0)}`,
                transactionId: t.id,
                referenceId: `spike:${t.id}`,
                amount,
                category: t.category,
                date: t.date
            });
        }
    });

    // 2. Duplicate charges: same amount + category within a short window.
    const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));
    for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            const a = sorted[i];
            const b = sorted[j];
            const diffDays = Math.abs(new Date(b.date) - new Date(a.date)) / 86400000;
            if (diffDays > 3) break;
            if (
                Math.abs((Number(a.amount) || 0) - (Number(b.amount) || 0)) < 0.01 &&
                (a.category || '') === (b.category || '')
            ) {
                anomalies.push({
                    type: 'DUPLICATE',
                    severity: 'warning',
                    title: `Possible duplicate ${b.category || 'charge'}`,
                    body: `Rs ${(Number(b.amount) || 0).toFixed(2)} charged twice within ${Math.round(diffDays * 24)}h`,
                    transactionId: b.id,
                    referenceId: `duplicate:${a.id}:${b.id}`,
                    amount: Number(b.amount) || 0,
                    category: b.category,
                    date: b.date
                });
            }
        }
    }

    return anomalies;
}

module.exports = { detect };
