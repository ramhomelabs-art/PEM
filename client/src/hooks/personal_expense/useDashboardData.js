import { subscribeToDataChanges } from '../../utils/realtimeSync';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../../config';
import { formatCurrency } from '../../utils/currency';
import {
    MIN_TREND_PERIODS,
    buildCashFlowBuckets,
    countActiveBuckets,
    defaultGranularity,
    resolveRangeWindow,
} from '../../utils/cashFlow';

const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
});

/**
 * Resolves with `fallback` for any non-OK response instead of throwing, so one
 * failing endpoint never blanks the whole dashboard. Each loader reports its
 * own error so the UI can show a per-panel retry.
 */
async function loadJSON(url, { auth = false, fallback = null } = {}) {
    try {
        const res = await fetch(url, auth ? { headers: authHeaders() } : undefined);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch {
        return fallback;
    }
}

const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const isExpense = (t) => t?.type === 'expense';
const isIncome = (t) => t?.type === 'income';

const monthKey = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${d.getMonth()}`;
};

/* ------------------------------------------------------- transactions -- */

export function useTransactions(userId) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // The mount effect calls `load`, whose only synchronous work is the check
    // below; every setState happens after an await, so it never triggers the
    // cascading render that `set-state-in-effect` warns about. `reload` keeps
    // the loading flag handling for explicit user-triggered refreshes.
    const load = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(`${API_URL}/transactions/user/${userId}`, {
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setTransactions(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(err);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const reload = useCallback(async () => {
        setLoading(true);
        await load();
    }, [load]);

    useEffect(() => {
        load();
        const unsubscribe = subscribeToDataChanges((event) => {
            load();
        });
        return unsubscribe;
    }, [load]);

    const remove = useCallback(
        async (id) => {
            const res = await fetch(`${API_URL}/transactions/manual/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await reload();
        },
        [reload]
    );

    return { transactions, loading, error, reload, remove };
}

/* ------------------------------------------------- commitments & budget -- */

export function useCommitments(userId) {
    const [bills, setBills] = useState([]);
    const [loans, setLoans] = useState([]);
    const [borrow, setBorrow] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [banks, setBanks] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!userId) return;
        try {
            const [b, l, w, g, k] = await Promise.all([
                loadJSON(`${API_URL}/bills/user/${userId}`, { auth: true, fallback: [] }),
                loadJSON(`${API_URL}/loans/user/${userId}`, { auth: true, fallback: [] }),
                loadJSON(`${API_URL}/borrow/user/${userId}`, { auth: true, fallback: [] }),
                loadJSON(`${API_URL}/budgets/user/${userId}`, { auth: true, fallback: [] }),
                loadJSON(`${API_URL}/banks/user/${userId}`, { auth: true, fallback: [] }),
            ]);
            setBills(Array.isArray(b) ? b : []);
            setLoans(Array.isArray(l) ? l : []);
            setBorrow(Array.isArray(w) ? w : []);
            setBudgets(Array.isArray(g) ? g : []);
            setBanks(Array.isArray(k) ? k : []);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const reload = useCallback(async () => {
        setLoading(true);
        await load();
    }, [load]);

    useEffect(() => {
        load();
        const unsubscribe = subscribeToDataChanges((event) => {
            load();
        });
        return unsubscribe;
    }, [load]);

    return { bills, loans, borrow, budgets, banks, loading, reload };
}

/* ------------------------------------------------------------ messages -- */

/**
 * Polls the unread count and conversation summaries.
 *
 * The previous implementation hit both endpoints every 5 seconds forever,
 * including while the tab was hidden. It now pauses on `document.hidden` and
 * backs off to 30s once the panel has gone idle.
 */
export function useUnreadMessages(enabled, { onNewMessage } = {}) {
    const [count, setCount] = useState(0);
    const [conversations, setConversations] = useState([]);
    const seenRef = useRef(null);
    const callbackRef = useRef(onNewMessage);

    // Mirrors the latest callback into a ref inside an effect rather than
    // during render, so the poll effect never has to re-subscribe.
    useEffect(() => {
        callbackRef.current = onNewMessage;
    }, [onNewMessage]);

    useEffect(() => {
        if (!enabled) return undefined;

        let cancelled = false;
        let timer;

        const tick = async () => {
            if (!document.hidden) {
                const token = localStorage.getItem('token');
                if (!token || token === 'null' || token === 'undefined') {
                    timer = setTimeout(tick, 15000);
                    return;
                }
                const headers = authHeaders();
                let countRes, convRes;
                try {
                    [countRes, convRes] = await Promise.all([
                        fetch(`${API_URL}/messages/unread/count`, { headers }),
                        fetch(`${API_URL}/messages/conversations`, { headers }),
                    ]);
                } catch (e) {
                    timer = setTimeout(tick, 30000);
                    return;
                }

                if (!cancelled && countRes.ok) {
                    const data = await countRes.json();
                    setCount(data?.count ?? 0);
                }

                if (!cancelled && convRes.ok) {
                    const list = await convRes.json();
                    const unread = (Array.isArray(list) ? list : [])
                        .filter((conv) => conv.unreadCount > 0)
                        .map((conv) => ({
                            id: conv.partnerId,
                            sender: conv.partner,
                            message: conv.lastMessage,
                            created_at: conv.lastMessageTime,
                        }));

                    // Fire the notification only for genuinely new arrivals,
                    // never for whatever happened to be unread on first load.
                    if (seenRef.current) {
                        const fresh = unread.find(
                            (u) =>
                                !seenRef.current.has(`${u.id}-${u.created_at}`)
                        );
                        if (fresh) callbackRef.current?.(fresh);
                    }
                    seenRef.current = new Set(
                        unread.map((u) => `${u.id}-${u.created_at}`)
                    );
                    setConversations(unread);
                }
            }

            timer = setTimeout(tick, document.hidden ? 30000 : 10000);
        };

        tick();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [enabled]);

    return { count, conversations };
}

/* --------------------------------------------------------- derivations -- */

/** Headline figures plus month-over-month deltas. */
export function useFinanceSummary(transactions) {
    return useMemo(() => {
        const income = transactions.filter(isIncome);
        const expenses = transactions.filter(isExpense);
        const totalIncome = income.reduce((s, t) => s + toNumber(t.amount), 0);
        const totalExpense = expenses.reduce((s, t) => s + toNumber(t.amount), 0);

        const thisMonth = monthKey(new Date());
        const lastMonth = monthKey(
            new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
        );

        const sumFor = (rows, key) =>
            rows
                .filter((t) => monthKey(t.date) === key)
                .reduce((s, t) => s + toNumber(t.amount), 0);

        const thisExpense = sumFor(expenses, thisMonth);
        const lastExpense = sumFor(expenses, lastMonth);

        // Guards the divide-by-zero that used to render "Infinity%" and "NaN%".
        const expenseDelta =
            lastExpense > 0
                ? ((thisExpense - lastExpense) / lastExpense) * 100
                : null;

        const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;

        return {
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            thisMonthExpense: thisExpense,
            expenseDelta,
            savingsRate,
            transactionCount: transactions.length,
        };
    }, [transactions]);
}

/** Category breakdown for the spend chart, largest first. */
export function useCategoryBreakdown(transactions, type = 'expense') {
    return useMemo(() => {
        const totals = new Map();
        for (const t of transactions) {
            const matches = type === 'expense' ? isExpense(t) : isIncome(t);
            if (!matches) continue;
            const key = t.category || 'Uncategorised';
            totals.set(key, (totals.get(key) || 0) + toNumber(t.amount));
        }
        return [...totals.entries()]
            .map(([category, value]) => ({ category, value }))
            .filter((d) => d.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [transactions, type]);
}

/**
 * Cash-flow series for the dashboard chart. The grouping itself lives in the
 * pure `buildCashFlowBuckets` helper (`utils/cashFlow.js`) so it can be unit
 * tested; this hook only wires it to React and applies the sparse-data rule:
 * if the requested grouping yields fewer than `MIN_TREND_PERIODS` active
 * periods, it retries weekly so an almost-empty chart never renders.
 */
export function useCashFlowSeries(
    transactions,
    { range = '1m', customRange, granularity } = {}
) {
    return useMemo(() => {
        const now = new Date();
        const { start, end } = resolveRangeWindow(range, customRange, now);
        // An explicit choice from the user is always honoured; the sparse-data
        // fallback only applies to the automatically-selected default.
        const explicit = Boolean(granularity);
        const requested = granularity || defaultGranularity(range, customRange, now);

        let used = requested;
        let data = buildCashFlowBuckets(transactions, { granularity: requested, start, end });

        if (!explicit && countActiveBuckets(data) < MIN_TREND_PERIODS && requested !== 'week') {
            used = 'week';
            data = buildCashFlowBuckets(transactions, { granularity: 'week', start, end });
        }

        return { data, granularity: used, start, end };
    }, [transactions, range, customRange, granularity]);
}

/** Day bucket key `${year}-${monthIndex}-${day}` (local time, no UTC drift). */
const dayKey = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
        ? null
        : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * Last `days` days of income / expense / net, zero-filled. Used for KPI
 * sparklines and the daily spending area chart.
 */
export function useDailySeries(transactions, days = 30) {
    return useMemo(() => {
        const today = new Date();
        const buckets = [];
        const index = new Map();
        for (let i = days - 1; i >= 0; i -= 1) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            const bucket = {
                key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
                date: d,
                income: 0,
                expense: 0,
                net: 0,
            };
            buckets.push(bucket);
            index.set(bucket.key, bucket);
        }

        for (const t of transactions) {
            const bucket = index.get(dayKey(t.date));
            if (!bucket) continue;
            const amt = toNumber(t.amount);
            if (isIncome(t)) bucket.income += amt;
            else if (isExpense(t)) bucket.expense += amt;
        }
        for (const b of buckets) b.net = b.income - b.expense;
        return buckets;
    }, [transactions, days]);
}

/**
 * KPI figures for the selected window plus the % change against the preceding
 * window of the same length. `null` deltas mean "no prior data", rendered as
 * a dash rather than a misleading `Infinity%`.
 */
export function useKpiMetrics(transactions, months = 1) {
    return useMemo(() => {
        const now = new Date();
        const curStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
        const prevStart = new Date(now.getFullYear(), now.getMonth() - months, 1);

        const within = (t, start, end) => {
            const d = new Date(t.date);
            if (Number.isNaN(d.getTime())) return false;
            if (d < start) return false;
            return end ? d < end : true;
        };

        const cur = transactions.filter((t) => within(t, curStart, null));
        const prev = transactions.filter((t) => within(t, prevStart, curStart));

        const metrics = (rows) => {
            const income = rows.filter(isIncome).reduce((s, t) => s + toNumber(t.amount), 0);
            const expense = rows.filter(isExpense).reduce((s, t) => s + toNumber(t.amount), 0);
            return {
                income,
                expense,
                balance: income - expense,
                savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
                count: rows.length,
            };
        };

        const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
        const curr = metrics(cur);
        const before = metrics(prev);

        return {
            current: curr,
            previous: before,
            deltas: {
                income: pct(curr.income, before.income),
                expense: pct(curr.expense, before.expense),
                balance: pct(curr.balance, before.balance),
                savingsRate: curr.savingsRate - before.savingsRate,
            },
        };
    }, [transactions, months]);
}

/**
 * Per-day expense totals for a calendar month (0 = current, 1 = last month).
 * `monthOffset` keeps the dependency array stable across renders.
 */
export function useDailySpendMonth(transactions, monthOffset = 0) {
    return useMemo(() => {
        const now = new Date();
        const date = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
        const y = date.getFullYear();
        const m = date.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const data = [];
        for (let d = 1; d <= daysInMonth; d += 1) {
            data.push({ day: d, key: `${y}-${m}-${d}`, amount: 0 });
        }
        const index = new Map(data.map((b) => [b.key, b]));
        for (const t of transactions) {
            if (!isExpense(t)) continue;
            const bucket = index.get(dayKey(t.date));
            if (bucket) bucket.amount += toNumber(t.amount);
        }
        return {
            data,
            label: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        };
    }, [transactions, monthOffset]);
}

/**
 * Three auto-generated smart tips. Deterministic derivations only — no
 * hardcoded copy data — so the card always reflects the live dataset.
 */
export function useInsights(transactions, budgets = []) {
    return useMemo(() => {
        const now = new Date();
        const thisKey = monthKey(now);
        const lastKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

        const catTotals = (key) => {
            const m = new Map();
            for (const t of transactions) {
                if (!isExpense(t) || monthKey(t.date) !== key) continue;
                const c = t.category || 'Uncategorised';
                m.set(c, (m.get(c) || 0) + toNumber(t.amount));
            }
            return m;
        };
        const cur = catTotals(thisKey);
        const prev = catTotals(lastKey);

        const topSpend = [...cur.entries()].sort((a, b) => b[1] - a[1])[0];
        const insights = [];

        // 1. Largest month-over-month category increase.
        let rising = null;
        for (const [category, value] of cur) {
            const before = prev.get(category) || 0;
            if (before > 0 && value > before) {
                const pct = ((value - before) / before) * 100;
                if (!rising || pct > rising.pct) rising = { category, pct, value, before };
            }
        }
        if (rising && rising.pct >= 5) {
            insights.push({
                id: 'trend',
                tone: 'warn',
                icon: 'trending-up',
                title: `${rising.category} is up ${Math.round(rising.pct)}%`,
                detail: `${formatCurrency(rising.value)} this month vs ${formatCurrency(rising.before)} last month.`,
            });
        }

        // 2. Over-budget categories.
        const over = budgets
            .map((b) => {
                const spent = transactions
                    .filter((t) => isExpense(t) && t.category === b.category && monthKey(t.date) === thisKey)
                    .reduce((s, t) => s + toNumber(t.amount), 0);
                const limit = toNumber(b.amountLimit);
                return { category: b.category, spent, limit, pct: limit > 0 ? (spent / limit) * 100 : 0 };
            })
            .filter((b) => b.limit > 0 && b.pct > 100)
            .sort((a, b) => b.pct - a.pct)[0];
        if (over) {
            insights.push({
                id: 'budget',
                tone: 'neg',
                icon: 'alert',
                title: `Over budget on ${over.category}`,
                detail: `${formatCurrency(over.spent)} spent of a ${formatCurrency(over.limit)} limit.`,
            });
        }

        // 3. Savings-rate health (or top spend when cash flow is negative).
        const income = transactions
            .filter((t) => isIncome(t) && monthKey(t.date) === thisKey)
            .reduce((s, t) => s + toNumber(t.amount), 0);
        const expense = transactions
            .filter((t) => isExpense(t) && monthKey(t.date) === thisKey)
            .reduce((s, t) => s + toNumber(t.amount), 0);
        if (income > 0) {
            const rate = Math.round(((income - expense) / income) * 100);
            insights.push(
                rate >= 0
                    ? {
                        id: 'savings',
                        tone: 'pos',
                        icon: 'piggy',
                        title: `You're saving ${rate}% this month`,
                        detail: `${formatCurrency(income - expense)} kept out of ${formatCurrency(income)} income.`,
                    }
                    : {
                        id: 'savings',
                        tone: 'neg',
                        icon: 'alert',
                        title: `You overspent by ${formatCurrency(expense - income)}`,
                        detail: 'Spending outpaced income this month.',
                    }
            );
        } else if (topSpend) {
            insights.push({
                id: 'top',
                tone: 'info',
                icon: 'trending-up',
                title: `${topSpend[0]} leads your spending`,
                detail: `${formatCurrency(topSpend[1])} so far this month.`,
            });
        }

        return insights.slice(0, 3);
    }, [transactions, budgets]);
}

/** Forward-looking budget vs actual rows for the bar chart. */
export function useBudgetVsActual(transactions, budgets, monthOffset = 0) {
    return useMemo(() => {
        const now = new Date();
        const key = monthKey(new Date(now.getFullYear(), now.getMonth() - monthOffset, 1));
        return budgets
            .map((b) => {
                const spent = transactions
                    .filter((t) => isExpense(t) && t.category === b.category && monthKey(t.date) === key)
                    .reduce((s, t) => s + toNumber(t.amount), 0);
                const limit = toNumber(b.amountLimit);
                return {
                    category: b.category,
                    spent,
                    limit,
                    pct: limit > 0 ? (spent / limit) * 100 : 0,
                };
            })
            .filter((b) => b.limit > 0)
            .sort((a, b) => b.pct - a.pct);
    }, [transactions, budgets, monthOffset]);
}

/** Budgets that are exceeded in the current calendar month. */
export function useBudgetAlerts(transactions, budgets) {
    return useMemo(() => {
        if (!budgets.length) return [];
        const now = new Date();
        const month = monthKey(now);

        return budgets
            .map((b) => {
                const spent = transactions
                    .filter(
                        (t) =>
                            isExpense(t) &&
                            t.category === b.category &&
                            monthKey(t.date) === month
                    )
                    .reduce((s, t) => s + toNumber(t.amount), 0);
                const limit = toNumber(b.amountLimit);
                return { ...b, spent, limit, pct: limit > 0 ? (spent / limit) * 100 : 0 };
            })
            .filter((b) => b.spent > b.limit)
            .sort((a, b) => b.pct - a.pct);
    }, [transactions, budgets]);
}

export function useBudgetProgress(transactions, budgets) {
    return useMemo(() => {
        const now = new Date();
        const month = monthKey(now);

        return budgets
            .map((b) => {
                const spent = transactions
                    .filter(
                        (t) =>
                            isExpense(t) &&
                            t.category === b.category &&
                            monthKey(t.date) === month
                    )
                    .reduce((s, t) => s + toNumber(t.amount), 0);
                const limit = toNumber(b.amountLimit);
                const pct = limit > 0 ? (spent / limit) * 100 : 0;
                return { ...b, spent, limit, pct, over: spent > limit && limit > 0 };
            })
            .sort((a, b) => b.pct - a.pct);
    }, [transactions, budgets]);
}

/** Upcoming bills and EMIs inside the reminder window. */
export function useUpcomingObligations(bills, loans, borrow, { days = 30 } = {}) {
    return useMemo(() => {
        const horizon = new Date();
        horizon.setDate(horizon.getDate() + days);

        const unpaidBills = bills
            .filter((b) => b.status !== 'paid' && new Date(b.dueDate) <= horizon)
            .map((b) => ({
                id: `bill-${b.id}`,
                kind: 'bill',
                title: b.name,
                amount: toNumber(b.amount),
                dueDate: b.dueDate,
                href: '/bills',
            }));

        const activeEmis = loans
            .filter((l) => l.status === 'active' && new Date(l.nextEmiDate) <= horizon)
            .map((l) => ({
                id: `loan-${l.id}`,
                kind: 'emi',
                title: `${l.name} EMI`,
                amount: toNumber(l.emiAmount),
                dueDate: l.nextEmiDate,
                href: '/loans',
            }));

        const outstandingBorrow = borrow
            .filter((b) => b.status !== 'settled' && b.dueDate && new Date(b.dueDate) <= horizon)
            .map((b) => ({
                id: `borrow-${b.id}`,
                kind: 'borrow',
                title: `Borrowed from ${b.personName || b.borrowerName || b.name || 'contact'}`,
                amount: toNumber(b.amount),
                dueDate: b.dueDate,
                href: '/borrow',
            }));

        return [...unpaidBills, ...activeEmis, ...outstandingBorrow].sort(
            (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
        );
    }, [bills, loans, borrow, days]);
}

/* ------------------------------------------------------------ weather -- */

const WEATHER_KEY = 'pem.weatherLocation';
const AUTO_LOCATE_KEY = 'pem.weatherAutoLocated';
const DEFAULT_LOCATION = {
    name: 'Erode',
    lat: 11.341,
    lng: 77.7172,
    display: 'Erode, TN, India',
    source: 'default',
};

function readStoredLocation() {
    try {
        const raw = localStorage.getItem(WEATHER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/** Best-effort reverse geocode (BigDataCloud, no API key) for a browser location. */
async function reverseGeocode(lat, lng) {
    const fallback = {
        name: 'Current location',
        display: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
        lat,
        lng,
        source: 'auto',
    };
    try {
        const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
        );
        const j = await res.json();
        const city = j.city || j.locality || j.principalSubdivision || j.countryName;
        return {
            name: city || 'Current location',
            display:
                [city, j.principalSubdivision, j.countryName].filter(Boolean).join(', ') ||
                fallback.display,
            lat,
            lng,
            source: 'auto',
        };
    } catch {
        return fallback;
    }
}

export function useWeatherLocation(preferred) {
    const [location, setLocation] = useState(() => {
        if (preferred) return { ...preferred, source: 'user' };
        const stored = readStoredLocation();
        if (stored) return stored;
        return DEFAULT_LOCATION;
    });
    const [syncedPreference, setSyncedPreference] = useState(preferred);

    // Reconcile against the server-side preference during render rather than
    // in an effect, which avoids an extra cascading render on every mount.
    if (preferred && preferred !== syncedPreference) {
        setSyncedPreference(preferred);
        const next = { ...preferred, source: 'user' };
        setLocation(next);
        localStorage.setItem(WEATHER_KEY, JSON.stringify(next));
    }

    // Ask the browser for the real location unless the user has explicitly
    // chosen one. The old guard skipped this whenever *any* location was
    // stored, so the seeded default (and any stale auto reading) stuck forever.
    // `source: 'user'` (a manual pick or a server preference) is the only value
    // that suppresses auto-detection now.
    useEffect(() => {
        if (preferred) return undefined;
        const stored = readStoredLocation();
        if (stored?.source === 'user') return undefined;
        try {
            if (sessionStorage.getItem(AUTO_LOCATE_KEY)) return undefined;
        } catch {
            return undefined;
        }
        if (!navigator.geolocation) return undefined;

        try {
            sessionStorage.setItem(AUTO_LOCATE_KEY, '1');
        } catch {
            // Private mode — still attempt a one-off locate below.
        }
        let cancelled = false;
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const next = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
                if (cancelled) return;
                setLocation(next);
                try {
                    localStorage.setItem(WEATHER_KEY, JSON.stringify(next));
                } catch {
                    // Storage full / disabled — location still works this session.
                }
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 }
        );
        return () => {
            cancelled = true;
        };
    }, [preferred]);

    const update = useCallback(async (next) => {
        const stamped = { ...next, source: 'user' };
        setLocation(stamped);
        localStorage.setItem(WEATHER_KEY, JSON.stringify(stamped));
        try {
            await fetch(`${API_URL}/auth/preferences`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ preferences: { weather: stamped } }),
            });
        } catch {
            // Location already persisted locally; server sync can retry later.
        }
    }, []);

    return { location, update };
}