const test = require('node:test');
const assert = require('node:assert');
const { fifoLots, holdingPeriod, monthsBetween } = require('./fifo');

const lots = [
    { id: 1, openDate: '2023-01-01', quantity: 10, costPerUnit: 100 },
    { id: 2, openDate: '2023-02-01', quantity: 5, costPerUnit: 120 }
];

test('fifoLots consumes oldest lots first, exact money', () => {
    const res = fifoLots({ date: '2024-01-01', quantity: 12, proceedsPaise: 180000 }, lots, { longTermMonths: 12 });
    assert.strictEqual(res.soldQuantity, 12);
    assert.strictEqual(res.remainingQuantity, 0);
    assert.strictEqual(res.allocations.length, 2);

    const [a0, a1] = res.allocations;
    assert.deepStrictEqual(
        { lotId: a0.lotId, quantity: a0.quantity, costPaise: a0.costPaise, proceedsPaise: a0.proceedsPaise, gainPaise: a0.gainPaise, holdingDays: a0.holdingDays, isLongTerm: a0.isLongTerm },
        { lotId: 1, quantity: 10, costPaise: 100000, proceedsPaise: 150000, gainPaise: 50000, holdingDays: 365, isLongTerm: true }
    );
    assert.deepStrictEqual(
        { lotId: a1.lotId, quantity: a1.quantity, costPaise: a1.costPaise, proceedsPaise: a1.proceedsPaise, gainPaise: a1.gainPaise, holdingDays: a1.holdingDays, isLongTerm: a1.isLongTerm },
        { lotId: 2, quantity: 2, costPaise: 24000, proceedsPaise: 30000, gainPaise: 6000, holdingDays: 334, isLongTerm: false }
    );
});

test('fifoLots partial sell stays within the oldest lot', () => {
    const res = fifoLots({ date: '2023-06-01', quantity: 8, proceedsPaise: 120000 }, lots);
    assert.strictEqual(res.soldQuantity, 8);
    assert.strictEqual(res.remainingQuantity, 0);
    assert.strictEqual(res.allocations.length, 1);
    assert.strictEqual(res.allocations[0].lotId, 1);
    assert.strictEqual(res.allocations[0].quantity, 8);
    assert.strictEqual(res.allocations[0].costPaise, 80000);
    assert.strictEqual(res.allocations[0].proceedsPaise, 120000);
    assert.strictEqual(res.allocations[0].gainPaise, 40000);
});

test('fifoLots reports unmatched quantity on oversell', () => {
    const res = fifoLots({ date: '2024-01-01', quantity: 16, proceedsPaise: 240000 }, lots);
    assert.strictEqual(res.soldQuantity, 15);
    assert.strictEqual(res.remainingQuantity, 1);
    assert.strictEqual(res.allocations.length, 2);
});

test('fifoLots ignores closed/zero lots and orders by openDate', () => {
    const shuffled = [
        { id: 9, openDate: '2023-03-01', quantity: 0, costPerUnit: 10 },
        { id: 2, openDate: '2023-02-01', quantity: 5, costPerUnit: 120 },
        { id: 1, openDate: '2023-01-01', quantity: 10, costPerUnit: 100 }
    ];
    const res = fifoLots({ date: '2024-01-01', quantity: 12, proceedsPaise: 180000 }, shuffled);
    assert.strictEqual(res.allocations[0].lotId, 1);
    assert.strictEqual(res.allocations[1].lotId, 2);
});

test('fifoLots empty sell matches nothing', () => {
    const res = fifoLots({ date: '2024-01-01', quantity: 0, proceedsPaise: 0 }, lots);
    assert.strictEqual(res.soldQuantity, 0);
    assert.strictEqual(res.allocations.length, 0);
});

test('holdingPeriod counts whole days', () => {
    assert.strictEqual(holdingPeriod('2023-01-01', '2024-01-01'), 365);
    assert.strictEqual(holdingPeriod('2023-01-01', '2023-01-01'), 0);
});

test('monthsBetween is day-of-month aware', () => {
    assert.strictEqual(monthsBetween('2023-02-01', '2024-01-01'), 11);
    assert.strictEqual(monthsBetween('2023-01-15', '2024-01-14'), 11);
    assert.strictEqual(monthsBetween('2023-01-15', '2024-01-15'), 12);
});