const test = require('node:test');
const assert = require('node:assert');
const { isBuyLike, isSell, buildOpenLotsFromBuys, computeTaxOnSell } = require('./taxlots');
const { fifoLots } = require('./fifo');

test('isBuyLike and isSell helpers', () => {
    assert.strictEqual(isBuyLike('buy'), true);
    assert.strictEqual(isBuyLike('sip'), true);
    assert.strictEqual(isBuyLike('sell'), false);
    assert.strictEqual(isSell('sell'), true);
    assert.strictEqual(isSell('buy'), false);
});

test('buildOpenLotsFromBuys shapes lots correctly', () => {
    const buys = [
        { id: 1, txDate: '2025-01-01', units: 10, amount: 1000 },
        { id: 2, txDate: '2025-06-01', units: 5, amount: 500 }
    ];
    const lots = buildOpenLotsFromBuys(buys);
    assert.strictEqual(lots.length, 2);
    assert.strictEqual(lots[0].quantity, 10);
    assert.strictEqual(lots[0].costPerUnit, 100);
});

test('fifoLots matches FIFO for tax lots', () => {
    const lots = [
        { id: 1, openDate: '2025-01-01', quantity: 10, costPerUnit: 100 },
        { id: 2, openDate: '2025-06-01', quantity: 5, costPerUnit: 150 }
    ];
    const res = fifoLots({ quantity: 7, proceedsPaise: 70000, date: '2026-01-01' }, lots, { longTermMonths: 12 });
    assert.strictEqual(res.remainingQuantity, 0);
    assert.strictEqual(res.allocations.length, 1);
    assert.strictEqual(res.allocations[0].lotId, 1);
    assert.strictEqual(res.allocations[0].quantity, 7);
});