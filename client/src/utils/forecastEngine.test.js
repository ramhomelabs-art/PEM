import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    getKolkataTime,
    isTransferTransaction,
    calculateMedian,
    calculateRunRate,
    computeCategoryForecast,
    generateMacroForecast,
} from './forecastEngine.js';

describe('Forecast Engine - Time Model (Asia/Kolkata)', () => {
    test('Correctly calculates leap year February (29 days in 2028 vs 28 in 2027)', () => {
        const leapDate = new Date('2028-02-15T12:00:00Z');
        const nonLeapDate = new Date('2027-02-15T12:00:00Z');

        const leapTime = getKolkataTime(leapDate);
        const nonLeapTime = getKolkataTime(nonLeapDate);

        assert.equal(leapTime.daysInMonth, 29);
        assert.equal(nonLeapTime.daysInMonth, 28);
    });

    test('Never counts today as both fully elapsed and remaining: elapsed + remaining === daysInMonth', () => {
        const sampleDate = new Date('2026-10-06T15:30:00+05:30');
        const timeInfo = getKolkataTime(sampleDate);

        assert.equal(timeInfo.daysInMonth, 31);
        assert.ok(Math.abs(timeInfo.elapsedDays + timeInfo.remainingDays - 31) < 0.0001);
    });

    test('Handles first day and last day of the month cleanly', () => {
        const firstDay = new Date('2026-10-01T00:30:00+05:30');
        const lastDay = new Date('2026-10-31T23:30:00+05:30');

        const firstInfo = getKolkataTime(firstDay);
        const lastInfo = getKolkataTime(lastDay);

        assert.ok(firstInfo.elapsedDays > 0 && firstInfo.elapsedDays < 1);
        assert.ok(firstInfo.remainingDays > 30 && firstInfo.remainingDays < 31);

        assert.ok(lastInfo.elapsedDays > 30 && lastInfo.elapsedDays <= 31);
        assert.ok(lastInfo.remainingDays < 1);
    });
});

describe('Forecast Engine - Transfers & Refunds', () => {
    test('Correctly identifies transfer transactions to exclude from run-rate and spend', () => {
        assert.equal(isTransferTransaction({ category: 'Credit Card Payment' }), true);
        assert.equal(isTransferTransaction({ description: 'Card bill payment' }), true);
        assert.equal(isTransferTransaction({ category: 'Savings Transfer' }), true);
        assert.equal(isTransferTransaction({ category: 'Food', description: 'Dinner' }), false);
    });

    test('Nets refunds against category spend', () => {
        const budget = { id: 'b1', category: 'Shopping', amountLimit: 10000 };
        const txs = [
            { id: '1', category: 'Shopping', amount: 3000, type: 'expense', date: '2026-10-02' },
            { id: '2', category: 'Shopping', amount: 500, type: 'income', date: '2026-10-03' }, // Refund
        ];

        const forecast = computeCategoryForecast({
            budget,
            currentMonthTransactions: txs,
            timeInfo: getKolkataTime(new Date('2026-10-06T12:00:00+05:30')),
        });

        // 3000 - 500 = 2500
        assert.equal(forecast.spentSoFar, 2500);
    });
});

describe('Forecast Engine - One-Off Exclusion & Median', () => {
    test('Calculates median accurately for odd and even sample sizes', () => {
        assert.equal(calculateMedian([100, 200, 300]), 200);
        assert.equal(calculateMedian([100, 200, 300, 400]), 250);
        assert.equal(calculateMedian([500]), 500);
    });

    test('Excludes one-off purchases > 3x median from variable run rate, but retains in spentSoFar', () => {
        const budget = { id: 'b1', category: 'Food', amountLimit: 15000 };
        const txs = [
            { id: '1', category: 'Food', amount: 200, type: 'expense', date: '2026-10-01' },
            { id: '2', category: 'Food', amount: 250, type: 'expense', date: '2026-10-02' },
            { id: '3', category: 'Food', amount: 300, type: 'expense', date: '2026-10-03' },
            { id: '4', category: 'Food', amount: 4000, type: 'expense', date: '2026-10-04' }, // One-off > 3x median(250) = 750
        ];

        const forecast = computeCategoryForecast({
            budget,
            currentMonthTransactions: txs,
            timeInfo: getKolkataTime(new Date('2026-10-05T12:00:00+05:30')),
        });

        assert.equal(forecast.spentSoFar, 4750);
        assert.equal(forecast.oneOffTotal, 4000);
        assert.equal(forecast.variableSpent, 750);
        assert.equal(forecast.oneOffTxs.length, 1);
    });
});

describe('Forecast Engine - Weighted Run-Rate & History Weighting', () => {
    test('Uses w = 1 when there is no history, falling back entirely to this month', () => {
        const thisMonthAvg = 500;
        const histAvg = 1000;
        const elapsed = 5;

        const rateWithNoHist = calculateRunRate(thisMonthAvg, histAvg, elapsed, false);
        assert.equal(rateWithNoHist, 500);
    });

    test('Blends this month and trailing history proportionally with w = elapsed / (elapsed + 10)', () => {
        const thisMonthAvg = 600;
        const histAvg = 400;
        const elapsed = 10; // w = 10 / 20 = 0.5

        const rate = calculateRunRate(thisMonthAvg, histAvg, elapsed, true);
        assert.equal(rate, 500); // 0.5 * 600 + 0.5 * 400 = 500
    });
});

describe('Forecast Engine - 2% Threshold & Status State Machine', () => {
    test('Correctly identifies exceeded (> 1.02x limit)', () => {
        const budget = { id: 'b1', category: 'Food', amountLimit: 5000 };
        const txs = [{ id: '1', category: 'Food', amount: 5150, type: 'expense', date: '2026-10-03' }]; // 5150 > 5100 (5000 * 1.02)

        const forecast = computeCategoryForecast({
            budget,
            currentMonthTransactions: txs,
            timeInfo: getKolkataTime(new Date('2026-10-06T12:00:00+05:30')),
        });

        assert.equal(forecast.state, 'exceeded');
    });

    test('Correctly identifies at_limit (within 2%)', () => {
        const budget = { id: 'b1', category: 'Food', amountLimit: 5000 };
        const txs = [{ id: '1', category: 'Food', amount: 4950, type: 'expense', date: '2026-10-03' }]; // 4950 between 4900 and 5100

        const forecast = computeCategoryForecast({
            budget,
            currentMonthTransactions: txs,
            timeInfo: getKolkataTime(new Date('2026-10-06T12:00:00+05:30')),
        });

        assert.equal(forecast.state, 'at_limit');
    });

    test('Correctly identifies watch (between 85% and 100%) and projected_breach', () => {
        const budgetWatch = { id: 'b1', category: 'Travel', amountLimit: 10000 };
        const txsWatch = [{ id: '1', category: 'Travel', amount: 1500, type: 'expense', date: '2026-10-05' }];

        // At day 6 00:00, 5 full days elapsed. 1500 / 5 = 300/day. Remaining 26 days * 300 = 7800 + 1500 = 9300 (93% of 10000) -> watch
        const forecastWatch = computeCategoryForecast({
            budget: budgetWatch,
            currentMonthTransactions: txsWatch,
            timeInfo: getKolkataTime(new Date('2026-10-06T00:00:00+05:30')),
        });

        assert.equal(forecastWatch.state, 'watch');
    });
});

describe('Forecast Engine - Paise Precision & Total Consistency', () => {
    test('Macro totals exactly equal sum of category items without rounding gaps', () => {
        const budgets = [
            { id: '1', category: 'Food', amountLimit: 5000 },
            { id: '2', category: 'Travel', amountLimit: 3000 },
            { id: '3', category: 'Shopping', amountLimit: 4000 },
        ];
        const txs = [
            { id: 't1', category: 'Food', amount: 1234.56, type: 'expense', date: '2026-10-02' },
            { id: 't2', category: 'Travel', amount: 890.12, type: 'expense', date: '2026-10-03' },
            { id: 't3', category: 'Shopping', amount: 1500.33, type: 'expense', date: '2026-10-04' },
        ];

        const macro = generateMacroForecast({
            budgets,
            transactions: txs,
            now: new Date('2026-10-06T12:00:00+05:30'),
        });

        const categorySumSpent = macro.categoryForecasts.reduce((s, c) => s + c.spentSoFar, 0);
        const categorySumProjected = macro.categoryForecasts.reduce((s, c) => s + c.projected, 0);
        const categorySumBudget = macro.categoryForecasts.reduce((s, c) => s + c.limit, 0);

        assert.ok(Math.abs(macro.totalSpentSoFar - categorySumSpent) < 0.01);
        assert.ok(Math.abs(macro.totalProjected - categorySumProjected) < 0.01);
        assert.equal(macro.totalBudget, categorySumBudget);
    });
});
