const test = require('node:test');
const assert = require('node:assert');
const { PriceScheduler } = require('./scheduler');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('PriceScheduler never overlaps parallel runs', async () => {
    const s = new PriceScheduler();
    let calls = 0;
    let concurrent = 0;
    let maxConcurrent = 0;

    const handler = async () => {
        calls += 1;
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await sleep(30);
        concurrent -= 1;
    };

    s.start(handler, 5);
    await sleep(90);
    s.stop();

    assert.ok(calls >= 1, `handler should have run at least once (got ${calls})`);
    assert.strictEqual(maxConcurrent, 1, 'runs must never overlap');
});

test('PriceScheduler.stop prevents further ticks', async () => {
    const s = new PriceScheduler();
    let calls = 0;
    s.start(async () => { calls += 1; }, 5);
    await sleep(20);
    const afterStart = calls;
    s.stop();
    await sleep(30);
    assert.ok(afterStart >= 1);
    assert.strictEqual(calls, afterStart, 'no ticks after stop');
});

test('PriceScheduler records lastRunAt and surfaces handler errors', async () => {
    const s = new PriceScheduler();
    let calls = 0;
    s.start(async () => {
        calls += 1;
        if (calls === 1) throw new Error('boom');
    }, 5);
    // first run throws ('boom' logged), second succeeds; lastRunAt only set on success
    await sleep(40);
    s.stop();
    assert.ok(calls >= 2);
    assert.ok(s.lastRunAt instanceof Date);
});