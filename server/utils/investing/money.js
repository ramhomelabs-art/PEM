/**
 * Integer-paise money helpers. Currency amounts are NEVER stored or computed
 * as floats: DB columns are exact NUMERIC and the API layer converts to
 * integer paise (via toPaise) before any computation. All results here are
 * exact integers rounded half-away-from-zero.
 */

const PAISE_PER_RUPEE = 100;

/** Round half away from zero (banker-safe for money). */
function roundHalfAway(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return (n < 0 ? -1 : 1) * Math.round(Math.abs(n));
}

/** Exact rupee decimal -> integer paise (half-up at the paisa boundary). */
function toPaise(rupees) {
    return roundHalfAway(Number(rupees) * PAISE_PER_RUPEE);
}

/** Integer paise -> rupee decimal (for display; never used for math). */
function fromPaise(paise) {
    return Number(paise) / PAISE_PER_RUPEE;
}

/** Exact integer multiply + divide with half-away rounding (BigInt-backed). */
function mulDiv(paise, numerator, denominator) {
    if (Number(denominator) === 0) {
        throw new Error('mulDiv: divide by zero');
    }
    const p = BigInt(Math.round(Number(paise) || 0));
    const n = BigInt(Math.round(Number(numerator) || 0));
    const d = BigInt(Math.round(Number(denominator) || 0));
    const neg = p !== 0n && (p < 0n) !== (n < 0n);
    const a = p < 0n ? -p : p;
    const b = n < 0n ? -n : n;
    const prod = a * b;
    const q = prod / d;
    const r = prod % d;
    let out = q + (r * 2n >= d ? 1n : 0n);
    if (neg) out = -out;
    return Number(out);
}

module.exports = { PAISE_PER_RUPEE, roundHalfAway, toPaise, fromPaise, mulDiv };