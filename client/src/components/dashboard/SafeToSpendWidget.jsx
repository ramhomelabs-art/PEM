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
    Compass,
    TrendingDown,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { cx } from '../ui/cx';

/* -------------------------------------------------------------------------- */
/* Animated Liquid Water Wave Component                                      */
/* -------------------------------------------------------------------------- */
function LiquidWaveGauge({
    percentage = 100,
    status = 'healthy',
    size = 110,
    label = '',
    sublabel = '',
}) {
    const clampedPct = Math.max(0, Math.min(100, Math.round(percentage)));

    // Theme color gradients for liquid wave
    const waveTheme = useMemo(() => {
        if (status === 'danger' || clampedPct < 15) {
            return {
                bg: 'bg-rose-950/40',
                border: 'border-rose-500/30',
                glow: 'rgba(239, 68, 68, 0.25)',
                frontColor: 'rgba(239, 68, 68, 0.75)',
                backColor: 'rgba(244, 63, 94, 0.45)',
                textColor: 'text-rose-400',
            };
        }
        if (status === 'tight' || clampedPct < 40) {
            return {
                bg: 'bg-amber-950/40',
                border: 'border-amber-500/30',
                glow: 'rgba(245, 158, 11, 0.25)',
                frontColor: 'rgba(245, 158, 11, 0.75)',
                backColor: 'rgba(251, 191, 36, 0.45)',
                textColor: 'text-amber-400',
            };
        }
        return {
            bg: 'bg-teal-950/40',
            border: 'border-teal-500/30',
            glow: 'rgba(20, 184, 166, 0.25)',
            frontColor: 'rgba(20, 184, 166, 0.75)',
            backColor: 'rgba(16, 185, 129, 0.45)',
            textColor: 'text-teal-300',
        };
    }, [status, clampedPct]);

    // Calculate Y offset for the wave (0% = 100 y, 100% = 0 y)
    const waveY = 100 - clampedPct;

    return (
        <div className="flex flex-col items-center justify-center shrink-0">
            {/* Outer Glow Tank */}
            <div
                className={cx(
                    'relative overflow-hidden rounded-2xl border transition-all duration-500 flex items-center justify-center',
                    waveTheme.bg,
                    waveTheme.border
                )}
                style={{
                    width: size,
                    height: size,
                    boxShadow: `0 0 20px ${waveTheme.glow}`,
                }}
            >
                {/* SVG Water Waves */}
                <svg
                    className="absolute inset-0 h-full w-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id={`grad-front-${status}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={waveTheme.frontColor} />
                            <stop offset="100%" stopColor="rgba(8, 14, 29, 0.95)" />
                        </linearGradient>
                        <linearGradient id={`grad-back-${status}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={waveTheme.backColor} />
                            <stop offset="100%" stopColor="rgba(8, 14, 29, 0.75)" />
                        </linearGradient>
                    </defs>

                    {/* Back Wave */}
                    <g
                        style={{
                            transform: `translateY(${waveY}%)`,
                            transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        <path
                            d="M 0 0 Q 25 -8, 50 0 T 100 0 T 150 0 T 200 0 L 200 100 L 0 100 Z"
                            fill={`url(#grad-back-${status})`}
                            className="animate-wave-back"
                        />
                    </g>

                    {/* Front Wave */}
                    <g
                        style={{
                            transform: `translateY(${waveY}%)`,
                            transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        <path
                            d="M 0 0 Q 25 6, 50 0 T 100 0 T 150 0 T 200 0 L 200 100 L 0 100 Z"
                            fill={`url(#grad-front-${status})`}
                            className="animate-wave-front"
                        />
                    </g>
                </svg>

                {/* Central Overlay Percentage */}
                <div className="relative z-10 flex flex-col items-center justify-center text-center p-1 drop-shadow-md select-none">
                    <span className="text-xl sm:text-2xl font-black tracking-tight text-white tnum leading-none">
                        {clampedPct}%
                    </span>
                    <span className={cx('text-[9px] font-extrabold uppercase tracking-wider mt-0.5', waveTheme.textColor)}>
                        {label || 'Capacity'}
                    </span>
                </div>
            </div>

            {sublabel && (
                <span className="mt-1.5 text-[10px] font-semibold text-ink-muted text-center max-w-[120px] truncate">
                    {sublabel}
                </span>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Main Safe-to-Spend Widget                                                 */
/* -------------------------------------------------------------------------- */
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
        const percentOfDailyRemaining = Math.max(0, 100 - percentOfDailySpent);

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
            percentOfDailyRemaining,
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
        const simulatedWaterCapacity = Math.max(0, 100 - Math.round((projectedTodaySpent / (dailyTarget || 1)) * 100));

        // 3. Liquid Cash & Mandatory Obligations Safety
        const newLiquidCash = liquidCash - simVal;
        const isObligationInvaded = newLiquidCash < totalObligations || simVal > safeMonth;
        const invadedAmount = isObligationInvaded
            ? Math.max(0, totalObligations - Math.max(0, newLiquidCash)) || Math.max(0, simVal - safeMonth)
            : 0;

        // 4. Detailed Prediction & Verdict
        let level = 'safe';
        let badge = 'Safe & Affordable';
        let badgeColor = 'bg-emerald-500/20 text-emerald-400';
        let icon = CheckCircle2;
        let headline = 'Spend fits comfortably within today’s allowance';
        let explanation = '';

        if (isObligationInvaded) {
            level = 'danger';
            badge = 'Critical · Invades Mandatory Dues';
            badgeColor = 'bg-rose-500/20 text-rose-400';
            icon = ShieldAlert;
            headline = 'Unsafe Purchase: Risks Mandatory Bills & EMIs';
            explanation = `Spending ${formatCurrency(simVal, currency)} exceeds your discretionary limit and will invade ${formatCurrency(invadedAmount, currency)} of funds reserved for upcoming bills and commitments.`;
        } else if (safeMonthReductionPct > 50) {
            level = 'warning';
            badge = 'High Monthly Pool Drain';
            badgeColor = 'bg-orange-500/20 text-orange-400';
            icon = AlertTriangle;
            headline = 'Major impact on remaining month budget';
            explanation = `This single purchase consumes ${safeMonthReductionPct}% of your total monthly discretionary funds. Your daily budget for the remaining ${futureDays} days drops by ${formatCurrency(dailyDrop, currency)}/day (down to ${formatCurrency(newFutureDaily, currency)}/day).`;
        } else if (isExceedingToday) {
            level = 'caution';
            badge = 'Exceeds Today (Month Safe)';
            badgeColor = 'bg-amber-500/20 text-amber-400';
            icon = AlertTriangle;
            headline = 'Crosses today’s daily budget';
            explanation = `Spending this pushes today's spend to ${formatCurrency(projectedTodaySpent, currency)} (over target by ${formatCurrency(todayOverAmount, currency)}). Covered by your monthly pool without risking bills, adjusting tomorrow's allowance to ${formatCurrency(newFutureDaily, currency)}/day.`;
        } else {
            level = 'safe';
            badge = 'Within Daily Target';
            badgeColor = 'bg-emerald-500/20 text-emerald-400';
            icon = CheckCircle2;
            headline = 'Comfortably affordable today';
            explanation = `After this expense, you'll still have ${formatCurrency(todayRemainingAfterSim, currency)} safe for today, and future daily pace stays strong at ${formatCurrency(newFutureDaily, currency)}/day for the next ${futureDays} days.`;
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
            simulatedWaterCapacity,
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
            <div className="mb-4 h-16 w-full animate-pulse rounded-2xl bg-[#0c1427]/60" />
        );
    }

    return (
        <section className="mb-4 w-full">
            {/* Primary Safe-to-Spend Banner (Solid Dark Surface, No White Borders) */}
            <div
                className={cx(
                    'group relative w-full overflow-hidden rounded-2xl bg-[#0c1427] transition-all duration-300 shadow-[0_12px_40px_rgba(0,0,0,0.5)]',
                    calculations.status === 'healthy'
                        ? 'shadow-[0_0_24px_rgba(16,185,129,0.06)]'
                        : calculations.status === 'tight'
                        ? 'shadow-[0_0_24px_rgba(245,158,11,0.06)]'
                        : 'shadow-[0_0_24px_rgba(239,68,68,0.08)]'
                )}
            >
                {/* Ambient glow accent top line */}
                <div
                    className={cx(
                        'h-[2px] w-full',
                        calculations.status === 'healthy'
                            ? 'bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent'
                            : calculations.status === 'tight'
                            ? 'bg-gradient-to-r from-transparent via-amber-400/80 to-transparent'
                            : 'bg-gradient-to-r from-transparent via-rose-400/80 to-transparent'
                    )}
                />

                <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4 bg-[#0c1427]">
                    {/* Left: Indicator & Headline */}
                    <div className="flex items-center gap-3">
                        <div
                            className={cx(
                                'grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105',
                                calculations.status === 'healthy'
                                    ? 'bg-emerald-500/15 text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                                    : calculations.status === 'tight'
                                    ? 'bg-amber-500/15 text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
                                    : 'bg-rose-500/15 text-rose-400 shadow-[0_0_16px_rgba(239,68,68,0.25)]'
                            )}
                        >
                            {calculations.status === 'danger' ? (
                                <ShieldAlert size={22} strokeWidth={2.4} />
                            ) : (
                                <ShieldCheck size={22} strokeWidth={2.4} />
                            )}
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                                    Safe-to-Spend Today
                                </span>
                                <span
                                    className={cx(
                                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
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
                                <span className="tnum text-xl sm:text-2xl font-black tracking-tight text-white">
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
                            <div className="hidden items-center gap-1.5 rounded-xl bg-[#101a33] px-3 py-1.5 text-xs md:flex">
                                <Clock size={12} className="text-ink-faint" />
                                <span className="text-ink-muted font-medium">Spent Today:</span>
                                <span className={cx('font-bold tnum', calculations.isOverDailyTarget ? 'text-amber-400' : 'text-white')}>
                                    {formatCurrency(calculations.todaySpent, currency)}
                                </span>
                            </div>
                        )}

                        <div className="hidden items-center gap-2 rounded-xl bg-[#101a33] px-3 py-1.5 text-xs md:flex">
                            <span className="text-ink-muted font-medium">Reserved Dues:</span>
                            <span className="font-bold text-rose-400 tnum">
                                -{formatCurrency(calculations.totalObligations, currency)}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsDetailsOpen((prev) => !prev)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#101a33] hover:bg-[#152243] px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95 shadow-sm"
                            aria-expanded={isDetailsOpen}
                        >
                            <Calculator size={13} className="text-teal-400" />
                            <span>Real-Time Breakdown &amp; Test</span>
                            {isDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>

                {/* Collapsible Deep Breakdown & Real-Time Wave Simulator */}
                <AnimatePresence>
                    {isDetailsOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="w-full overflow-hidden bg-[#080e1d]"
                        >
                            <div className="p-4 sm:p-5">
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {/* Left Column: Calculation Breakdown + Dynamic Water Wave Gauge */}
                                    <div className="flex flex-col justify-between space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                                                <Compass size={13} className="text-teal-400" />
                                                How Safe-to-Spend is calculated
                                            </h4>
                                            <span className="text-[11px] font-medium text-teal-400/80">
                                                {calculations.isUsingBankAccounts
                                                    ? 'Synced with Bank Accounts'
                                                    : 'Calculated from Net Cashflow'}
                                            </span>
                                        </div>

                                        <div className="rounded-2xl bg-[#101a33] p-4 flex flex-col gap-3 shadow-inner">
                                            {/* Top row: Wave Tank + Core Pool Summary */}
                                            <div className="flex items-center gap-4">
                                                <LiquidWaveGauge
                                                    percentage={
                                                        simulationResult
                                                            ? simulationResult.simulatedWaterCapacity
                                                            : calculations.percentOfDailyRemaining
                                                    }
                                                    status={
                                                        simulationResult
                                                            ? simulationResult.level
                                                            : calculations.status
                                                    }
                                                    size={96}
                                                    label={simulationResult ? 'Live Safe' : 'Today Safe'}
                                                    sublabel={
                                                        simulationResult
                                                            ? `${simulationResult.simulatedWaterCapacity}% left today`
                                                            : `${calculations.percentOfDailyRemaining}% allowance left`
                                                    }
                                                />

                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="flex items-center gap-1.5 text-ink-muted">
                                                            <Landmark size={13} className="text-teal-400" />
                                                            Liquid Balance
                                                        </span>
                                                        <span className="font-extrabold text-white tnum">
                                                            {formatCurrency(calculations.liquidCash, currency)}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="flex items-center gap-1.5 text-ink-muted">
                                                            <Receipt size={13} className="text-amber-400" />
                                                            Upcoming Bills ({calculations.upcomingBills.length})
                                                        </span>
                                                        <span className="font-bold text-rose-400 tnum">
                                                            -{formatCurrency(calculations.billsTotal, currency)}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="flex items-center gap-1.5 text-ink-muted">
                                                            <Wallet size={13} className="text-rose-400" />
                                                            Loan EMIs ({calculations.activeEmis.length})
                                                        </span>
                                                        <span className="font-bold text-rose-400 tnum">
                                                            -{formatCurrency(calculations.emisTotal, currency)}
                                                        </span>
                                                    </div>

                                                    {calculations.payablesTotal > 0 && (
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="flex items-center gap-1.5 text-ink-muted">
                                                                <ShieldAlert size={13} className="text-violet-400" />
                                                                Borrowed Debts
                                                            </span>
                                                            <span className="font-bold text-rose-400 tnum">
                                                                -{formatCurrency(calculations.payablesTotal, currency)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Divider */}
                                            <div className="h-[1px] w-full bg-white/[0.04]" />

                                            {/* Discretionary Pool for Month */}
                                            <div className="flex items-center justify-between text-xs sm:text-sm">
                                                <span className="font-bold text-ink-muted">
                                                    Discretionary Pool for Month
                                                </span>
                                                <span className="font-black text-emerald-400 tnum text-base">
                                                    {formatCurrency(calculations.safeMonth, currency)}
                                                </span>
                                            </div>

                                            {/* Today's Allocation and Spend */}
                                            <div className="rounded-xl bg-[#080e1d]/80 p-3 space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-ink-muted font-medium">Today's Target Allowance</span>
                                                    <span className="font-bold text-white tnum">
                                                        {formatCurrency(calculations.dailyTarget, currency)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-ink-muted font-medium">
                                                        Already Spent Today ({calculations.todayCount} txs)
                                                    </span>
                                                    <span className={cx('font-bold tnum', calculations.todaySpent > 0 ? 'text-amber-400' : 'text-ink-faint')}>
                                                        -{formatCurrency(calculations.todaySpent, currency)}
                                                    </span>
                                                </div>

                                                {/* Spend pace progress bar */}
                                                <div>
                                                    <div className="flex items-center justify-between text-[11px] text-ink-faint mb-1">
                                                        <span>Daily pace consumption</span>
                                                        <span className="tnum font-bold text-white">
                                                            {calculations.percentOfDailySpent}%
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0c1427]">
                                                        <div
                                                            className={cx(
                                                                'h-full transition-all duration-500 rounded-full',
                                                                calculations.isOverDailyTarget
                                                                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                                                    : 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                                            )}
                                                            style={{ width: `${calculations.percentOfDailySpent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: "Can I Afford This?" Live Real-Time Simulator */}
                                    <div className="rounded-2xl bg-[#101a33] p-4 flex flex-col justify-between shadow-inner">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-teal-500/15 text-teal-300">
                                                        <Sparkles size={13} />
                                                    </span>
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                                        "Can I Afford This?" Check
                                                    </h4>
                                                </div>
                                                <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full">
                                                    Real-Time Predictor
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-ink-muted leading-relaxed mb-3">
                                                Enter an expense to test how it impacts today's limit, future daily budgets, and bill safety.
                                            </p>

                                            {/* Input + Quick amount chips */}
                                            <div className="space-y-2.5">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="Enter expense amount (e.g. 2000)"
                                                        value={simulationAmount}
                                                        onChange={(e) => setSimulationAmount(e.target.value)}
                                                        className="w-full rounded-xl bg-[#080e1d] px-3.5 py-2.5 text-xs font-bold text-white placeholder:text-ink-faint outline-none focus:ring-1 focus:ring-teal-400"
                                                    />
                                                    {simulationAmount && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSimulationAmount('')}
                                                            className="absolute right-3 top-2.5 text-ink-muted hover:text-white transition"
                                                            aria-label="Clear simulation amount"
                                                        >
                                                            <X size={15} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Quick Presets */}
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-[10px] font-bold text-ink-faint mr-1">Quick:</span>
                                                    {[500, 1000, 2000, 5000].map((preset) => (
                                                        <button
                                                            key={preset}
                                                            type="button"
                                                            onClick={() => handleQuickAdd(preset)}
                                                            className={cx(
                                                                'rounded-lg px-2.5 py-1 text-[11px] font-bold transition',
                                                                Number(simulationAmount) === preset
                                                                    ? 'bg-teal-500/20 text-teal-300 shadow-[0_0_10px_rgba(20,184,166,0.3)]'
                                                                    : 'bg-[#080e1d] text-ink-muted hover:text-white hover:bg-[#152243]'
                                                            )}
                                                        >
                                                            +{formatCurrency(preset, currency)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Live Simulation Results */}
                                            {simulationResult ? (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="mt-3 space-y-2.5"
                                                >
                                                    {/* Verdict Banner */}
                                                    <div className="rounded-xl bg-[#080e1d] p-3">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={cx('rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase flex items-center gap-1', simulationResult.badgeColor)}>
                                                                <simulationResult.icon size={12} />
                                                                {simulationResult.badge}
                                                            </span>
                                                        </div>
                                                        <h5 className="text-xs font-extrabold text-white">
                                                            {simulationResult.headline}
                                                        </h5>
                                                        <p className="mt-1 text-[11px] font-medium text-ink-muted leading-relaxed">
                                                            {simulationResult.explanation}
                                                        </p>
                                                    </div>

                                                    {/* 4-Card Real-Time Prediction Comparison Grid */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {/* 1. Today's Spend */}
                                                        <div className="rounded-xl bg-[#080e1d] p-2.5">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
                                                                Today's Spend
                                                            </span>
                                                            <div className="mt-0.5 flex items-center gap-1 text-xs font-black tnum">
                                                                <span className="text-ink-muted">{formatCurrency(calculations.todaySpent, currency)}</span>
                                                                <ArrowRight size={11} className="text-ink-faint shrink-0" />
                                                                <span className={simulationResult.isExceedingToday ? 'text-amber-400' : 'text-emerald-400'}>
                                                                    {formatCurrency(simulationResult.projectedTodaySpent, currency)}
                                                                </span>
                                                            </div>
                                                            <span className={cx('mt-0.5 text-[10px] font-semibold block tnum', simulationResult.isExceedingToday ? 'text-amber-400' : 'text-emerald-400')}>
                                                                {simulationResult.isExceedingToday
                                                                    ? `Over target by ${formatCurrency(simulationResult.todayOverAmount, currency)}`
                                                                    : `${formatCurrency(simulationResult.todayRemainingAfterSim, currency)} safe left`}
                                                            </span>
                                                        </div>

                                                        {/* 2. Tomorrow's Daily Allowance */}
                                                        <div className="rounded-xl bg-[#080e1d] p-2.5">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
                                                                Next {simulationResult.futureDays} Days Pace
                                                            </span>
                                                            <div className="mt-0.5 flex items-center gap-1 text-xs font-black tnum">
                                                                <span className="text-ink-muted">{formatCurrency(simulationResult.currentFutureDaily, currency)}</span>
                                                                <ArrowRight size={11} className="text-ink-faint shrink-0" />
                                                                <span className={simulationResult.dailyDrop > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                                                                    {formatCurrency(simulationResult.newFutureDaily, currency)}/d
                                                                </span>
                                                            </div>
                                                            <span className="mt-0.5 text-[10px] font-semibold text-ink-muted block tnum">
                                                                {simulationResult.dailyDrop > 0
                                                                    ? `-${formatCurrency(simulationResult.dailyDrop, currency)}/day drop`
                                                                    : 'Pace unaffected'}
                                                            </span>
                                                        </div>

                                                        {/* 3. Monthly Discretionary Left */}
                                                        <div className="rounded-xl bg-[#080e1d] p-2.5">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
                                                                Discretionary Pool
                                                            </span>
                                                            <div className="mt-0.5 flex items-center gap-1 text-xs font-black tnum">
                                                                <span className="text-ink-muted">{formatCurrency(calculations.safeMonth, currency)}</span>
                                                                <ArrowRight size={11} className="text-ink-faint shrink-0" />
                                                                <span className="text-emerald-400">
                                                                    {formatCurrency(simulationResult.newSafeMonth, currency)}
                                                                </span>
                                                            </div>
                                                            <span className="mt-0.5 text-[10px] font-semibold text-ink-muted block tnum">
                                                                -{simulationResult.safeMonthReductionPct}% of month pool
                                                            </span>
                                                        </div>

                                                        {/* 4. Mandatory Dues Safety */}
                                                        <div className="rounded-xl bg-[#080e1d] p-2.5">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
                                                                Bill / EMI Shield
                                                            </span>
                                                            <div className="mt-0.5 text-xs font-black tnum">
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
                                                                    : 'No dues pending'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ) : (
                                                <div className="mt-3 rounded-xl bg-[#080e1d] p-3 text-center">
                                                    <p className="text-xs font-semibold text-ink-muted">
                                                        💡 Tip: Tap any <strong className="text-teal-400">Quick</strong> amount above or type any expense to preview the live consequence before spending.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 flex items-center justify-between text-[10px] text-ink-faint border-t border-white/[0.04] pt-2">
                                            <span>⚡ Live sync with transactions</span>
                                            <span className="text-teal-400/90 font-semibold">{calculations.daysRemaining} days remaining in month</span>
                                        </div>
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
