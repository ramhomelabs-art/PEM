/**
 * Pure cash-flow helpers — no React, no DOM.
 *
 * All of the daily / weekly / monthly grouping lives here so the dashboard can
 * stay declarative and so the logic is directly unit-testable (see
 * `cashFlow.test.js`). Every function is deterministic given its inputs.
 */
const DAY_MS = 86400000;

// Kept local (instead of importing the UI `RANGE_PRESETS`) so this module stays
// dependency-free and runnable under Node's native test runner.
const RANGE_MONTHS = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 };

/** Fewer active periods than this and the chart is considered "sparse". */
export const MIN_TREND_PERIODS = 3;

const toAmount = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const startOfDay = (value) => {
    const d = value instanceof Date ? value : new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/** Resolves the inclusive `[start, end]` window for a range preset / custom range. */
export function resolveRangeWindow(range = '1m', customRange, now = new Date()) {
    if (range === 'custom' && customRange?.from) {
        return {
            start: startOfDay(customRange.from),
            end: customRange.to ? new Date(`${customRange.to}T23:59:59.999`) : now,
        };
    }
    const months = RANGE_MONTHS[range] ?? 1;
    return {
        start: new Date(now.getFullYear(), now.getMonth() - (months - 1), 1),
        end: now,
    };
}

/**
 * The default grouping for a range: daily for "This month", monthly for
 * quarter-or-longer presets, and span-adaptive for a custom range.
 */
export function defaultGranularity(range = '1m', customRange, now = new Date()) {
    if (range !== 'custom') return range === '1m' ? 'day' : 'month';

    const { start, end } = resolveRangeWindow(range, customRange, now);
    const days = Math.max(1, Math.round((end - start) / DAY_MS));
    if (days <= 31) return 'day';
    if (days <= 92) return 'week';
    return 'month';
}

const bucketLabel = (date, granularity, crossYear) => {
    if (granularity === 'month') {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            ...(crossYear ? { year: '2-digit' } : {}),
        });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const bucketKey = (date, granularity) =>
    granularity === 'month' ? `${date.getFullYear()}-${date.getMonth()}` : startOfDay(date).getTime();

/**
 * Buckets income / expense across the window at the requested granularity.
 * Every period is zero-filled so the X axis never skips one; each bucket also
 * carries `net` (income − expense) and a running `balance`.
 */
export function buildCashFlowBuckets(transactions = [], { granularity = 'month', start, end } = {}) {
    const from = startOfDay(start);
    const to = end ? new Date(end) : new Date();
    const crossYear = from.getFullYear() !== to.getFullYear();
    const stepDays = granularity === 'week' ? 7 : 1;

    const buckets = [];
    const cursor =
        granularity === 'month'
            ? new Date(from.getFullYear(), from.getMonth(), 1)
            : new Date(from);
    while (cursor <= to) {
        buckets.push({
            key: bucketKey(cursor, granularity),
            label: bucketLabel(cursor, granularity, crossYear),
            start: new Date(cursor),
            income: 0,
            expense: 0,
        });
        if (granularity === 'month') cursor.setMonth(cursor.getMonth() + 1);
        else cursor.setDate(cursor.getDate() + stepDays);
    }

    if (!buckets.length) return buckets;

    const indexOf = (d) => {
        if (granularity === 'month') {
            return (
                (d.getFullYear() - buckets[0].start.getFullYear()) * 12 +
                (d.getMonth() - buckets[0].start.getMonth())
            );
        }
        return Math.floor(
            (startOfDay(d).getTime() - buckets[0].start.getTime()) / (stepDays * DAY_MS)
        );
    };

    for (const t of transactions) {
        const d = new Date(t.date);
        if (Number.isNaN(d.getTime()) || d < from || d > to) continue;
        const bucket = buckets[indexOf(d)];
        if (!bucket) continue;
        if (t.type === 'income') bucket.income += toAmount(t.amount);
        else if (t.type === 'expense') bucket.expense += toAmount(t.amount);
    }

    let running = 0;
    for (const b of buckets) {
        b.net = b.income - b.expense;
        running += b.net;
        b.balance = running;
    }
    return buckets;
}

/** Periods that actually contain activity (used for the sparse-data fallback). */
export const countActiveBuckets = (buckets = []) =>
    buckets.filter((b) => b.income > 0 || b.expense > 0).length;

/** Income / expense / net totals across a window — used for the "vs last period" line. */
export function windowTotals(transactions = [], start, end) {
    const from = startOfDay(start);
    const to = end ? new Date(end) : new Date();
    let income = 0;
    let expense = 0;

    for (const t of transactions) {
        const d = new Date(t.date);
        if (Number.isNaN(d.getTime()) || d < from || d > to) continue;
        if (t.type === 'income') income += toAmount(t.amount);
        else if (t.type === 'expense') expense += toAmount(t.amount);
    }
    return { income, expense, net: income - expense };
}

/** The window immediately preceding `[start, end]`, of equal length. */
export function previousWindow(start, end) {
    const from = startOfDay(start);
    const to = end ? new Date(end) : new Date();
    const span = Math.max(DAY_MS, to - from);
    return { start: new Date(from.getTime() - span), end: new Date(from.getTime() - 1) };
}

/** Headline figures plus best / lowest / average net period for the footer strip. */
export function summarizeCashFlow(buckets = []) {
    const totalIn = buckets.reduce((s, b) => s + b.income, 0);
    const totalOut = buckets.reduce((s, b) => s + b.expense, 0);
    const net = totalIn - totalOut;
    const savingsRate = totalIn > 0 ? (net / totalIn) * 100 : null;

    const active = buckets.filter((b) => b.income > 0 || b.expense > 0);
    let best = null;
    let lowest = null;
    for (const b of active) {
        if (!best || b.net > best.net) best = b;
        if (!lowest || b.net < lowest.net) lowest = b;
    }
    const avg = buckets.length ? net / buckets.length : 0;

    return {
        totalIn,
        totalOut,
        net,
        savingsRate,
        best,
        lowest,
        avg,
        activePeriods: active.length,
        totalPeriods: buckets.length,
    };
}
