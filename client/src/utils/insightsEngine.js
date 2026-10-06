import { formatCurrency } from './currency.js';

/**
 * Calculates savings rate matching the exact KPI cards formula:
 * (income - expense) / income * 100
 */
export function calculateSavingsRate(income, expense) {
    const inc = Number(income) || 0;
    const exp = Number(expense) || 0;
    if (inc <= 0) return 0;
    return ((inc - exp) / inc) * 100;
}

const monthKey = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const dayKey = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isExpense = (t) => t.type === 'expense' || !t.type;
const isIncome = (t) => t.type === 'income';
const toNumber = (v) => Math.abs(Number(v) || 0);

const SEVERITY_ORDER = {
    warning: 4,
    opportunity: 3,
    positive: 2,
    info: 1,
};

/**
 * Generates ranked financial insights strictly according to rules:
 * - Budget >= 90% or projected to exceed by month-end (with "at limit" for <2% trivial overage)
 * - Category up or down >= 20% vs last month
 * - Unusually large transaction (> 2x category average)
 * - Possible new recurring charge (same merchant, similar amount, 2+ months)
 * - No-spend day streak
 * - Savings rate trend matching KPI calculation
 *
 * @param {Object} params
 * @param {Array} params.transactions List of transactions
 * @param {Array} params.budgets List of budget targets
 * @param {Date} [params.now=new Date()] Reference date for deterministic evaluations
 * @param {string} [params.currency='INR'] Target currency code
 * @returns {Array} At most 4 ranked insight objects
 */
export function generateInsights({
    transactions = [],
    budgets = [],
    now = new Date(),
    currency = 'INR',
} = {}) {
    if (!Array.isArray(transactions) || !transactions.length) {
        return [];
    }

    const refDate = now instanceof Date ? now : new Date(now);
    const y = refDate.getFullYear();
    const m = refDate.getMonth();
    const thisKey = monthKey(refDate);
    const prevDate = new Date(y, m - 1, 1);
    const lastKey = monthKey(prevDate);

    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const currentDay = Math.min(refDate.getDate(), daysInMonth);
    const monthShort = refDate.toLocaleString('en-US', { month: 'short' });

    const insights = [];

    // 1. Budget rules: >= 90% or projected to exceed
    if (Array.isArray(budgets) && budgets.length > 0) {
        for (const b of budgets) {
            const limit = Number(b.amountLimit) || 0;
            if (limit <= 0) continue;

            const cat = b.category;
            const spent = transactions
                .filter((t) => isExpense(t) && t.category === cat && monthKey(t.date) === thisKey)
                .reduce((sum, t) => sum + toNumber(t.amount), 0);

            if (spent <= 0) continue;

            const utilization = (spent / limit) * 100;
            const dailyRate = spent / Math.max(1, currentDay);
            const projected = Math.round(dailyRate * daysInMonth);
            const isOver = spent > limit;
            const overagePct = isOver ? (spent - limit) / limit : 0;

            if (isOver) {
                if (overagePct < 0.02) {
                    // Trivial overage (< 2%): use "at limit" wording instead of warning
                    insights.push({
                        id: `budget-at-limit-${cat}`,
                        severity: 'warning',
                        title: `${cat} at budget limit`,
                        detail: `Spent ${formatCurrency(spent, currency)} of ${formatCurrency(limit, currency)} limit.`,
                        metric: formatCurrency(spent, currency),
                        trend: `${Math.round(utilization)}% of limit`,
                        sortWeight: 1000 + spent,
                    });
                } else {
                    insights.push({
                        id: `budget-over-${cat}`,
                        severity: 'warning',
                        title: `Over budget on ${cat}`,
                        detail: `Exceeded ${formatCurrency(limit, currency)} limit by ${formatCurrency(spent - limit, currency)}.`,
                        metric: formatCurrency(spent, currency),
                        trend: `+${Math.round(utilization - 100)}% over`,
                        sortWeight: 2000 + (spent - limit),
                    });
                }
            } else if (utilization >= 90) {
                insights.push({
                    id: `budget-near-${cat}`,
                    severity: 'warning',
                    title: `${cat} near budget limit`,
                    detail: `Spent ${formatCurrency(spent, currency)} (${Math.round(utilization)}%) of ${formatCurrency(limit, currency)} limit.`,
                    metric: formatCurrency(spent, currency),
                    trend: `${Math.round(utilization)}% of limit`,
                    sortWeight: 900 + spent,
                });
            } else if (projected > limit) {
                insights.push({
                    id: `budget-pace-${cat}`,
                    severity: 'warning',
                    title: `${cat} pace warning`,
                    detail: `At this pace ${cat} will reach ${formatCurrency(projected, currency)} by ${daysInMonth} ${monthShort}.`,
                    metric: formatCurrency(projected, currency),
                    trend: `Proj. ${Math.round((projected / limit) * 100)}%`,
                    sortWeight: 800 + (projected - limit),
                });
            }
        }
    }

    // 2. Category up or down >= 20% vs last month
    const curCatMap = new Map();
    const prevCatMap = new Map();

    for (const t of transactions) {
        if (!isExpense(t)) continue;
        const mk = monthKey(t.date);
        const cat = t.category || 'General';
        const amt = toNumber(t.amount);

        if (mk === thisKey) {
            curCatMap.set(cat, (curCatMap.get(cat) || 0) + amt);
        } else if (mk === lastKey) {
            prevCatMap.set(cat, (prevCatMap.get(cat) || 0) + amt);
        }
    }

    for (const [cat, curVal] of curCatMap.entries()) {
        const prevVal = prevCatMap.get(cat) || 0;
        if (prevVal > 0 && curVal > 0) {
            const pct = ((curVal - prevVal) / prevVal) * 100;
            if (pct >= 20) {
                insights.push({
                    id: `cat-up-${cat}`,
                    severity: 'warning',
                    title: `${cat} spend up ${Math.round(pct)}%`,
                    detail: `${formatCurrency(curVal, currency)} this month vs ${formatCurrency(prevVal, currency)} last month.`,
                    metric: formatCurrency(curVal, currency),
                    trend: `▲ ${Math.round(pct)}% vs last month`,
                    sortWeight: 700 + (curVal - prevVal),
                });
            } else if (pct <= -20) {
                insights.push({
                    id: `cat-down-${cat}`,
                    severity: 'positive',
                    title: `${cat} spend down ${Math.round(Math.abs(pct))}%`,
                    detail: `Reduced from ${formatCurrency(prevVal, currency)} to ${formatCurrency(curVal, currency)}.`,
                    metric: formatCurrency(curVal, currency),
                    trend: `▼ ${Math.round(Math.abs(pct))}% vs last month`,
                    sortWeight: 500 + Math.abs(curVal - prevVal),
                });
            }
        }
    }

    // 3. Unusually large transaction (> 2x category average)
    const thisMonthExpenses = transactions.filter((t) => isExpense(t) && monthKey(t.date) === thisKey);
    const catCounts = new Map();
    const catSums = new Map();

    for (const t of thisMonthExpenses) {
        const cat = t.category || 'General';
        catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
        catSums.set(cat, (catSums.get(cat) || 0) + toNumber(t.amount));
    }

    let mostUnusual = null;
    for (const t of thisMonthExpenses) {
        const cat = t.category || 'General';
        const count = catCounts.get(cat) || 0;
        const total = catSums.get(cat) || 0;
        if (count >= 2) {
            const avg = total / count;
            const amt = toNumber(t.amount);
            if (amt > 2 * avg && amt >= 500) {
                const ratio = amt / avg;
                if (!mostUnusual || ratio > mostUnusual.ratio) {
                    mostUnusual = { t, avg, ratio };
                }
            }
        }
    }

    if (mostUnusual) {
        const { t, avg } = mostUnusual;
        const merchant = t.merchant || t.description || 'Transaction';
        insights.push({
            id: `unusual-tx-${t.id || t._id || merchant}`,
            severity: 'info',
            title: `Unusual spend in ${t.category || 'General'}`,
            detail: `${merchant} of ${formatCurrency(t.amount, currency)} is 2x above average (${formatCurrency(avg, currency)}).`,
            metric: formatCurrency(t.amount, currency),
            trend: `+${Math.round(((t.amount - avg) / avg) * 100)}% above avg`,
            sortWeight: 400 + toNumber(t.amount),
        });
    }

    // 4. Possible new recurring charge (same merchant, similar amount, 2+ months)
    const merchantMonths = new Map();
    for (const t of transactions) {
        if (!isExpense(t)) continue;
        const merchant = (t.merchant || t.description || '').trim();
        if (!merchant || merchant.length < 3) continue;

        const mk = monthKey(t.date);
        if (!mk) continue;

        if (!merchantMonths.has(merchant)) {
            merchantMonths.set(merchant, new Map());
        }
        const mmap = merchantMonths.get(merchant);
        mmap.set(mk, (mmap.get(mk) || 0) + toNumber(t.amount));
    }

    let topRecurring = null;
    for (const [merchant, monthMap] of merchantMonths.entries()) {
        if (monthMap.size >= 2) {
            const amounts = Array.from(monthMap.values());
            const avgAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;
            const isConsistent = amounts.every((a) => Math.abs(a - avgAmt) / avgAmt <= 0.15);

            if (isConsistent && avgAmt >= 200) {
                if (!topRecurring || avgAmt > topRecurring.amount) {
                    topRecurring = { merchant, amount: avgAmt, count: monthMap.size };
                }
            }
        }
    }

    if (topRecurring) {
        insights.push({
            id: `recurring-${topRecurring.merchant}`,
            severity: 'opportunity',
            title: 'Recurring charge detected',
            detail: `${topRecurring.merchant} charged ~${formatCurrency(topRecurring.amount, currency)} across consecutive months.`,
            metric: formatCurrency(topRecurring.amount, currency),
            trend: 'Monthly recurring',
            sortWeight: 600 + topRecurring.amount,
        });
    }

    // 5. No-spend day streak
    const dailyExpenses = new Map();
    for (const t of thisMonthExpenses) {
        const dk = dayKey(t.date);
        dailyExpenses.set(dk, (dailyExpenses.get(dk) || 0) + toNumber(t.amount));
    }

    let streak = 0;
    for (let d = currentDay; d >= 1; d -= 1) {
        const dk = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const spent = dailyExpenses.get(dk) || 0;
        if (spent === 0) {
            streak += 1;
        } else {
            break;
        }
    }

    if (streak >= 2) {
        insights.push({
            id: `no-spend-streak-${streak}`,
            severity: 'positive',
            title: `${streak}-day no-spend streak!`,
            detail: `You recorded zero expenses over the last ${streak} days. Keep it up!`,
            metric: `${streak} days`,
            trend: '★ Streak',
            sortWeight: 550 + streak * 50,
        });
    }

    // 6. Savings rate trend (using identical calculateSavingsRate helper)
    const curIncome = transactions
        .filter((t) => isIncome(t) && monthKey(t.date) === thisKey)
        .reduce((sum, t) => sum + toNumber(t.amount), 0);
    const curExpense = transactions
        .filter((t) => isExpense(t) && monthKey(t.date) === thisKey)
        .reduce((sum, t) => sum + toNumber(t.amount), 0);

    const prevIncome = transactions
        .filter((t) => isIncome(t) && monthKey(t.date) === lastKey)
        .reduce((sum, t) => sum + toNumber(t.amount), 0);
    const prevExpense = transactions
        .filter((t) => isExpense(t) && monthKey(t.date) === lastKey)
        .reduce((sum, t) => sum + toNumber(t.amount), 0);

    const curRate = calculateSavingsRate(curIncome, curExpense);
    const prevRate = calculateSavingsRate(prevIncome, prevExpense);

    if (curIncome > 0 && prevIncome > 0) {
        const rateDelta = curRate - prevRate;
        if (rateDelta >= 3) {
            insights.push({
                id: 'savings-rate-improved',
                severity: 'positive',
                title: `Savings rate improved by ${Math.round(rateDelta)}%`,
                detail: `Current rate is ${Math.round(curRate)}% vs ${Math.round(prevRate)}% last month.`,
                metric: `${Math.round(curRate)}%`,
                trend: `▲ ${Math.round(rateDelta)}%`,
                sortWeight: 520 + rateDelta,
            });
        } else if (rateDelta <= -3) {
            insights.push({
                id: 'savings-rate-dipped',
                severity: 'warning',
                title: `Savings rate dipped by ${Math.round(Math.abs(rateDelta))}%`,
                detail: `Current rate is ${Math.round(curRate)}% vs ${Math.round(prevRate)}% last month.`,
                metric: `${Math.round(curRate)}%`,
                trend: `▼ ${Math.round(Math.abs(rateDelta))}%`,
                sortWeight: 650 + Math.abs(rateDelta),
            });
        }
    } else if (curIncome > 0) {
        insights.push({
            id: 'savings-rate-current',
            severity: curRate >= 20 ? 'positive' : 'info',
            title: `Savings rate at ${Math.round(curRate)}%`,
            detail: `Saved ${formatCurrency(curIncome - curExpense, currency)} out of ${formatCurrency(curIncome, currency)} income.`,
            metric: `${Math.round(curRate)}%`,
            trend: `${Math.round(curRate)}%`,
            sortWeight: 300 + curRate,
        });
    }

    // Sort ranked insights by severity first, then size/impact
    insights.sort((a, b) => {
        const sevA = SEVERITY_ORDER[a.severity] || 0;
        const sevB = SEVERITY_ORDER[b.severity] || 0;
        if (sevB !== sevA) return sevB - sevA;
        return (b.sortWeight || 0) - (a.sortWeight || 0);
    });

    // Return at most 4 ranked insights
    return insights.slice(0, 4);
}
