import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    ShieldAlert,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Calculator,
    CheckCircle2,
    AlertTriangle,
    Wallet,
    Receipt,
    Landmark,
    X,
    Clock,
    ArrowRight,
    TrendingDown,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { cx } from '../ui/cx';

export function SafeToSpendWidget({
    transactions = [],
    banks = [],
    bills = [],
    loans = [],
    borrow = [],
    budgets = [],
    kpiBalance = 0,
    currency = 'INR',
    loading = false,
}) {
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [simulationAmount, setSimulationAmount] = useState('');

    const calculations = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const currentDay = today.getDate();
        const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);

        // Date matcher for today (local timezone safe)
        const isToday = (dateVal) => {
            if (!dateVal) return false;
            const d = new Date(dateVal);
            return (
                !isNaN(d.getTime()) &&
                d.getFullYear() === year &&
                d.getMonth() === month &&
                d.getDate() === currentDay
            );
        };

        // 1. Calculate today's actual expenses in real-time
        const todayExpenseTransactions = (transactions || []).filter(
            (t) => (t.type === 'expense' || !t.type) && isToday(t.date)
        );
        const todaySpent = todayExpenseTransactions.reduce(
            (sum, t) => sum + Math.abs(Number(t.amount) || 0),
            0
        );
        const todayCount = todayExpenseTransactions.length;

        // 2. Liquid funds
        const bankBalanceSum = Array.isArray(banks)
            ? banks.reduce((sum, b) => sum + (Number(b.balance) || 0), 0)
            : 0;
        const liquidCash = bankBalanceSum > 0 ? bankBalanceSum : Math.max(0, kpiBalance || 0);

        // 3. Upcoming bills due in the remainder of this month (from today onwards)
        const upcomingBills = (bills || []).filter((b) => {
            if (b.status === 'paid') return false;
            if (!b.dueDate) return true;
            const due = new Date(b.dueDate);
            return (
                due.getMonth() === month &&
                due.getFullYear() === year &&
                due.getDate() >= currentDay
            );
        });
        const billsTotal = upcomingBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);

        // 4. Unpaid loan EMIs
        const activeEmis = (loans || []).filter((l) => {
            if (l.status === 'closed' || l.isEmiPaid) return false;
            return true;
        });
        const emisTotal = activeEmis.reduce((s, l) => s + (Number(l.emiAmount) || 0), 0);

        // 5. Borrowed payables due
        const pendingPayables = (borrow || []).filter((w) => {
            if (w.status === 'settled' || w.type !== 'borrowed') return false;
            return true;
        });
        const payablesTotal = pendingPayables.reduce((s, w) => s + (Number(w.amount) || 0), 0);

        const totalObligations = billsTotal + emisTotal + payablesTotal;

        // 6. Monthly safe-to-spend pool
        const safeMonth = Math.max(0, liquidCash - totalObligations);

        // 7. Today's Base Target & Real-time Remaining Allowance
        // Total pool available at start of today = remaining safe month pool + what was already spent today
        const poolStartOfToday = safeMonth + todaySpent;
        const dailyTarget = Math.max(0, Math.round(poolStartOfToday / daysRemaining));

        // Real-time remaining safe amount for TODAY specifically
        const safeTodayRemaining = Math.max(0, dailyTarget - todaySpent);
        const isOverDailyTarget = todaySpent > dailyTarget;
        const overDailyAmount = isOverDailyTarget ? todaySpent - dailyTarget : 0;
        const percentOfDailySpent = dailyTarget > 0 ? Math.min(100, Math.round((todaySpent / dailyTarget) * 100)) : (todaySpent > 0 ? 100 : 0);

        // Status
        let status = 'healthy';
        if (liquidCash === 0) {
            status = 'neutral';
        } else if (liquidCash < totalObligations) {
            status = 'danger';
        } else if (isOverDailyTarget) {
            status = 'tight';
        } else if (safeTodayRemaining < 200 && safeTodayRemaining > 0) {
            status = 'tight';
        }

        return {
            daysRemaining,
            liquidCash,
            isUsingBankAccounts: bankBalanceSum > 0,
            upcomingBills,
            billsTotal,
            activeEmis,
            emisTotal,
            pendingPayables,
            payablesTotal,
            totalObligations,
            safeMonth,
            todaySpent,
            todayCount,
            dailyTarget,
            safeTodayRemaining,
            isOverDailyTarget,
            overDailyAmount,
            percentOfDailySpent,
            status,
        };
    }, [transactions, banks, bills, loans, borrow, kpiBalance]);

    // Real-Time Predictive Simulation Model
    const simulationResult = useMemo(() => {
        const simVal = Number(simulationAmount) || 0;
        if (simVal <= 0) return null;

        const {
            todaySpent,
            dailyTarget,
            safeMonth,
            liquidCash,
            totalObligations,
            daysRemaining,
        } = calculations;

        // 1. Immediate Today Impact
        const projectedTodaySpent = todaySpent + simVal;
        const isExceedingToday = projectedTodaySpent > dailyTarget;
        const todayOverAmount = isExceedingToday ? projectedTodaySpent - dailyTarget : 0;
        const todayRemainingAfterSim = Math.max(0, dailyTarget - projectedTodaySpent);

        // 2. Future Days Impact (Tomorrow onwards)
        const futureDays = Math.max(1, daysRemaining - 1);
        const newSafeMonth = Math.max(0, safeMonth - simVal);
        const currentFutureDaily = futureDays > 0 ? Math.max(0, Math.round(safeMonth / futureDays)) : safeMonth;
        const newFutureDaily = futureDays > 0 ? Math.max(0, Math.round(newSafeMonth / futureDays)) : newSafeMonth;
        const dailyDrop = Math.max(0, currentFutureDaily - newFutureDaily);
        const safeMonthReductionPct = safeMonth > 0 ? Math.min(100, Math.round((simVal / safeMonth) * 100)) : 100;

        // 3. Liquid Cash & Mandatory Obligations Safety
        const newLiquidCash = liquidCash - simVal;
        const isObligationInvaded = newLiquidCash < totalObligations || simVal > safeMonth;
        const invadedAmount = isObligationInvaded
            ? Math.max(0, totalObligations - Math.max(0, newLiquidCash)) || Math.max(0, simVal - safeMonth)
            : 0;

        // 4. Detailed Prediction & Verdict
        let level = 'safe';
        let badge = 'Safe & Affordable';
        let badgeColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
        let icon = CheckCircle2;
        let headline = 'Spend is fully within today’s allowance';
        let explanation = '';

        if (isObligationInvaded) {
            level = 'danger';
            badge = 'Critical · Invades Mandatory Dues';
            badgeColor = 'bg-rose-500/15 text-rose-400 border border-rose-500/20';
            icon = ShieldAlert;
            headline = 'Unsafe Purchase: Risks Mandatory Bills & EMIs';
            explanation = `Spending ${formatCurrency(simVal, currency)} exceeds your safe discretionary cushion and will invade ${formatCurrency(invadedAmount, currency)} of funds reserved for mandatory commitments. Not recommended.`;
        } else if (safeMonthReductionPct > 50) {
            level = 'warning';
            badge = 'High Monthly Pool Drain';
            badgeColor = 'bg-orange-500/15 text-orange-400 border border-orange-500/20';
            icon = AlertTriangle;
            headline = 'Major impact on remaining month budget';
            explanation = `This single purchase consumes ${safeMonthReductionPct}% of your total monthly discretionary funds. Your daily allowance for the remaining ${futureDays} days will drop by ${formatCurrency(dailyDrop, currency)}/day (down to ${formatCurrency(newFutureDaily, currency)}/day).`;
        } else if (isExceedingToday) {
            level = 'caution';
            badge = 'Exceeds Today (Month Safe)';
            badgeColor = 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
            icon = AlertTriangle;
            headline = 'Crosses today’s daily budget';
            explanation = `Spending this will push today's total spend to ${formatCurrency(projectedTodaySpent, currency)} (exceeding today's target by ${formatCurrency(todayOverAmount, currency)}). It is fully covered by your monthly pool without risking bills, adjusting tomorrow's budget to ${formatCurrency(newFutureDaily, currency)}/day.`;
        } else {
            level = 'safe';
            badge = 'Within Daily Target';
            badgeColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
            icon = CheckCircle2;
            headline = 'Comfortably affordable today';
            explanation = `After this expense, you'll still have ${formatCurrency(todayRemainingAfterSim, currency)} safe to spend today, and your future daily pace stays strong at ${formatCurrency(newFutureDaily, currency)}/day for the next ${futureDays} days.`;
        }

        return {
            simVal,
            projectedTodaySpent,
            isExceedingToday,
            todayOverAmount,
            todayRemainingAfterSim,
            futureDays,
            newSafeMonth,
            currentFutureDaily,
            newFutureDaily,
            dailyDrop,
            safeMonthReductionPct,
            newLiquidCash,
            isObligationInvaded,
            invadedAmount,
            level,
            badge,
            badgeColor,
            icon,
            headline,
            explanation,
        };
    }, [simulationAmount, calculations, currency]);

    const handleQuickAdd = (amount) => {
        setSimulationAmount(String(amount));
    };

    if (loading) {
        return (
            <div className="mb-4 h-16 w-full animate-pulse rounded-card border border-line bg-surface/60" />
        );
    }

    return (
        <section className="mb-4">
            {/* Primary Safe-to-Spend Banner */}
            <div
                className={cx(
                    'group relative overflow-hidden rounded-card border transition-all duration-300',
                    calculations.status === 'healthy'
                        ? 'border-emerald-500/25 bg-gradient-to-r from-emerald-950/20 via-surface to-surface'
                        : calculations.status === 'tight'
                        ? 'border-amber-500/25 bg-gradient-to-r from-amber-950/20 via-surface to-surface'
                        : calculations.status === 'danger'
                        ? 'border-rose-500/25 bg-gradient-to-r from-rose-950/20 via-surface to-surface'
                        : 'border-line bg-surface'
                )}
            >
                {/* Ambient glow accent top line */}
                <div
                    className={cx(
                        'h-[2px] w-full',
                        calculations.status === 'healthy'
                            ? 'bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-70'
                            : calculations.status === 'tight'
                            ? 'bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-70'
                            : 'bg-gradient-to-r from-transparent via-rose-400 to-transparent opacity-70'
                    )}
                />

                <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    {/* Left: Indicator & Headline */}
                    <div className="flex items-center gap-3">
                        <div
                            className={cx(
                                'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105',
                                calculations.status === 'healthy'
                                    ? 'bg-emerald-500/15 text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                                    : calculations.status === 'tight'
                                    ? 'bg-amber-500/15 text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                                    : 'bg-rose-500/15 text-rose-400 shadow-[0_0_16px_rgba(239,68,68,0.2)]'
                            )}
                        >
                            {calculations.status === 'danger' ? (
                                <ShieldAlert size={20} strokeWidth={2.4} />
                            ) : (
                                <ShieldCheck size={20} strokeWidth={2.4} />
                            )}
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                                    Safe-to-Spend Today
                                </span>
                                <span
                                    className={cx(
                                        'inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[10px] font-extrabold uppercase tracking-wide',
                                        calculations.isOverDailyTarget
                                            ? 'bg-amber-500/15 text-amber-400'
                                            : calculations.status === 'healthy'
                                            ? 'bg-emerald-500/15 text-emerald-400'
                                            : calculations.status === 'tight'
                                            ? 'bg-amber-500/15 text-amber-400'
                                            : 'bg-rose-500/15 text-rose-400'
                                    )}
                                >
                                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                                    {calculations.isOverDailyTarget
                                        ? 'Daily Target Exceeded'
                                        : calculations.status === 'healthy'
                                        ? 'Protected'
                                        : calculations.status === 'tight'
                                        ? 'Caution'
                                        : 'Action Needed'}
                                </span>
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                                <span className="tnum text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
                                    {formatCurrency(calculations.safeTodayRemaining, currency)}
                                    <span className="text-xs font-semibold text-ink-muted"> left today</span>
                                </span>

                                <span className="text-xs font-medium text-ink-faint">
                                    {calculations.todaySpent > 0 ? (
                                        calculations.isOverDailyTarget ? (
                                            <>
                                                (Spent {formatCurrency(calculations.todaySpent, currency)} today · over {formatCurrency(calculations.dailyTarget, currency)} target by <strong className="text-amber-400">{formatCurrency(calculations.overDailyAmount, currency)}</strong>)
                                            </>
                                        ) : (
                                            <>
                                                (Spent {formatCurrency(calculations.todaySpent, currency)} today of {formatCurrency(calculations.dailyTarget, currency)} target · {formatCurrency(calculations.safeMonth, currency)} left for month)
                                            </>
                                        )
                                    ) : (
                                        <>
                                            ({formatCurrency(calculations.safeMonth, currency)} left for {calculations.daysRemaining} days · ₹0 spent today)
                                        </>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Quick metric chips & Expand button */}
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {calculations.todaySpent > 0 && (
                            <div className="hidden items-center gap-1.5 rounded-control bg-sunken/80 px-2.5 py-1 text-xs md:flex">
                                <Clock size={12} className="text-ink-faint" />
                                <span className="text-ink-muted font-medium">Spent Today:</span>
                                <span className={cx('font-bold tnum', calculations.isOverDailyTarget ? 'text-amber-400' : 'text-ink')}>
                                    {formatCurrency(calculations.todaySpent, currency)}
                                </span>
                            </div>
                        )}

                        <div className="hidden items-center gap-2 rounded-control bg-sunken/80 px-2.5 py-1 text-xs md:flex">
                            <span className="text-ink-muted font-medium">Reserved Dues:</span>
                            <span className="font-bold text-neg tnum">
                                -{formatCurrency(calculations.totalObligations, currency)}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsDetailsOpen((prev) => !prev)}
                            className="inline-flex items-center gap-1.5 rounded-control bg-surface hover:bg-raised px-3 py-1.5 text-xs font-bold text-ink transition active:scale-95 shadow-sm"
                            aria-expanded={isDetailsOpen}
                        >
                            <Calculator size={13} className="text-brand" />
                            <span>Breakdown &amp; Simulator</span>
                            {isDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>

                {/* Collapsible Deep Breakdown & "Can I Afford This?" Real-Time Simulator */}
                <AnimatePresence>
                    {isDetailsOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden border-t border-line/40 bg-sunken/40"
                        >
                            <div className="p-4 sm:p-5">
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                                    {/* Left (6 cols): Calculation Breakdown */}
                                    <div className="space-y-3 lg:col-span-6">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                                                How Safe-to-Spend is calculated
                                            </h4>
                                            <span className="text-[11px] font-medium text-ink-faint">
                                                {calculations.isUsingBankAccounts
                                                    ? 'Synced with Bank Accounts'
                                                    : 'Calculated from Net Cashflow'}
                                            </span>
                                        </div>

                                        <div className="space-y-2 rounded-control bg-surface p-3.5 border border-line/40">
                                            {/* Liquid Balance */}
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="flex items-center gap-2 text-ink-muted">
                                                    <Landmark size={14} className="text-brand" />
                                                    Available Liquid Balance
                                                </span>
                                                <span className="font-bold text-ink tnum">
                                                    {formatCurrency(calculations.liquidCash, currency)}
                                                </span>
                                            </div>

                                            {/* Obligations */}
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="flex items-center gap-2 text-ink-muted">
                                                    <Receipt size={14} className="text-warn" />
                                                    Upcoming Bills ({calculations.upcomingBills.length} pending)
                                                </span>
                                                <span className="font-bold text-neg tnum">
                                                    -{formatCurrency(calculations.billsTotal, currency)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs">
                                                <span className="flex items-center gap-2 text-ink-muted">
                                                    <Wallet size={14} className="text-neg" />
                                                    Active Loan EMIs ({calculations.activeEmis.length} due)
                                                </span>
                                                <span className="font-bold text-neg tnum">
                                                    -{formatCurrency(calculations.emisTotal, currency)}
                                                </span>
                                            </div>

                                            {calculations.payablesTotal > 0 && (
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="flex items-center gap-2 text-ink-muted">
                                                        <ShieldAlert size={14} className="text-violet" />
                                                        Borrowed Debts Due
                                                    </span>
                                                    <span className="font-bold text-neg tnum">
                                                        -{formatCurrency(calculations.payablesTotal, currency)}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="my-1.5 border-t border-line/50" />

                                            {/* Monthly Pool */}
                                            <div className="flex items-center justify-between text-xs sm:text-sm">
                                                <span className="font-bold text-ink">
                                                    Discretionary Pool for Month
                                                </span>
                                                <span className="font-extrabold text-emerald-400 tnum">
                                                    {formatCurrency(calculations.safeMonth, currency)}
                                                </span>
                                            </div>

                                            <div className="my-1.5 border-t border-line/50" />

                                            {/* Today's Real-time Allocation & Spending */}
                                            <div className="space-y-1.5 pt-0.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-ink-muted">Today's Target Allowance</span>
                                                    <span className="font-bold text-ink tnum">
                                                        {formatCurrency(calculations.dailyTarget, currency)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-ink-muted">
                                                        Already Spent Today ({calculations.todayCount} txs)
                                                    </span>
                                                    <span className={cx('font-bold tnum', calculations.todaySpent > 0 ? 'text-amber-400' : 'text-ink-muted')}>
                                                        -{formatCurrency(calculations.todaySpent, currency)}
                                                    </span>
                                                </div>

                                                {/* Mini progress bar for today */}
                                                <div className="pt-1">
                                                    <div className="flex items-center justify-between text-[11px] text-ink-faint mb-1">
                                                        <span>Today's spend pace</span>
                                                        <span className="tnum font-semibold text-ink">
                                                            {calculations.percentOfDailySpent}% of daily target
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                                                        <div
                                                             className={cx(
                                                                'h-full transition-all duration-300 rounded-full',
                                                                calculations.isOverDailyTarget
                                                                    ? 'bg-amber-400'
                                                                    : 'bg-emerald-400'
                                                            )}
                                                            style={{ width: `${calculations.percentOfDailySpent}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
                                                    <span className="font-bold text-ink">
                                                        Safe-to-Spend Left Today
                                                    </span>
                                                    <span className={cx(
                                                        'font-extrabold tnum',
                                                        calculations.isOverDailyTarget
                                                            ? 'text-amber-400'
                                                            : 'text-emerald-400'
                                                    )}>
                                                        {formatCurrency(calculations.safeTodayRemaining, currency)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right (6 cols): "Can I Afford This?" Live Real-Time Simulator */}
                                    <div className="rounded-control bg-surface p-4 lg:col-span-6 flex flex-col justify-between border border-line/40">
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand/10 text-brand">
                                                        <Sparkles size={13} />
                                                    </span>
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                                                        "Can I Afford This?" Check
                                                    </h4>
                                                </div>
                                                <span className="text-[10px] font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                                                    Live Impact Analysis
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-ink-muted leading-relaxed mb-3">
                                                Test an expense in real-time to preview exact consequences on today's budget, upcoming bills, and remaining daily allowance.
                                            </p>

                                            {/* Input + Quick amount chips */}
                                            <div className="space-y-2">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="Enter expense amount to test (e.g. 2000)"
                                                        value={simulationAmount}
                                                        onChange={(e) => setSimulationAmount(e.target.value)}
                                                        className="w-full rounded-control bg-sunken px-3.5 py-2 text-xs font-bold text-ink placeholder:text-ink-faint outline-none focus:ring-1 focus:ring-brand border border-line/50"
                                                    />
                                                    {simulationAmount && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSimulationAmount('')}
                                                            className="absolute right-2.5 top-2.5 text-ink-muted hover:text-ink transition"
                                                            aria-label="Clear simulation amount"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Quick Presets */}
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-[10px] font-semibold text-ink-faint mr-1">Quick:</span>
                                                    {[500, 1000, 2000, 5000].map((preset) => (
                                                        <button
                                                            key={preset}
                                                            type="button"
                                                            onClick={() => handleQuickAdd(preset)}
                                                            className={cx(
                                                                'rounded-md px-2 py-0.5 text-[11px] font-semibold transition border',
                                                                Number(simulationAmount) === preset
                                                                    ? 'bg-brand/20 text-brand border-brand/40'
                                                                    : 'bg-sunken text-ink-muted hover:text-ink hover:bg-raised border-line/40'
                                                            )}
                                                        >
                                                            +{formatCurrency(preset, currency)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Live Simulation Results */}
                                            {simulationResult && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="mt-3.5 space-y-3"
                                                >
                                                    {/* Verdict Banner */}
                                                    <div className="rounded-control bg-sunken/90 p-3 border border-line/50">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase flex items-center gap-1', simulationResult.badgeColor)}>
                                                                <simulationResult.icon size={12} />
                                                                {simulationResult.badge}
                                                            </span>
                                                        </div>
                                                        <h5 className="text-xs font-bold text-ink">
                                                            {simulationResult.headline}
                                                        </h5>
                                                        <p className="mt-1 text-[11px] font-medium text-ink-muted leading-relaxed">
                                                            {simulationResult.explanation}
                                                        </p>
                                                    </div>

                                                    {/* 4-Card Real-Time Prediction Comparison Grid */}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {/* 1. Today's Spend */}
                                                        <div className="rounded-lg bg-sunken/80 p-2.5 border border-line/30">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
                                                                Today's Spend
                                                            </span>
                                                            <div className="mt-1 flex items-center gap-1 text-xs font-extrabold tnum">
                                                                <span className="text-ink-muted">{formatCurrency(calculations.todaySpent, currency)}</span>
                                                                <ArrowRight size={11} className="text-ink-faint shrink-0" />
                                                                <span className={simulationResult.isExceedingToday ? 'text-amber-400' : 'text-emerald-400'}>
                                                                    {formatCurrency(simulationResult.projectedTodaySpent, currency)}
                                                                </span>
                                                            </div>
                                                            <span className={cx('mt-0.5 text-[10px] font-semibold block tnum', simulationResult.isExceedingToday ? 'text-amber-400' : 'text-emerald-400')}>
                                                                {simulationResult.isExceedingToday
                                                                    ? `Over target by ${formatCurrency(simulationResult.todayOverAmount, currency)}`
                                                                    : `${formatCurrency(simulationResult.todayRemainingAfterSim, currency)} left safe today`}
                                                            </span>
                                                        </div>

                                                        {/* 2. Tomorrow's Daily Allowance */}
                                                        <div className="rounded-lg bg-sunken/80 p-2.5 border border-line/30">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
                                                                Next {simulationResult.futureDays} Days Pace
                                                            </span>
                                                            <div className="mt-1 flex items-center gap-1 text-xs font-extrabold tnum">
                                                                <span className="text-ink-muted">{formatCurrency(simulationResult.currentFutureDaily, currency)}</span>
                                                                <ArrowRight size={11} className="text-ink-faint shrink-0" />
                                                                <span className={simulationResult.dailyDrop > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                                                                    {formatCurrency(simulationResult.newFutureDaily, currency)}/d
                                                                </span>
                                                            </div>
                                                            <span className="mt-0.5 text-[10px] font-semibold text-ink-muted block tnum">
                                                                {simulationResult.dailyDrop > 0
                                                                    ? `-${formatCurrency(simulationResult.dailyDrop, currency)}/day drop`
                                                                    : 'Daily pace unaffected'}
                                                            </span>
                                                        </div>

                                                        {/* 3. Monthly Discretionary Left */}
                                                        <div className="rounded-lg bg-sunken/80 p-2.5 border border-line/30">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
                                                                Discretionary Pool
                                                            </span>
                                                            <div className="mt-1 flex items-center gap-1 text-xs font-extrabold tnum">
                                                                <span className="text-ink-muted">{formatCurrency(calculations.safeMonth, currency)}</span>
                                                                <ArrowRight size={11} className="text-ink-faint shrink-0" />
                                                                <span className="text-emerald-400">
                                                                    {formatCurrency(simulationResult.newSafeMonth, currency)}
                                                                </span>
                                                            </div>
                                                            <span className="mt-0.5 text-[10px] font-semibold text-ink-muted block tnum">
                                                                -{simulationResult.safeMonthReductionPct}% of monthly pool
                                                            </span>
                                                        </div>

                                                        {/* 4. Mandatory Dues Safety */}
                                                        <div className="rounded-lg bg-sunken/80 p-2.5 border border-line/30">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
                                                                Mandatory Dues Shield
                                                            </span>
                                                            <div className="mt-1 text-xs font-extrabold tnum">
                                                                {simulationResult.isObligationInvaded ? (
                                                                    <span className="text-rose-400 flex items-center gap-1">
                                                                        <AlertTriangle size={12} />
                                                                        {formatCurrency(simulationResult.invadedAmount, currency)} At Risk
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-emerald-400 flex items-center gap-1">
                                                                        <ShieldCheck size={12} />
                                                                        100% Protected
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="mt-0.5 text-[10px] font-semibold text-ink-muted block tnum">
                                                                {calculations.totalObligations > 0
                                                                    ? `${formatCurrency(calculations.totalObligations, currency)} reserved`
                                                                    : 'No mandatory dues'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>

                                        <p className="mt-3 text-[10px] text-ink-faint leading-normal">
                                            💡 Real-time predictions automatically adjust based on today's live transactions, bills, and liquid bank balances.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
}

export default SafeToSpendWidget;
