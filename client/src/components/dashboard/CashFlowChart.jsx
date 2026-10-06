import { useMemo } from 'react';
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { cx } from '../ui/cx';
import { formatCompact } from '../../utils/currency';
import { CHART } from '../../utils/theme';
import { CashFlowTooltip } from './CashFlowTooltip';

const SERIES = [
    { key: 'income', name: 'Inflow', color: CHART.income },
    { key: 'expense', name: 'Outflow', color: CHART.expense },
    { key: 'net', name: 'Net Horizon', color: CHART.net },
];

const AXIS_TICK = { fill: 'var(--pem-text-faint)', fontSize: 11 };

/** Custom glowing node for real transaction points on the Net line */
function PulseDot(props) {
    const { cx: x, cy: y, payload } = props;
    if (!x || !y || payload?.isAnchor) return null;
    const isPos = (payload?.net ?? 0) >= 0;
    const color = isPos ? CHART.income : CHART.expense;

    return (
        <g key={`node-${payload?.key || payload?.label}`}>
            <circle cx={x} cy={y} r={8} fill={color} opacity={0.25} />
            <circle
                cx={x}
                cy={y}
                r={4.5}
                fill={color}
                stroke="var(--pem-surface, #0f172a)"
                strokeWidth={2}
            />
        </g>
    );
}

/**
 * Innovative Fluid Liquidity Stream:
 * Continuous dual-zone flow (Inflow wave & Outflow wave) anchored against
 * an illuminated Net Horizon with Zero Baseline.
 * Eliminates disconnected bars and provides an organic, modern financial stream.
 */
export function CashFlowChart({
    data = [],
    currency = 'INR',
    hidden = {},
    onToggle,
}) {
    // Graceful handling for sparse / 1-point datasets so the stream curves naturally across the card
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];
        if (data.length === 1) {
            const d = data[0];
            return [
                {
                    ...d,
                    key: 'anchor-start',
                    label: 'Start',
                    income: 0,
                    expense: 0,
                    net: 0,
                    isAnchor: true,
                },
                {
                    ...d,
                    key: 'node-active',
                    label: d.label,
                    isAnchor: false,
                },
                {
                    ...d,
                    key: 'anchor-end',
                    label: 'End',
                    income: d.income * 0.95,
                    expense: d.expense * 0.95,
                    net: d.net * 0.95,
                    isAnchor: true,
                },
            ];
        }
        return data;
    }, [data]);

    const hasNegative = data.some((d) => (d.net ?? 0) < 0);

    return (
        <div className="flex h-full flex-col">
            {/* Interactive Stream Legend */}
            <div className="mb-2 flex items-center justify-between">
                <ul className="flex flex-wrap items-center gap-2">
                    {SERIES.map((s) => {
                        const off = hidden[s.key];
                        return (
                            <li key={s.key}>
                                <button
                                    type="button"
                                    onClick={() => onToggle?.(s.key)}
                                    aria-pressed={!off}
                                    className={cx(
                                        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold transition',
                                        off
                                            ? 'bg-sunken text-ink-faint line-through opacity-50'
                                            : 'bg-raised text-ink hover:bg-raised/80 shadow-xs'
                                    )}
                                >
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{
                                            backgroundColor: s.color,
                                            boxShadow: off ? 'none' : `0 0 8px ${s.color}60`,
                                        }}
                                    />
                                    {s.name}
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <span className="text-[11px] font-medium text-ink-faint">
                    Zero Horizon Baseline
                </span>
            </div>

            {/* Fluid Chart */}
            <div className="h-[180px] w-full min-w-0 sm:h-[200px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 600, height: 200 }}>
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
                    >
                        <defs>
                            <linearGradient id="cf-inflow-glow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={CHART.income} stopOpacity={0.38} />
                                <stop offset="80%" stopColor={CHART.income} stopOpacity={0.05} />
                                <stop offset="100%" stopColor={CHART.income} stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="cf-outflow-glow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={CHART.expense} stopOpacity={0.38} />
                                <stop offset="80%" stopColor={CHART.expense} stopOpacity={0.05} />
                                <stop offset="100%" stopColor={CHART.expense} stopOpacity={0.0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="4 6"
                            stroke="var(--pem-border)"
                            vertical={false}
                            opacity={0.6}
                        />

                        <XAxis
                            dataKey="label"
                            tick={AXIS_TICK}
                            axisLine={false}
                            tickLine={false}
                            interval={chartData.length > 16 ? 'preserveStartEnd' : 0}
                            minTickGap={14}
                        />

                        <YAxis
                            tick={AXIS_TICK}
                            axisLine={false}
                            tickLine={false}
                            width={54}
                            tickCount={5}
                            allowDecimals={false}
                            domain={[hasNegative ? 'auto' : 0, 'auto']}
                            tickFormatter={(v) => (v === 0 ? '0' : formatCompact(v, currency))}
                        />

                        {/* Zero Horizon Reference Line */}
                        <ReferenceLine
                            y={0}
                            stroke="var(--pem-border-strong, #475569)"
                            strokeDasharray="3 3"
                            strokeWidth={1.2}
                        />

                        <Tooltip
                            cursor={{
                                stroke: 'var(--pem-accent, #8b5cf6)',
                                strokeWidth: 1.5,
                                strokeDasharray: '3 3',
                                opacity: 0.6,
                            }}
                            content={<CashFlowTooltip currency={currency} />}
                        />

                        {/* Inflow Fluid Stream */}
                        {!hidden.income ? (
                            <Area
                                type="monotone"
                                dataKey="income"
                                name="Inflow"
                                stroke={CHART.income}
                                strokeWidth={2.4}
                                fill="url(#cf-inflow-glow)"
                                activeDot={{
                                    r: 5,
                                    fill: CHART.income,
                                    stroke: 'var(--pem-surface)',
                                    strokeWidth: 2,
                                }}
                                animationDuration={700}
                            />
                        ) : null}

                        {/* Outflow Fluid Stream */}
                        {!hidden.expense ? (
                            <Area
                                type="monotone"
                                dataKey="expense"
                                name="Outflow"
                                stroke={CHART.expense}
                                strokeWidth={2.4}
                                fill="url(#cf-outflow-glow)"
                                activeDot={{
                                    r: 5,
                                    fill: CHART.expense,
                                    stroke: 'var(--pem-surface)',
                                    strokeWidth: 2,
                                }}
                                animationDuration={700}
                            />
                        ) : null}

                        {/* Net Liquidity Horizon Spine */}
                        {!hidden.net ? (
                            <Line
                                type="monotone"
                                dataKey="net"
                                name="Net Horizon"
                                stroke={CHART.net}
                                strokeWidth={2.8}
                                dot={<PulseDot />}
                                activeDot={{
                                    r: 6,
                                    fill: CHART.net,
                                    stroke: 'var(--pem-surface)',
                                    strokeWidth: 2,
                                }}
                                animationDuration={700}
                            />
                        ) : null}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
