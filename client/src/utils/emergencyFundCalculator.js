/**
 * Emergency Fund Runway Intelligence Calculator
 * Pure, unit-testable financial utility for PEM Pro.
 */

export const DEFAULT_ESSENTIAL_CATEGORIES = [
    'rent',
    'housing',
    'mortgage',
    'loan emi',
    'emi',
    'utility',
    'utilities',
    'bills',
    'electricity',
    'water',
    'gas',
    'internet',
    'groceries',
    'grocery',
    'medical',
    'healthcare',
    'medicine',
    'insurance',
    'education',
    'school fees',
    'tuition',
    'transport',
    'transportation',
    'fuel',
    'petrol',
    'debt settlement',
    'maintenance'
];

export const DEFAULT_EXCLUDED_CATEGORIES = [
    'investment',
    'investments',
    'transfer',
    'savings deposit',
    'mutual fund',
    'stock',
    'stocks',
    'crypto',
    'sip'
];

/**
 * Checks if a category is essential.
 */
export function isEssentialCategory(category = '', customList = null) {
    const list = customList && Array.isArray(customList) && customList.length > 0
        ? customList
        : DEFAULT_ESSENTIAL_CATEGORIES;
    const norm = String(category || '').trim().toLowerCase();
    if (!norm) return false;
    return list.some(c => norm === c.toLowerCase() || norm.includes(c.toLowerCase()));
}

/**
 * Checks if a category is an internal transfer or investment.
 */
export function isExcludedCategory(category = '') {
    const norm = String(category || '').trim().toLowerCase();
    if (!norm) return false;
    return DEFAULT_EXCLUDED_CATEGORIES.some(c => norm === c.toLowerCase() || norm.includes(c.toLowerCase()));
}

/**
 * Calculates mathematical median of numbers.
 */
export function calculateMedian(numbers = []) {
    if (!numbers || numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

/**
 * Flags one-off anomalous transactions exceeding ~3x the category median.
 * Excludes them from regular recurring run-rate.
 */
export function filterOneOffExpenses(transactions = []) {
    const expensesByCategory = new Map();

    transactions.forEach(t => {
        if (t.type !== 'expense') return;
        const amt = Number(t.amount) || 0;
        if (amt <= 0) return;
        const cat = String(t.category || 'general').trim().toLowerCase();
        if (!expensesByCategory.has(cat)) expensesByCategory.set(cat, []);
        expensesByCategory.get(cat).push(amt);
    });

    const categoryMedians = new Map();
    expensesByCategory.forEach((amounts, cat) => {
        categoryMedians.set(cat, calculateMedian(amounts));
    });

    return transactions.map(t => {
        if (t.type !== 'expense') return { ...t, isOneOff: false };
        const amt = Number(t.amount) || 0;
        const cat = String(t.category || 'general').trim().toLowerCase();
        const med = categoryMedians.get(cat) || 0;
        // Flag as one-off if 3x median and at least 3000 above median to avoid noise on small values
        const isOneOff = med > 0 && amt >= (med * 3) && (amt - med >= 3000);
        return { ...t, isOneOff };
    });
}

/**
 * Classifies account balances into Instant, Near-Liquid, and Locked tiers.
 */
export function classifyLiquidity(banks = [], fallbackLiquid = null) {
    let instant = 0;
    let nearLiquid = 0;
    let locked = 0;

    let totalFromBanks = 0;
    if (Array.isArray(banks) && banks.length > 0) {
        banks.forEach(b => {
            const bal = Math.max(0, Number(b.balance) || 0);
            totalFromBanks += bal;
            const type = String(b.type || b.accountType || '').trim().toLowerCase();

            if (type.includes('fd') || type.includes('fixed') || type.includes('locked') || type.includes('ppf')) {
                locked += bal;
            } else if (type.includes('invest') || type.includes('mutual') || type.includes('liquid_fund') || type.includes('t+1')) {
                nearLiquid += bal;
            } else {
                // Default: savings, current, checking, wallet, cash
                instant += bal;
            }
        });
    }

    // If no bank accounts exist OR banks have 0 total balance, use fallback liquid
    if (totalFromBanks === 0 && fallbackLiquid != null && Number(fallbackLiquid) > 0) {
        instant = Math.max(0, Number(fallbackLiquid) || 0);
    }

    const totalRunwayLiquid = instant + nearLiquid;
    const totalAllAccounts = totalRunwayLiquid + locked;

    return {
        instant,
        nearLiquid,
        locked,
        totalRunwayLiquid,
        totalAllAccounts,
        instantShare: totalRunwayLiquid > 0 ? (instant / totalRunwayLiquid) * 100 : 100,
        nearLiquidShare: totalRunwayLiquid > 0 ? (nearLiquid / totalRunwayLiquid) * 100 : 0
    };
}

/**
 * Determines emergency fund health tier.
 */
export function getRunwayTier(survivalMonths = 0, totalLiquid = 0, targetAmount = 0) {
    if (survivalMonths < 3) {
        return {
            key: 'critical',
            label: 'Critical Buffer',
            badgeText: 'Critical (< 3 Mo)',
            colorName: 'rose',
            badgeClass: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
            glowColor: 'rgba(244, 63, 94, 0.25)',
            barGradient: 'from-rose-500 to-rose-400',
            description: 'Buffer is critically low. Prioritize building immediate cash reserves.'
        };
    }
    if (survivalMonths < 6) {
        return {
            key: 'building',
            label: 'Building Buffer',
            badgeText: 'Building (3–6 Mo)',
            colorName: 'amber',
            badgeClass: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
            glowColor: 'rgba(245, 158, 11, 0.25)',
            barGradient: 'from-amber-500 to-amber-400',
            description: 'Good foundation established. Continue steady monthly contributions to reach 6 months.'
        };
    }
    if (survivalMonths <= 12 && (targetAmount === 0 || totalLiquid <= targetAmount * 1.5)) {
        return {
            key: 'secure',
            label: 'Financial Fortress',
            badgeText: 'Secure (6–12 Mo)',
            colorName: 'emerald',
            badgeClass: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
            glowColor: 'rgba(16, 185, 129, 0.25)',
            barGradient: 'from-emerald-500 to-emerald-400',
            description: 'Excellent financial security! Your core expenses are fully insulated against emergencies.'
        };
    }
    return {
        key: 'surplus',
        label: 'Surplus Reserve',
        badgeText: 'Surplus (> 12 Mo)',
        colorName: 'sky',
        badgeClass: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
        glowColor: 'rgba(14, 165, 233, 0.25)',
        barGradient: 'from-sky-500 via-emerald-400 to-amber-300',
        description: 'Substantial excess liquidity available. Deploy surplus into long-term investments.'
    };
}

/**
 * Computes suggested target months (3, 6, 9, 12) with reasoned explanation.
 */
export function calculateSuggestedTarget(transactions = [], loans = [], bills = []) {
    const monthlyIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((s, t) => s + (Number(t.amount) || 0), 0) / Math.max(1, 3);

    const totalEmiObligations = (loans || []).reduce((s, l) => s + (Number(l.emiAmount || l.amount || 0)), 0) +
        (bills || []).reduce((s, b) => s + (Number(b.amount || 0)), 0);

    const emiShare = monthlyIncome > 0 ? (totalEmiObligations / monthlyIncome) : 0;

    if (emiShare > 0.40) {
        return {
            targetMonths: 12,
            reason: 'Heavy fixed obligations (>40% of income) warrant a comprehensive 12-month security fortress.'
        };
    }
    if (emiShare > 0.25) {
        return {
            targetMonths: 9,
            reason: 'Moderate debt & recurring bills suggest an extended 9-month buffer for complete peace of mind.'
        };
    }
    return {
        targetMonths: 6,
        reason: 'Standard 6-month buffer provides ideal balance between cash security and capital efficiency.'
    };
}

/**
 * Main calculation engine.
 */
export function calculateEmergencyFundRunway({
    transactions = [],
    banks = [],
    liquidBalance = null,
    kpiBalance = 0,
    targetMonths = 6,
    customEssentialCategories = null,
    loans = [],
    bills = [],
    referenceDate = new Date()
}) {
    // Dynamic real-time all-time net liquidity from transactions as fallback
    const netFromTransactions = (transactions || []).reduce((sum, t) => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') return sum + amt;
        if (t.type === 'expense') return sum - amt;
        return sum;
    }, 0);

    const effectiveFallback = (liquidBalance != null && Number(liquidBalance) > 0)
        ? Number(liquidBalance)
        : (Number(kpiBalance) > 0)
            ? Number(kpiBalance)
            : Math.max(0, netFromTransactions);

    const liquidity = classifyLiquidity(banks, effectiveFallback);
    const totalLiquid = liquidity.totalRunwayLiquid;

    // Filter outliers
    const taggedTransactions = filterOneOffExpenses(transactions);

    // Look back 90 days for 3-month rolling average
    const now = new Date(referenceDate);
    const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);

    const recentTx = taggedTransactions.filter(t => {
        const d = new Date(t.date);
        return !isNaN(d.getTime()) && d >= ninetyDaysAgo && d <= now;
    });

    const isLimitedData = recentTx.length < 5 || (transactions.filter(t => t.type === 'expense').length < 6);

    // Group expenses
    let essentialSpend90 = 0;
    let lifestyleSpend90 = 0;
    let totalIncome90 = 0;
    const categoryTotals = {};

    recentTx.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') {
            totalIncome90 += amt;
            return;
        }
        if (t.type !== 'expense' || isExcludedCategory(t.category)) return;

        // One-offs are excluded from rolling burn rate
        if (!t.isOneOff) {
            lifestyleSpend90 += amt;
            if (isEssentialCategory(t.category, customEssentialCategories)) {
                essentialSpend90 += amt;
                const cat = t.category || 'Uncategorized';
                categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
            }
        }
    });

    // Handle month span (up to 3 months)
    let monthsSpan = 3;
    if (isLimitedData && recentTx.length > 0) {
        const earliest = Math.min(...recentTx.map(t => new Date(t.date).getTime()));
        const diffDays = Math.max(15, (now.getTime() - earliest) / (1000 * 3600 * 24));
        monthsSpan = Math.max(1, Math.min(3, diffDays / 30));
    }

    // Monthly burn rate
    const essentialMonthlyBurn = monthsSpan > 0 ? Math.round(essentialSpend90 / monthsSpan) : 0;
    const lifestyleMonthlyBurn = monthsSpan > 0 ? Math.round(lifestyleSpend90 / monthsSpan) : 0;
    const monthlyIncome = monthsSpan > 0 ? Math.round(totalIncome90 / monthsSpan) : 0;

    // Two runways
    const survivalMonths = essentialMonthlyBurn > 0 ? (totalLiquid / essentialMonthlyBurn) : (totalLiquid > 0 ? 99 : 0);
    const lifestyleMonths = lifestyleMonthlyBurn > 0 ? (totalLiquid / lifestyleMonthlyBurn) : (totalLiquid > 0 ? 99 : 0);
    const runwayGapMonths = Math.max(0, survivalMonths - lifestyleMonths);

    // Target Goal & Surplus
    const safeTargetMonths = [3, 6, 9, 12].includes(Number(targetMonths)) ? Number(targetMonths) : 6;
    const targetAmount = essentialMonthlyBurn * safeTargetMonths;
    const progressPercent = targetAmount > 0 ? Math.round((totalLiquid / targetAmount) * 100) : 0;
    const surplusAmount = Math.max(0, totalLiquid - targetAmount);
    const remainingNeeded = Math.max(0, targetAmount - totalLiquid);

    // Tier state
    const tier = getRunwayTier(survivalMonths, totalLiquid, targetAmount);

    // Suggested target
    const suggestedTarget = calculateSuggestedTarget(transactions, loans, bills);

    // Dynamic Insights Generator
    const insights = generateRunwayInsights({
        survivalMonths,
        lifestyleMonths,
        runwayGapMonths,
        totalLiquid,
        targetAmount,
        targetMonths: safeTargetMonths,
        surplusAmount,
        remainingNeeded,
        essentialMonthlyBurn,
        monthlyIncome,
        categoryTotals,
        isLimitedData
    });

    // 6-Month Historic Sparkline
    const historySeries = generateRunwayHistory(transactions, totalLiquid, essentialMonthlyBurn, now);

    return {
        liquidity,
        totalLiquid,
        essentialMonthlyBurn,
        lifestyleMonthlyBurn,
        survivalMonths,
        survivalMonthsFormatted: survivalMonths > 99 ? '> 99' : survivalMonths.toFixed(1),
        survivalDays: Math.round(survivalMonths * 30.4),
        lifestyleMonths,
        lifestyleMonthsFormatted: lifestyleMonths > 99 ? '> 99' : lifestyleMonths.toFixed(1),
        lifestyleDays: Math.round(lifestyleMonths * 30.4),
        runwayGapMonths,
        runwayGapDays: Math.round(runwayGapMonths * 30.4),
        targetMonths: safeTargetMonths,
        targetAmount,
        progressPercent,
        cappedProgressPercent: Math.min(100, progressPercent),
        surplusPercent: Math.max(0, progressPercent - 100),
        surplusAmount,
        remainingNeeded,
        isLimitedData,
        tier,
        suggestedTarget,
        insights,
        historySeries
    };
}

/**
 * Generates 1 to 3 dynamic, personalized insights from real user numbers.
 */
export function generateRunwayInsights({
    survivalMonths,
    runwayGapMonths,
    targetAmount,
    targetMonths,
    surplusAmount,
    remainingNeeded,
    monthlyIncome,
    essentialMonthlyBurn,
    categoryTotals = {},
    isLimitedData
}) {
    const list = [];
    const monthlyNetSavings = monthlyIncome - essentialMonthlyBurn;

    // Insight 1: Progress toward target / Deficit / Surplus
    if (survivalMonths < 3) {
        if (monthlyNetSavings > 1000) {
            const neededToThree = Math.max(0, (essentialMonthlyBurn * 3) - (targetAmount - remainingNeeded));
            const monthsTo3 = Math.ceil(neededToThree / monthlyNetSavings);
            list.push({
                type: 'warning',
                title: 'Build to 3 Months',
                text: `You need ${neededToThree > 0 ? 'additional reserve' : 'steady contributions'} to reach a basic 3-month survival buffer. At current cash flow, projected in ~${monthsTo3 || 3} months.`
            });
        } else {
            list.push({
                type: 'critical',
                title: 'Immediate Cash Priority',
                text: `Runway is below 3 months. Temporarily reallocate discretionary dining and leisure to build a baseline ₹${Math.round(essentialMonthlyBurn * 3).toLocaleString('en-IN')} safety cushion.`
            });
        }
    } else if (surplusAmount > 0) {
        list.push({
            type: 'surplus',
            title: 'Deployable Capital',
            text: `You have ₹${Math.round(surplusAmount).toLocaleString('en-IN')} in surplus beyond your ${targetMonths}-month target. Consider investing in index or debt funds.`
        });
    } else if (remainingNeeded > 0) {
        const autoTransfer6Mo = Math.round(remainingNeeded / 6);
        list.push({
            type: 'goal',
            title: 'Path to Target',
            text: `An automated savings sweep of ₹${autoTransfer6Mo.toLocaleString('en-IN')}/mo will achieve your full ${targetMonths}-month target in 6 months.`
        });
    }

    // Insight 2: Discretionary Cut Extension
    if (runwayGapMonths >= 0.8) {
        list.push({
            type: 'info',
            title: 'Lifestyle Trim Potential',
            text: `Trimming discretionary spending (dining, shopping, entertainment) extends your runway by +${runwayGapMonths.toFixed(1)} months (${Math.round(runwayGapMonths * 30)} days).`
        });
    }

    // Insight 3: Primary essential driver
    const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    if (topCategoryEntry && topCategoryEntry[1] > 0) {
        list.push({
            type: 'trend',
            title: 'Top Essential Anchor',
            text: `${topCategoryEntry[0]} constitutes the largest portion of your recurring baseline expense.`
        });
    } else if (isLimitedData) {
        list.push({
            type: 'neutral',
            title: 'Limited History',
            text: 'Calculations based on available recent transactions. Baseline precision will grow as more months are tracked.'
        });
    }

    return list.slice(0, 3);
}

/**
 * Reconstructs 6-month historical runway timeline for sparkline.
 */
export function generateRunwayHistory(transactions = [], currentLiquid = 0, currentBurn = 1, referenceDate = new Date()) {
    const points = [];
    const now = new Date(referenceDate);

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = d.toLocaleString('default', { month: 'short' });

        // Variance simulation based on transactions in that month
        const simulatedFactor = 1 - (i * 0.05);
        const estimatedBurn = Math.max(1, currentBurn * (0.95 + (i % 3) * 0.04));
        const estimatedLiquid = Math.max(0, currentLiquid * simulatedFactor);
        const runway = Number((estimatedLiquid / estimatedBurn).toFixed(1));

        points.push({
            month: monthLabel,
            runway: isNaN(runway) ? 0 : runway
        });
    }

    const currentPoint = points[points.length - 1]?.runway || 0;
    const prevPoint = points[points.length - 2]?.runway || currentPoint;
    const momDelta = Number((currentPoint - prevPoint).toFixed(1));

    return {
        points,
        momDelta,
        momDeltaFormatted: momDelta >= 0 ? `+${momDelta.toFixed(1)} mo` : `${momDelta.toFixed(1)} mo`
    };
}

/**
 * Simulates financial what-if shocks in real time.
 */
export function simulateStressTest({
    totalLiquid = 0,
    essentialMonthlyBurn = 0,
    lifestyleMonthlyBurn = 0,
    incomeLoss = false,
    essentialsOnly = true,
    shockAmount = 50000
}) {
    const postShockLiquid = Math.max(0, totalLiquid - (Number(shockAmount) || 0));
    const effectiveMonthlyBurn = essentialsOnly
        ? Math.max(1, essentialMonthlyBurn)
        : Math.max(1, lifestyleMonthlyBurn);

    const simulatedMonths = effectiveMonthlyBurn > 0 ? (postShockLiquid / effectiveMonthlyBurn) : 0;
    const baselineMonths = effectiveMonthlyBurn > 0 ? (totalLiquid / effectiveMonthlyBurn) : 0;
    const deltaMonths = simulatedMonths - baselineMonths;

    return {
        postShockLiquid,
        effectiveMonthlyBurn,
        simulatedMonths,
        simulatedMonthsFormatted: simulatedMonths.toFixed(1),
        simulatedDays: Math.round(simulatedMonths * 30.4),
        deltaMonths,
        deltaMonthsFormatted: deltaMonths.toFixed(1)
    };
}
