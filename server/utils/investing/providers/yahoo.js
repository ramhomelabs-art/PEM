/**
 * Yahoo Finance adapter for stocks / ETFs (and any asset with an assetCode
 * ticker). Mirrors the existing codebase convention:
 *   const YahooFinance = require('yahoo-finance2').default;
 */

const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

function toMs(input) {
    if (input instanceof Date) return input.getTime();
    if (typeof input === 'number') return input;
    const s = String(input);
    if (s.length <= 10) return new Date(`${s}T00:00:00Z`).getTime();
    return new Date(s).getTime();
}

const toEpochSeconds = (input) => Math.floor(toMs(input) / 1000);

/** Date-ish -> 'YYYY-MM-DD' (UTC). */
function toYmd(input) {
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    const d = new Date(toMs(input));
    return d.toISOString().slice(0, 10);
}

/** Latest quote for a symbol. Throws when Yahoo has no quote. */
async function fetchQuote(symbol) {
    const q = await yahooFinance.quote(String(symbol).trim());
    if (!q || typeof q.regularMarketPrice !== 'number' || !Number.isFinite(q.regularMarketPrice)) {
        throw new Error(`No quote data for symbol ${symbol}`);
    }
    return {
        price: q.regularMarketPrice,
        currency: q.currency || 'INR',
        time: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : null,
        name: q.shortName || q.longName || null
    };
}

/**
 * Daily bars between period1 and period2 (Date / ms / 'YYYY-MM-DD').
 * Returns [{ date, open, high, low, close, volume }] newest-last, filtering
 * bars Yahoo marks as null-close (no trade / halts).
 */
async function fetchHistorical(symbol, period1, period2) {
    const rows = await yahooFinance.historical(
        { symbol: String(symbol).trim(), period1: toEpochSeconds(period1), period2: toEpochSeconds(period2), interval: '1d' },
        { validateResult: false }
    );
    return (rows || [])
        .filter((r) => Number.isFinite(Number(r.close)))
        .map((r) => ({
            date: toYmd(r.date),
            open: Number(r.open) || 0,
            high: Number(r.high) || 0,
            low: Number(r.low) || 0,
            close: Number(r.close),
            volume: Number(r.volume) || 0
        }));
}

module.exports = { fetchQuote, fetchHistorical, toYmd };