import { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { CalendarDays, TrendingDown } from 'lucide-react';
import { cx } from '../ui/cx';
import { formatCurrency, formatDate } from '../../utils/currency';
import { CategoryTransactionsModal } from './CategoryTransactionsModal';

const WEEKDAYS = [
    { short: 'Mon', full: 'Monday' },
    { short: 'Tue', full: 'Tuesday' },
    { short: 'Wed', full: 'Wednesday' },
    { short: 'Thu', full: 'Thursday' },
    { short: 'Fri', full: 'Friday' },
    { short: 'Sat', full: 'Saturday' },
    { short: 'Sun', full: 'Sunday' },
];

/**
 * Custom Tooltip for Daily Spending Bar Chart.
 * Displays date, total, transaction count, top 3 transactions, and click instruction.
 */
export function SpendTooltip({ active, payload, currency }) {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    const isFuture = data.isFuture;

    return (
        <div className="min-w-[210px] rounded-[12px] bg-surface/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-1.5">
                <span className="text-xs font-bold text-ink">
                    {formatDate(data.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {data.isToday ? (
                    <span className="rounded-[6px] bg-brand/20 px-1.5 py-0.2 text-[10px] font-bold text-brand">
                        TODAY
                    </span>
                ) : null}
            </div>

            {isFuture ? (
                <p className="text-xs text-ink-faint">Future day · No spend recorded yet</p>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-ink-muted">Total Spent:</span>
                        <span className="tabular-nums text-sm font-bold text-ink">
                            {formatCurrency(data.amount, currency)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-ink-muted">
                        <span>Transactions:</span>
                        <span className="tabular-nums font-semibold text-ink">
                            {data.transactionsCount}
                        </span>
                    </div>

                    {data.topTransactions?.length > 0 ? (
                        <div className="border-t border-[rgba(255,255,255,0.06)] pt-1.5 space-y-1">
                            <span className="text-[10px] uppercase font-semibold tracking-wider text-ink-faint">
                                Top Transactions
                            </span>
                            {data.topTransactions.slice(0, 3).map((t, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs gap-2">
                                    <span className="truncate text-ink-muted text-[11px]">
                                        {t.merchant || t.description || t.category || 'Expense'}
                                    </span>
                                    <span className="tabular-nums font-semibold text-ink text-[11px] shrink-0">
                                        {formatCurrency(Math.abs(Number(t.amount) || 0), currency)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {data.transactionsCount > 0 ? (
                        <p className="text-[10px] text-brand/90 font-medium pt-1">
                            Click bar to inspect transactions →
                        </p>
                    ) : null}
                </div>
            )}
        </div>
    );
}

/**
 * DailyBarChart: Plots daily spend as rounded bars with future empty tracks,
 * reference lines (daily average & budget pace), callout for highest day,
 * and clickable bars.
 */
export function DailyBarChart({
    data = [],
    currency = 'INR',
    dailyAvg = 0,
    budgetPace = 0,
    today = new Date().getDate(),
    onBarClick,
}) {
    // Custom X-axis tick: every 5th day + Today with label
    const CustomTick = ({ x, y, payload }) => {
        const day = Number(payload.value);
        const isToday = day === today;
        const show = day % 5 === 0 || isToday;
        if (!show) return null;

        return (
            <g transform={`translate(${x},${y})`}>
                <text
                    x={0}
                    y={0}
                    dy={12}
                    textAnchor="middle"
                    fill={isToday ? 'var(--pem-brand, #14b8a6)' : 'var(--pem-text-faint, #64748b)'}
                    fontSize={11}
                    fontWeight={isToday ? 700 : 500}
                >
                    {day}
                </text>
                {isToday ? (
                    <text
                        x={0}
                        y={0}
                        dy={23}
                        textAnchor="middle"
                        fill="var(--pem-brand, #14b8a6)"
                        fontSize={8.5}
                        fontWeight={800}
                        letterSpacing="0.05em"
                    >
                        TODAY
                    </text>
                ) : null}
            </g>
        );
    };

    return (
        <div className="h-[230px] w-full min-w-0 min-h-[230px]">
            <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={230}
                initialDimension={{ width: 500, height: 230 }}
                debounce={60}
            >
                <BarChart
                    data={data}
                    margin={{ top: 12, right: 12, left: -16, bottom: 12 }}
                    barCategoryGap={2}
                    onClick={(state) => {
                        if (state && state.activePayload && state.activePayload[0]) {
                            const d = state.activePayload[0].payload;
                            if (d && d.transactionsCount > 0 && onBarClick) {
                                onBarClick(d);
                            }
                        }
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--pem-border)" vertical={false} />
                    <XAxis
                        dataKey="day"
                        tick={<CustomTick />}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                    />
                    <YAxis
                        tick={{ fill: 'var(--pem-text-faint)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                        tickCount={4}
                        tickFormatter={(v) => formatCurrency(v, currency, { compact: true })}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(255, 255, 255, 0.04)', radius: 4 }}
                        content={<SpendTooltip currency={currency} />}
                    />

                    {/* Daily Average Reference Line (muted violet) */}
                    {dailyAvg > 0 ? (
                        <ReferenceLine
                            y={dailyAvg}
                            stroke="#8b5cf6"
                            strokeDasharray="3 3"
                            label={{
                                value: `Avg ${formatCurrency(dailyAvg, currency, { compact: true })}`,
                                position: 'right',
                                fill: '#8b5cf6',
                                fontSize: 10,
                                fontWeight: 600,
                            }}
                        />
                    ) : null}

                    {/* Budget Pace Reference Line (amber) */}
                    {budgetPace > 0 ? (
                        <ReferenceLine
                            y={budgetPace}
                            stroke="#f59e0b"
                            strokeDasharray="3 3"
                            label={{
                                value: `Pace ${formatCurrency(budgetPace, currency, { compact: true })}`,
                                position: 'right',
                                fill: '#f59e0b',
                                fontSize: 10,
                                fontWeight: 600,
                            }}
                        />
                    ) : null}

                    {/* Bars with rounded tops and conditional colors */}
                    <Bar
                        dataKey="plotAmount"
                        maxBarSize={14}
                        radius={[4, 4, 0, 0]}
                        className="cursor-pointer"
                    >
                        {data.map((d) => {
                            if (d.isFuture) {
                                return (
                                    <Cell
                                        key={`day-${d.day}`}
                                        fill="rgba(255, 255, 255, 0.04)"
                                        className="cursor-default"
                                    />
                                );
                            }

                            // Color scale based on budget pace
                            let color = '#8b5cf6'; // default violet
                            if (budgetPace > 0) {
                                if (d.amount > 2 * budgetPace) {
                                    color = '#f43f5e'; // rose (>2x pace)
                                } else if (d.amount > budgetPace) {
                                    color = '#f59e0b'; // amber (> pace)
                                }
                            }

                            return (
                                <Cell
                                    key={`day-${d.day}`}
                                    fill={color}
                                    style={{
                                        filter: d.isToday ? 'drop-shadow(0 0 4px rgba(20, 184, 166, 0.5))' : 'none',
                                    }}
                                />
                            );
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * WeekdayHeat: 7 weekday cells with intensity scaling across 5 steps,
 * top weekday callout, and a min-to-max legend.
 */
export function WeekdayHeat({ series = [], currency = 'INR' }) {
    const { weekdayData, maxAvg, highestDay } = useMemo(() => {
        // Collect amounts and count occurrences for each weekday
        const totals = new Array(7).fill(0);
        const counts = new Array(7).fill(0);

        for (const item of series) {
            const d = item.date instanceof Date ? item.date : new Date(item.date);
            if (Number.isNaN(d.getTime())) continue;
            const idx = (d.getDay() + 6) % 7; // Monday = 0
            totals[idx] += Math.abs(Number(item.amount) || 0);
            counts[idx] += 1;
        }

        const data = WEEKDAYS.map((wd, i) => {
            const count = counts[i];
            const total = totals[i];
            const avg = count > 0 ? total / count : 0;
            return {
                short: wd.short,
                full: wd.full,
                avg,
                total,
                count,
            };
        });

        const max = Math.max(...data.map((d) => d.avg), 1);
        const highest = [...data].sort((a, b) => b.avg - a.avg)[0];

        return { weekdayData: data, maxAvg: max, highestDay: highest };
    }, [series]);

    // 5-step intensity background color
    const getIntensityStyle = (avg) => {
        if (!avg || avg <= 0) {
            return {
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                color: 'var(--pem-text-faint, #64748b)',
            };
        }
        const ratio = avg / maxAvg;
        if (ratio > 0.75) return { backgroundColor: 'rgba(139, 92, 246, 0.65)', color: '#ffffff' };
        if (ratio > 0.50) return { backgroundColor: 'rgba(139, 92, 246, 0.45)', color: '#ffffff' };
        if (ratio > 0.25) return { backgroundColor: 'rgba(139, 92, 246, 0.28)', color: 'var(--pem-text, #f1f5f9)' };
        return { backgroundColor: 'rgba(139, 92, 246, 0.14)', color: 'var(--pem-text, #f1f5f9)' };
    };

    return (
        <div className="space-y-4 py-1">
            {/* 7 Weekday Cells */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {weekdayData.map((d) => {
                    const style = getIntensityStyle(d.avg);
                    const isHighest = highestDay && highestDay.avg > 0 && highestDay.short === d.short;

                    return (
                        <div
                            key={d.short}
                            style={style}
                            className={cx(
                                'flex flex-col items-center justify-between p-3 rounded-[12px] min-h-[72px] transition-all',
                                isHighest ? 'ring-1 ring-violet shadow-sm' : ''
                            )}
                        >
                            <span className="text-xs font-semibold uppercase tracking-wider opacity-85">
                                {d.short}
                            </span>
                            <span className="tabular-nums text-sm font-bold my-1">
                                {d.avg > 0 ? formatCurrency(d.avg, currency, { compact: true }) : '—'}
                            </span>
                            <span className="text-[10px] opacity-75">
                                {d.avg > 0 ? 'avg/day' : 'no spend'}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Bottom: Highlight Caption & Min-to-Max Legend */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 text-xs">
                {highestDay && highestDay.avg > 0 ? (
                    <span className="font-semibold text-ink">
                        You spend most on <span className="text-violet">{highestDay.full}s</span>
                    </span>
                ) : (
                    <span className="text-ink-faint">No weekday spending recorded</span>
                )}

                <div className="flex items-center gap-1.5 text-[11px] text-ink-faint self-end sm:self-auto">
                    <span>Less</span>
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-[rgba(255,255,255,0.03)]" />
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-[rgba(139,92,246,0.14)]" />
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-[rgba(139,92,246,0.28)]" />
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-[rgba(139,92,246,0.45)]" />
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-[rgba(139,92,246,0.65)]" />
                    <span>More</span>
                </div>
            </div>
        </div>
    );
}

/**
 * DailySpendingCard: Main widget container.
 * Features:
 * - Segmented switch [Daily | Weekday]
 * - Single summary strip: "Avg ₹X/day · Projected month-end ₹Y" with budget status chip
 * - Daily rounded bar chart with future slots and callout for highest day
 * - Weekday heatmap with 5-intensity scaling
 * - Accessible, responsive, with loading and empty states.
 */
export function DailySpendingCard({
    transactions = [],
    budgets = [],
    currency = 'INR',
    loading = false,
    error = null,
    monthOffset = 0,
}) {
    const [view, setView] = useState('daily'); // 'daily' | 'weekday'
    const [modalDay, setModalDay] = useState(null);

    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const isCurrentMonth = monthOffset === 0;
    const currentDay = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

    const monthLabel = targetDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });

    // Extract total monthly budget limit
    const monthlyBudget = useMemo(() => {
        if (!Array.isArray(budgets)) return 0;
        return budgets.reduce((sum, b) => sum + (Number(b.amountLimit) || 0), 0);
    }, [budgets]);

    const budgetPace = useMemo(() => {
        if (monthlyBudget <= 0) return 0;
        return Math.round(monthlyBudget / daysInMonth);
    }, [monthlyBudget, daysInMonth]);

    // Daily buckets with future days as faint tracks
    const { chartData, totalSpent, maxDay, avgPerDay, projectedMonthEnd } = useMemo(() => {
        const days = [];
        const monthKeyStr = `${y}-${String(m + 1).padStart(2, '0')}`;

        // Filter current month transactions
        const monthTxs = transactions.filter((t) => {
            const isExp = t.type === 'expense' || !t.type;
            if (!isExp) return false;
            const d = new Date(t.date);
            return (
                d.getFullYear() === y &&
                d.getMonth() === m
            );
        });

        // Map by day of month
        const dayMap = new Map();
        for (const t of monthTxs) {
            const d = new Date(t.date).getDate();
            if (!dayMap.has(d)) dayMap.set(d, []);
            dayMap.get(d).push(t);
        }

        let total = 0;
        let peakDay = null;

        for (let d = 1; d <= daysInMonth; d += 1) {
            const txs = dayMap.get(d) || [];
            const amount = txs.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
            const isFuture = isCurrentMonth && d > currentDay;
            const isToday = isCurrentMonth && d === currentDay;

            if (!isFuture) {
                total += amount;
                if (amount > 0 && (!peakDay || amount > peakDay.amount)) {
                    // Identify top merchant for peak day
                    const topTx = [...txs].sort(
                        (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)
                    )[0];
                    peakDay = {
                        day: d,
                        amount,
                        date: new Date(y, m, d),
                        topMerchant: topTx ? topTx.merchant || topTx.description || topTx.category : '',
                    };
                }
            }

            days.push({
                day: d,
                date: new Date(y, m, d),
                amount,
                plotAmount: isFuture ? 1 : amount, // minimum height slot for future
                isFuture,
                isToday,
                transactions: txs,
                transactionsCount: txs.length,
                topTransactions: [...txs].sort(
                    (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)
                ),
            });
        }

        const avg = currentDay > 0 ? Math.round(total / currentDay) : 0;
        const projected = Math.round(avg * daysInMonth);

        return {
            chartData: days,
            totalSpent: total,
            maxDay: peakDay,
            avgPerDay: avg,
            projectedMonthEnd: projected,
        };
    }, [transactions, y, m, daysInMonth, isCurrentMonth, currentDay]);

    // Weekday series
    const weekdaySeries = useMemo(() => {
        return transactions.filter((t) => {
            const isExp = t.type === 'expense' || !t.type;
            if (!isExp) return false;
            const d = new Date(t.date);
            return d.getFullYear() === y && d.getMonth() === m;
        });
    }, [transactions, y, m]);

    if (loading) {
        return <div className="pem-skeleton h-[280px] w-full rounded-card" />;
    }

    if (error) {
        return (
            <div className="flex h-[280px] items-center justify-center rounded-card bg-[rgba(255,255,255,0.03)] text-xs text-neg">
                Failed to load daily spending data.
            </div>
        );
    }

    const isOverBudget = monthlyBudget > 0 && projectedMonthEnd > monthlyBudget;

    return (
        <div className="space-y-3.5">
            {/* Header: Title + Subtitle and ONE Segmented Switch */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-bold text-ink">Daily Spending</h3>
                    <p className="text-xs text-ink-muted">{monthLabel}</p>
                </div>

                <div
                    role="tablist"
                    aria-label="View format"
                    className="bg-[rgba(255,255,255,0.04)] p-1 rounded-[12px] flex items-center shrink-0"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={view === 'daily'}
                        onClick={() => setView('daily')}
                        className={cx(
                            'px-3 py-1 text-xs rounded-[8px] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                            view === 'daily'
                                ? 'bg-[rgba(255,255,255,0.09)] text-ink font-semibold shadow-xs'
                                : 'text-ink-muted hover:text-ink font-medium'
                        )}
                    >
                        Daily
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={view === 'weekday'}
                        onClick={() => setView('weekday')}
                        className={cx(
                            'px-3 py-1 text-xs rounded-[8px] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                            view === 'weekday'
                                ? 'bg-[rgba(255,255,255,0.09)] text-ink font-semibold shadow-xs'
                                : 'text-ink-muted hover:text-ink font-medium'
                        )}
                    >
                        Weekday
                    </button>
                </div>
            </div>

            {/* Single Summary Strip under header */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-ink-muted">
                    <span>
                        Avg <strong className="text-ink">{formatCurrency(avgPerDay, currency)}</strong>/day
                    </span>
                    <span>·</span>
                    <span>
                        Projected month-end <strong className="text-ink">{formatCurrency(projectedMonthEnd, currency)}</strong>
                    </span>
                </div>

                {monthlyBudget > 0 ? (
                    <span
                        className={cx(
                            'px-2 py-0.5 rounded-[8px] text-[11px] font-semibold tabular-nums',
                            isOverBudget ? 'bg-neg-soft/20 text-neg' : 'bg-pos-soft/20 text-pos'
                        )}
                    >
                        {isOverBudget ? '▲ Above budget pace' : '▼ Under budget pace'}
                    </span>
                ) : null}
            </div>

            {/* Peak day callout (in Daily view) */}
            {view === 'daily' && maxDay && maxDay.amount > 0 ? (
                <div className="flex items-center gap-2 text-[11px] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 rounded-[8px] self-start text-ink-muted">
                    <span className="font-semibold text-warn">
                        Peak Day ({formatDate(maxDay.date, { day: 'numeric', month: 'short' })}):
                    </span>
                    <span className="font-bold text-ink tabular-nums">
                        {formatCurrency(maxDay.amount, currency)}
                    </span>
                    {maxDay.topMerchant ? (
                        <span className="text-ink-faint truncate max-w-[150px]">
                            · {maxDay.topMerchant}
                        </span>
                    ) : null}
                </div>
            ) : null}

            {/* Switchable Body with smooth transition */}
            <div className="transition-all duration-200 min-h-[220px]">
                {view === 'daily' ? (
                    <DailyBarChart
                        data={chartData}
                        currency={currency}
                        dailyAvg={avgPerDay}
                        budgetPace={budgetPace}
                        today={currentDay}
                        onBarClick={(dayData) => setModalDay(dayData)}
                    />
                ) : (
                    <WeekdayHeat series={weekdaySeries} currency={currency} />
                )}
            </div>

            {/* Existing Modal integration when bar is clicked */}
            {modalDay && (
                <CategoryTransactionsModal
                    isOpen={Boolean(modalDay)}
                    onClose={() => setModalDay(null)}
                    initialCategory="ALL"
                    transactions={modalDay.transactions || []}
                    currency={currency}
                    totalSpend={modalDay.amount || 0}
                />
            )}
        </div>
    );
}
