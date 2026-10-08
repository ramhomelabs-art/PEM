const symbolMap = {
    USD: '$',
    INR: '₹',
    GBP: '£',
    EUR: '€',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    AED: 'د.إ',
    SGD: 'S$',
};

// Currencies whose default grouping differs from the en-US pattern.
const groupingLocale = { INR: 'en-IN' };

export const symbolFor = (currencyCode = 'INR') =>
    symbolMap[currencyCode] || currencyCode || '₹';

/**
 * THE canonical money formatter for the whole app.
 *
 * The dashboard specification requires a single `Intl.NumberFormat` built with
 * the Indian number grouping (`en-IN`) and INR. This wrapper keeps every other
 * screen working (it accepts any ISO currency code) while guaranteeing that no
 * caller ever has to hand-roll `toFixed` or string concatenation again.
 *
 *   formatCurrency(1234.5)            -> "₹1,234.5"
 *   formatCurrency(1234.5, 'USD')     -> "US$1,234.5"  (en-IN locale)
 *   formatCurrency(124000, 'INR', { compact: true }) -> "₹1.24L"
 */
export function formatCurrency(value, currencyCode = 'INR', options = {}) {
    const { compact = false, decimals = 2, signed = false } = options;

    const num = Number(value);
    if (!Number.isFinite(num)) {
        return `${signed ? '+' : ''}${symbolFor(currencyCode)}0`;
    }

    const locale = groupingLocale[currencyCode] || 'en-IN';

    let formatted;
    try {
        formatted = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            notation: compact ? 'compact' : 'standard',
            minimumFractionDigits: 0,
            maximumFractionDigits: compact ? 1 : decimals,
        }).format(num);
    } catch {
        // Unknown / exotic currency code: fall back to a safe manual format.
        const body = num.toLocaleString(locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: compact ? 1 : decimals,
        });
        formatted = `${symbolFor(currencyCode)}${body}`;
    }

    return signed && num > 0 ? `+${formatted}` : formatted;
}

/** Compact form used only on chart axes / tight tiles. */
export function formatCompact(value, currencyCode = 'INR') {
    return formatCurrency(value, currencyCode, { compact: true });
}

/**
 * India-first investments shortcut: INR-only, standard grouping.
 *   inr(1234.5)       -> "₹1,234.5"
 *   inr(1234.5, { compact: true }) -> "₹1.23K"
 */
export const inr = (value, options = {}) => formatCurrency(value, 'INR', options);

/** Compact INR for chart axes / tight tiles. */
export const inrCompact = (value) => formatCurrency(value, 'INR', { compact: true });

/**
 * Backwards-compatible alias. Some widgets still call
 * `formatMoney(v, currency, { compact: true })`; route that through the same
 * canonical implementation so the output is identical everywhere.
 */
export function formatMoney(value, currencyCode = 'INR', options = {}) {
    return formatCurrency(value, currencyCode, options);
}

/**
 * Percentage that stays readable for both tiny and extreme ratios.
 * Guards the 0/0 case that previously produced `NaN%` on empty datasets.
 */
export function formatPercent(value, { decimals = 1, signed = false } = {}) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0%';
    const sign = signed && num > 0 ? '+' : '';
    return `${sign}${num.toFixed(decimals)}%`;
}

/** Date formatting that never renders "Invalid Date" to the user. */
export function formatDate(value, options) {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, options);
}

/** Whole-day distance, used for "due in 3 days" / "12 days late" copy. */
export function daysUntil(value) {
    if (!value) return null;
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return null;
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((startOfDay(target) - startOfDay(new Date())) / 86400000);
}

/** Relative day label: Today / Tomorrow / in 5 days / 3 days ago. */
export function relativeDayLabel(value) {
    const diff = daysUntil(value);
    if (diff === null) return '—';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 0) return `in ${diff} days`;
    return `${Math.abs(diff)} days ago`;
}

export { symbolMap };

/** Legacy alias retained for the pages that still import `formatCurrency`. */
export { formatCurrency as default };
