/**
 * Month-End Expense Forecast & Overspend Radar Calculation Engine
 * Pure mathematical functions with precision in paise, timezone handling (Asia/Kolkata),
 * transfer/refund normalization, median-based one-off detection, and weighted run-rate modeling.
 */

/**
 * 1. Time Model (Asia/Kolkata)
 * Returns current timestamp attributes in Asia/Kolkata with exact elapsed and remaining days.
 * Never counts today as both fully elapsed and remaining.
 */
export function getKolkataTime(dateInput = new Date()) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
        throw new Error('Invalid date passed to getKolkataTime');
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    });

    const parts = formatter.formatToParts(d);
    const getPart = (type) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);

    const year = getPart('year');
    const month = getPart('month') - 1; // 0-indexed month
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const second = getPart('second');

    // Number of days in the current month (supports leap years e.g. Feb 29)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Elapsed days: complete passed days + fraction of today
    const dayFraction = (hour * 3600 + minute * 60 + second) / 86400;
    const elapsedDays = Math.min(daysInMonth, Math.max(0.01, (day - 1) + dayFraction));
    const remainingDays = Math.max(0, daysInMonth - elapsedDays);

    return {
        year,
        month,
        day,
        hour,
        minute,
        second,
        daysInMonth,
        elapsedDays,
        remainingDays,
    };
}

/**
 * 2. Transfer & Exclusions Classifier
 */
export function isTransferTransaction(tx) {
    if (!tx) return false;
    const category = String(tx.category || '').toLowerCase().trim();
    const desc = String(tx.description || '').toLowerCase().trim();
    const paymentMode = String(tx.paymentMode || '').toLowerCase().trim();
    const source = String(tx.source || '').toLowerCase().trim();

    if (
        category === 'transfer' ||
        category === 'transfers' ||
        category === 'credit card payment' ||
        category === 'card payment' ||
        category === 'savings transfer' ||
        category === 'account transfer'
    ) {
        return true;
    }

    if (
        desc.includes('card bill payment') ||
        desc.includes('credit card bill payment') ||
        desc.includes('self transfer') ||
        desc.includes('fund transfer') ||
        desc.includes('wallet topup')
    ) {
        return true;
    }

    if (paymentMode.includes('transfer') && !paymentMode.includes('pot')) {
        return true;
    }

    if (source === 'transfer' || source === 'cc_payment') {
        return true;
    }

    return false;
}

/**
 * 3. Statistical Utilities (Paise, Median, Percentiles)
 */
export function toPaise(rupees) {
    return Math.round((Number(rupees) || 0) * 100);
}

export function toRupees(paise) {
    return Math.round(paise) / 100;
}

export function calculateMedian(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    const sorted = [...numbers].map(Number).filter((n) => !isNaN(n) && n > 0).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculatePercentile(numbers, p) {
    if (!numbers || numbers.length === 0) return 0;
    const sorted = [...numbers].map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (lower === upper) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Checks if a transaction is a statistical or user-flagged one-off
 */
export function isOneOff(tx, categoryMedian, manualOneOffIds = new Set()) {
    if (!tx) return false;
    if (manualOneOffIds && manualOneOffIds.has(tx.id)) return true;
    if (tx.isOneOff === true) return true;
    const amt = Math.abs(Number(tx.amount) || 0);
    if (categoryMedian > 0 && amt > 3 * categoryMedian) return true;
    return false;
}

/**
 * 4. Run-Rate and Limit Crossing Date
 */
export function calculateRunRate(thisMonthDailyAvg, trailing3MonthDailyAvg, elapsedDays, hasHistory) {
    if (!hasHistory) return thisMonthDailyAvg;
    const w = elapsedDays / (elapsedDays + 10);
    return w * thisMonthDailyAvg + (1 - w) * trailing3MonthDailyAvg;
}

export function calculateLimitBreachDate(currentDate, elapsedDays, daysToBreach, daysInMonth) {
    if (daysToBreach === null || daysToBreach === undefined || daysToBreach < 0) return null;
    const breachDay = Math.ceil(elapsedDays + daysToBreach);
    if (breachDay > daysInMonth) return null;

    const targetDate = new Date(currentDate);
    targetDate.setDate(breachDay);
    return targetDate;
}

/**
 * 5. Category Forecast Processor
 */
export function computeCategoryForecast({
    budget,
    currentMonthTransactions = [],
    historicalTransactions = [],
    upcomingBills = [],
    activeLoans = [],
    manualOneOffIds = new Set(),
    timeInfo = getKolkataTime(),
}) {
    const category = budget.category;
    const limit = Number(budget.amountLimit) || 0;
    const limitPaise = toPaise(limit);
    const { year, month, day, daysInMonth, elapsedDays, remainingDays } = timeInfo;

    // A. Filter and categorize this month's transactions
    const validMonthTxs = currentMonthTransactions.filter((t) => {
        if (!t || isTransferTransaction(t)) return false;
        const cat = (t.category || 'General').toLowerCase().trim();
        return cat === category.toLowerCase().trim();
    });

    // Compute category median from expense transactions
    const rawExpenseAmts = validMonthTxs
        .filter((t) => (t.type === 'expense' || !t.type) && Number(t.amount) > 0)
        .map((t) => Math.abs(Number(t.amount)));
    const categoryMedian = calculateMedian(rawExpenseAmts);

    let spentSoFarPaise = 0;
    let oneOffTotalPaise = 0;
    const oneOffTxs = [];
    const regularExpenseTxs = [];
    const dailySpendMap = {}; // Day -> paise

    for (const tx of validMonthTxs) {
        const amt = Number(tx.amount) || 0;
        const amtPaise = toPaise(Math.abs(amt));
        const isIncomeOrRefund = tx.type === 'income' || amt < 0;

        if (isIncomeOrRefund) {
            // Net refund against category
            spentSoFarPaise = Math.max(0, spentSoFarPaise - amtPaise);
        } else {
            spentSoFarPaise += amtPaise;

            const isOneOffTx = isOneOff(tx, categoryMedian, manualOneOffIds);
            if (isOneOffTx) {
                oneOffTotalPaise += amtPaise;
                oneOffTxs.push(tx);
            } else {
                regularExpenseTxs.push(tx);
                const txDate = new Date(tx.date || tx.createdAt);
                const txDay = txDate.getDate();
                dailySpendMap[txDay] = (dailySpendMap[txDay] || 0) + amtPaise;
            }
        }
    }

    const spentSoFar = toRupees(spentSoFarPaise);
    const oneOffTotal = toRupees(oneOffTotalPaise);
    const variableSpentPaise = Math.max(0, spentSoFarPaise - oneOffTotalPaise);
    const variableSpent = toRupees(variableSpentPaise);

    // B. Committed upcoming dues due in remainder of this month
    let committedPaise = 0;
    for (const b of upcomingBills) {
        if (b.status === 'paid') continue;
        const bCat = (b.category || '').toLowerCase().trim();
        if (bCat === category.toLowerCase().trim() || (!b.category && category.toLowerCase() === 'bills & utilities')) {
            if (b.dueDate) {
                const due = new Date(b.dueDate);
                if (due.getFullYear() === year && due.getMonth() === month && due.getDate() >= day) {
                    committedPaise += toPaise(b.amount);
                }
            } else {
                committedPaise += toPaise(b.amount);
            }
        }
    }

    for (const l of activeLoans) {
        if (l.status === 'closed' || l.isEmiPaid) continue;
        const lCat = (l.category || 'Loan EMI').toLowerCase().trim();
        if (lCat === category.toLowerCase().trim() || category.toLowerCase() === 'loans & emi' || category.toLowerCase() === 'debt/loan') {
            committedPaise += toPaise(l.emiAmount);
        }
    }

    const committed = toRupees(committedPaise);

    // C. Historical trailing 3-month daily average
    const histCategoryTxs = historicalTransactions.filter((t) => {
        if (!t || isTransferTransaction(t)) return false;
        const cat = (t.category || 'General').toLowerCase().trim();
        return cat === category.toLowerCase().trim() && (t.type === 'expense' || !t.type);
    });

    const hasHistory = histCategoryTxs.length >= 3;
    let trailing3MonthDailyAvgPaise = 0;
    const historicalDailySpendList = [];

    if (hasHistory) {
        // Group historical spend by unique date
        const histDays = new Set();
        let totalHistPaise = 0;
        for (const ht of histCategoryTxs) {
            const hDate = new Date(ht.date || ht.createdAt).toISOString().split('T')[0];
            histDays.add(hDate);
            const hPaise = toPaise(ht.amount);
            totalHistPaise += hPaise;
            historicalDailySpendList.push(hPaise);
        }
        const effectiveHistDays = Math.max(1, histDays.size);
        trailing3MonthDailyAvgPaise = Math.round(totalHistPaise / effectiveHistDays);
    }

    // D. Current Month Daily Variable Average
    const thisMonthDailyAvgPaise = elapsedDays > 0 ? Math.round(variableSpentPaise / elapsedDays) : 0;
    const thisMonthDailyAvg = toRupees(thisMonthDailyAvgPaise);
    const trailing3MonthDailyAvg = toRupees(trailing3MonthDailyAvgPaise);

    // E. Weighted Run-Rate
    const runRatePaise = calculateRunRate(thisMonthDailyAvgPaise, trailing3MonthDailyAvgPaise, elapsedDays, hasHistory);
    const runRate = toRupees(runRatePaise);

    // F. Projected Month-End (in Paise for exact integer arithmetic)
    const futureVariablePaise = Math.round(runRatePaise * remainingDays);
    const projectedPaise = spentSoFarPaise + committedPaise + futureVariablePaise;
    const projected = toRupees(projectedPaise);

    // G. Confidence & Low / High Range
    const currentDaysWithTxs = Object.keys(dailySpendMap).length;
    const totalDataPoints = currentDaysWithTxs + historicalDailySpendList.length;

    let confidence = 'low'; // 'high' | 'medium' | 'low'
    if (totalDataPoints >= 15 && validMonthTxs.length >= 8) {
        confidence = 'high';
    } else if (totalDataPoints >= 5 || validMonthTxs.length >= 3) {
        confidence = 'medium';
    }

    let lowRunRatePaise;
    let highRunRatePaise;

    const allDailyPoints = [...Object.values(dailySpendMap), ...historicalDailySpendList];
    if (allDailyPoints.length >= 10) {
        lowRunRatePaise = calculatePercentile(allDailyPoints, 25);
        highRunRatePaise = calculatePercentile(allDailyPoints, 75);
    } else {
        // Thin history: +/- 20%
        lowRunRatePaise = Math.round(runRatePaise * 0.8);
        highRunRatePaise = Math.round(runRatePaise * 1.2);
    }

    const projectedLowPaise = spentSoFarPaise + committedPaise + Math.round(lowRunRatePaise * remainingDays);
    const projectedHighPaise = spentSoFarPaise + committedPaise + Math.round(highRunRatePaise * remainingDays);
    const projectedLow = toRupees(projectedLowPaise);
    const projectedHigh = toRupees(projectedHighPaise);

    // H. Safe Daily Cap & Runway
    const remainingBudgetPaise = Math.max(0, limitPaise - spentSoFarPaise - committedPaise);
    const remainingBudget = toRupees(remainingBudgetPaise);
    const safeDailyCap = remainingDays > 0 ? toRupees(Math.round(remainingBudgetPaise / remainingDays)) : 0;

    // Limit Crossing Calculation
    let limitBreachDate = null;
    if (spentSoFarPaise > limitPaise) {
        limitBreachDate = new Date(year, month, day);
    } else if (runRatePaise > 0) {
        const paiseNeededToBreach = limitPaise - (spentSoFarPaise + committedPaise);
        if (paiseNeededToBreach >= 0) {
            const daysFloat = paiseNeededToBreach / runRatePaise;
            if (daysFloat <= remainingDays) {
                limitBreachDate = calculateLimitBreachDate(new Date(year, month, day), elapsedDays, daysFloat, daysInMonth);
            }
        }
    }

    // Runway calculation: days until budget exhausted at current run rate
    let runwayDays = remainingDays;
    let runwayText = 'Lasts through month end';
    if (spentSoFarPaise >= limitPaise) {
        runwayDays = 0;
        runwayText = 'Budget exhausted';
    } else if (runRatePaise > 0) {
        const canLastDays = Math.floor(remainingBudgetPaise / runRatePaise);
        if (canLastDays < remainingDays) {
            runwayDays = canLastDays;
            const endDay = Math.min(daysInMonth, Math.ceil(elapsedDays + canLastDays));
            const runwayDate = new Date(year, month, endDay);
            const formattedRunway = runwayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            runwayText = `Lasts until ${formattedRunway}`;
        }
    }

    // I. Status State Machine
    // 2% threshold = 1.02 * limit
    const exceededThresholdPaise = Math.round(limitPaise * 1.02);
    const atLimitLowerPaise = Math.round(limitPaise * 0.98);
    const watchThresholdPaise = Math.round(limitPaise * 0.85);

    let state = 'on_track';
    // If fewer than 7 days of data and no history
    if (elapsedDays < 7 && !hasHistory && validMonthTxs.length === 0) {
        state = 'insufficient_data';
    } else if (spentSoFarPaise > exceededThresholdPaise) {
        state = 'exceeded';
    } else if (spentSoFarPaise >= atLimitLowerPaise && spentSoFarPaise <= exceededThresholdPaise) {
        state = 'at_limit';
    } else if (projectedPaise > exceededThresholdPaise) {
        state = 'projected_breach';
    } else if (projectedPaise >= watchThresholdPaise && projectedPaise <= exceededThresholdPaise) {
        state = 'watch';
    } else {
        state = 'on_track';
    }

    // J. Variance
    const variancePaise = projectedPaise - limitPaise;
    const variance = toRupees(variancePaise);
    const variancePercent = limitPaise > 0 ? Math.round((variancePaise / limitPaise) * 100) : 0;

    return {
        id: budget.id,
        category,
        limit,
        limitPaise,
        spentSoFar,
        spentSoFarPaise,
        variableSpent,
        oneOffTotal,
        oneOffTxs,
        regularExpenseTxs,
        committed,
        committedPaise,
        hasHistory,
        thisMonthDailyAvg,
        trailing3MonthDailyAvg,
        runRate,
        runRatePaise,
        projected,
        projectedPaise,
        projectedLow,
        projectedHigh,
        confidence,
        safeDailyCap,
        remainingBudget,
        runwayDays,
        runwayText,
        limitBreachDate,
        state,
        variance,
        variancePercent,
    };
}

/**
 * 6. Macro Model Generator
 * Aggregates all category forecasts, computes totals in paise, hero cumulative series,
 * and dynamic actionable alert copy.
 */
export function generateMacroForecast({
    budgets = [],
    transactions = [],
    bills = [],
    loans = [],
    manualOneOffIds = new Set(),
    now = new Date(),
}) {
    const timeInfo = getKolkataTime(now);
    const { year, month, daysInMonth, elapsedDays, remainingDays } = timeInfo;

    // 1. Separate current month vs historical 3 months transactions
    const startOfCurrentMonth = new Date(year, month, 1);
    const startOf3MonthsAgo = new Date(year, month - 3, 1);

    const currentMonthTxs = [];
    const historicalTxs = [];
    const unbudgetedMonthTxs = [];

    const budgetedCategoryNames = new Set(budgets.map((b) => (b.category || '').toLowerCase().trim()));

    for (const t of transactions || []) {
        if (!t || !t.date) continue;
        const d = new Date(t.date);
        if (isNaN(d.getTime())) continue;

        if (d >= startOfCurrentMonth) {
            currentMonthTxs.push(t);
            const cat = (t.category || '').toLowerCase().trim();
            if (!budgetedCategoryNames.has(cat) && !isTransferTransaction(t) && t.type === 'expense') {
                unbudgetedMonthTxs.push(t);
            }
        } else if (d >= startOf3MonthsAgo && d < startOfCurrentMonth) {
            historicalTxs.push(t);
        }
    }

    // 2. Compute category forecasts
    const categoryForecasts = budgets.map((b) =>
        computeCategoryForecast({
            budget: b,
            currentMonthTransactions: currentMonthTxs,
            historicalTransactions: historicalTxs,
            upcomingBills: bills,
            activeLoans: loans,
            manualOneOffIds,
            timeInfo,
        })
    );

    // Default sorting: severity then projected variance descending
    const severityOrder = {
        exceeded: 1,
        projected_breach: 2,
        at_limit: 3,
        watch: 4,
        on_track: 5,
        insufficient_data: 6,
    };

    categoryForecasts.sort((a, b) => {
        const rankDiff = (severityOrder[a.state] || 99) - (severityOrder[b.state] || 99);
        if (rankDiff !== 0) return rankDiff;
        return b.variance - a.variance;
    });

    // 3. Macro Totals in Paise (Zero Floating Point Imbalance)
    let totalBudgetPaise = 0;
    let totalSpentSoFarPaise = 0;
    let totalProjectedPaise = 0;
    let totalProjectedLowPaise = 0;
    let totalProjectedHighPaise = 0;
    let totalCommittedPaise = 0;

    for (const cf of categoryForecasts) {
        totalBudgetPaise += cf.limitPaise;
        totalSpentSoFarPaise += cf.spentSoFarPaise;
        totalProjectedPaise += cf.projectedPaise;
        totalProjectedLowPaise += toPaise(cf.projectedLow);
        totalProjectedHighPaise += toPaise(cf.projectedHigh);
        totalCommittedPaise += cf.committedPaise;
    }

    const totalBudget = toRupees(totalBudgetPaise);
    const totalSpentSoFar = toRupees(totalSpentSoFarPaise);
    const totalProjected = toRupees(totalProjectedPaise);
    const totalProjectedLow = toRupees(totalProjectedLowPaise);
    const totalProjectedHigh = toRupees(totalProjectedHighPaise);
    const totalCommitted = toRupees(totalCommittedPaise);
    const totalNetVariance = toRupees(totalProjectedPaise - totalBudgetPaise);

    // 4. Counts by State
    const counts = {
        all: categoryForecasts.length,
        exceeded: categoryForecasts.filter((c) => c.state === 'exceeded' || c.state === 'at_limit').length,
        projected_breach: categoryForecasts.filter((c) => c.state === 'projected_breach').length,
        watch: categoryForecasts.filter((c) => c.state === 'watch').length,
        on_track: categoryForecasts.filter((c) => c.state === 'on_track' || c.state === 'insufficient_data').length,
    };
    const needingAttentionCount = counts.exceeded + counts.projected_breach + counts.watch;

    // 5. Dynamic Single-Sentence Alert Banner Generation
    let alertMessage = null;
    const exceededList = categoryForecasts.filter((c) => c.state === 'exceeded');
    const breachList = categoryForecasts.filter((c) => c.state === 'projected_breach');
    const watchList = categoryForecasts.filter((c) => c.state === 'watch');

    const alertParts = [];
    if (exceededList.length > 0) {
        const names = exceededList.map((c) => c.category).slice(0, 2).join(' and ');
        alertParts.push(`${names} ${exceededList.length === 1 ? 'has' : 'have'} exceeded budget limit`);
    }

    if (breachList.length > 0) {
        const breachDetails = breachList
            .slice(0, 2)
            .map((c) => {
                if (c.limitBreachDate) {
                    const dtStr = c.limitBreachDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return `${c.category} is on track to exceed by ${dtStr}`;
                }
                return `${c.category} is pacing to exceed limit`;
            })
            .join(' and ');
        alertParts.push(breachDetails);
    } else if (watchList.length > 0 && exceededList.length === 0) {
        const names = watchList.map((c) => c.category).slice(0, 2).join(' and ');
        alertParts.push(`${names} ${watchList.length === 1 ? 'is' : 'are'} pacing near capacity (85%+ used)`);
    }

    if (alertParts.length > 0) {
        alertMessage = alertParts.join('. ') + '.';
    }

    // 6. Cumulative Daily Curve (Hero Chart Data across 1..daysInMonth)
    // Daily spend distribution of budgeted categories so far
    const daySpendTotals = {};
    for (const cf of categoryForecasts) {
        for (const tx of cf.regularExpenseTxs || []) {
            const d = new Date(tx.date || tx.createdAt).getDate();
            daySpendTotals[d] = (daySpendTotals[d] || 0) + (Number(tx.amount) || 0);
        }
        for (const tx of cf.oneOffTxs || []) {
            const d = new Date(tx.date || tx.createdAt).getDate();
            daySpendTotals[d] = (daySpendTotals[d] || 0) + (Number(tx.amount) || 0);
        }
    }

    const cumulativeSeries = [];
    let runningActual = 0;
    const currentFloorDay = Math.min(daysInMonth, Math.floor(elapsedDays));
    const totalDailyRunRate = categoryForecasts.reduce((s, c) => s + c.runRate, 0);
    const totalLowRunRate = categoryForecasts.reduce((s, c) => s + (toRupees(toPaise(c.projectedLow) - c.spentSoFarPaise - c.committedPaise) / Math.max(1, remainingDays)), 0);
    const totalHighRunRate = categoryForecasts.reduce((s, c) => s + (toRupees(toPaise(c.projectedHigh) - c.spentSoFarPaise - c.committedPaise) / Math.max(1, remainingDays)), 0);

    for (let d = 1; d <= daysInMonth; d++) {
        const idealPace = Math.round((totalBudget / daysInMonth) * d);
        const daySpend = daySpendTotals[d] || 0;

        if (d <= currentFloorDay) {
            runningActual += daySpend;
            cumulativeSeries.push({
                day: d,
                label: `Day ${d}`,
                actual: Math.round(runningActual),
                idealPace,
                limit: totalBudget,
            });
        } else if (d === currentFloorDay + 1) {
            // Transition day connecting actual to projected
            const projectedFutureDays = d - elapsedDays;
            const projectedPoint = Math.round(totalSpentSoFar + totalDailyRunRate * projectedFutureDays);
            const rangeLow = Math.round(totalSpentSoFar + totalLowRunRate * projectedFutureDays);
            const rangeHigh = Math.round(totalSpentSoFar + totalHighRunRate * projectedFutureDays);

            cumulativeSeries.push({
                day: d,
                label: `Day ${d}`,
                actual: d === Math.ceil(elapsedDays) ? Math.round(totalSpentSoFar) : undefined,
                projected: projectedPoint,
                rangeLow: Math.max(0, rangeLow),
                rangeHigh: Math.max(rangeLow, rangeHigh),
                rangeBand: [Math.max(0, rangeLow), Math.max(rangeLow, rangeHigh)],
                idealPace,
                limit: totalBudget,
            });
        } else {
            const projectedFutureDays = d - elapsedDays;
            const projectedPoint = Math.round(totalSpentSoFar + totalDailyRunRate * projectedFutureDays);
            const rangeLow = Math.round(totalSpentSoFar + totalLowRunRate * projectedFutureDays);
            const rangeHigh = Math.round(totalSpentSoFar + totalHighRunRate * projectedFutureDays);

            cumulativeSeries.push({
                day: d,
                label: `Day ${d}`,
                projected: projectedPoint,
                rangeLow: Math.max(0, rangeLow),
                rangeHigh: Math.max(rangeLow, rangeHigh),
                rangeBand: [Math.max(0, rangeLow), Math.max(rangeLow, rangeHigh)],
                idealPace,
                limit: totalBudget,
            });
        }
    }

    const monthName = now.toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Kolkata' });
    const monthShort = now.toLocaleString('en-US', { month: 'short', timeZone: 'Asia/Kolkata' });
    const formattedDate = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    });
    const formattedTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
    });

    return {
        timeInfo,
        monthName,
        monthShort,
        formattedDate,
        formattedTime,
        asOfSubtitle: `${monthName} ${year} Forecast · As of ${formattedDate}, ${formattedTime} IST`,
        categoryForecasts,
        totalBudget,
        totalSpentSoFar,
        totalProjected,
        totalProjectedLow,
        totalProjectedHigh,
        totalCommitted,
        totalNetVariance,
        counts,
        needingAttentionCount,
        alertMessage,
        cumulativeSeries,
        unbudgetedSpent: unbudgetedMonthTxs.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0),
    };
}
