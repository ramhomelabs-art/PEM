/**
 * AMFI daily NAV provider for mutual funds.
 *
 * AMFI publishes one lump CSV-ish dump of every scheme's latest NAV every
 * trading day:
 * `Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;
 *  Plan;Option;Net Asset Value;Date`
 *
 * `parseNavDump` is a pure function (unit tested) and `fetchNavDump` only adds
 * the network hop, so callers can inject their own fetch for tests.
 */

const { amfiNavUrl } = require('../config');

const MONTHS = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};

/** '01-Oct-2026' -> '2026-10-01' (UTC-safe, no timezone drift). */
function parseAmfiDate(value) {
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(String(value || '').trim());
    if (!m) return null;
    const mm = MONTHS[m[2]];
    if (!mm) return null;
    const dd = String(Number(m[1])).padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
}

/**
 * Parse the raw AMFI dump text into rows.
 * Returns [{ amfiCode, schemeName, plan, option, nav, navDate }].
 * Skips headers, AMC banners, blank lines, non-numeric scheme codes, empty
 * or non-positive NAVs and unparseable dates.
 */
function parseNavDump(text) {
    const rows = [];
    const lines = String(text || '').split(/\r?\n/);
    for (const line of lines) {
        const f = line.split(';');
        if (f.length < 8) continue;
        const code = (f[0] || '').trim();
        if (!/^\d+$/.test(code)) continue; // header band / AMC names / quotes
        const schemeName = (f[3] || '').trim();
        if (!schemeName) continue;
        const nav = Number((f[6] || '').trim());
        if (!Number.isFinite(nav) || nav <= 0) continue;
        const navDate = parseAmfiDate(f[7]);
        if (!navDate) continue;
        rows.push({
            amfiCode: code,
            schemeName,
            plan: (f[4] || '').trim() || null,
            option: (f[5] || '').trim() || null,
            nav,
            navDate
        });
    }
    return rows;
}

/** GET the full dump. `fetchImpl` is injected for tests. */
async function fetchNavDump({ fetchImpl } = {}) {
    const fn = fetchImpl || ((url) => fetch(url));
    const res = await fn(amfiNavUrl);
    if (!res.ok) {
        throw new Error(`AMFI NAV fetch failed: HTTP ${res.status}`);
    }
    return res.text();
}

module.exports = { parseNavDump, parseAmfiDate, fetchNavDump, amfiNavUrl };