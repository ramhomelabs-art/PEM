const test = require('node:test');
const assert = require('node:assert');
const { parseNavDump, parseAmfiDate, fetchNavDump } = require('./amfi');

const DUMP = [
    'Quote Date;1;2;3',
    'Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date',
    '',
    'Open Ended Schemes(Childrens Fund)',
    '',
    'Axis Mutual Fund',
    '',
    "135762;INF846K01WO1;-;Axis Children's Fund;Direct Plan;Growth Option;29.0001;01-Oct-2026",
    "135765;INF846K01WP8;-;Axis Children's Fund;Direct Plan;IDCW Option;26.7144;01-Oct-2026",
    "135759;INF846K01WJ1;-;Axis Children's Fund;Regular Plan;Growth Option;25.2450;01-Oct-2026",
    "135760;INF846K01WK9;-;Axis Children's Fund;Regular Plan;IDCW Option;23.2906;01-Oct-2026",
    "135764;INF846K01WR4;-;Axis Children's Fund;Direct Plan;Growth Option;29.5547;01-Oct-2026",
    "135763;INF846K01WS2;INF846K01WQ6;Axis Children's Fund;Direct Plan;IDCW Option;26.7648;01-Oct-2026",
    '999999;;;;;;;;NA;30-Sep-2026',
    '988888;INF846K00000;INF846K00001;New Fund;Regular;Growth;;;;',
    '977777;;;;;0.0000;30-Sep-2026',
    ''
].join('\r\n');

test('parseAmfiDate converts dd-MMM-yyyy to yyyy-MM-dd', () => {
    assert.strictEqual(parseAmfiDate('01-Oct-2026'), '2026-10-01');
    assert.strictEqual(parseAmfiDate('31-Dec-2025'), '2025-12-31');
    assert.strictEqual(parseAmfiDate(' 05-Apr-2024 '), '2024-04-05');
    assert.strictEqual(parseAmfiDate('bad'), null);
    assert.strictEqual(parseAmfiDate('01-Bad-2026'), null);
});

test('parseNavDump skips headers, banners and malformed rows', () => {
    const rows = parseNavDump(DUMP);
    assert.strictEqual(rows.length, 6);
    assert.deepStrictEqual(rows.map((r) => r.amfiCode), ['135762', '135765', '135759', '135760', '135764', '135763']);
});

test('parseNavDump keeps scheme/plan/option and normalises date + nav', () => {
    const [first] = parseNavDump(DUMP);
    assert.deepStrictEqual(first, {
        amfiCode: '135762',
        schemeName: "Axis Children's Fund",
        plan: 'Direct Plan',
        option: 'Growth Option',
        nav: 29.0001,
        navDate: '2026-10-01'
    });
});

test('parseNavDump handles a single CRLF-terminated line and empty input', () => {
    assert.strictEqual(parseNavDump('').length, 0);
    assert.strictEqual(parseNavDump(null).length, 0);
    const one = parseNavDump('135762;x;y;Name;Plan;Option;10;01-Oct-2026\r\n');
    assert.strictEqual(one.length, 1);
    assert.strictEqual(one[0].nav, 10);
});

test('fetchNavDump uses the injected fetch and returns body text', async () => {
    const calls = [];
    const mockFetch = async (url) => {
        calls.push(url);
        return { ok: true, text: async () => DUMP };
    };
    const text = await fetchNavDump({ fetchImpl: mockFetch });
    assert.strictEqual(text, DUMP);
    assert.strictEqual(calls.length, 1);
});

test('fetchNavDump throws on non-OK responses', async () => {
    const mockFetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(() => fetchNavDump({ fetchImpl: mockFetch }), /HTTP 503/);
});