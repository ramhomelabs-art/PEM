import { useMemo, useState } from 'react';
import { Inbox, Plus, TrendingUp } from 'lucide-react';
import { Button, EmptyState } from '../ui/primitives';
import { cx } from '../ui/cx';
import { formatCompact } from '../../utils/currency';
import {
    MIN_TREND_PERIODS,
    previousWindow,
    resolveRangeWindow,
    summarizeCashFlow,
    windowTotals,
} from '../../utils/cashFlow';
import { useCashFlowSeries } from '../../hooks/personal_expense/useDashboardData';
import { CashFlowChart } from './CashFlowChart';
import { CashFlowSummary } from './CashFlowSummary';

const GRANULARITIES = [
    { id: 'day', label: 'Daily' },
    { id: 'week', label: 'Weekly' },
    { id: 'month', label: 'Monthly' },
];

const RANGE_SUBTITLE = {
    '1m': 'This month',
    '3m': 'Last 3 months',
    '6m': 'Last 6 months',
    '1y': 'Last 12 months',
};

const GRANULARITY_WORD = { day: 'daily', week: 'weekly', month: 'monthly' };
const PERIOD_UNIT = { day: 'day', week: 'week', month: 'month' };

/** Tiny segmented control for time grouping. */
function Segmented({ label, options, value, onChange }) {
    return (
        <div
            role="group"
            aria-label={label}
            className="inline-flex rounded-control border border-line bg-sunken p-0.5"
        >
            {options.map((o) => {
                const active = o.id === value;
                return (
                    <button
                        key={o.id}
                        type="button"
                        onClick={() => onChange(o.id)}
                        aria-pressed={active}
                        className={cx(
                            'rounded-[8px] px-3 py-1 text-xs font-semibold transition',
                            active
                                ? 'bg-surface text-ink shadow-card'
                                : 'text-ink-muted hover:text-ink'
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

const savedText = (net, currency) =>
    net >= 0
        ? `+${formatCompact(net, currency)}`
        : `-${formatCompact(Math.abs(net), currency)}`;

/**
 * Advanced Cash Flow Card:
 * One unified, innovative fluid stream format with high-precision tracking,
 * liquidity balance bar, and intelligent financial telemetry.
 */
export function CashFlowCard({
    transactions = [],
    range = '1m',
    customRange,
    currency = 'INR',
    loading,
    onAdd,
}) {
    const [override, setOverride] = useState(null);
    const [hidden, setHidden] = useState({ income: false, expense: false, net: false });

    // Recompute the "requested" granularity only while it matches the range.
    const rangeKey = `${range}:${customRange?.from || ''}:${customRange?.to || ''}`;
    const requested = override && override.rangeKey === rangeKey ? override.value : undefined;

    const { data: series, granularity } = useCashFlowSeries(transactions, {
        range,
        customRange,
        granularity: requested,
    });
    const summary = useMemo(() => summarizeCashFlow(series), [series]);

    const comparison = useMemo(() => {
        const { start, end } = resolveRangeWindow(range, customRange);
        const current = windowTotals(transactions, start, end);
        const prevWin = previousWindow(start, end);
        const previous = windowTotals(transactions, prevWin.start, prevWin.end);
        if (!previous.net) return null;
        return ((current.net - previous.net) / Math.abs(previous.net)) * 100;
    }, [transactions, range, customRange]);

    const isEmpty = summary.totalIn === 0 && summary.totalOut === 0;
    const sparse = !isEmpty && summary.activePeriods < MIN_TREND_PERIODS;

    const rangeLabel = range === 'custom' ? 'Custom range' : RANGE_SUBTITLE[range] ?? '';
    const subtitle = `${rangeLabel} · ${GRANULARITY_WORD[granularity] ?? ''} stream`;
    const periodNoun = range === '1m' ? 'this month' : 'this period';

    // Coverage calculation
    const coverage =
        summary.totalOut > 0
            ? summary.totalIn / summary.totalOut
            : summary.totalIn > 0
              ? 99
              : 1;

    return (
        <section className="pem-card flex h-full flex-col p-4 sm:p-5">
            <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-ink">
                        <TrendingUp size={18} className="text-brand" aria-hidden="true" />
                        Cash Flow Stream
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Segmented
                        label="Group by"
                        options={GRANULARITIES}
                        value={granularity}
                        onChange={(value) => setOverride({ rangeKey, value })}
                    />
                </div>
            </header>

            {loading ? (
                <div className="mt-3 flex-1 space-y-3">
                    <div className="pem-skeleton h-4 w-64" />
                    <div className="pem-skeleton h-[180px] w-full rounded-card sm:h-[200px]" />
                </div>
            ) : isEmpty ? (
                <div className="mt-3 flex-1">
                    <EmptyState
                        icon={Inbox}
                        title="No transactions in this period"
                        action={
                            <Button variant="primary" size="sm" icon={Plus} onClick={onAdd}>
                                Add entry
                            </Button>
                        }
                    />
                </div>
            ) : (
                <div className="mt-3 flex flex-1 flex-col">
                    <CashFlowSummary
                        summary={summary}
                        comparison={comparison}
                        periodNoun={periodNoun}
                        currency={currency}
                    />

                    <div className="mt-2.5 flex-1">
                        <CashFlowChart
                            data={series}
                            currency={currency}
                            hidden={hidden}
                            onToggle={(key) =>
                                setHidden((h) => ({ ...h, [key]: !h[key] }))
                            }
                        />
                    </div>

                    {sparse ? (
                        <p className="mt-1.5 text-xs text-ink-faint">
                            Tracking active entries. Add more transactions to expand trend resolution.
                        </p>
                    ) : null}

                    {/* Advanced Financial Telemetry Strip */}
                    <footer className="mt-2.5 grid grid-cols-2 gap-2 border-t border-line pt-2 text-xs sm:grid-cols-4">
                        <div className="min-w-0">
                            <p className="text-[11px] font-medium text-ink-faint">Peak Inflow</p>
                            <p className="tnum font-bold text-pos truncate">
                                {summary.best
                                    ? `${summary.best.label} (${savedText(summary.best.net, currency)})`
                                    : '—'}
                            </p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-medium text-ink-faint">Peak Outflow</p>
                            <p className="tnum font-bold text-neg truncate">
                                {summary.lowest
                                    ? `${summary.lowest.label} (${savedText(summary.lowest.net, currency)})`
                                    : '—'}
                            </p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-medium text-ink-faint">Coverage Ratio</p>
                            <p className="tnum font-bold text-ink truncate">
                                {coverage >= 99 ? '∞ (Zero spend)' : `${coverage.toFixed(2)}x coverage`}
                            </p>
                        </div>
                        <div className="min-w-0 text-left sm:text-right">
                            <p className="text-[11px] font-medium text-ink-faint">Flow Velocity</p>
                            <p
                                className={cx(
                                    'tnum font-bold truncate',
                                    summary.avg >= 0 ? 'text-pos' : 'text-neg'
                                )}
                            >
                                {summary.avg >= 0 ? '+' : ''}
                                {formatCompact(summary.avg, currency)} /{' '}
                                {PERIOD_UNIT[granularity]}
                            </p>
                        </div>
                    </footer>
                </div>
            )}
        </section>
    );
}
