const test = require('node:test');
const assert = require('node:assert');
const { xirr, xirrPercent } = require('./xirr');

const MS_PER_DAY = 86400000;
const DAYS_PER_YEAR = 365;
const START = Date.parse('2023-01-01T00:00:00Z');

function pv(cashflows, rate) {
    let s = 0;
    for (const c of cashflows) {
        const ms = c.date instanceof Date ? c.date.getTime() : Date.parse(c.date);
        const yearFrac = (ms - START) / (MS_PER_DAY * DAYS_PER_YEAR);
        s += c.amount / Math.pow(1 + rate, yearFrac);
    }
    return s;
}

test('xirr of a 10% one-year round trip', () => {
    const cf = [{ date: '2023-01-01', amount: -100000 }, { date: '2024-01-01', amount: 110000 }];
    assert.ok(Math.abs(xirr(cf) - 0.1) < 1e-6, `got ${xirr(cf)}`);
});

test('xirr of a loss is negative', () => {
    const cf = [{ amount: -100000, date: '2023-01-01' }, { amount: 90000, date: '2024-01-01' }];
    assert.ok(Math.abs(xirr(cf) - -0.1) < 1e-6, `got ${xirr(cf)}`);
});

test('xirr returns NaN for degenerate input', () => {
    assert.ok(Number.isNaN(xirr([])));
    assert.ok(Number.isNaN(xirr([{ date: '2023-01-01', amount: -100 }])));
    assert.ok(Number.isNaN(xirr([
        { date: '2023-01-01', amount: -100 },
        { date: '2023-01-01', amount: 100 }
    ])));
});

test('xirr converges so PV is ~0 for irregular flows', () => {
    const cf = [
        { date: '2023-06-25', amount: -100000 },
        { date: '2023-12-31', amount: 50000 },
        { date: '2024-06-25', amount: 70000 }
    ];
    const rate = xirr(cf);
    assert.ok(Number.isFinite(rate), 'rate should be finite');
    assert.ok(rate > 0 && rate < 1, `rate ${rate} in a plausible band`);
    assert.ok(Math.abs(pv(cf, rate)) < 1e-6, `PV ${pv(cf, rate)} near zero`);
});

test('xirr accepts Dates and epoch ms', () => {
    const a = xirr([
        { date: new Date('2023-01-01'), amount: -100000 },
        { date: new Date('2024-01-01'), amount: 110000 }
    ]);
    const b = xirr([
        { date: START, amount: -100000 },
        { date: START + 365 * MS_PER_DAY, amount: 110000 }
    ]);
    assert.ok(Math.abs(a - 0.1) < 1e-6);
    assert.ok(Math.abs(b - 0.1) < 1e-6);
});

test('xirrPercent scales to percent', () => {
    const cf = [{ date: '2023-01-01', amount: -100000 }, { date: '2024-01-01', amount: 110000 }];
    assert.ok(Math.abs(xirrPercent(cf) - 10) < 1e-6);
});