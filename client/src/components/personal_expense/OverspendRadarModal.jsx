import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Radar,
    TrendingUp,
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    Calendar,
    Zap,
    ArrowUpRight,
    Sparkles,
    Gauge,
    Info,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge, Button, IconBadge, Progress } from '../ui/primitives';
import { formatCurrency, formatPercent } from '../../utils/currency';
import { cx } from '../ui/cx';

/**
 * Month-End Expense Forecast & Overspend Radar
 * Calculates month-end spend velocity projections per category based on days elapsed,
 * alerts on impending budget bursts, and recommends exact daily burn caps to stay safe.
 */
export function OverspendRadarModal({
    isOpen,
    onClose,
    budgets = [],
    transactions = [],
    currency = 'INR',
}) {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [throttleAdjustment, setThrottleAdjustment] = useState({}); // { category: adjustmentPercent }

    const forecastData = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const currentDay = Math.min(now.getDate(), daysInMonth);
        const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);
        const monthProgressPercent = Math.round((currentDay / daysInMonth) * 100);

        // Filter current month expenses
        const currentMonthExpenses = (transactions || []).filter((t) => {
            if (t.type !== 'expense' && t.type) return false;
            if (!t.date) return false;
            const d = new Date(t.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });

        // Group actual spend by category
        const categorySpendMap = new Map();
        for (const t of currentMonthExpenses) {
            const cat = t.category || 'General';
            const amt = Math.abs(Number(t.amount) || 0);
            categorySpendMap.set(cat, (categorySpendMap.get(cat) || 0) + amt);
        }

        let totalBudget = 0;
        let totalCurrentSpend = 0;
        let totalProjected = 0;

        const categoriesList = budgets.map((b) => {
            const category = b.category;
            const limit = Number(b.amountLimit) || 0;
            const spent = categorySpendMap.get(category) || 0;

            totalBudget += limit;
            totalCurrentSpend += spent;

            // Current burn rate velocity
            const dailyBurnRate = currentDay > 0 ? spent / currentDay : 0;

            // Forecast at month end (Day 30/31)
            const projectedMonthEnd = Math.round(dailyBurnRate * daysInMonth);
            totalProjected += projectedMonthEnd;

            // Projected Variance
            const projectedVariance = projectedMonthEnd - limit;
            const projectedVariancePercent = limit > 0 ? Math.round((projectedVariance / limit) * 100) : 0;

            // Remaining budget allowance for the rest of this month
            const remainingBudget = Math.max(0, limit - spent);
            const recommendedDailyCap = Math.round(remainingBudget / daysRemaining);

            // Breach Status
            let riskLevel = 'safe'; // 'safe' | 'warning' | 'breach'
            let riskLabel = 'On Track';
            let riskTone = 'pos';

            if (spent >= limit) {
                riskLevel = 'breach';
                riskLabel = 'Budget Exceeded';
                riskTone = 'neg';
            } else if (projectedMonthEnd > limit * 1.15) {
                riskLevel = 'breach';
                riskLabel = 'High Overspend Risk';
                riskTone = 'neg';
            } else if (projectedMonthEnd > limit) {
                riskLevel = 'warning';
                riskLabel = 'Pacing Ahead';
                riskTone = 'warn';
            }

            return {
                id: b.id,
                category,
                limit,
                spent,
                currentPercent: limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 100,
                dailyBurnRate: Math.round(dailyBurnRate),
                projectedMonthEnd,
                projectedVariance,
                projectedVariancePercent,
                remainingBudget,
                recommendedDailyCap,
                riskLevel,
                riskLabel,
                riskTone,
            };
        });

        // Sort: highest risk first
        categoriesList.sort((a, b) => {
            if (a.riskLevel === 'breach' && b.riskLevel !== 'breach') return -1;
            if (b.riskLevel === 'breach' && a.riskLevel !== 'breach') return 1;
            return b.projectedVariance - a.projectedVariance;
        });

        const highRiskCount = categoriesList.filter((c) => c.riskLevel === 'breach').length;
        const warningCount = categoriesList.filter((c) => c.riskLevel === 'warning').length;
        const netProjectedOvershoot = Math.max(0, totalProjected - totalBudget);

        return {
            currentDay,
            daysInMonth,
            daysRemaining,
            monthProgressPercent,
            totalBudget,
            totalCurrentSpend,
            totalProjected,
            netProjectedOvershoot,
            highRiskCount,
            warningCount,
            categoriesList,
        };
    }, [budgets, transactions]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Month-End Expense Forecast & Overspend Radar"
            subtitle="Predict which categories will overshoot budget by month-end & daily corrective limits"
            icon={Radar}
            size="xl"
            bodyClassName="p-0 overflow-hidden"
        >
            <div className="flex flex-col max-h-[80vh]">
                {/* Top Macro Forecast Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-line/60 bg-sunken/40 p-4">
                    <div className="rounded-control bg-surface p-3 border border-line/40">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-ink-muted">
                            <span>Month Velocity</span>
                            <span className="text-brand font-bold">Day {forecastData.currentDay}/{forecastData.daysInMonth}</span>
                        </div>
                        <div className="mt-1 text-base font-extrabold text-ink tnum">
                            {forecastData.monthProgressPercent}%
                            <span className="text-[10px] font-normal text-ink-faint"> elapsed</span>
                        </div>
                    </div>

                    <div className="rounded-control bg-surface p-3 border border-line/40">
                        <span className="text-[11px] font-semibold text-ink-muted">Projected Month-End Spend</span>
                        <div className="mt-1 text-base font-extrabold text-ink tnum">
                            {formatCurrency(forecastData.totalProjected, currency)}
                        </div>
                    </div>

                    <div className="rounded-control bg-surface p-3 border border-line/40">
                        <span className="text-[11px] font-semibold text-ink-muted">Net Projected Overshoot</span>
                        <div className={cx('mt-1 text-base font-extrabold tnum', forecastData.netProjectedOvershoot > 0 ? 'text-neg' : 'text-emerald-400')}>
                            {forecastData.netProjectedOvershoot > 0
                                ? `+${formatCurrency(forecastData.netProjectedOvershoot, currency)}`
                                : 'Within Budget'}
                        </div>
                    </div>

                    <div className="rounded-control bg-surface p-3 border border-line/40">
                        <span className="text-[11px] font-semibold text-ink-muted">Categories at Risk</span>
                        <div className="mt-1 text-base font-extrabold text-amber-400 tnum">
                            {forecastData.highRiskCount + forecastData.warningCount} / {forecastData.categoriesList.length}
                        </div>
                    </div>
                </div>

                {/* Radar Alert Warning Banner */}
                {forecastData.highRiskCount > 0 && (
                    <div className="flex items-center gap-2.5 bg-rose-500/10 px-4 py-2.5 border-b border-rose-500/20 text-xs text-rose-400">
                        <ShieldAlert size={16} className="shrink-0" />
                        <span>
                            <strong>Early Overspend Alert:</strong> {forecastData.highRiskCount} categories are burning faster than the month's timeline and will burst budget without throttling.
                        </span>
                    </div>
                )}

                {/* Category Projection Cards */}
                <div className="overflow-y-auto p-4 space-y-3">
                    {forecastData.categoriesList.length === 0 ? (
                        <div className="py-12 text-center text-ink-muted">
                            <Gauge size={32} className="mx-auto mb-2 text-brand opacity-60" />
                            <p className="text-sm font-semibold">No active category budgets set</p>
                            <p className="text-xs text-ink-faint mt-0.5">
                                Set budget limits for your categories to enable automatic month-end velocity forecasting.
                            </p>
                        </div>
                    ) : (
                        forecastData.categoriesList.map((item) => {
                            const isSelected = selectedCategory === item.category;

                            return (
                                <div
                                    key={item.id || item.category}
                                    className={cx(
                                        'rounded-control border p-4 transition-all duration-200',
                                        item.riskLevel === 'breach'
                                            ? 'bg-rose-950/10 border-rose-500/30'
                                            : item.riskLevel === 'warning'
                                            ? 'bg-amber-950/10 border-amber-500/30'
                                            : 'bg-surface border-line/50 hover:border-line'
                                    )}
                                >
                                    {/* Header Row */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div
                                                className={cx(
                                                    'grid h-8 w-8 place-items-center rounded-lg font-bold text-xs',
                                                    item.riskLevel === 'breach'
                                                        ? 'bg-rose-500/20 text-rose-400'
                                                        : item.riskLevel === 'warning'
                                                        ? 'bg-amber-500/20 text-amber-400'
                                                        : 'bg-emerald-500/20 text-emerald-400'
                                                )}
                                            >
                                                {item.riskLevel === 'breach' ? (
                                                    <AlertTriangle size={15} />
                                                ) : (
                                                    <CheckCircle2 size={15} />
                                                )}
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-bold text-ink">{item.category}</h4>
                                                <span className="text-[11px] text-ink-muted">
                                                    Spent {formatCurrency(item.spent, currency)} of {formatCurrency(item.limit, currency)} limit
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span
                                                className={cx(
                                                    'rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
                                                    item.riskLevel === 'breach'
                                                        ? 'bg-rose-500/15 text-rose-400'
                                                        : item.riskLevel === 'warning'
                                                        ? 'bg-amber-500/15 text-amber-400'
                                                        : 'bg-emerald-500/15 text-emerald-400'
                                                )}
                                            >
                                                {item.riskLabel}
                                            </span>

                                            <div className="text-right">
                                                <div className="text-xs font-bold text-ink tnum">
                                                    Projected: {formatCurrency(item.projectedMonthEnd, currency)}
                                                </div>
                                                {item.projectedVariance > 0 ? (
                                                    <div className="text-[10px] font-semibold text-neg tnum">
                                                        +{formatCurrency(item.projectedVariance, currency)} (+{item.projectedVariancePercent}%)
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] font-medium text-emerald-400 tnum">
                                                        Under limit by {formatCurrency(Math.abs(item.projectedVariance), currency)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pace Progress Bar */}
                                    <div className="mt-3">
                                        <div className="flex items-center justify-between text-[11px] text-ink-muted mb-1">
                                            <span>Current Spend Pace ({item.currentPercent}% used)</span>
                                            <span>Timeline Pace ({forecastData.monthProgressPercent}% elapsed)</span>
                                        </div>
                                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-sunken">
                                            {/* Spend bar */}
                                            <div
                                                className={cx(
                                                    'h-full rounded-full transition-all duration-300',
                                                    item.riskLevel === 'breach'
                                                        ? 'bg-rose-500'
                                                        : item.riskLevel === 'warning'
                                                        ? 'bg-amber-400'
                                                        : 'bg-emerald-400'
                                                )}
                                                style={{ width: `${Math.min(100, item.currentPercent)}%` }}
                                            />
                                            {/* Month timeline marker indicator */}
                                            <div
                                                className="absolute top-0 bottom-0 w-0.5 bg-white/70 shadow-sm z-10"
                                                style={{ left: `${forecastData.monthProgressPercent}%` }}
                                                title={`Current Day ${forecastData.currentDay} Timeline Marker`}
                                            />
                                        </div>
                                    </div>

                                    {/* Actionable Throttle & Target Cap */}
                                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-control bg-sunken/60 p-2.5 text-xs">
                                        <div className="flex items-center gap-2 text-ink-muted">
                                            <Sparkles size={13} className="text-brand" />
                                            <span>
                                                Current Burn: <strong className="text-ink">{formatCurrency(item.dailyBurnRate, currency)}/day</strong>
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-ink-muted font-medium">
                                                Recommended Cap for Next {forecastData.daysRemaining} Days:
                                            </span>
                                            <span className={cx('font-extrabold tnum', item.recommendedDailyCap === 0 ? 'text-neg' : 'text-emerald-400')}>
                                                {formatCurrency(item.recommendedDailyCap, currency)}/day
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Insight */}
                <div className="border-t border-line/40 bg-sunken/30 p-3 px-4 text-xs text-ink-muted flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-ink-faint">
                        <Zap size={13} className="text-brand" />
                        Radar recalculates dynamic daily spend velocity on every new transaction recorded.
                    </span>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default OverspendRadarModal;
