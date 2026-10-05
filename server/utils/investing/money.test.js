const test = require('node:test');
const assert = require('node:assert');
const { toPaise, fromPaise, mulDiv } = require('./money');

test('toPaise converts exact rupees', () => {
    assert.strictEqual(toPaise(12.34), 1234);
    assert.strictEqual(toPaise(0), 0);
    assert.strictEqual(toPaise(1000), 100000);
});

test('toPaise rounds half away from zero at the paisa', () => {
    assert.strictEqual(toPaise(12.345), 1235);
    assert.strictEqual(toPaise(12.334), 1233);
    assert.strictEqual(toPaise(-12.345), -1235);
});

test('toPaise is safe against float artifacts', () => {
    assert.strictEqual(toPaise(0.07), 7);
    assert.strictEqual(toPaise(0.1 + 0.2), 30);
});

test('fromPaise mirrors toPaise', () => {
    assert.strictEqual(fromPaise(1050), 10.5);
});

test('mulDiv exact', () => {
    assert.strictEqual(mulDiv(100, 15, 100), 15);
    assert.strictEqual(mulDiv(120, 5, 30), 20);
    assert.strictEqual(mulDiv(0, 7, 13), 0);
});

test('mulDiv rounds half away from zero', () => {
    assert.strictEqual(mulDiv(5, 1, 2), 3);
    assert.strictEqual(mulDiv(-5, 1, 2), -3);
    assert.strictEqual(mulDiv(1001, 15, 100), 150); // 150.15 -> 150
});

test('mulDiv stays exact for large values', () => {
    assert.strictEqual(mulDiv(123456789012, 7, 13), 66476732545);
});

test('mulDiv divides by zero throws', () => {
    assert.throws(() => mulDiv(1, 1, 0));
});