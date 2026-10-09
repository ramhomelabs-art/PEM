import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck, Sparkles, ChevronUp, ChevronDown, TrendingUp,
    TrendingDown, Info, Flame, Target, Compass, AlertTriangle,
    SlidersHorizontal, ShieldAlert, ArrowRight, CheckCircle2
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { calculateEmergencyFundRunway } from '../../utils/emergencyFundCalculator';
import RunwayProgressBar from './emergency_fund/RunwayProgressBar';
import RunwayStressTest from './emergency_fund/RunwayStressTest';
import SurplusAllocationModal from './emergency_fund/SurplusAllocationModal';
import LiquidityBreakdownTooltip from './emergency_fund/LiquidityBreakdownTooltip';

export const EmergencyFundRunwayCard = ({
    banks = [],
    transactions = [],
    loans = [],
    bills = [],
    kpiBalance = 0,
    liquidBalance = null,
    currency = 'INR',
    loading = false
}) => {
    // Persisted target months (3, 6, 9, 12; default 6)
    const [targetMonths, setTargetMonths] = useState(() => {
        const saved = localStorage.getItem('pem_emergency_target_months');
        const num = Number(saved);
        return [3, 6, 9, 12].includes(num) ? num : 6;
    });

    const [showAdvice, setShowAdvice] = useState(false);
    const [showStressTest, setShowStressTest] = useState(false);
    const [showSurplusModal, setShowSurplusModal] = useState(false);

    useEffect(() => {
        localStorage.setItem('pem_emergency_target_months', String(targetMonths));
    }, [targetMonths]);

    // Financial Calculation Engine
    const runway = useMemo(() => {
        return calculateEmergencyFundRunway({
            transactions,
            banks,
            liquidBalance,
            kpiBalance,
            targetMonths,
            loans,
            bills
        });
    }, [transactions, banks, liquidBalance, kpiBalance, targetMonths, loans, bills]);

    if (loading) {
        return (
            <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-surface/80 p-5 shadow-2xl animate-pulse">
                <div className="h-6 w-52 rounded-xl bg-raised/60" />
                <div className="mt-4 h-16 w-full rounded-2xl bg-raised/40" />
            </div>
        );
    }

    const {
        tier,
        survivalMonthsFormatted,
        survivalDays,
        lifestyleMonthsFormatted,
        runwayGapMonths,
        essentialMonthlyBurn,
        lifestyleMonthlyBurn,
        totalLiquid,
        targetAmount,
        progressPercent,
        cappedProgressPercent,
        surplusPercent,
        surplusAmount,
        remainingNeeded,
        isLimitedData,
        suggestedTarget,
        insights,
        historySeries,
        liquidity
    } = runway;

    return (
        <section className="mt-4">
            <div
                className="overflow-hidden rounded-3xl border border-line dark:border-line bg-surface/80 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:border-line-strong"
            >
                {/* Dynamic Tier Glow Accent Top Line */}
                <div
                    className={`h-[2.5px] w-full bg-gradient-to-r ${tier.barGradient}`}
                    style={{ opacity: 0.9 }}
                />

                <div className="p-4 sm:p-6 space-y-5">
                    {/* Header Row: Title, Badge, Target Selector, and Alert */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className={`grid h-11 w-11 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-2xl bg-${tier.colorName}-500/15 text-${tier.colorName}-400 border border-${tier.colorName}-500/30 shadow-lg`}
                                style={{ boxShadow: `0 0 18px ${tier.glowColor}` }}
                            >
                                <ShieldCheck size={24} strokeWidth={2.3} />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-ink">
                                        Emergency Fund Runway
                                    </h3>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tier.badgeClass}`}>
                                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                                        {tier.badgeText}
                                    </span>
                                    {isLimitedData && (
                                        <span className="text-[10px] text-ink-muted bg-raised px-2.5 py-0.5 rounded-full border border-line">
                                            Limited data (preliminary)
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-ink-muted">
                                    {tier.description}
                                </p>
                            </div>
                        </div>

                        {/* Target Months Selector & MoM Sparkline Delta */}
                        <div className="flex items-center gap-3 self-start sm:self-auto">
                            {/* MoM Delta Chip */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sunken/50 border border-line text-xs font-semibold text-ink-muted">
                                {Number(historySeries.momDelta) >= 0 ? (
                                    <TrendingUp size={13} className="text-emerald-400" />
                                ) : (
                                    <TrendingDown size={13} className="text-rose-400" />
                                )}
                                <span className="tnum">{historySeries.momDeltaFormatted}</span>
                                <span className="text-[10px] text-ink-faint font-medium">MoM</span>
                            </div>

                            {/* Target Selector */}
                            <div className="flex items-center gap-1 p-1 rounded-xl bg-sunken/60 border border-line">
                                {[3, 6, 9, 12].map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setTargetMonths(m)}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                            targetMonths === m
                                                ? 'bg-brand text-brand-contrast shadow-sm shadow-brand/25'
                                                : 'text-ink-muted hover:text-ink hover:bg-raised'
                                        }`}
                                        title={`Set target to ${m} months`}
                                        aria-pressed={targetMonths === m}
                                    >
                                        {m}M
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Smart Suggested Target Hint */}
                    {suggestedTarget.targetMonths !== targetMonths && (
                        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-ink-muted flex items-center justify-between gap-2 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <Compass size={14} className="text-indigo-400 shrink-0" />
                                <span>
                                    Recommended: <strong className="text-ink">{suggestedTarget.targetMonths} Months</strong> ({suggestedTarget.reason})
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTargetMonths(suggestedTarget.targetMonths)}
                                className="text-indigo-400 font-bold hover:underline shrink-0 text-xs cursor-pointer"
                            >
                                Apply {suggestedTarget.targetMonths}M
                            </button>
                        </div>
                    )}

                    {/* Dual Runways Main Metrics + Multi-Segment Progress Bar */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                        {/* Left: Dual Runways Display */}
                        <div className="lg:col-span-7 space-y-3">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <span className="tnum text-3xl sm:text-4xl font-black tracking-tight text-ink">
                                    {survivalMonthsFormatted} Months
                                </span>
                                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    Survival Runway
                                </span>
                                <span className="text-xs text-ink-faint">
                                    ({survivalDays} days essentials only)
                                </span>
                            </div>

                            {/* Dual Comparison Gap Breakdown */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                    <span>
                                        Essential Burn: <strong className="text-ink tnum">{formatCurrency(essentialMonthlyBurn, currency)}/mo</strong>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                                    <span>
                                        Lifestyle Runway: <strong className="text-ink tnum">{lifestyleMonthsFormatted} Mo</strong> ({formatCurrency(lifestyleMonthlyBurn, currency)}/mo)
                                    </span>
                                </div>
                                {runwayGapMonths >= 0.5 && (
                                    <span className="text-brand font-semibold">
                                        (+{runwayGapMonths.toFixed(1)} Mo discretionary buffer)
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Right: Milestone Progress Bar & Target Summary */}
                        <div className="lg:col-span-5 flex flex-col gap-2.5">
                            <div className="flex justify-between items-center text-xs font-semibold">
                                <span className="text-ink-muted">
                                    {targetMonths}-Month Goal Progress
                                </span>
                                <span className="text-ink font-extrabold tnum text-sm">
                                    {progressPercent}%
                                </span>
                            </div>

                            {/* Multi-Segment Milestone Progress Bar */}
                            <RunwayProgressBar
                                progressPercent={progressPercent}
                                cappedProgressPercent={cappedProgressPercent}
                                surplusPercent={surplusPercent}
                                targetMonths={targetMonths}
                                tier={tier}
                            />

                            {/* Liquid vs Target Balance Strip with Tooltip */}
                            <div className="flex items-center justify-between text-xs text-ink-faint font-medium pt-0.5">
                                <span className="flex items-center gap-1">
                                    <span>Liquid Reserves:</span>
                                    <strong className="text-ink">{formatCurrency(totalLiquid, currency)}</strong>
                                    <LiquidityBreakdownTooltip liquidity={liquidity} currency={currency} />
                                </span>
                                <span>
                                    Target: <strong className="text-ink">{formatCurrency(targetAmount, currency)}</strong>
                                </span>
                            </div>

                            {/* Actionable Surplus Button when above target */}
                            {surplusAmount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowSurplusModal(true)}
                                    className="mt-1 w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-emerald-500/15 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                                >
                                    <Sparkles size={14} className="text-amber-400" />
                                    <span>Allocate {formatCurrency(surplusAmount, currency)} Surplus</span>
                                    <ArrowRight size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bottom Strip: Collapsible Dynamic Insights & What-If Stress Tester */}
                    <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => setShowAdvice(!showAdvice)}
                                className="font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                                <Sparkles size={13} className="text-brand" />
                                <span>{showAdvice ? 'Hide Insights' : `Smart Insights (${insights.length})`}</span>
                                {showAdvice ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowStressTest(!showStressTest)}
                                className="font-semibold text-ink-muted hover:text-ink inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <ShieldAlert size={13} className="text-rose-400" />
                                <span>{showStressTest ? 'Close Stress Test' : 'What-If Stress Test'}</span>
                                {showStressTest ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        </div>

                        {/* Quick 1-line key takeaway summary */}
                        <div className="text-[11px] text-ink-muted truncate max-w-sm">
                            {surplusAmount > 0
                                ? `Surplus of ${formatCurrency(surplusAmount, currency)} beyond ${targetMonths}M target`
                                : remainingNeeded > 0
                                    ? `Need ${formatCurrency(remainingNeeded, currency)} to reach full ${targetMonths}M target`
                                    : 'Optimal reserve achieved'}
                        </div>
                    </div>

                    {/* Collapsible Dynamic Personalized Insights Drawer */}
                    <AnimatePresence>
                        {showAdvice && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden space-y-2 pt-1"
                            >
                                <div className="rounded-2xl border border-line bg-sunken/60 p-4 text-xs space-y-3 backdrop-blur-md">
                                    {insights.map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-2.5">
                                            <div className="p-1.5 rounded-xl bg-surface border border-line shrink-0 mt-0.5">
                                                {item.type === 'critical' ? (
                                                    <AlertTriangle size={13} className="text-rose-400" />
                                                ) : item.type === 'surplus' ? (
                                                    <Sparkles size={13} className="text-amber-400" />
                                                ) : item.type === 'goal' ? (
                                                    <Target size={13} className="text-emerald-400" />
                                                ) : (
                                                    <Info size={13} className="text-sky-400" />
                                                )}
                                            </div>
                                            <div>
                                                <strong className="text-ink font-semibold">{item.title}: </strong>
                                                <span className="text-ink-muted leading-relaxed">{item.text}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Collapsible What-If Stress Test Simulator Drawer */}
                    <AnimatePresence>
                        {showStressTest && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden pt-1"
                            >
                                <RunwayStressTest
                                    totalLiquid={totalLiquid}
                                    essentialMonthlyBurn={essentialMonthlyBurn}
                                    lifestyleMonthlyBurn={lifestyleMonthlyBurn}
                                    currency={currency}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Actionable Surplus Deployment Modal */}
            <SurplusAllocationModal
                isOpen={showSurplusModal}
                onClose={() => setShowSurplusModal(false)}
                surplusAmount={surplusAmount}
                currency={currency}
            />
        </section>
    );
};

export default EmergencyFundRunwayCard;
