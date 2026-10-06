import { ArrowDownRight, ArrowUpRight, Scale } from 'lucide-react';
import { Badge } from '../ui/primitives';
import { formatCompact, formatCurrency, formatPercent } from '../../utils/currency';

/**
 * Advanced Cash Flow Intelligence Bar:
 * - Net takeaway sentence & health badge
 * - Inflow vs Outflow Proportional Liquidity Bar with 50% equilibrium marker
 * - High-level metrics: Coverage Ratio, Burn Velocity, and Comparison vs previous period
 */
export function CashFlowSummary({
    summary,
    comparison,
    periodNoun = 'this period',
    currency = 'INR',
}) {
    const { net, savingsRate, totalIn = 0, totalOut = 0 } = summary;

    const tone =
        savingsRate === null
            ? 'muted'
            : savingsRate >= 20
              ? 'pos'
              : savingsRate >= 0
                ? 'warn'
                : 'neg';

    const label =
        savingsRate === null
            ? 'No income'
            : savingsRate >= 20
              ? 'Surplus'
              : savingsRate >= 0
                ? 'Balanced'
                : savingsRate <= -100
                  ? 'High Burn'
                  : 'Deficit';

    const sentence =
        net >= 0
            ? `Net Surplus of ${formatCurrency(net, currency)}`
            : `Capital Deficit of ${formatCurrency(Math.abs(net), currency)}`;

    const RateIcon = comparison >= 0 ? ArrowUpRight : ArrowDownRight;

    // Inflow vs Outflow liquidity flow split
    const totalFlow = totalIn + totalOut;
    const inPercent = totalFlow > 0 ? Math.round((totalIn / totalFlow) * 100) : 50;
    const outPercent = 100 - inPercent;

    // Coverage Ratio (Inflow / Outflow)
    const coverage = totalOut > 0 ? totalIn / totalOut : totalIn > 0 ? 99 : 1;

    return (
        <div className="space-y-2">
            {/* Top row: Net delta status + Badge + Comparison */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs sm:text-sm font-bold text-ink">
                        {sentence}
                        <span className="font-normal text-ink-muted"> {periodNoun}</span>
                        {savingsRate !== null ? (
                            <span className="text-xs font-semibold text-ink-muted">
                                {' '}· {formatPercent(savingsRate)} of inflow
                            </span>
                        ) : null}
                    </p>
                    <Badge tone={tone}>{label}</Badge>
                </div>

                <div className="flex items-center gap-2">
                    {comparison !== null ? (
                        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-ink-faint">
                            <RateIcon
                                size={13}
                                className={comparison >= 0 ? 'text-pos' : 'text-neg'}
                                aria-hidden="true"
                            />
                            {Math.abs(comparison).toFixed(0)}% vs last window
                        </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 rounded-control bg-raised px-2 py-0.5 text-xs font-semibold text-ink-muted">
                        <Scale size={12} className="text-brand" />
                        {coverage >= 99 ? '∞ Coverage' : `${coverage.toFixed(2)}x Coverage`}
                    </span>
                </div>
            </div>

            {/* Proportional Liquidity Flow Bar */}
            <div className="rounded-control border border-line bg-surface/50 px-2.5 py-1.5 backdrop-blur-xs">
                <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-pos">
                        <span className="h-2 w-2 rounded-full bg-pos shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                        Inflow {inPercent}% ({formatCompact(totalIn, currency)})
                    </span>
                    <span className="text-[11px] text-ink-faint">
                        Liquidity Balance
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-neg">
                        ({formatCompact(totalOut, currency)}) {outPercent}% Outflow
                        <span className="h-2 w-2 rounded-full bg-neg shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                    </span>
                </div>

                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-line/40">
                    <div
                        className="h-full rounded-l-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${inPercent}%` }}
                    />
                    <div
                        className="absolute top-0 right-0 h-full rounded-r-full bg-gradient-to-l from-rose-500 to-amber-500 transition-all duration-500"
                        style={{ width: `${outPercent}%` }}
                    />
                    {/* Center 50% Equilibrium Marker */}
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white/70 shadow-xs -translate-x-1/2"
                        style={{ left: '50%' }}
                        title="50% Equilibrium Horizon"
                    />
                </div>
            </div>
        </div>
    );
}
