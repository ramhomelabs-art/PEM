import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSavingsRate, generateInsights } from './insightsEngine.js';

const NOW = new Date(2026, 9, 15, 12, 0, 0); // 15 Oct 2026

test('calculateSavingsRate: computes correct percentage matching KPI cards', () => {
    assert.equal(calculateSavingsRate(100000, 60000), 40);
    assert.equal(calculateSavingsRate(50000, 50000), 0);
    assert.equal(calculateSavingsRate(0, 1000), 0);
});

test('generateInsights: flags budget near limit and over limit with trivial overage rule', () => {
    // Case 1: Trivial overage (< 2%) -> "at limit"
    const txsTrivial = [
        { date: '2026-10-05', amount: 10150, category: 'Groceries', type: 'expense' },
    ];
    const budgetsTrivial = [{ category: 'Groceries', amountLimit: 10000 }];
    const insightsTrivial = generateInsights({
        transactions: txsTrivial,
        budgets: budgetsTrivial,
        now: NOW,
    });
    assert.ok(insightsTrivial.some((i) => i.title.includes('at budget limit')));

    // Case 2: Substantial over budget (> 2%)
    const txsOver = [
        { date: '2026-10-05', amount: 12000, category: 'Dining', type: 'expense' },
    ];
    const budgetsOver = [{ category: 'Dining', amountLimit: 10000 }];
    const insightsOver = generateInsights({
        transactions: txsOver,
        budgets: budgetsOver,
        now: NOW,
    });
    assert.ok(insightsOver.some((i) => i.title.includes('Over budget on Dining')));
});

test('generateInsights: detects budget pace warning before month end', () => {
    // 15 days in, spent 8,000 on a 10,000 limit -> daily pace ~533/day -> projected ~16,500 by Oct 31
    const txs = [
        { date: '2026-10-05', amount: 4000, category: 'Shopping', type: 'expense' },
        { date: '2026-10-12', amount: 4000, category: 'Shopping', type: 'expense' },
    ];
    const budgets = [{ category: 'Shopping', amountLimit: 10000 }];
    const insights = generateInsights({
        transactions: txs,
        budgets,
        now: NOW,
    });
    assert.ok(insights.some((i) => i.title.includes('pace warning')));
});

test('generateInsights: flags category month-over-month increase >= 20%', () => {
    const txs = [
        { date: '2026-09-10', amount: 2000, category: 'Entertainment', type: 'expense' },
        { date: '2026-10-04', amount: 3500, category: 'Entertainment', type: 'expense' }, // +75%
    ];
    const insights = generateInsights({
        transactions: txs,
        budgets: [],
        now: NOW,
    });
    assert.ok(insights.some((i) => i.title.includes('Entertainment spend up 75%')));
});

test('generateInsights: identifies unusually large transaction (> 2x category avg)', () => {
    const txs = [
        { date: '2026-10-01', amount: 400, category: 'Fuel', merchant: 'Shell', type: 'expense' },
        { date: '2026-10-04', amount: 500, category: 'Fuel', merchant: 'HP', type: 'expense' },
        { date: '2026-10-10', amount: 2500, category: 'Fuel', merchant: 'Indian Oil Highway', type: 'expense' }, // >2x avg
    ];
    const insights = generateInsights({
        transactions: txs,
        budgets: [],
        now: NOW,
    });
    assert.ok(insights.some((i) => i.title.includes('Unusual spend in Fuel')));
});

test('generateInsights: detects possible new recurring charge across consecutive months', () => {
    const txs = [
        { date: '2026-09-02', amount: 799, merchant: 'Netflix', category: 'Subscriptions', type: 'expense' },
        { date: '2026-10-02', amount: 799, merchant: 'Netflix', category: 'Subscriptions', type: 'expense' },
    ];
    const insights = generateInsights({
        transactions: txs,
        budgets: [],
        now: NOW,
    });
    assert.ok(insights.some((i) => i.id.includes('recurring-Netflix')));
});

test('generateInsights: detects no-spend day streak and caps at 4 ranked insights', () => {
    // Last transaction was on Oct 11 -> Oct 12, 13, 14, 15 are zero-spend (4 days streak)
    const txs = [
        { date: '2026-10-10', amount: 300, category: 'Snacks', type: 'expense' },
    ];
    const insights = generateInsights({
        transactions: txs,
        budgets: [],
        now: NOW,
    });
    assert.ok(insights.some((i) => i.title.includes('no-spend streak')));
    assert.ok(insights.length <= 4);
});
