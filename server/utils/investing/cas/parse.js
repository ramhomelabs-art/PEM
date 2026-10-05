/**
 * Pure CAS import parsing + matching (no I/O, no DB) for the investments
 * module. Two input flavours collapse into one canonical row:
 *
 *   1. Delimited template (CSV/TSV/semicolon) - the guaranteed path:
 *        date, schemeName, amfiCode, isin, plan, option, type, units, nav,
 *        amount, balance, folio, provider
 *      Header row required (or you get positional mapping against that exact
 *      column order).
 *
 *   2. CAMS / KFinTech CAS text layer (what pdf-parse yields from the MF
 *      Central PDF) - heuristic line parser: scheme block headers + txn lines
 *      `01-Apr-2024  PURCHASE  1000.00  10.123  98.76  10.123`.
 *
 * Everything here is unit-tested with fixtures; extraction (PDF etc.) lives in
 * ./extract.js and DB effects in ./import.js.
 */

const crypto = require('crypto');

const MONTHS = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};

/** 'dd-MMM-yyyy' / 'dd-mm-yyyy' / 'dd/mm/yyyy' / ISO -> 'YYYY-MM-DD' or null. */
function parseCasDate(value) {
    const s = String(value ?? '').trim();
    if (!s) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dmy = /^(\d{1,2})[/-](\d{1,2}|[A-Za-z]{3})[/-](\d{4})$/.exec(s);
    if (!dmy) return null;
    const mm = /^\d{1,2}$/.test(dmy[2])
        ? String(Number(dmy[2])).padStart(2, '0')
        : (MONTHS[dmy[2]] || null);
    if (!mm) return null;
    const dd = String(Number(dmy[1])).padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
}

/** Strip thousands separators and coerce; null when absent / non-finite. */
function casNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const s = String(value).trim().replace(/,/g, '');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

/** Free-text transaction description -> internal type (schema CHECK constraint). */
function mapCasType(keyword) {
    const k = String(keyword || '').toUpperCase();
    if (/SIP/.test(k)) return 'sip';
    if (/REDEMPTION|SELL|SWITCH\s*OUT|EXIT/.test(k)) return 'sell';
    if (/SWITCH\s*IN/.test(k)) return 'buy';
    if (/SWITCH/.test(k)) return 'switch';
    if (/DIVIDEND|REINVEST|INCOME DISTRIBUTION|IDCW/.test(k)) return 'dividend';
    if (/BONUS/.test(k)) return 'bonus';
    if (/SPLIT/.test(k)) return 'split';
    if (/PURCHASE|BUY|SUBSCRIBE|ACCEPTANCE/.test(k)) return 'buy';
    return null;
}

/** Canonical asset key (amfi || isin || normalised name) used for dedupe. */
function assetKey(row) {
    if (row.amfiCode) return `amfi:${row.amfiCode}`;
    if (row.isin) return `isin:${row.isin}`;
    return `name:${normaliseName(row.schemeName)}`;
}

const NAME_STOPWORDS = /\b(mutual|fund|direct|regular|plan|growth|option|idcw|dividend|reinvest|transfer|scheme|tax|saver|bluechip|equity|opportunities|index)\b/g;

/** Stable normalisation for name-based matching. */
function normaliseName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(NAME_STOPWORDS, ' ')
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

const TX_PROVIDER = 'cas';

/** SHA-256 idempotency key per the idx_txns_import_hash contract. */
function hashCasRow(row) {
    const seed = [
        TX_PROVIDER,
        row.provider || '',
        row.folio || '',
        row.type,
        row.date,
        row.amount ?? '',
        row.units ?? '',
        row.nav ?? ''
    ].join('|');
    return crypto.createHash('sha256').update(seed).digest('hex');
}

// ---------------------------------------------------------------------------
// Delimited template
// ---------------------------------------------------------------------------

const HEADER_ALIASES = {
    date: [/^date$/i, /^tx\s?date$/i, /^transaction\s?date$/i, /^dt$/i],
    schemeName: [/^scheme\s?name$/i, /^scheme$/i, /^name$/i, /^fund\s?name$/i, /^fund$/i],
    amfiCode: [/^amfi\s?code$/i, /^amfi$/i, /^scheme\s?code$/i],
    isin: [/^isin$/i],
    plan: [/^plan$/i],
    option: [/^option$/i, /^div\s?option$/i],
    type: [/^type$/i, /^txn?\s?type$/i, /^transaction\s?type$/i, /^description$/i],
    units: [/^units$/i, /^qty$/i, /^quantity$/i],
    nav: [/^nav$/i, /^nav\s?value$/i],
    amount: [/^amount$/i, /^amt$/i, /^value$/i],
    balance: [/^balance$/i, /^balance\s?units$/i],
    folio: [/^folio$/i, /^folio\s?no$/i, /^folio\s?number$/i],
    provider: [/^provider$/i, /^amc$/i, /^rta$/i]
};

const HEADER_KEYS = Object.keys(HEADER_ALIASES);

/** Guess the delimiter by scanning the first few non-empty lines. */
function detectDelimiter(text) {
    const sample = String(text || '').split(/\r?\n/).filter((l) => l.trim()).slice(0, 5).join('\n');
    const counts = [',', '\t', ';'].map((d) => ({ d, c: sample.split(d).length - 1 }));
    return counts.sort((a, b) => b.c - a.c)[0].d;
}

function splitLine(line, delim) {
    // crude CSV: handles double-quoted fields, no embedded-newline support
    const out = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === delim && !inQ) { out.push(cur); cur = ''; }
        else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
}

/** Text -> canonical rows. Header optional but strongly encouraged. */
function parseTabular(text) {
    const delim = detectDelimiter(text);
    const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { rows: [], errors: [], delimiter: delim };

    const first = splitLine(lines[0], delim);
    const header = first.map((h) => HEADER_KEYS.find((k) => HEADER_ALIASES[k].some((re) => re.test(h))));
    const headers = header.some((k) => k) ? header : null;

    const body = headers ? lines.slice(1) : lines;
    const errors = [];
    const rows = [];

    for (let i = 0; i < body.length; i++) {
        const fields = splitLine(body[i], delim);
        const raw = {};
        if (headers) {
            fields.forEach((f, idx) => { if (headers[idx]) raw[headers[idx]] = f; });
        } else {
            // positional template: date, schemeName, amfiCode, plan, option, type, units, nav, amount, balance
            const pos = ['date', 'schemeName', 'amfiCode', 'plan', 'option', 'type', 'units', 'nav', 'amount', 'balance'];
            pos.forEach((k, idx) => { raw[k] = fields[idx]; });
        }

        try {
            const row = normaliseRow(raw, i);
            if (row) rows.push(row);
        } catch (err) {
            errors.push({ line: i + (headers ? 2 : 1), message: err.message });
        }
    }
    return { rows, errors, delimiter: delim };
}

/** One canonical row from a raw field object; throws on unusable rows. */
function normaliseRow(raw, line) {
    const date = parseCasDate(raw.date);
    const schemeName = String(raw.schemeName || '').trim();
    const type = mapCasType(raw.type);

    if (!date || !schemeName || !type) {
        const bits = [];
        if (!date) bits.push('invalid date');
        if (!schemeName) bits.push('missing schemeName');
        if (!type) bits.push(`unrecognised type '${raw.type}'`);
        throw new Error(bits.join(', '));
    }

    const units = casNumber(raw.units);
    const nav = casNumber(raw.nav);
    const amount = casNumber(raw.amount);
    const balance = casNumber(raw.balance);

    if (units === null && (raw.units !== undefined && raw.units !== '')) {
        throw new Error(`invalid units '${raw.units}'`);
    }

    // a meaningful txn row should have at least money or units
    const hasAmount = amount !== null && amount !== 0;
    const hasUnits = units !== null && units !== 0;
    if (!hasAmount && !hasUnits) throw new Error('row has no units or amount');

    return {
        date,
        schemeName,
        amfiCode: String(raw.amfiCode || '').trim() || null,
        isin: String(raw.isin || '').trim() || null,
        plan: String(raw.plan || '').trim() || null,
        option: String(raw.option || '').trim() || null,
        type,
        units: units ?? 0,
        nav: nav ?? 0,
        amount: amount ?? 0,
        balance: balance,
        folio: String(raw.folio || '').trim() || null,
        provider: String(raw.provider || '').trim() || null,
        hash: null,
        source: 'sheet'
    };
}

// ---------------------------------------------------------------------------
// CAMS / KFinTech CAS text layer (heuristic)
// ---------------------------------------------------------------------------

const TXN_RE = /^\s*(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([-0-9.,]+)(?:\s+([-0-9.,]+))?(?:\s+([-0-9.,]+))?(?:\s+([-0-9.,]+))?\s*$/;
const SCHEME_RE = /^[A-Za-z].*(?:Mutual Fund|Fund|Opportunities|Equity|Growth|Index|Plan).*$/;
const FOLIO_RE = /folio\s*(?:no\.?|number|no)\s*[:#]?\s*([A-Za-z0-9_\-\/]+)/i;

/** Tolerant parser for the PDF text layer of an MF Central CAS. */
function parseCasText(text) {
    const errors = [];
    const rows = [];
    const lines = String(text || '').split(/\r?\n/);
    let context = { schemeName: null, folio: null };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        const folioM = FOLIO_RE.exec(trimmed);
        if (folioM && (context.schemeName || /folio/i.test(trimmed))) {
            context = { schemeName: context.schemeName, folio: folioM[1].replace(/[^A-Za-z0-9_\-\/]/g, '') };
        }

        const tm = TXN_RE.exec(line);
        if (tm) {
            const date = parseCasDate(tm[1]);
            const desc = tm[2].replace(/\s{2,}/g, ' ').trim();
            const nums = [tm[3], tm[4], tm[5], tm[6]].map(casNumber);
            const type = mapCasType(desc);
            if (date && type && context.schemeName) {
                // CAS columns: amount, units, nav, balance (sell rows put a - on either amount or units)
                const isSell = type === 'sell';
                const abs = (v) => (v === null ? 0 : Math.abs(v));
                const amount = isSell ? abs(nums[0]) : (nums[0] ?? 0);
                const units = isSell ? abs(nums[1]) : (nums[1] ?? 0);
                const nav = isSell ? abs(nums[2]) : (nums[2] ?? 0);
                const balance = nums[3] ?? null;
                rows.push({
                    date,
                    schemeName: context.schemeName,
                    amfiCode: null,
                    isin: null,
                    plan: context.plan || null,
                    option: context.option || null,
                    type,
                    units,
                    nav,
                    amount,
                    balance,
                    folio: context.folio,
                    provider: null,
                    hash: null,
                    source: 'cas-pdf'
                });
            } else {
                errors.push({ line: i + 1, message: `dropped unparsed txn line: '${trimmed.slice(0, 80)}'` });
            }
            continue;
        }

        // scheme block header: "AMC - Scheme Name  (Plan Option)" or plain name line
        if (!context.schemeName && SCHEME_RE.test(trimmed) && !/(purchase|redemption|switch|dividend|reinvest|bonus|split|page|amfi|pan|kyc|statement|summary)/i.test(trimmed)) {
            const paren = /\((.*?)\)\s*$/.exec(trimmed);
            context = { schemeName: trimmed.replace(paren ? paren[0] : '', '').trim(), folio: context.folio };
            if (paren) {
                context.plan = paren[1].split(/\s+/).slice(0, 2).join(' '); // e.g. "Direct Plan Growth"
            }
        }
    }

    return { rows, errors };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Parse any supported source into canonical rows + issues.
 * opts: { text, format: 'auto' | 'csv' | 'tsv' | 'cas' }
 */
function parseCas(inputText, { format = 'auto' } = {}) {
    const text = String(inputText || '');
    const trimmed = text.trim();
    if (!trimmed) return { rows: [], errors: [{ message: 'empty input' }], source: format };

    const looksTabular = /[,\t;]/.test(trimmed) && /(,|\t|;)/.test(trimmed.split(/\r?\n/)[0] || '');
    const wantSheet = format === 'csv' || format === 'tsv' || (format === 'auto' && looksTabular);

    let parsed;
    if (wantSheet) parsed = parseTabular(text);
    else parsed = parseCasText(text);

    // stamp hashes AFTER normalisation so preview === commit identity
    for (const row of parsed.rows) row.hash = hashCasRow(row);
    if (parsed.source === undefined) parsed.source = wantSheet ? 'sheet' : 'cas-pdf';
    return parsed;
}

// ---------------------------------------------------------------------------
// Pure asset matching helper (DB layer passes existing assets in)
// ---------------------------------------------------------------------------

/**
 * Match canonical parse rows to the user's existing assets.
 * existing: [{id, amfiCode, isin, name}]   rows: parseCas().rows
 * Returns { match: Map<row, existing asset>, unmatched: [] }
 */
function matchRowsToAssets(existing, rows) {
    const byAmfi = new Map();
    const byIsin = new Map();
    const byName = new Map();
    for (const a of existing || []) {
        if (a.amfiCode) byAmfi.set(String(a.amfiCode).trim(), a);
        if (a.isin) byIsin.set(String(a.isin).trim().toUpperCase(), a);
        const n = normaliseName(a.name);
        if (n) byName.set(n, a);
    }
    const matched = new Map();
    const unmatched = [];
    for (const row of rows || []) {
        let asset = row.amfiCode ? byAmfi.get(String(row.amfiCode).trim()) : null;
        if (!asset && row.isin) asset = byIsin.get(String(row.isin).trim().toUpperCase());
        if (!asset) asset = byName.get(normaliseName(row.schemeName));
        if (asset) matched.set(row, asset);
        else unmatched.push(row);
    }
    return { matched, unmatched };
}

module.exports = {
    parseCas,
    parseTabular,
    parseCasText,
    parseCasDate,
    casNumber,
    mapCasType,
    normaliseName,
    hashCasRow,
    assetKey,
    detectDelimiter,
    matchRowsToAssets,
    MONTHS
};