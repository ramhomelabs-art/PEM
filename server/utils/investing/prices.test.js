const test = require('node:test');
const assert = require('node:assert');
const { buildAmfiInserts } = require('./prices');

test('buildAmfiInserts joins AMFI rows to user assets by code', () => {
    const assets = [
        { id: 1, userId: 7, amfiCode: '135762' },
        { id: 2, userId: 7, amfiCode: '119598' },
        { id: 3, userId: 9, amfiCode: '135765' }
    ];
    const rows = [
        { amfiCode: '135762', schemeName: "Axis Children's Fund", plan: 'Direct', option: 'Growth', nav: 29.0001, navDate: '2026-10-01' },
        { amfiCode: '135765', schemeName: "Axis Children's Fund", plan: 'Direct', option: 'IDCW', nav: 26.7144, navDate: '2026-10-01' },
        { amfiCode: '000000', schemeName: 'Unheld', nav: 1, navDate: '2026-10-01' }
    ];
    const inserts = buildAmfiInserts(assets, rows);
    assert.strictEqual(inserts.length, 2);
    assert.deepStrictEqual(inserts[0], {
        userId: 7, assetId: 1, navDate: '2026-10-01', nav: 29.0001, source: 'amfi', schemeName: "Axis Children's Fund"
    });
    assert.deepStrictEqual(inserts[1], {
        userId: 9, assetId: 3, navDate: '2026-10-01', nav: 26.7144, source: 'amfi', schemeName: "Axis Children's Fund"
    });
});

test('buildAmfiInserts ignores assets without codes and empty row sets', () => {
    const assets = [{ id: 3, userId: 7, amfiCode: '' }, { id: 4, userId: 7, amfiCode: '  ' }];
    const rows = [{ amfiCode: '135762', schemeName: 'X', nav: 10, navDate: '2026-10-01' }];
    assert.strictEqual(buildAmfiInserts(assets, rows).length, 0);
    assert.strictEqual(buildAmfiInserts(assets, []).length, 0);
    assert.strictEqual(buildAmfiInserts(null, rows).length, 0);
});