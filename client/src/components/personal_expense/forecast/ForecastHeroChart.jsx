import React from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceDot,
} from 'recharts';
import { formatCurrency } from '../../../utils/currency';

/**
 * Custom Hero Chart Tooltip with clean formatting
 */
function CustomHeroTooltip({ active, payload, label, currency = 'INR' }) {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    return (
        <div className="rounded-xl border border-white/[0.08] bg-[#0c1427]/95 p-3 shadow-2xl backdrop-blur-md">
            <div className="text-xs font-semibold text-ink-muted">
                {data.label || `Day ${data.day}`}
            </div>

            <div className="mt-2 space-y-1.5 text-xs">
                {data.actual !== undefined && (
                    <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-ink-secondary">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Actual Spend:
                        </span>
                        <span className="font-semibold text-emerald-400 tabular-nums">
                            {formatCurrency(data.actual, currency)}
                        </span>
                    </div>
                )}

                {data.projected !== undefined && (
                    <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-ink-secondary">
                            <span className="h-2 w-2 rounded-full bg-sky-400" />
                            Projected Spend:
                        </span>
                        <span className="font-semibold text-sky-400 tabular-nums">
                            {formatCurrency(data.projected, currency)}
                        </span>
                    </div>
                )}

                {data.rangeLow !== undefined && data.rangeHigh !== undefined && (
                    <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-ink-muted">
                            <span className="h-2 w-2 rounded-full bg-teal-500/40" />
                            Projected Range:
                        </span>
                        <span className="font-medium text-ink-muted tabular-nums">
                            {formatCurrency(data.rangeLow, currency)} – {formatCurrency(data.rangeHigh, currency)}
                        </span>
                    </div>
                )}

                {data.idealPace !== undefined && (
                    <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-ink-muted">
                            <span className="h-2 w-2 rounded-full bg-slate-500" />
                            Ideal Pace:
                        </span>
                        <span className="font-medium text-slate-400 tabular-nums">
                            {formatCurrency(data.idealPace, currency)}
                        </span>
                    </div>
                )}

                {data.limit !== undefined && (
                    <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-1.5">
                        <span className="flex items-center gap-1.5 text-rose-400/90">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            Budget Limit:
                        </span>
                        <span className="font-bold text-rose-400 tabular-nums">
                            {formatCurrency(data.limit, currency)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Forecast Hero Chart
 * Cumulative trajectory with Actual solid curve, Projected dashed curve,
 * Low-High range shading, Ideal Pace, and Budget Limit.
 * Contains the single, modal-wide Legend for these series.
 */
export function ForecastHeroChart({ macroData, currency = 'INR' }) {
    if (!macroData || !macroData.cumulativeSeries?.length) return null;

    const { cumulativeSeries, totalBudget, timeInfo } = macroData;
    const { day, daysInMonth } = timeInfo || { day: 1, daysInMonth: 30 };

    // Format Y-axis ticks in compact K notation (e.g. ₹25K)
    const formatYAxis = (val) => {
        if (val === 0) return '₹0';
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
        if (val >= 1000) return `₹${Math.round(val / 1000)}k`;
        return `₹${val}`;
    };

    // Find the max value for YAxis scaling
    const maxVal = Math.max(
        totalBudget * 1.15,
        ...cumulativeSeries.map((d) => Math.max(d.actual || 0, d.projected || 0, d.rangeHigh || 0, d.limit || 0))
    );

    return (
        <section
            aria-label="Cumulative Expense Forecast Trajectory"
            className="overflow-hidden rounded-2xl bg-surface-raised/70 p-4 shadow-sm"
        >
            {/* Header + Single Unified Modal Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.04] pb-3">
                <div className="min-w-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        Cumulative Spend Trajectory
                    </h3>
                    <p className="text-[11px] text-ink-muted">
                        Budgeted categories pace vs month limit
                    </p>
                </div>

                {/* THE ONLY LEGEND FOR THE ENTIRE MODAL */}
                <div
                    className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted"
                    aria-label="Chart legend"
                >
                    <div className="flex items-center gap-1.5">
                        <span className="h-0.5 w-3.5 rounded-full bg-emerald-400" />
                        <span className="text-ink-secondary">Actual</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="h-0.5 w-3.5 rounded-full border-t-2 border-dashed border-sky-400" />
                        <span className="text-ink-secondary">Projected</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-3.5 rounded-sm bg-teal-500/20" />
                        <span className="text-ink-secondary">Range</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="h-0.5 w-3.5 rounded-full border-t-2 border-dashed border-rose-500" />
                        <span className="text-ink-secondary">Limit</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="h-0.5 w-3.5 rounded-full border-t border-dotted border-slate-400" />
                        <span className="text-ink-secondary">Ideal pace</span>
                    </div>
                </div>
            </div>

            {/* Chart Canvas */}
            <div className="mt-3 h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={cumulativeSeries}
                        margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="rangeBandGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.22} />
                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />

                        <XAxis
                            dataKey="day"
                            tickLine={false}
                            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            ticks={[1, Math.round(daysInMonth / 4), Math.round(daysInMonth / 2), Math.round((daysInMonth * 3) / 4), daysInMonth]}
                            tickFormatter={(v) => `D${v}`}
                        />

                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={formatYAxis}
                            domain={[0, maxVal]}
                        />

                        <Tooltip content={<CustomHeroTooltip currency={currency} />} />

                        {/* Low-High Shaded Range Band */}
                        <Area
                            type="monotone"
                            dataKey="rangeHigh"
                            stroke="none"
                            fill="url(#rangeBandGradient)"
                            isAnimationActive={false}
                        />

                        {/* Actual Spend Area fill */}
                        <Area
                            type="monotone"
                            dataKey="actual"
                            stroke="none"
                            fill="url(#actualGradient)"
                            isAnimationActive={false}
                        />

                        {/* Ideal Pace Line */}
                        <Line
                            type="linear"
                            dataKey="idealPace"
                            stroke="#64748b"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                            dot={false}
                            isAnimationActive={false}
                        />

                        {/* Budget Limit Line */}
                        <Line
                            type="linear"
                            dataKey="limit"
                            stroke="#f43f5e"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            dot={false}
                            isAnimationActive={false}
                        />

                        {/* Projected Forecast Dashed Line */}
                        <Line
                            type="monotone"
                            dataKey="projected"
                            stroke="#38bdf8"
                            strokeWidth={2.2}
                            strokeDasharray="4 4"
                            dot={false}
                            connectNulls
                            isAnimationActive={false}
                        />

                        {/* Actual Spend Solid Line */}
                        <Line
                            type="monotone"
                            dataKey="actual"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={false}
                            connectNulls
                            isAnimationActive={false}
                        />

                        {/* "Today" Reference Marker Dot */}
                        {cumulativeSeries.find((d) => d.day === day) && (
                            <ReferenceDot
                                x={day}
                                y={cumulativeSeries.find((d) => d.day === day)?.actual || 0}
                                r={4.5}
                                fill="#10b981"
                                stroke="#ffffff"
                                strokeWidth={2}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}

export default ForecastHeroChart;
