import { cx } from '../ui/cx';
import { formatCurrency } from '../../utils/currency';
import { CHART } from '../../utils/theme';

/**
 * High-precision hover HUD for the Cash Flow stream:
 * Displays period, Inflow, Outflow, Net Delta, Coverage ratio, and Cumulative Balance.
 */
export function CashFlowTooltip({ active, payload, label, currency = 'INR' }) {
    if (!active || !payload?.length) return null;

    const dataItem = payload[0]?.payload;
    if (dataItem?.isAnchor) return null;

    const read = (key) => payload.find((p) => p.dataKey === key)?.value ?? dataItem?.[key] ?? 0;
    const income = read('income');
    const expense = read('expense');
    const net = read('net');
    const balance = dataItem?.balance ?? null;
    const coverage = expense > 0 ? income / expense : income > 0 ? 99 : 1;

    return (
        <div className="min-w-[210px] rounded-control border border-line-strong bg-raised/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="mb-2.5 flex items-center justify-between border-b border-line pb-1.5">
                <p className="text-xs font-bold text-ink">{label}</p>
                <span
                    className={cx(
                        'rounded-pill px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        net >= 0 ? 'bg-pos-soft text-pos' : 'bg-neg-soft text-neg'
                    )}
                >
                    {net >= 0 ? 'Surplus' : 'Deficit'}
                </span>
            </div>

            <dl className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-1.5 text-ink-muted">
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: CHART.income }}
                        />
                        Inflow
                    </dt>
                    <dd className="tnum font-bold text-pos">{formatCurrency(income, currency)}</dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-1.5 text-ink-muted">
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: CHART.expense }}
                        />
                        Outflow
                    </dt>
                    <dd className="tnum font-bold text-neg">{formatCurrency(expense, currency)}</dd>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-line/60 pt-1.5">
                    <dt className="flex items-center gap-1.5 font-semibold text-ink">
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: CHART.net }}
                        />
                        Net Horizon
                    </dt>
                    <dd className={cx('tnum font-extrabold', net >= 0 ? 'text-pos' : 'text-neg')}>
                        {formatCurrency(net, currency, { signed: true })}
                    </dd>
                </div>

                <div className="flex items-center justify-between gap-4 text-[11px] text-ink-muted">
                    <dt>Flow Coverage</dt>
                    <dd className="tnum font-semibold text-ink">
                        {coverage >= 99 ? '∞ (No spend)' : `${coverage.toFixed(2)}x`}
                    </dd>
                </div>

                {balance !== null ? (
                    <div className="flex items-center justify-between gap-4 border-t border-line/60 pt-1.5 text-[11px]">
                        <dt className="text-ink-muted">Cumulative</dt>
                        <dd className={cx('tnum font-bold', balance >= 0 ? 'text-pos' : 'text-neg')}>
                            {formatCurrency(balance, currency, { signed: true })}
                        </dd>
                    </div>
                ) : null}
            </dl>
        </div>
    );
}
