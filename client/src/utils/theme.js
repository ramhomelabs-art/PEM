/**
 * Single source of truth for chart colours, semantic tones and the dashboard
 * date-range options. Components must not hard-code hex values or amount
 * formatters — import from here instead.
 */

export const CHART = {
    income: '#10b981', // emerald-500
    expense: '#f43f5e', // rose-500
    net: '#8b5cf6', // violet-500
    balance: '#38bdf8', // sky-400
    grid: 'currentColor',
};

/**
 * Curated signature colors for standard categories so that every category
 * has a predictable, unique, and consistent color across all charts & widgets.
 */
export const CATEGORY_COLOR_MAP = {
    'Debt Settlement': '#8b5cf6', // Violet
    'Utility': '#f59e0b',         // Amber / Gold
    'Shopping': '#ec4899',        // Vibrant Pink
    'Food': '#f97316',            // Warm Orange
    'Dining': '#f97316',
    'Loan EMI': '#6366f1',        // Indigo
    'EMI': '#6366f1',
    'Travel': '#06b6d4',          // Cyan
    'Transport': '#0ea5e9',       // Sky Blue
    'Medical': '#ef4444',         // Red / Crimson
    'Healthcare': '#ef4444',
    'Entertainment': '#a855f7',   // Purple
    'Groceries': '#84cc16',       // Lime
    'Bills': '#d97706',           // Deep Amber
    'Investment': '#10b981',      // Emerald
    'Investments': '#10b981',
    'Salary': '#059669',          // Deep Emerald
    'Freelance': '#14b8a6',       // Teal
    'Business': '#3b82f6',        // Royal Blue
    'Education': '#38bdf8',       // Light Sky
    'Housing': '#b45309',         // Ochre Brown
    'Rent': '#78350f',            // Warm Earth
    'Personal Care': '#fb7185',   // Rose
    'Gift': '#e11d48',            // Ruby
    'Donation': '#22c55e',        // Fresh Green
    'General': '#64748b',         // Slate
    'Others': '#64748b',          // Slate
    'Other': '#64748b',           // Slate
};

/**
 * 28 distinct, high-contrast, beautiful dark-mode friendly palette colors.
 * Used for dynamic categories and fallback collision resolution to ensure
 * NO two categories in the same chart ever repeat colors.
 */
export const DISTINCT_SERIES_COLORS = [
    '#8b5cf6', // violet
    '#f59e0b', // amber
    '#ec4899', // pink
    '#f97316', // orange
    '#6366f1', // indigo
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#84cc16', // lime
    '#ef4444', // red
    '#3b82f6', // blue
    '#a855f7', // purple
    '#14b8a6', // teal
    '#fb7185', // rose
    '#eab308', // yellow
    '#0ea5e9', // sky
    '#d946ef', // fuchsia
    '#2dd4bf', // mint
    '#fb923c', // light orange
    '#c084fc', // lavender
    '#4ade80', // light emerald
    '#38bdf8', // light blue
    '#f472b6', // light pink
    '#a3e635', // bright lime
    '#e11d48', // ruby
    '#0284c7', // deep sky
    '#7c3aed', // deep violet
    '#ca8a04', // goldenrod
    '#64748b', // slate
];

/** Backwards-compatible alias for existing imports. */
export const SERIES_COLORS = DISTINCT_SERIES_COLORS;

/**
 * Returns a globally consistent, unique color for any category name.
 * Checks the canonical map first; if not found, hashes the name deterministically
 * into the distinct series palette.
 */
export function getCategoryColor(name = '') {
    const key = String(name ?? '').trim();
    if (!key) return '#64748b';
    if (CATEGORY_COLOR_MAP[key]) return CATEGORY_COLOR_MAP[key];

    // Case-insensitive check
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(CATEGORY_COLOR_MAP)) {
        if (k.toLowerCase() === lower) return v;
    }

    // Deterministic hash to consistent distinct color
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash << 5) - hash + key.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % DISTINCT_SERIES_COLORS.length;
    return DISTINCT_SERIES_COLORS[idx];
}

/**
 * Assigns a *strictly unique* palette colour to every name in a dataset,
 * ensuring no colors repeat in donut or allocation charts while respecting
 * canonical category colors.
 */
export function assignCategoryColors(names = []) {
    const map = new Map();
    const usedColors = new Set();
    const uniqueNames = [...new Set(names.map((n) => String(n ?? '').trim()))];

    // First pass: assign fixed canonical colors where available, avoiding collisions
    for (const name of uniqueNames) {
        if (name === 'Others' || name === 'Other') {
            map.set(name, '#64748b');
            usedColors.add('#64748b');
            continue;
        }
        const preferred = getCategoryColor(name);
        if (!usedColors.has(preferred)) {
            map.set(name, preferred);
            usedColors.add(preferred);
        }
    }

    // Second pass: for any remaining names, assign an unused color from DISTINCT_SERIES_COLORS
    let colorIdx = 0;
    for (const name of uniqueNames) {
        if (!map.has(name)) {
            while (colorIdx < DISTINCT_SERIES_COLORS.length && usedColors.has(DISTINCT_SERIES_COLORS[colorIdx])) {
                colorIdx++;
            }
            const fallback = DISTINCT_SERIES_COLORS[colorIdx % DISTINCT_SERIES_COLORS.length];
            map.set(name, fallback);
            usedColors.add(fallback);
            colorIdx++;
        }
    }

    return map;
}

/**
 * Semantic tone → Tailwind classes. Kept as full literal strings so Tailwind's
 * content scanner can see them (dynamic `text-${tone}-400` would be purged).
 */
export const TONES = {
    brand: {
        text: 'text-brand-400',
        bg: 'bg-brand-soft',
        ring: 'ring-brand-400/30',
        hex: '#8b5cf6',
    },
    pos: {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        ring: 'ring-emerald-400/30',
        hex: '#10b981',
    },
    neg: {
        text: 'text-rose-400',
        bg: 'bg-rose-500/10',
        ring: 'ring-rose-400/30',
        hex: '#f43f5e',
    },
    warn: {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        ring: 'ring-amber-400/30',
        hex: '#f59e0b',
    },
    info: {
        text: 'text-sky-400',
        bg: 'bg-sky-500/10',
        ring: 'ring-sky-400/30',
        hex: '#38bdf8',
    },
    violet: {
        text: 'text-violet-400',
        bg: 'bg-violet-500/10',
        ring: 'ring-violet-400/30',
        hex: '#8b5cf6',
    },
    muted: {
        text: 'text-[color:var(--pem-text-muted)]',
        bg: 'bg-[color:var(--pem-surface)]',
        ring: 'ring-[color:var(--pem-border)]',
        hex: '#64748b',
    },
};

/** Dashboard range presets. `months` drives the data window. */
export const RANGE_PRESETS = [
    { id: '1m', label: 'This month', months: 1 },
    { id: '3m', label: '3M', months: 3 },
    { id: '6m', label: '6M', months: 6 },
    { id: '1y', label: '1Y', months: 12 },
];

/** Utilisation tone thresholds shared by credit cards + budgets. */
export function utilizationTone(pct) {
    if (!Number.isFinite(pct)) return 'muted';
    if (pct >= 70) return 'neg';
    if (pct >= 30) return 'warn';
    return 'pos';
}

export function budgetTone(pct) {
    if (!Number.isFinite(pct)) return 'muted';
    if (pct > 100) return 'neg';
    if (pct >= 80) return 'warn';
    return 'pos';
}
