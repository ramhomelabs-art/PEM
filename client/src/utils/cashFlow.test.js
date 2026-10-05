import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    buildCashFlowBuckets,
    countActiveBuckets,
    defaultGranularity,
    previousWindow,
    resolveRangeWindow,
    summarizeCashFlow,
    windowTotals,
} from './cashFlow.js';

// Fixed "now" so every assertion is deterministic (15 Oct 2026, local time).
const NOW = new Date(2026, 9, 15, 12, 0, 0);

test('resolveRangeWindow derives the preset window from now', () => {
    const { start, end } = resolveRangeWindow('3m', undefined, NOW);
    assert.equal(start.getFullYear(), 2026);
    assert.equal(start.getMonth(), 7); // August
    assert.equal(start.getDate(), 1);
    assert.equal(end, NOW);
});

test('defaultGranularity: daily for This month, monthly for quarter+', () => {
    assert.equal(defaultGranularity('1m', undefined, NOW), 'day');
    assert.equal(defaultGranularity('3m', undefined, NOW), 'month');
    assert.equal(defaultGranularity('6m', undefined, NOW), 'month');
    assert.equal(defaultGranularity('1y', undefined, NOW), 'month');
});

test('defaultGranularity: custom ranges adapt to their span', () => {
    assert.equal(
        defaultGranularity('custom', { from: '2026-09-20', to: '2026-10-15' }, NOW),
        'day'
    );
    assert.equal(
        defaultGranularity('custom', { from: '2026-08-01', to: '2026-10-15' }, NOW),
        'week'
    );
    assert.equal(
        defaultGranularity('custom', { from: '2026-01-01', to: '2026-12-31' }, NOW),
        'month'
    );
});

test('buildCashFlowBuckets: monthly buckets are zero-filled and aggregated', () => {
    const tx = [
        { date: new Date(2026, 7, 10), type: 'income', amount: 1000 },
        { date: new Date(2026, 7, 12), type: 'expense', amount: 400 },
        { date: new Date(2026, 9, 1), type: 'income', amount: 500 },
        { date: new Date(2025, 0, 1), type: 'income', amount: 9999 }, // out of range
    ];
    const { start, end } = resolveRangeWindow('3m', undefined, NOW);
    const buckets = buildCashFlowBuckets(tx, { granularity: 'month', start, end });

    assert.equal(buckets.length, 3);
    assert.deepEqual(
        buckets.map((b) => b.label),
        ['Aug', 'Sep', 'Oct']
    );
    assert.equal(buckets[0].income, 1000);
    assert.equal(buckets[0].expense, 400);
    assert.equal(buckets[0].net, 600);
    assert.equal(buckets[1].income, 0); // zero-filled September
    assert.equal(buckets[2].income, 500);
    assert.equal(buckets[2].balance, 1100); // 600 + 0 + 500
});

test('buildCashFlowBuckets: daily buckets cover every day in the window', () => {
    const { start, end } = resolveRangeWindow('1m', undefined, NOW); // 1–15 Oct
    const buckets = buildCashFlowBuckets(
        [{ date: new Date(2026, 9, 2), type: 'income', amount: 100 }],
        { granularity: 'day', start, end }
    );

    assert.equal(buckets.length, 15);
    assert.equal(buckets[0].income, 0);
    assert.equal(buckets[1].income, 100);
});

test('buildCashFlowBuckets: weekly buckets step seven days', () => {
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);
    const buckets = buildCashFlowBuckets([], { granularity: 'week', start, end });
    assert.equal(buckets.length, 5); // Aug 1, 8, 15, 22, 29
});

test('countActiveBuckets counts only periods with activity', () => {
    const { start, end } = resolveRangeWindow('3m', undefined, NOW);
    const buckets = buildCashFlowBuckets(
        [
            { date: new Date(2026, 7, 10), type: 'income', amount: 1000 },
            { date: new Date(2026, 9, 1), type: 'income', amount: 500 },
        ],
        { granularity: 'month', start, end }
    );
    assert.equal(countActiveBuckets(buckets), 2);
});

test('summarizeCashFlow computes totals, savings rate and extremes', () => {
    const { start, end } = resolveRangeWindow('3m', undefined, NOW);
    const buckets = buildCashFlowBuckets(
        [
            { date: new Date(2026, 7, 10), type: 'income', amount: 1000 },
            { date: new Date(2026, 7, 12), type: 'expense', amount: 400 },
            { date: new Date(2026, 9, 1), type: 'income', amount: 500 },
        ],
        { granularity: 'month', start, end }
    );
    const s = summarizeCashFlow(buckets);

    assert.equal(s.totalIn, 1500);
    assert.equal(s.totalOut, 400);
    assert.equal(s.net, 1100);
    assert.ok(Math.abs(s.savingsRate - 73.333) < 0.01);
    assert.equal(s.best.label, 'Aug'); // net 600
    assert.equal(s.lowest.label, 'Oct'); // net 500 (Sep is inactive)
    assert.equal(s.avg, 1100 / 3);
    assert.equal(s.activePeriods, 2);
    assert.equal(s.totalPeriods, 3);
});

test('windowTotals and previousWindow segment the timeline correctly', () => {
    const { start, end } = resolveRangeWindow('1m', undefined, NOW);
    const totals = windowTotals(
        [
            { date: new Date(2026, 9, 3), type: 'income', amount: 200 },
            { date: new Date(2026, 9, 4), type: 'expense', amount: 50 },
            { date: new Date(2026, 8, 20), type: 'income', amount: 999 }, // September
        ],
        start,
        end
    );
    assert.deepEqual(totals, { income: 200, expense: 50, net: 150 });

    const prev = previousWindow(start, end);
    assert.equal(prev.end.getTime(), start.getTime() - 1);
    assert.ok(prev.start.getTime() < prev.end.getTime());
});
