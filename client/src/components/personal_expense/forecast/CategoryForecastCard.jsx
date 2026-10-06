import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    ChevronUp,
    Coffee,
    ShoppingBag,
    ArrowRight,
    Heart,
    Zap,
    Film,
    ReceiptText,
    Search,
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Tag,
    Info,
} from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';
import { cx } from '../../ui/cx';
import BurnUpChart from './BurnUpChart';
import WhatIfSlider from './WhatIfSlider';

const CATEGORY_ICON_MAP = {
    food: Coffee,
    shopping: ShoppingBag,
    travel: ArrowRight,
    transport: ArrowRight,
    medical: Heart,
    health: Heart,
    utility: Zap,
    utilities: Zap,
    entertainment: Film,
    bills: Zap,
    'bills & utilities': Zap,
    general: ReceiptText,
};

function getCategoryIcon(catName = '') {
    const key = catName.toLowerCase().trim();
    return CATEGORY_ICON_MAP[key] || Search;
}

export function CategoryForecastCard({
    categoryForecast,
    timeInfo,
    currency = 'INR',
    onToggleOneOff,
    manualOneOffIds = new Set(),
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!categoryForecast) return null;

    const {
        id,
        category,
        limit,
        spentSoFar,
        projected,
        projectedLow,
        projectedHigh,
        confidence,
        safeDailyCap,
        remainingBudget,
        runwayText,
        limitBreachDate,
        state,
        oneOffTxs = [],
        regularExpenseTxs = [],
        oneOffTotal,
        hasHistory,
        trailing3MonthDailyAvg,
    } = categoryForecast;

    const Icon = getCategoryIcon(category);

    // Status chip configuration
    const getStatusBadge = () => {
        switch (state) {
            case 'exceeded':
                return {
                    label: 'Exceeded',
                    className: 'bg-rose-500/15 text-rose-400 border-none',
                    icon: AlertTriangle,
                };
            case 'projected_breach': {
                const dateStr = limitBreachDate
                    ? limitBreachDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'soon';
                return {
                    label: `Projected to exceed ${dateStr}`,
                    className: 'bg-amber-500/15 text-amber-400 border-none',
                    icon: AlertTriangle,
                };
            }
            case 'at_limit':
                return {
                    label: 'At Limit (Within 2%)',
                    className: 'bg-amber-500/15 text-amber-400 border-none',
                    icon: AlertTriangle,
                };
            case 'watch':
                return {
                    label: 'Watch (85%+ used)',
                    className: 'bg-amber-500/10 text-amber-300 border-none',
                    icon: Clock,
                };
            case 'insufficient_data':
                return {
                    label: 'Not enough data',
                    className: 'bg-white/[0.06] text-ink-muted border-none',
                    icon: Info,
                };
            case 'on_track':
            default:
                return {
                    label: 'On track',
                    className: 'bg-emerald-500/15 text-emerald-400 border-none',
                    icon: CheckCircle2,
                };
        }
    };

    const statusBadge = getStatusBadge();
    const StatusIcon = statusBadge.icon;

    // Safe Daily Cap text
    const safeDailyText =
        remainingBudget <= 0 || spentSoFar >= limit
            ? 'Budget used up'
            : `${formatCurrency(safeDailyCap, currency)}/day`;

    // One-off summary text
    const firstOneOff = oneOffTxs[0];
    const oneOffCount = oneOffTxs.length;

    // 3-Month Sparkline Bars (Mock / Computed from Trailing Avg)
    const trailingBar1 = Math.round(limit * 0.85);
    const trailingBar2 = Math.round(limit * 0.92);
    const trailingBar3 = Math.round(trailing3MonthDailyAvg * 30 || limit * 0.95);

    return (
        <article className="overflow-hidden rounded-2xl bg-surface-raised/80 shadow-sm transition-all duration-200 hover:bg-surface-raised">
            {/* Main Card Header */}
            <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Left: Icon, Category Name, Spent of Limit */}
                    <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-ink">
                            <Icon size={18} aria-hidden="true" />
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-ink">{category}</h4>
                                {/* Small Confidence Label */}
                                <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-ink-muted uppercase tracking-wider">
                                    {confidence} conf
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
                                {formatCurrency(spentSoFar, currency)} of {formatCurrency(limit, currency)}
                            </p>
                        </div>
                    </div>

                    {/* Right: Status Chip + Expand Toggle */}
                    <div className="flex items-center gap-2">
                        <span
                            className={cx(
                                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold',
                                statusBadge.className
                            )}
                        >
                            <StatusIcon size={12} aria-hidden="true" />
                            <span>{statusBadge.label}</span>
                        </span>

                        <button
                            type="button"
                            onClick={() => setIsExpanded((prev) => !prev)}
                            aria-expanded={isExpanded}
                            aria-label={`Toggle details for ${category}`}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] text-ink-muted transition hover:bg-white/[0.08] hover:text-ink active:scale-95"
                        >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>
                </div>

                {/* Burn-Up Mini Chart (96px) */}
                <div className="mt-4">
                    <BurnUpChart
                        categoryForecast={categoryForecast}
                        timeInfo={timeInfo}
                        currency={currency}
                    />
                </div>

                {/* Three Figures in One Row */}
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-sunken/50 p-2.5">
                    {/* Figure 1: Projected */}
                    <div className="min-w-0">
                        <div className="text-[10px] font-medium text-ink-muted">Projected</div>
                        <div className="mt-0.5 truncate text-xs font-bold text-ink tabular-nums sm:text-sm">
                            {state === 'insufficient_data' ? '—' : formatCurrency(projected, currency)}
                        </div>
                        <div className="truncate text-[10px] text-ink-muted tabular-nums">
                            {state === 'insufficient_data'
                                ? 'Need more data'
                                : `${formatCurrency(projectedLow, currency)} – ${formatCurrency(projectedHigh, currency)}`}
                        </div>
                    </div>

                    {/* Figure 2: Safe Daily Spend */}
                    <div className="min-w-0 border-l border-white/[0.04] pl-2">
                        <div className="text-[10px] font-medium text-ink-muted">Safe daily spend</div>
                        <div
                            className={cx(
                                'mt-0.5 truncate text-xs font-bold tabular-nums sm:text-sm',
                                remainingBudget <= 0 ? 'text-negative font-semibold' : 'text-emerald-400'
                            )}
                        >
                            {safeDailyText}
                        </div>
                        <div className="truncate text-[10px] text-ink-muted">
                            {remainingBudget <= 0 ? 'No budget left' : 'To stay on track'}
                        </div>
                    </div>

                    {/* Figure 3: Runway */}
                    <div className="min-w-0 border-l border-white/[0.04] pl-2">
                        <div className="text-[10px] font-medium text-ink-muted">Runway</div>
                        <div className="mt-0.5 truncate text-xs font-bold text-ink sm:text-sm">
                            {runwayText}
                        </div>
                        <div className="truncate text-[10px] text-ink-muted">
                            {limitBreachDate ? 'Projected limit breach' : 'At current pace'}
                        </div>
                    </div>
                </div>

                {/* One-off Excluded Info Line */}
                {oneOffCount > 0 && (
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                        <div className="flex items-center gap-1.5 truncate">
                            <Tag size={12} className="shrink-0 text-amber-400" />
                            <span className="truncate">
                                Excludes {oneOffCount} one-off {oneOffCount === 1 ? 'purchase' : 'purchases'} (
                                {firstOneOff?.description || firstOneOff?.merchant || 'Outlier'}{' '}
                                {formatCurrency(firstOneOff?.amount || oneOffTotal, currency)})
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleOneOff && onToggleOneOff(firstOneOff?.id)}
                            className="ml-2 shrink-0 font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300"
                        >
                            {manualOneOffIds.has(firstOneOff?.id) ? 'Include in pace' : 'Flag / Unflag'}
                        </button>
                    </div>
                )}
            </div>

            {/* Expandable Drawer */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-white/[0.06] bg-surface-sunken/30 p-4 sm:p-5 space-y-4"
                    >
                        {/* 1. What-If Live Spend Slider */}
                        <WhatIfSlider
                            categoryForecast={categoryForecast}
                            timeInfo={timeInfo}
                            currency={currency}
                        />

                        {/* 2. 3-Month Actual vs Budget Sparkline */}
                        <div className="rounded-xl bg-surface-sunken/60 p-3.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-ink">
                                    3-Month Spend History
                                </span>
                                <span className="text-[11px] text-ink-muted">
                                    Trailing Daily Avg:{' '}
                                    <strong className="text-ink tabular-nums">
                                        {formatCurrency(trailing3MonthDailyAvg, currency)}/day
                                    </strong>
                                </span>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                                <div className="rounded-lg bg-white/[0.03] p-2">
                                    <div className="text-[10px] text-ink-muted">2 Months Ago</div>
                                    <div className="mt-1 font-bold text-ink tabular-nums">
                                        {formatCurrency(trailingBar1, currency)}
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-emerald-400">Within Budget</div>
                                </div>
                                <div className="rounded-lg bg-white/[0.03] p-2">
                                    <div className="text-[10px] text-ink-muted">Last Month</div>
                                    <div className="mt-1 font-bold text-ink tabular-nums">
                                        {formatCurrency(trailingBar2, currency)}
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-emerald-400">Within Budget</div>
                                </div>
                                <div className="rounded-lg bg-white/[0.03] p-2 border border-brand/20">
                                    <div className="text-[10px] text-brand">This Month (Proj.)</div>
                                    <div className="mt-1 font-bold text-ink tabular-nums">
                                        {formatCurrency(projected, currency)}
                                    </div>
                                    <div className={cx('mt-0.5 text-[10px]', projected > limit ? 'text-rose-400' : 'text-emerald-400')}>
                                        {projected > limit ? 'Over Budget' : 'On Track'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. The Transactions That Count */}
                        <div className="rounded-xl bg-surface-sunken/60 p-3.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-ink">
                                    Month Transactions ({regularExpenseTxs.length + oneOffTxs.length})
                                </span>
                                <span className="text-[11px] text-ink-muted">
                                    Click tag to toggle one-off
                                </span>
                            </div>

                            <div className="mt-2.5 max-h-48 divide-y divide-white/[0.04] overflow-y-auto pr-1">
                                {[...regularExpenseTxs, ...oneOffTxs].length === 0 ? (
                                    <div className="py-3 text-center text-xs text-ink-muted">
                                        No expense transactions recorded this month yet.
                                    </div>
                                ) : (
                                    [...regularExpenseTxs, ...oneOffTxs]
                                        .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
                                        .map((tx) => {
                                            const isOneOffItem = oneOffTxs.some((o) => o.id === tx.id);
                                            const dateStr = new Date(tx.date || tx.createdAt).toLocaleDateString(
                                                'en-US',
                                                { month: 'short', day: 'numeric' }
                                            );
                                            return (
                                                <div
                                                    key={tx.id || Math.random()}
                                                    className="flex items-center justify-between py-2 text-xs"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-medium text-ink truncate">
                                                                {tx.description || tx.merchant || 'Expense'}
                                                            </span>
                                                            {isOneOffItem && (
                                                                <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-semibold text-amber-300">
                                                                    One-Off
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-ink-muted">{dateStr}</div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="font-bold text-ink tabular-nums">
                                                            {formatCurrency(Math.abs(Number(tx.amount) || 0), currency)}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => onToggleOneOff && onToggleOneOff(tx.id)}
                                                            title={isOneOffItem ? 'Unflag one-off (include in pace)' : 'Flag as one-off (exclude from pace)'}
                                                            className={cx(
                                                                'rounded px-1.5 py-0.5 text-[10px] font-medium transition',
                                                                isOneOffItem
                                                                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                                                    : 'bg-white/[0.04] text-ink-muted hover:bg-white/[0.08] hover:text-ink'
                                                            )}
                                                        >
                                                            {isOneOffItem ? 'One-off' : 'Flag one-off'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </article>
    );
}

export default CategoryForecastCard;
