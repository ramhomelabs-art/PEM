import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceLine,
    ReferenceDot,
} from 'recharts';
import { formatCurrency } from '../../../utils/currency';

function MiniBurnUpTooltip({ active, payload, currency = 'INR', limit }) {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
        <div className="rounded-lg border border-white/[0.08] bg-[#0c1427]/95 p-2 shadow-xl backdrop-blur-md">
            <div className="text-[10px] font-semibold text-ink-muted">Day {data.day}</div>
            <div className="mt-1 space-y-1 text-[11px]">
                {data.actual !== undefined && (
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-emerald-400">Actual:</span>
                        <span className="font-semibold tabular-nums text-emerald-400">
                            {formatCurrency(data.actual, currency)}
                        </span>
                    </div>
                )}
                {data.projected !== undefined && (
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sky-400">Projected:</span>
                        <span className="font-semibold tabular-nums text-sky-400">
                            {formatCurrency(data.projected, currency)}
                        </span>
                    </div>
                )}
                {limit !== undefined && (
                    <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-0.5 text-rose-400/90">
                        <span>Limit:</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(limit, currency)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * BurnUpChart (96px height)
 * Shows actual cumulative line, dashed projection with range band,
 * limit line, today marker, and limit-crossing marker.
 */
export function BurnUpChart({ categoryForecast, timeInfo, currency = 'INR' }) {
    const {
        limit,
        spentSoFar,
        runRate,
        projectedLow,
        projectedHigh,
        limitBreachDate,
        regularExpenseTxs = [],
        oneOffTxs = [],
    } = categoryForecast || {};

    const { day, daysInMonth, elapsedDays, remainingDays } = timeInfo || {
        day: 1,
        daysInMonth: 30,
        elapsedDays: 1,
        remainingDays: 29,
    };

    const chartData = useMemo(() => {
        // Daily spend grouping
        const dailySpendMap = {};
        for (const tx of [...regularExpenseTxs, ...oneOffTxs]) {
            if (!tx || !tx.date) continue;
            const d = new Date(tx.date).getDate();
            dailySpendMap[d] = (dailySpendMap[d] || 0) + Math.abs(Number(tx.amount) || 0);
        }

        const series = [];
        let cumActual = 0;
        const currentFloorDay = Math.min(daysInMonth, Math.floor(elapsedDays));
        const lowDailyRate = Math.max(0, (projectedLow - spentSoFar) / Math.max(1, remainingDays));
        const highDailyRate = Math.max(lowDailyRate, (projectedHigh - spentSoFar) / Math.max(1, remainingDays));

        for (let d = 1; d <= daysInMonth; d++) {
            const daySpend = dailySpendMap[d] || 0;

            if (d <= currentFloorDay) {
                cumActual += daySpend;
                series.push({
                    day: d,
                    actual: Math.round(cumActual),
                });
            } else if (d === currentFloorDay + 1) {
                const futureOffset = d - elapsedDays;
                const proj = Math.round(spentSoFar + runRate * futureOffset);
                const rLow = Math.round(spentSoFar + lowDailyRate * futureOffset);
                const rHigh = Math.round(spentSoFar + highDailyRate * futureOffset);

                series.push({
                    day: d,
                    actual: d === Math.ceil(elapsedDays) ? Math.round(spentSoFar) : undefined,
                    projected: proj,
                    rangeHigh: rHigh,
                    rangeLow: rLow,
                });
            } else {
                const futureOffset = d - elapsedDays;
                const proj = Math.round(spentSoFar + runRate * futureOffset);
                const rLow = Math.round(spentSoFar + lowDailyRate * futureOffset);
                const rHigh = Math.round(spentSoFar + highDailyRate * futureOffset);

                series.push({
                    day: d,
                    projected: proj,
                    rangeHigh: rHigh,
                    rangeLow: rLow,
                });
            }
        }
        return series;
    }, [categoryForecast, timeInfo]);

    const maxChartVal = Math.max(
        limit * 1.1,
        ...chartData.map((d) => Math.max(d.actual || 0, d.projected || 0, d.rangeHigh || 0))
    );

    const breachDayNum = limitBreachDate ? new Date(limitBreachDate).getDate() : null;

    return (
        <div className="h-[96px] w-full min-w-0" aria-label={`Burn-up trajectory chart for ${categoryForecast?.category}`}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <ComposedChart
                    data={chartData}
                    margin={{ top: 6, right: 6, left: 6, bottom: 2 }}
                >
                    <defs>
                        <linearGradient id={`miniRangeGrad_${categoryForecast?.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.03} />
                        </linearGradient>
                    </defs>

                    <XAxis dataKey="day" hide />
                    <YAxis hide domain={[0, maxChartVal]} />

                    <Tooltip content={<MiniBurnUpTooltip currency={currency} limit={limit} />} />

                    {/* Range Band */}
                    <Area
                        type="monotone"
                        dataKey="rangeHigh"
                        stroke="none"
                        fill={`url(#miniRangeGrad_${categoryForecast?.id})`}
                        isAnimationActive={false}
                    />

                    {/* Limit Line */}
                    <ReferenceLine
                        y={limit}
                        stroke="#f43f5e"
                        strokeDasharray="3 3"
                        strokeWidth={1.2}
                    />

                    {/* Projected Dashed Line */}
                    <Line
                        type="monotone"
                        dataKey="projected"
                        stroke="#38bdf8"
                        strokeWidth={1.8}
                        strokeDasharray="3 3"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                    />

                    {/* Actual Solid Line */}
                    <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                    />

                    {/* "Today" Marker */}
                    {chartData.find((d) => d.day === day) && (
                        <ReferenceDot
                            x={day}
                            y={chartData.find((d) => d.day === day)?.actual || 0}
                            r={3.5}
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth={1.5}
                        />
                    )}

                    {/* Limit Crossing Marker */}
                    {breachDayNum && chartData.find((d) => d.day === breachDayNum) && (
                        <ReferenceDot
                            x={breachDayNum}
                            y={limit}
                            r={4}
                            fill="#f43f5e"
                            stroke="#ffffff"
                            strokeWidth={1.5}
                        />
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

export default BurnUpChart;
