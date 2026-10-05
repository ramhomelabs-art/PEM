/**
 * FIFO tax-lot engines. A buy/sip opens a lot; a sell consumes the oldest open
 * lots first. All money in paise (integers); unit quantities keep the DB's
 * micro-unit (1e-6) precision and costs NAV x 1e4, matching tax_lots columns.
 */

const { mulDiv } = require('./money');

const UNIT_MICRO = 1e6;
const NAV_SCALE = 1e4;
// units x 1e6 * nav x 1e4 = rupees x 1e10; dividing by 1e8 yields paise.
const VALUE_SCALE = 10n ** 8n;

function toDateMs(date) {
    if (date instanceof Date) return date.getTime();
    if (typeof date === 'number') return date;
    const s = String(date);
    if (s.length <= 10) return new Date(`${s}T00:00:00Z`).getTime();
    return new Date(s).getTime();
}

function startOfDayMs(ms) {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole calendar days between two dates (negative if `to` < `from`). */
function holdingPeriod(openDate, asOfDate = new Date()) {
    const from = startOfDayMs(toDateMs(openDate));
    const to = startOfDayMs(toDateMs(asOfDate));
    if (!Number.isFinite(from) || !Number.isFinite(to)) return NaN;
    return Math.round((to - from) / 86400000);
}

/** Complete calendar months between two dates (day-of-month aware). */
function monthsBetween(fromDate, toDate) {
    const fromMs = toDateMs(fromDate);
    const toMs = toDateMs(toDate);
    let a = new Date(Math.min(fromMs, toMs));
    const b = new Date(Math.max(fromMs, toMs));
    let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    if (b.getUTCDate() < a.getUTCDate()) months -= 1;
    return fromMs <= toMs ? months : -months;
}

/** Exact cost in paise for `quantityMi` micro-units at `costPerUnit`. */
function lotCostPaise(quantityMi, costPerUnit) {
    const uMi = BigInt(quantityMi);
    const nX = BigInt(Math.round(Number(costPerUnit) * NAV_SCALE));
    const prod = uMi * nX;
    const sign = prod < 0n ? -1n : 1n;
    const abs = prod < 0n ? -prod : prod;
    const q = abs / VALUE_SCALE;
    const r = abs % VALUE_SCALE;
    return Number(sign * (q + (r * 2n >= VALUE_SCALE ? 1n : 0n)));
}

/**
 * Match a sell against open buy lots FIFO.
 *
 * sell: { quantity, proceedsPaise, date }
 *   quantity      - units being sold (NAV precision is irrelevant; units only)
 *   proceedsPaise - gross sale proceeds in integer paise
 *   date          - sale date (for holding period)
 *
 * lots: [{ id?, openDate, quantity, costPerUnit }]  (open lots; not sorted by
 * caller - FIFO orders by openDate internally).
 *
 * opts.longTermMonths (default 12) controls the isLongTerm flag per lot.
 *
 * Returns:
 *   allocations:     [{ lotId, openDate, quantity, costPaise, proceedsPaise,
 *                       gainPaise, holdingDays, isLongTerm }]
 *   soldQuantity:    units matched (decimal)
 *   remainingQuantity: units of the sell left unmatched (decimal)
 */
function fifoLots(sell, lots, opts = {}) {
    const longTermMonths = opts.longTermMonths ?? 12;
    const sellQtyMi = Math.round(Number(sell.quantity) * UNIT_MICRO);
    const proceedsTotal = Math.round(Number(sell.proceedsPaise) || 0);
    const sellDate = sell.date;

    const openLots = (lots || [])
        .filter((l) => l && toMicroUnits(l.quantity) > 0)
        .sort((a, b) => toDateMs(a.openDate) - toDateMs(b.openDate));

    const allocations = [];
    let remainingMi = sellQtyMi;

    for (const lot of openLots) {
        if (remainingMi <= 0) break;
        const lotQtyMi = Math.round(Number(lot.quantity) * UNIT_MICRO);
        if (lotQtyMi <= 0) continue;
        const takeMi = Math.min(remainingMi, lotQtyMi);
        allocations.push({
            lotId: lot.id ?? null,
            openDate: lot.openDate,
            quantityMi: takeMi
        });
        remainingMi -= takeMi;
    }

    const soldMi = sellQtyMi - remainingMi;
    const hasAllocations = soldMi > 0;

    if (!hasAllocations) {
        return { allocations: [], soldQuantity: 0, remainingQuantity: toUnits(sellQtyMi) };
    }

    let assigned = 0;
    const completed = allocations.map((a, idx) => {
        const proceedsPaise = idx === allocations.length - 1
            ? proceedsTotal - assigned
            : mulDiv(proceedsTotal, a.quantityMi, soldMi);
        assigned += proceedsPaise;

        const lot = openLots[idx];
        const costPaise = lotCostPaise(a.quantityMi, lot.costPerUnit);
        const holdingDays = holdingPeriod(lot.openDate, sellDate);
        return {
            lotId: a.lotId,
            openDate: lot.openDate,
            quantity: toUnits(a.quantityMi),
            costPaise,
            proceedsPaise,
            gainPaise: proceedsPaise - costPaise,
            holdingDays,
            isLongTerm: monthsBetween(lot.openDate, sellDate) >= longTermMonths
        };
    });

    return {
        allocations: completed,
        soldQuantity: toUnits(soldMi),
        remainingQuantity: toUnits(remainingMi)
    };
}

function toMicroUnits(units) {
    return Math.round(Number(units) * UNIT_MICRO);
}

function toUnits(microUnits) {
    return Number(microUnits) / UNIT_MICRO;
}

module.exports = { holdingPeriod, monthsBetween, fifoLots };