const test = require('node:test');
const assert = require('node:assert');
const { currentValue, invested, unrealisedGain, lotValuePaise } = require('./portfolio');

test('invested sums money in and subtracts money out', () => {
    const txns = [
        { type: 'buy', amount: 100000 },
        { type: 'sip', amount: 500000 },
        { type: 'sell', amount: 200000 }
    ];
    assert.strictEqual(invested(txns), 400000);
});

test('invested tolerates negative amounts (sign from type)', () => {
    const txns = [
        { type: 'buy', amount: 100000 },
        { type: 'sell', amount: -40000 }
    ];
    assert.strictEqual(invested(txns), 60000);
});

test('invested ignores neutral txns (dividend/switch/bonus/split)', () => {
    const txns = [
        { type: 'buy', amount: 100000 },
        { type: 'dividend', amount: 5000 },
        { type: 'switch', amount: 9999 },
        { type: 'bonus', amount: 1 }
    ];
    assert.strictEqual(invested(txns), 100000);
});

test('invested handles empty and null', () => {
    assert.strictEqual(invested([]), 0);
    assert.strictEqual(invested(null), 0);
});

test('lotValuePaise is paise-exact where floats would drift', () => {
    assert.strictEqual(lotValuePaise(10, 100), 100000);       // 10 * 100 = 1000.00
    assert.strictEqual(lotValuePaise(0.1, 0.1), 1);           // 0.01
    assert.strictEqual(lotValuePaise(10.5, 95.25), 100013);   // 1000.125 -> 1000.13
    assert.strictEqual(lotValuePaise(-10, 100), -100000);
});

test('currentValue sums holdings', () => {
    const holdings = [
        { quantity: 10, nav: 100 },
        { quantity: 10.5, nav: 95.25 }
    ];
    assert.strictEqual(currentValue(holdings), 200013);
    assert.strictEqual(currentValue([]), 0);
    assert.strictEqual(currentValue(null), 0);
});

test('unrealisedGain is currentValue minus invested', () => {
    assert.strictEqual(unrealisedGain(200013, 150000), 50013);
    assert.strictEqual(unrealisedGain(100000, 150000), -50000);
});