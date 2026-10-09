import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isEssentialCategory,
    calculateMedian,
    filterOneOffExpenses,
    classifyLiquidity,
    getRunwayTier,
    calculateEmergencyFundRunway,
    simulateStressTest
} from './emergencyFundCalculator.js';

test('isEssentialCategory: identifies standard and custom essential categories', () => {
    assert.equal(isEssentialCategory('Rent'), true);
    assert.equal(isEssentialCategory('Groceries'), true);
    assert.equal(isEssentialCategory('Loan EMI'), true);
    assert.equal(isEssentialCategory('Utility'), true);
    assert.equal(isEssentialCategory('Shopping'), false);
    assert.equal(isEssentialCategory('Dining'), false);
    assert.equal(isEssentialCategory('Investment'), false);
    assert.equal(isEssentialCategory('Custom Fee', ['custom fee']), true);
});

test('calculateMedian: accurately finds median for odd, even, and empty arrays', () => {
    assert.equal(calculateMedian([]), 0);
    assert.equal(calculateMedian([100]), 100);
    assert.equal(calculateMedian([10, 20, 30]), 20);
    assert.equal(calculateMedian([10, 20, 30, 40]), 25);
    assert.equal(calculateMedian([50, 10, 100]), 50);
});

test('filterOneOffExpenses: excludes anomalous purchases > 3x category median', () => {
    const txs = [
        { id: 1, type: 'expense', category: 'Dining', amount: 500 },
        { id: 2, type: 'expense', category: 'Dining', amount: 600 },
        { id: 3, type: 'expense', category: 'Dining', amount: 550 },
        { id: 4, type: 'expense', category: 'Dining', amount: 7000 }, // Outlier!
    ];
    const filtered = filterOneOffExpenses(txs);
    assert.equal(filtered[0].isOneOff, false);
    assert.equal(filtered[1].isOneOff, false);
    assert.equal(filtered[2].isOneOff, false);
    assert.equal(filtered[3].isOneOff, true);
});

test('classifyLiquidity: categorizes accounts into Instant, Near-Liquid, and Locked', () => {
    const banks = [
        { name: 'HDFC Savings', type: 'Savings', balance: 50000 },
        { name: 'ICICI Current', type: 'Checking', balance: 25000 },
        { name: 'Liquid MF', type: 'Investment', balance: 75000 },
        { name: 'SBI Fixed Deposit', type: 'FD', balance: 200000 }
    ];
    const res = classifyLiquidity(banks);
    assert.equal(res.instant, 75000);
    assert.equal(res.nearLiquid, 75000);
    assert.equal(res.locked, 200000);
    assert.equal(res.totalRunwayLiquid, 150000);
    assert.equal(res.totalAllAccounts, 350000);

    // Fallback when banks have 0 balance
    const zeroBanks = [{ name: 'HDFC', balance: 0 }];
    const resFallback = classifyLiquidity(zeroBanks, 45000);
    assert.equal(resFallback.instant, 45000);
    assert.equal(resFallback.totalRunwayLiquid, 45000);
});

test('getRunwayTier: returns accurate tier boundaries for Critical, Building, Secure, and Surplus', () => {
    // Critical: < 3 months
    const tCritical = getRunwayTier(2.1, 40000, 120000);
    assert.equal(tCritical.key, 'critical');

    // Building: 3 to 6 months
    const tBuilding = getRunwayTier(4.5, 90000, 120000);
    assert.equal(tBuilding.key, 'building');

    // Secure: 6 to 12 months
    const tSecure = getRunwayTier(8.0, 160000, 120000);
    assert.equal(tSecure.key, 'secure');

    // Surplus: > 12 months or > 1.5x target
    const tSurplus = getRunwayTier(14.0, 280000, 120000);
    assert.equal(tSurplus.key, 'surplus');
});

test('calculateEmergencyFundRunway: handles normal case with dual runways and surplus', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const transactions = [
        // Essentials: Rent 20000/mo, Groceries 10000/mo -> 30000/mo essential burn
        { date: '2026-09-15', type: 'expense', category: 'Rent', amount: 20000 },
        { date: '2026-09-10', type: 'expense', category: 'Groceries', amount: 10000 },
        { date: '2026-08-15', type: 'expense', category: 'Rent', amount: 20000 },
        { date: '2026-08-10', type: 'expense', category: 'Groceries', amount: 10000 },
        { date: '2026-07-15', type: 'expense', category: 'Rent', amount: 20000 },
        { date: '2026-07-10', type: 'expense', category: 'Groceries', amount: 10000 },
        // Discretionary: Dining 10000/mo -> Lifestyle total = 40000/mo
        { date: '2026-09-05', type: 'expense', category: 'Dining', amount: 10000 },
        { date: '2026-08-05', type: 'expense', category: 'Dining', amount: 10000 },
        { date: '2026-07-05', type: 'expense', category: 'Dining', amount: 10000 },
    ];
    // Liquid = 2,40,000 (8 months of essentials, 6 months of lifestyle)
    const result = calculateEmergencyFundRunway({
        transactions,
        liquidBalance: 240000,
        targetMonths: 6,
        referenceDate: now
    });

    assert.equal(result.essentialMonthlyBurn, 30000);
    assert.equal(result.lifestyleMonthlyBurn, 40000);
    assert.equal(result.survivalMonths, 8);
    assert.equal(result.lifestyleMonths, 6);
    assert.equal(result.runwayGapMonths, 2);
    assert.equal(result.targetAmount, 180000); // 6 * 30000
    assert.equal(result.surplusAmount, 60000); // 240000 - 180000
    assert.equal(result.tier.key, 'secure');
    assert.equal(result.insights.length >= 1, true);
});

test('calculateEmergencyFundRunway: handles zero/no data gracefully without crashing or NaN', () => {
    const result = calculateEmergencyFundRunway({
        transactions: [],
        banks: [],
        liquidBalance: 0,
        targetMonths: 6
    });

    assert.equal(result.totalLiquid, 0);
    assert.equal(result.essentialMonthlyBurn, 0);
    assert.equal(result.survivalMonths, 0);
    assert.equal(result.lifestyleMonths, 0);
    assert.equal(result.tier.key, 'critical');
    assert.equal(isNaN(result.survivalDays), false);
});

test('calculateEmergencyFundRunway: calculates real-time liquidity from transaction net balance when bank balance is 0', () => {
    const transactions = [
        { date: '2026-09-01', type: 'income', amount: 100000 },
        { date: '2026-09-10', type: 'expense', category: 'Rent', amount: 20000 }
    ];
    // Bank exists with balance 0
    const banks = [{ name: 'HDFC', balance: 0 }];
    const result = calculateEmergencyFundRunway({
        transactions,
        banks,
        liquidBalance: null,
        kpiBalance: 0,
        targetMonths: 6
    });

    // Net balance is 100000 - 20000 = 80000
    assert.equal(result.totalLiquid, 80000);
    assert.equal(result.survivalMonths > 0, true);
});

test('calculateEmergencyFundRunway: adapts with limited data flag when < 3 months data', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const transactions = [
        { date: '2026-09-20', type: 'expense', category: 'Groceries', amount: 5000 },
        { date: '2026-09-25', type: 'expense', category: 'Rent', amount: 15000 }
    ];
    const result = calculateEmergencyFundRunway({
        transactions,
        liquidBalance: 60000,
        targetMonths: 6,
        referenceDate: now
    });

    assert.equal(result.isLimitedData, true);
    assert.equal(result.essentialMonthlyBurn > 0, true);
    assert.equal(result.survivalMonths > 0, true);
});

test('simulateStressTest: accurately simulates financial shock and expense freeze', () => {
    const stress = simulateStressTest({
        totalLiquid: 300000,
        essentialMonthlyBurn: 30000,
        lifestyleMonthlyBurn: 50000,
        incomeLoss: true,
        essentialsOnly: true,
        shockAmount: 60000
    });

    assert.equal(stress.postShockLiquid, 240000);
    assert.equal(stress.effectiveMonthlyBurn, 30000);
    assert.equal(stress.simulatedMonths, 8); // 240000 / 30000
    assert.equal(stress.deltaMonths, -2);    // 8 - 10
});
