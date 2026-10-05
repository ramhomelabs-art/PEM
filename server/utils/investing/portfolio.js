/**
 * Portfolio aggregates. All amounts are integer paise; unit counts tolerate
 * the DB's NUMERIC(18,6) precision and NAVs NUMERIC(18,4). Value math scales
 * both to integers before dividing, so no float rounding can leak in.
 */

const UNIT_MICRO = 1e6; // units x 1e6 (matches NUMERIC(18,6))
const NAV_SCALE = 1e4;  // nav x 1e4 (matches NUMERIC(18,4))
// units x 1e6 * nav x 1e4 = value rupees x 1e10; dividing by 1e8 yields paise.
const VALUE_SCALE = 10n ** 8n;

function toMicroUnits(units) {
    return Math.round(Number(units) * UNIT_MICRO);
}

/** Exact value in paise of `quantity` units priced at `nav`. */
function lotValuePaise(quantity, nav) {
    const uMi = BigInt(toMicroUnits(quantity));
    const nX = BigInt(Math.round(Number(nav) * NAV_SCALE));
    const prod = uMi * nX; // rupees x 1e10
    const sign = prod < 0n ? -1n : 1n;
    const abs = prod < 0n ? -prod : prod;
    const q = abs / VALUE_SCALE;
    const r = abs % VALUE_SCALE;
    const rounded = q + (r * 2n >= VALUE_SCALE ? 1n : 0n);
    return Number(sign * rounded);
}

/**
 * Value of a set of holdings: [{ quantity, nav }].
 * `nav` is the latest NAV/price per unit for each holding.
 */
function currentValue(holdings) {
    if (!Array.isArray(holdings)) return 0;
    return holdings.reduce((sum, h) => sum + lotValuePaise(h.quantity, h.nav), 0);
}

/**
 * Net capital deployed, paise.
 * txns: [{ type, amount }] with `amount` in integer paise (absolute value is
 * used; sign is derived from the type).
 *   money-in:  buy, sip
 *   money-out: sell
 *   neutral (ignored): switch, dividend, bonus, split
 * Note: dividend payouts are returns on capital, not capital itself, and
 * switch/bonus/split restructure units without moving net capital.
 */
function invested(txns) {
    if (!Array.isArray(txns)) return 0;
    return txns.reduce((sum, t) => {
        const amount = Math.abs(Math.round(Number(t.amount) || 0));
        if (t.type === 'buy' || t.type === 'sip') return sum + amount;
        if (t.type === 'sell') return sum - amount;
        return sum;
    }, 0);
}

/** Unrealised gain in paise (positive = profit, negative = loss). */
function unrealisedGain(currentValuePaise, investedPaise) {
    return Number(currentValuePaise) - Number(investedPaise);
}

module.exports = { lotValuePaise, currentValue, invested, unrealisedGain, toMicroUnits };