const test = require('node:test');
const assert = require('node:assert');
const { sipSummary } = require('./sips');

const iso = (d) => (d ? d.toISOString().slice(0, 10) : null);

test('monthly SIP schedule & due split', () => {
    const sip = {
        amount: 100000, // 1000 INR
        frequency: 'monthly',
        instalmentDay: 15,
        startDate: '2024-01-15',
        endDate: '2024-12-15',
        stepUpPct: 0
    };
    const r = sipSummary(sip, '2024-06-15');
    assert.strictEqual(r.instalmentsPlanned, 12);
    assert.strictEqual(r.instalmentsDue, 6);
    assert.strictEqual(r.investedPaise, 600000);
    assert.strictEqual(r.nextAmountPaise, 100000);
    assert.strictEqual(iso(r.nextDueDate), '2024-07-15');
    assert.strictEqual(r.totalCommittedPaise, 1200000);
});

test('annual step-up applies from the first anniversary', () => {
    const sip = {
        amount: 100000,
        frequency: 'monthly',
        instalmentDay: 15,
        startDate: '2024-01-15',
        endDate: '2025-03-15',
        stepUpPct: 10
    };
    const r = sipSummary(sip, '2025-03-15');
    assert.strictEqual(r.instalmentsPlanned, 15);
    assert.strictEqual(r.instalmentsDue, 15);
    assert.strictEqual(r.schedule[12].amountPaise, 110000); // 2025-01-15
    assert.strictEqual(r.investedPaise, 1530000); // 12 * 100000 + 3 * 110000
    assert.strictEqual(r.nextAmountPaise, 0);
});

test('weekly SIP rolls every 7 days', () => {
    const sip = {
        amount: 50000,
        frequency: 'weekly',
        instalmentDay: 2,
        startDate: '2024-01-16', // a Tuesday
        endDate: '2024-02-13',
        stepUpPct: 0
    };
    const r = sipSummary(sip, '2024-01-30');
    assert.strictEqual(r.instalmentsPlanned, 5);
    assert.strictEqual(r.instalmentsDue, 3);
    assert.strictEqual(r.investedPaise, 150000);
    assert.strictEqual(iso(r.nextDueDate), '2024-02-06');
});

test('month-end day is clamped to the month length', () => {
    const sip = {
        amount: 100000,
        frequency: 'monthly',
        instalmentDay: 31,
        startDate: '2024-01-31',
        endDate: '2024-04-30',
        stepUpPct: 0
    };
    const r = sipSummary(sip, '2024-04-30');
    assert.strictEqual(r.instalmentsPlanned, 4);
    assert.strictEqual(iso(r.schedule[1].date), '2024-02-29'); // leap year clamp
    assert.strictEqual(r.investedPaise, 400000);
});

test('open-ended SIP is bounded and still reports due amounts', () => {
    const sip = {
        amount: 100000,
        frequency: 'monthly',
        instalmentDay: 1,
        startDate: '2024-01-01',
        stepUpPct: 0
    };
    const r = sipSummary(sip, '2024-03-01');
    assert.strictEqual(r.instalmentsDue, 3);
    assert.strictEqual(r.investedPaise, 300000);
    assert.ok(r.instalmentsPlanned > 3);
});

test('quarterly SIP', () => {
    const sip = {
        amount: 300000,
        frequency: 'quarterly',
        instalmentDay: 10,
        startDate: '2024-04-10',
        endDate: '2025-01-10',
        stepUpPct: 0
    };
    const r = sipSummary(sip, '2025-01-10');
    assert.strictEqual(r.instalmentsPlanned, 4);
    assert.strictEqual(iso(r.schedule[1].date), '2024-07-10');
    assert.strictEqual(r.investedPaise, 1200000);
});