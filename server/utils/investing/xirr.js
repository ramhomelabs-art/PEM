/**
 * XIRR (annualised IRR) on a cashflow series.
 *
 * cashflows: [{ date, amount }]
 *   date   - Date | epoch ms | 'YYYY-MM-DD' | ISO string
 *   amount - integer paise (negative = out, positive = inflow)
 *
 * Returns the annualised rate as a DECIMAL fraction (0.10 == 10%). Returns
 * NaN when a rate cannot be determined (fewer than two cashflows, zero time
 * span, or the Newton iteration fails to converge).
 */

const DAYS_PER_YEAR = 365;
const MS_PER_DAY = 86400000;

function toMs(date) {
    if (date instanceof Date) return date.getTime();
    if (typeof date === 'number') return date;
    const s = String(date);
    if (s.length <= 10) return new Date(`${s}T00:00:00Z`).getTime();
    return new Date(s).getTime();
}

function presentValue(list, days, rate) {
    let f = 0;
    for (let k = 0; k < list.length; k += 1) {
        f += list[k].amount / Math.pow(1 + rate, days[k] / DAYS_PER_YEAR);
    }
    return f;
}

function xirr(cashflows, opts = {}) {
    const maxIterations = opts.maxIterations ?? 100;
    const tolerance = opts.tolerance ?? 1e-7;

    const list = (cashflows || [])
        .filter((c) => c && Number.isFinite(Number(c.amount)))
        .map((c) => ({ ms: toMs(c.date), amount: Number(c.amount) }))
        .filter((c) => Number.isFinite(c.ms))
        .sort((a, b) => a.ms - b.ms);

    if (list.length < 2) return NaN;

    const t0 = list[0].ms;
    const days = list.map((c) => (c.ms - t0) / MS_PER_DAY);
    if (days[days.length - 1] <= 0) return NaN;

    const years = days.map((d) => d / DAYS_PER_YEAR);

    // Initial guess: geometric rate implied by total out vs total in.
    let out = 0;
    let inn = 0;
    for (const c of list) {
        if (c.amount > 0) out += c.amount;
        else inn -= c.amount;
    }
    const spanYears = days[days.length - 1] / DAYS_PER_YEAR;
    let rate = Number.isFinite(opts.guess)
        ? opts.guess
        : inn > 0 && out > 0
            ? Math.pow(out / inn, 1 / spanYears) - 1
            : 0.1;
    if (!Number.isFinite(rate)) rate = 0.1;
    rate = Math.max(rate, -0.999999);

    for (let i = 0; i < maxIterations; i += 1) {
        let f = 0;
        let df = 0;
        for (let k = 0; k < list.length; k += 1) {
            const base = 1 + rate;
            const pow = Math.pow(base, years[k]);
            f += list[k].amount / pow;
            df -= (list[k].amount * years[k]) / (pow * base);
        }
        if (Math.abs(f) < tolerance) return rate;
        if (!Number.isFinite(df) || df === 0) return NaN;
        const step = f / df;
        if (!Number.isFinite(step)) return NaN;
        let next = rate - step;
        if (next <= -1) next = (rate - 1) / 2;
        if (Math.abs(next - rate) < 1e-12) {
            rate = next;
            break;
        }
        rate = next;
    }

    return Math.abs(presentValue(list, days, rate)) < tolerance ? rate : NaN;
}

const xirrPercent = (cashflows, opts = {}) => xirr(cashflows, opts) * 100;

module.exports = { xirr, xirrPercent };