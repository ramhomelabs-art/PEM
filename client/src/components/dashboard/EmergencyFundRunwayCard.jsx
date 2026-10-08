import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Sparkles, ChevronUp, ChevronDown, TrendingUp, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

export const EmergencyFundRunwayCard = ({
    banks = [],
    transactions = [],
    kpiBalance = 0,
    liquidBalance = null,
    currency = 'INR',
    loading = false
}) => {
    const [showRunwayTips, setShowRunwayTips] = useState(false);

    const runwayData = useMemo(() => {
        const bankSum = (banks || []).reduce((s, b) => s + (Number(b.balance) || 0), 0);
        
        // Calculate cumulative net cash from all transactions (income - expense)
        const netFromTx = (transactions || []).reduce((sum, t) => {
            const amt = Number(t.amount) || 0;
            if (t.type === 'income') return sum + amt;
            if (t.type === 'expense') return sum - amt;
            return sum;
        }, 0);

        // Real liquid cash calculation: uses linked bank balances, or live Safe-to-Spend cash, or net transaction balance
        const totalLiquid = liquidBalance != null && Number(liquidBalance) > 0
            ? Number(liquidBalance)
            : bankSum > 0
                ? bankSum
                : Number(kpiBalance) > 0
                    ? Number(kpiBalance)
                    : Math.max(0, netFromTx);

        // Calculate last 90 days expenses for accurate monthly burn rate
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

        const recentExpenses = (transactions || []).filter((t) => {
            if (t.type !== 'expense') return false;
            const d = new Date(t.date);
            return !isNaN(d.getTime()) && d >= ninetyDaysAgo;
        });

        const totalExpenseLast90 = recentExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        
        // Fallback to all expense monthly average or sensible default if no expenses
        const allExpenses = (transactions || []).filter((t) => t.type === 'expense');
        const totalAllExpenses = allExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        
        const monthlyBurn = totalExpenseLast90 > 0
            ? Math.round(totalExpenseLast90 / 3)
            : totalAllExpenses > 0
                ? Math.round(totalAllExpenses / Math.max(1, new Date().getMonth() + 1))
                : 20000;

        const runwayMonths = monthlyBurn > 0 ? totalLiquid / monthlyBurn : 0;
        const runwayMonthsFormatted = runwayMonths.toFixed(1);
        const targetGoal = monthlyBurn * 6;
        const progressPercent = Math.min(100, Math.round((runwayMonths / 6) * 100));

        let badgeText = 'Financial Fortress (6+ Mo Secured)';
        let badgeColor = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';

        if (runwayMonths < 1) {
            badgeText = 'Critical Runway (< 1 Month Buffer)';
            badgeColor = 'text-rose-400 bg-rose-500/15 border-rose-500/30';
        } else if (runwayMonths < 3) {
            badgeText = 'Moderate Runway (1–3 Months)';
            badgeColor = 'text-amber-400 bg-amber-500/15 border-amber-500/30';
        } else if (runwayMonths < 6) {
            badgeText = 'Solid Runway (3–6 Months)';
            badgeColor = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
        }

        const remainingNeeded = Math.max(0, targetGoal - totalLiquid);

        return {
            totalLiquid,
            monthlyBurn,
            runwayMonths,
            runwayMonthsFormatted,
            runwayDays: Math.round(runwayMonths * 30),
            targetGoal,
            progressPercent,
            badgeText,
            badgeColor,
            remainingNeeded,
        };
    }, [banks, transactions, kpiBalance, liquidBalance]);

    if (loading) {
        return (
            <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface p-5 shadow-card animate-pulse">
                <div className="h-6 w-48 rounded bg-sunken" />
                <div className="mt-4 h-12 w-full rounded bg-sunken" />
            </div>
        );
    }

    return (
        <section className="mt-4">
            <div className="overflow-hidden rounded-card border border-emerald-500/25 bg-gradient-to-r from-emerald-950/20 via-surface to-surface shadow-card transition-all duration-300 hover:border-emerald-500/40">
                <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80" />
                <div className="p-4 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        {/* Left metric display */}
                        <div className="flex items-start gap-3.5 sm:gap-4">
                            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/30">
                                <ShieldCheck size={24} strokeWidth={2.3} />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                                        Emergency Fund Runway
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${runwayData.badgeColor}`}>
                                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                                        {runwayData.badgeText}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <span className="tnum text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                                        {runwayData.runwayMonthsFormatted} Months
                                    </span>
                                    <span className="text-xs font-medium text-ink-faint">
                                        ({runwayData.runwayDays} days survival runway at {formatCurrency(runwayData.monthlyBurn, currency)}/mo burn)
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right Target Progress */}
                        <div className="flex flex-col gap-2 min-w-[280px] lg:max-w-xs w-full">
                            <div className="flex justify-between text-xs font-semibold">
                                <span className="text-ink-muted">6-Month Target Progress</span>
                                <span className="text-emerald-400 tnum font-bold">{runwayData.progressPercent}%</span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-sunken ring-1 ring-line/50">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${runwayData.progressPercent}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-ink-faint font-medium">
                                <span>Liquid: <strong className="text-ink">{formatCurrency(runwayData.totalLiquid, currency)}</strong></span>
                                <span>Target: <strong className="text-ink">{formatCurrency(runwayData.targetGoal, currency)}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Collapsible Tips Strip */}
                    <div className="mt-4 pt-3.5 border-t border-line/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-xs text-ink-muted flex items-center gap-1.5">
                            <Sparkles size={14} className="text-brand shrink-0" />
                            <span>
                                {runwayData.runwayMonths >= 6
                                    ? 'Outstanding! Your liquidity provides complete resilience against unforeseen emergencies.'
                                    : `Aim for 6 months buffer. You need ${formatCurrency(runwayData.remainingNeeded, currency)} more to achieve complete financial peace of mind.`}
                            </span>
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowRunwayTips(!showRunwayTips)}
                            className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1 shrink-0 self-start sm:self-auto"
                        >
                            <span>{showRunwayTips ? 'Hide Tips' : 'Runway Advice'}</span>
                            {showRunwayTips ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>

                    <AnimatePresence>
                        {showRunwayTips && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 overflow-hidden rounded-control border border-line/60 bg-sunken/80 p-3.5 text-xs text-ink-muted space-y-2"
                            >
                                <div className="flex items-start gap-2">
                                    <Info size={14} className="text-sky-400 mt-0.5 shrink-0" />
                                    <p>
                                        <strong className="text-ink">Rule of Thumb:</strong> Financial advisors recommend parking 3–6 months of living expenses in high-yield savings or liquid mutual funds.
                                    </p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <TrendingUp size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                                    <p>
                                        <strong className="text-ink">How to grow it:</strong> Set up an automatic sweep into your primary savings account on salary day before allocating to discretionary shopping.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
};

export default EmergencyFundRunwayCard;
