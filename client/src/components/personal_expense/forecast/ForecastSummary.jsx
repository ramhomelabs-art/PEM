import React from 'react';
import { Calendar, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';
import { cx } from '../../ui/cx';

/**
 * Summary row with 4 compact macro stats (each shown once):
 * 1. Month progress (thin progress bar with "Day X of Y")
 * 2. Projected month-end (Expected, with Low-High range beneath)
 * 3. Net vs budget (over or under, coloured value)
 * 4. Categories needing attention (counts split: N exceeded, N projected, N watch)
 */
export function ForecastSummary({ macroData, currency = 'INR' }) {
    if (!macroData) return null;

    const {
        timeInfo,
        totalBudget,
        totalProjected,
        totalProjectedLow,
        totalProjectedHigh,
        totalNetVariance,
        counts,
        needingAttentionCount,
    } = macroData;

    const { day, daysInMonth, elapsedDays } = timeInfo || { day: 1, daysInMonth: 30, elapsedDays: 1 };
    const monthProgressPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / daysInMonth) * 100)));

    const isOverBudget = totalNetVariance > 0;
    const netVariancePercent = totalBudget > 0 ? Math.round(Math.abs(totalNetVariance / totalBudget) * 100) : 0;

    return (
        <section aria-label="Forecast macro summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Tile 1: Month Progress */}
            <div className="flex flex-col justify-between rounded-xl bg-surface-raised/80 p-3.5 shadow-sm transition-all duration-200 hover:bg-surface-raised">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-muted">Month Progress</span>
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-raised text-ink-muted">
                        <Calendar size={13} aria-hidden="true" />
                    </span>
                </div>
                <div className="mt-2.5">
                    <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold tracking-tight text-ink">
                            Day {day} of {daysInMonth}
                        </span>
                        <span className="text-[11px] font-medium text-ink-muted tabular-nums">
                            {monthProgressPercent}%
                        </span>
                    </div>
                    {/* Thin progress bar */}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-raised">
                        <div
                            className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
                            style={{ width: `${monthProgressPercent}%` }}
                            role="progressbar"
                            aria-valuenow={monthProgressPercent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        />
                    </div>
                </div>
            </div>

            {/* Tile 2: Projected Month-End */}
            <div className="flex flex-col justify-between rounded-xl bg-surface-raised/80 p-3.5 shadow-sm transition-all duration-200 hover:bg-surface-raised">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-muted">Projected Month-End</span>
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-brand/10 text-brand">
                        <TrendingUp size={13} aria-hidden="true" />
                    </span>
                </div>
                <div className="mt-2.5">
                    <div className="text-base font-bold tracking-tight text-ink tabular-nums">
                        {formatCurrency(totalProjected, currency)}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-ink-muted tabular-nums">
                        Range: {formatCurrency(totalProjectedLow, currency)} – {formatCurrency(totalProjectedHigh, currency)}
                    </div>
                </div>
            </div>

            {/* Tile 3: Net vs Budget */}
            <div className="flex flex-col justify-between rounded-xl bg-surface-raised/80 p-3.5 shadow-sm transition-all duration-200 hover:bg-surface-raised">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-muted">Net vs Budget</span>
                    <span
                        className={cx(
                            'grid h-6 w-6 place-items-center rounded-md',
                            isOverBudget ? 'bg-negative-soft text-negative' : 'bg-positive-soft text-positive'
                        )}
                    >
                        <TrendingUp size={13} className={isOverBudget ? 'rotate-0' : 'rotate-180'} aria-hidden="true" />
                    </span>
                </div>
                <div className="mt-2.5">
                    <div
                        className={cx(
                            'text-base font-bold tracking-tight tabular-nums',
                            isOverBudget ? 'text-negative' : 'text-positive'
                        )}
                    >
                        {isOverBudget ? '+' : '-'}{formatCurrency(Math.abs(totalNetVariance), currency)}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-ink-muted">
                        {isOverBudget
                            ? `+${netVariancePercent}% over budget limit`
                            : `${netVariancePercent}% under budget limit`}
                    </div>
                </div>
            </div>

            {/* Tile 4: Categories Needing Attention */}
            <div className="flex flex-col justify-between rounded-xl bg-surface-raised/80 p-3.5 shadow-sm transition-all duration-200 hover:bg-surface-raised">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-muted">Needs Attention</span>
                    <span
                        className={cx(
                            'grid h-6 w-6 place-items-center rounded-md',
                            needingAttentionCount > 0 ? 'bg-warning-soft text-warning' : 'bg-positive-soft text-positive'
                        )}
                    >
                        {needingAttentionCount > 0 ? (
                            <AlertTriangle size={13} aria-hidden="true" />
                        ) : (
                            <ShieldCheck size={13} aria-hidden="true" />
                        )}
                    </span>
                </div>
                <div className="mt-2.5">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold tracking-tight text-ink tabular-nums">
                            {needingAttentionCount}
                        </span>
                        <span className="text-xs text-ink-muted">
                            of {counts.all} categories
                        </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-ink-muted">
                        {counts.exceeded > 0 && (
                            <span className="text-negative tabular-nums">{counts.exceeded} exceeded</span>
                        )}
                        {counts.exceeded > 0 && (counts.projected_breach > 0 || counts.watch > 0) && (
                            <span>·</span>
                        )}
                        {counts.projected_breach > 0 && (
                            <span className="text-warning tabular-nums">{counts.projected_breach} projected</span>
                        )}
                        {counts.projected_breach > 0 && counts.watch > 0 && (
                            <span>·</span>
                        )}
                        {counts.watch > 0 && (
                            <span className="text-info tabular-nums">{counts.watch} watch</span>
                        )}
                        {needingAttentionCount === 0 && (
                            <span className="text-positive">All on track</span>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default ForecastSummary;
