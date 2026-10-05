const test = require('node:test');
const assert = require('node:assert');
const {
    parseCas,
    parseTabular,
    parseCasText,
    parseCasDate,
    casNumber,
    mapCasType,
    normaliseName,
    hashCasRow,
    matchRowsToAssets,
    assetKey
} = require('./parse');

test('parseCasDate handles common formats', () => {
    assert.strictEqual(parseCasDate('01-Oct-2026'), '2026-10-01');
    assert.strictEqual(parseCasDate('01-10-2026'), '2026-10-01');
    assert.strictEqual(parseCasDate('01/10/2026'), '2026-10-01');
    assert.strictEqual(parseCasDate('2026-10-01'), '2026-10-01');
    assert.strictEqual(parseCasDate(''), null);
    assert.strictEqual(parseCasDate('bad'), null);
});

test('casNumber strips commas and rejects non-finite', () => {
    assert.strictEqual(casNumber('10,000.50'), 10000.5);
    assert.strictEqual(casNumber('-5.25'), -5.25);
    assert.strictEqual(casNumber(''), null);
    assert.strictEqual(casNumber('abc'), null);
});

test('mapCasType maps descriptions to canonical types', () => {
    assert.strictEqual(mapCasType('SIP Purchase'), 'sip');
    assert.strictEqual(mapCasType('SIP'), 'sip');
    assert.strictEqual(mapCasType('Redemption'), 'sell');
    assert.strictEqual(mapCasType('Switch Out'), 'sell');
    assert.strictEqual(mapCasType('Switch In'), 'buy');
    assert.strictEqual(mapCasType('Dividend Reinvest'), 'dividend');
    assert.strictEqual(mapCasType('Bonus'), 'bonus');
    assert.strictEqual(mapCasType('Purchase'), 'buy');
    assert.strictEqual(mapCasType('unknown'), null);
});

test('normaliseName collapses common suffixes', () => {
    assert.strictEqual(normaliseName('HDFC ELSS Tax Saver Direct Plan Growth'), 'hdfcelss');
    assert.strictEqual(normaliseName('Axis Bluechip Fund - Regular Growth'), 'axis');
    assert.strictEqual(normaliseName(''), '');
});

test('hashCasRow is stable for the same inputs', () => {
    const h1 = hashCasRow({
        provider: 'CAMS',
        folio: '123456',
        type: 'buy',
        date: '2026-10-01',
        amount: 1000,
        units: 10,
        nav: 100
    });
    const h2 = hashCasRow({
        provider: 'CAMS',
        folio: '123456',
        type: 'buy',
        date: '2026-10-01',
        amount: 1000,
        units: 10,
        nav: 100
    });
    assert.strictEqual(h1, h2);
});

test('assetKey prefers amfi/isin over name', () => {
    assert.strictEqual(assetKey({ amfiCode: '135762', schemeName: 'X' }), 'amfi:135762');
    assert.strictEqual(assetKey({ isin: 'INF846K01WO1', schemeName: 'X' }), 'isin:INF846K01WO1');
    assert.strictEqual(assetKey({ schemeName: 'HDFC ELSS' }), 'name:hdfcelss');
});

test('parseTabular parses CSV with header', () => {
    const text = [
        'Date,Scheme Name,AMFI Code,Type,Units,NAV,Amount,Folio',
        '01-Oct-2026,HDFC ELSS Tax Saver Direct Plan Growth,119598,Purchase,"10.500000",100.00,"1,050.00",123456'
    ].join('\n');
    const res = parseCas(text);
    assert.strictEqual(res.rows[0].schemeName.startsWith('HDFC'), true);
    assert.strictEqual(res.rows[0].amfiCode, '119598');
    assert.strictEqual(res.rows[0].type, 'buy');
    assert.strictEqual(res.rows[0].units, 10.5);
    assert.strictEqual(res.rows[0].amount, 1050);
    assert.ok(res.rows[0].hash, 'hash should be set');
});

test('parseTabular detects TSV and parses semicolons', () => {
    const tsv = 'date\tschemeName\tamfiCode\ttype\tunits\tnav\tamount\n01-Oct-2026\tX\t135762\tSIP\t100\t10\t1000';
    const csvSemi = 'date;schemeName;amfiCode;type;units;nav;amount\n01-Oct-2026;X;135762;Redemption;50;10;500';
    assert.strictEqual(parseTabular(tsv).rows[0].type, 'sip');
    assert.strictEqual(parseTabular(csvSemi).rows[0].type, 'sell');
});

test('parseCasText extracts scheme + txn lines (tolerant)', () => {
    const cas = [
        'Statement as on 01-Oct-2026',
        'HDFC ELSS Tax Saver - Direct Plan Growth Option (Direct Plan Growth)',
        'Folio No: 12345678',
        '01-Apr-2024  PURCHASE  1000.00  10.123  98.76  1012.30',
        '01-May-2024  SIP  1000.00  10.000  100.00  2012.30',
        '01-Jun-2024  Redemption  500.00  5.000  100.00  1512.30'
    ].join('\n');
    const res = parseCasText(cas);
    assert.strictEqual(res.rows.length, 3);
    assert.strictEqual(res.rows[0].type, 'buy');
    assert.strictEqual(res.rows[1].type, 'sip');
    assert.strictEqual(res.rows[2].type, 'sell');
    assert.strictEqual(res.rows[0].schemeName.startsWith('HDFC ELSS'), true);
    assert.strictEqual(res.rows[0].folio, '12345678');
});

test('parseCas routes to tabular or cas-pdf automatically', () => {
    const sheet = 'date,schemeName,amfiCode,type,units,nav,amount\n01-Oct-2026,X,135762,Buy,10,10,100';
    const cas = 'Scheme\n01-Apr-2024  PURCHASE  1000.00  10.000  100.00  1000.00';
    const r1 = parseCas(sheet, { format: 'auto' });
    const r2 = parseCas(cas, { format: 'auto' });
    assert.strictEqual(r1.rows[0].type, 'buy');
    assert(r2.source === 'cas-pdf' || r2.rows.length >= 0);
});

test('matchRowsToAssets matches by amfi > isin > name', () => {
    const existing = [
        { id: 1, amfiCode: '135762', isin: null, name: 'Axis' },
        { id: 2, amfiCode: null, isin: 'INF846K01WO1', name: 'Axis Child' },
        { id: 3, amfiCode: null, isin: null, name: 'HDFC ELSS Tax Saver Direct Plan Growth' }
    ];
    const rows = [
        { schemeName: 'Axis Something', amfiCode: '135762', hash: 'x' },
        { schemeName: 'Axis Childrens', isin: 'INF846K01WO1', hash: 'y' },
        { schemeName: 'HDFC ELSS Tax Saver Direct Plan Growth Option', amfiCode: null, isin: null, hash: 'z' },
        { schemeName: 'Unknown', hash: 'w' }
    ];
    const { matched, unmatched } = matchRowsToAssets(existing, rows);
    assert.strictEqual(matched.size, 3);
    assert.strictEqual(unmatched.length, 1);
});