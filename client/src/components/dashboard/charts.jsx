import { useMemo } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { CalendarDays } from 'lucide-react';
import { cx } from '../ui/cx';
import { formatCurrency, formatPercent } from '../../utils/currency';
import { CHART, getCategoryColor } from '../../utils/theme';

/* ------------------------------------------------------- Daily spending -- */

function DayTooltip({ active, payload, currency }) {
    if (!active || !payload?.length) return null;
    const { day, amount } = payload[0].payload;
    return (
        <div className="rounded-control border border-line-strong bg-raised px-3 py-2 shadow-raised backdrop-blur">
            <p className="text-xs font-semibold text-ink-muted">Day {day}</p>
            <p className="tnum text-sm font-bold text-ink">{formatCurrency(amount, currency)}</p>
        </div>
    );
}

/** Daily spending for one calendar month, as a gradient-filled area. */
export function DailySpendChart({
    data = [],
    label,
    compareData = null,
    compareLabel,
    currency = 'INR',
    loading,
}) {
    const merged = useMemo(
        () =>
            compareData
                ? data.map((d, i) => ({ ...d, prev: compareData[i]?.amount ?? 0 }))
                : data,
        [data, compareData]
    );
    const empty = useMemo(
        () => !merged.some((d) => d.amount > 0 || d.prev > 0),
        [merged]
    );

    if (loading) return <div className="pem-skeleton h-[200px] w-full rounded-card" />;

    if (empty) {
        return (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line text-center">
                <CalendarDays size={24} className="text-ink-faint" aria-hidden="true" />
                <p className="text-sm font-bold text-ink-muted">No spending this month</p>
                <p className="text-xs text-ink-faint">{label}</p>
            </div>
        );
    }

    return (
        <div className="h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 600, height: 200 }} debounce={60}>
                <AreaChart data={merged} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="daily-spend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART.net} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={CHART.net} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--pem-border)" vertical={false} />
                    <XAxis
                        dataKey="day"
                        tick={{ fill: 'var(--pem-text-faint)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={16}
                    />
                    <YAxis
                        tick={{ fill: 'var(--pem-text-faint)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                        tickFormatter={(v) => formatCurrency(v, currency, { compact: true })}
                    />
                    <Tooltip
                        cursor={{ stroke: 'var(--pem-border-strong)', strokeWidth: 1 }}
                        content={<DayTooltip currency={currency} />}
                    />
                    <Area
                        type="monotone"
                        dataKey="amount"
                        stroke={CHART.net}
                        strokeWidth={2.2}
                        fill="url(#daily-spend)"
                    />
                    {compareData ? (
                        <Area
                            type="monotone"
                            dataKey="prev"
                            stroke="var(--pem-text-faint)"
                            strokeWidth={1.6}
                            strokeDasharray="4 4"
                            fill="none"
                        />
                    ) : null}
                </AreaChart>
            </ResponsiveContainer>
            {compareData ? (
                <p className="mt-1 text-xs text-ink-faint">
                    Dashed line = {compareLabel || 'previous month'}
                </p>
            ) : null}
        </div>
    );
}

/* ---------------------------------------------------- Budget vs actual -- */

/**
 * Spend utilization color:
 * 0 to 50%: Green (#10b981)
 * 50 to 75% (and up to 90%): Yellow (#f59e0b)
 * 90 to 100% or above 100%: Red (#ef4444)
 */
export const getSpendUtilizationColor = (pct) => {
    if (pct >= 90) return '#ef4444'; // 90 to 100% or above 100%
    if (pct >= 50) return '#f59e0b'; // 50 to 75%
    return '#10b981';                // 0 to 50%
};

function BudgetTooltip({ active, payload, currency }) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    const catColor = getCategoryColor(row.category);
    const utilColor = getSpendUtilizationColor(row.pct);
    const isExceeded = row.pct > 100;
    const isCritical = row.pct >= 90;
    const isModerate = row.pct >= 50 && !isCritical;

    return (
        <div className="min-w-[200px] rounded-control border border-line-strong bg-raised/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="mb-2.5 flex items-center justify-between border-b border-line pb-1.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: catColor }} />
                    {row.category}
                </p>
                <span
                    className={cx(
                        'rounded-pill px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        isExceeded
                            ? 'bg-neg-soft text-neg'
                            : isCritical
                              ? 'bg-neg-soft text-neg'
                              : isModerate
                                ? 'bg-warn-soft text-warn'
                                : 'bg-pos-soft text-pos'
                    )}
                >
                    {isExceeded ? 'Exceeded' : isCritical ? 'Critical (≥90%)' : isModerate ? '50–75%' : 'Healthy (<50%)'}
                </span>
            </div>

            <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                        <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: catColor }} />
                        Budget Limit
                    </span>
                    <span className="tnum font-bold text-ink">{formatCurrency(row.limit, currency)}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                        <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: utilColor }} />
                        Actual Spent
                    </span>
                    <span className="tnum font-bold text-ink">{formatCurrency(row.spent, currency)}</span>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-line/60 pt-1.5">
                    <span className="text-ink-muted">Utilization</span>
                    <span className="tnum font-extrabold" style={{ color: utilColor }}>
                        {formatPercent(row.pct)}
                    </span>
                </div>
            </div>
        </div>
    );
}

const CategoryTick = ({ x, y, payload }) => {
    const color = getCategoryColor(payload.value);
    const label = payload.value.length > 11 ? `${payload.value.slice(0, 10)}…` : payload.value;
    return (
        <g transform={`translate(${x},${y})`}>
            <circle cx={-90} cy={-4} r={3.5} fill={color} />
            <text
                x={-82}
                y={0}
                dy={0}
                textAnchor="start"
                fill="var(--pem-text-secondary)"
                fontSize={12}
                fontWeight={500}
            >
                {label}
            </text>
        </g>
    );
};

/**
 * Horizontal budget-vs-actual bars:
 * - 1st line: Category Budget limit using category's unique color.
 * - Next line: Actual spend colored by utilization (0–50% green, 50–75% yellow, ≥90% red).
 */
export function BudgetActualChart({ data = [], currency = 'INR', loading }) {
    if (loading) return <div className="pem-skeleton h-[220px] w-full rounded-card" />;

    if (!data.length) {
        return (
            <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line text-center">
                <p className="text-sm font-bold text-ink-muted">No budgets set</p>
                <p className="text-xs text-ink-faint">Create a budget to track actual spending.</p>
            </div>
        );
    }

    const height = Math.max(180, data.length * 48);

    return (
        <div className="flex w-full flex-col">
            {/* Legend strip clarifying the two lines */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 text-[11px] text-ink-muted">
                    <span className="flex items-center gap-1 font-medium">
                        <span className="h-1.5 w-3 rounded-xs bg-brand" />
                        1st Line: Category Color (Budget)
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                        <span className="h-1.5 w-3 rounded-xs bg-pos" />
                        2nd Line: Spend Status
                    </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1 font-semibold text-pos">
                        <span className="h-1.5 w-1.5 rounded-full bg-pos" />
                        0–50%
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-warn">
                        <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                        50–75%
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-neg">
                        <span className="h-1.5 w-1.5 rounded-full bg-neg" />
                        ≥90%
                    </span>
                </div>
            </div>

            <div className="w-full min-w-0" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 600, height: height || 250 }} debounce={60}>
                    <BarChart
                        layout="vertical"
                        data={data}
                        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                        barCategoryGap={14}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--pem-border)" horizontal={false} />
                        <XAxis
                            type="number"
                            tick={{ fill: 'var(--pem-text-faint)', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => formatCurrency(v, currency, { compact: true })}
                        />
                        <YAxis
                            type="category"
                            dataKey="category"
                            width={96}
                            tick={<CategoryTick />}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--pem-border)', opacity: 0.3 }}
                            content={<BudgetTooltip currency={currency} />}
                        />
                        {/* 1st Line: Category Color (Budget limit) */}
                        <Bar dataKey="limit" name="Budget" radius={[0, 5, 5, 0]} barSize={7}>
                            {data.map((d) => (
                                <Cell key={`limit-${d.category}`} fill={getCategoryColor(d.category)} />
                            ))}
                        </Bar>
                        {/* Next Line: Spend Color (0-50% green, 50-75% yellow, >=90% red) */}
                        <Bar dataKey="spent" name="Spent" radius={[0, 5, 5, 0]} barSize={7}>
                            {data.map((d) => (
                                <Cell key={`spent-${d.category}`} fill={getSpendUtilizationColor(d.pct)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

/* --------------------------------------------------- Weekday heatmap --- */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Compact 7-cell weekday intensity strip (Mon-first). */
export function WeekdayHeatmap({ series = [], currency = 'INR', loading }) {
    const totals = useMemo(() => {
        const sums = new Array(7).fill(0);
        for (const point of series) {
            const d = point.date instanceof Date ? point.date : new Date(point.date);
            if (Number.isNaN(d.getTime())) continue;
            const idx = (d.getDay() + 6) % 7; // shift so Monday = 0
            sums[idx] += Number(point.amount) || 0;
        }
        return sums;
    }, [series]);

    if (loading) return <div className="pem-skeleton h-20 w-full rounded-card" />;

    const max = Math.max(...totals, 1);

    return (
        <div>
            <div className="grid grid-cols-7 gap-1.5">
                {totals.map((value, i) => {
                    const intensity = value / max;
                    return (
                        <div
                            key={WEEKDAYS[i]}
                            className="flex flex-col items-center gap-1"
                            title={`${WEEKDAYS[i]}: ${formatCurrency(value, currency)}`}
                        >
                            <div
                                className="h-12 w-full rounded-[8px] border border-line"
                                style={{
                                    backgroundColor: `rgba(139, 92, 246, ${0.08 + intensity * 0.72})`,
                                }}
                            />
                            <span className="text-xs font-medium text-ink-muted">{WEEKDAYS[i]}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
