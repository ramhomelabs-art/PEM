import { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, Inbox, X } from 'lucide-react';
import { cx } from '../ui/cx';
import { formatCurrency, formatDate } from '../../utils/currency';

const TABS = [
    { id: 'all', label: 'All' },
    { id: 'income', label: 'Income' },
    { id: 'expense', label: 'Expense' },
];

/**
 * Recent activity table. Category selection from the donut is applied before
 * the type tab, so the two filters compose predictably.
 */
export function ActivityList({
    transactions = [],
    currency = 'INR',
    loading,
    tab = 'all',
    onTabChange,
    categoryFilter,
    onClearFilter,
    onViewAll,
    limit = 6,
}) {
    const filtered = useMemo(() => {
        const rows = transactions
            .filter((t) => (tab === 'all' ? true : t.type === tab))
            .filter((t) => (categoryFilter ? t.category === categoryFilter : true))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        return rows;
    }, [transactions, tab, categoryFilter]);

    if (loading) {
        return (
            <ul className="space-y-2" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-control border border-line p-3">
                        <div className="pem-skeleton h-9 w-9 rounded-[10px]" />
                        <div className="flex-1 space-y-2">
                            <div className="pem-skeleton h-2.5 w-1/3" />
                            <div className="pem-skeleton h-2 w-1/4" />
                        </div>
                        <div className="pem-skeleton h-4 w-16" />
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div role="tablist" aria-label="Filter activity" className="inline-flex rounded-control border border-line bg-sunken p-0.5">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            role="tab"
                            type="button"
                            aria-selected={tab === t.id}
                            onClick={() => onTabChange?.(t.id)}
                            className={cx(
                                'rounded-[8px] px-3 py-1 text-xs font-semibold transition',
                                tab === t.id
                                    ? 'bg-surface text-ink shadow-card'
                                    : 'text-ink-muted hover:text-ink'
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {categoryFilter ? (
                    <button
                        type="button"
                        onClick={() => onClearFilter?.()}
                        className="inline-flex items-center gap-1 rounded-pill border border-line-strong bg-raised px-2.5 py-1 text-xs font-semibold text-ink"
                    >
                        {categoryFilter}
                        <X size={12} aria-hidden="true" />
                    </button>
                ) : null}
            </div>

            {!filtered.length ? (
                <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line text-center">
                    <Inbox size={24} className="text-ink-faint" aria-hidden="true" />
                    <p className="text-sm font-bold text-ink-muted">Nothing here</p>
                    <p className="text-xs text-ink-faint">
                        {categoryFilter || tab !== 'all'
                            ? 'No transactions match this filter.'
                            : 'Your latest transactions will show up here.'}
                    </p>
                </div>
            ) : (
                <ul className="pem-scroll max-h-[290px] space-y-1 overflow-y-auto pr-1">
                    {filtered.slice(0, limit).map((t) => {
                        const isIncome = t.type === 'income';
                        return (
                            <li
                                key={t.id}
                                className="flex items-center gap-3 rounded-control border border-transparent px-2 py-2 transition hover:border-line hover:bg-raised"
                            >
                                <span
                                    className={cx(
                                        'grid h-9 w-9 shrink-0 place-items-center rounded-[10px]',
                                        isIncome ? 'bg-pos-soft text-pos' : 'bg-neg-soft text-neg'
                                    )}
                                >
                                    {isIncome ? (
                                        <ArrowDownLeft size={16} aria-hidden="true" />
                                    ) : (
                                        <ArrowUpRight size={16} aria-hidden="true" />
                                    )}
                                </span>

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-ink">
                                        {t.description || t.category || 'Transaction'}
                                    </p>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                                        <span className="rounded-pill bg-raised px-1.5 py-0.5 font-medium text-ink-muted">
                                            {t.category || 'Uncategorised'}
                                        </span>
                                        <span>{formatDate(t.date, { day: 'numeric', month: 'short' })}</span>
                                        {t.paymentMode ? <span className="capitalize">{t.paymentMode}</span> : null}
                                    </div>
                                </div>

                                <span
                                    className={cx(
                                        'tnum shrink-0 text-sm font-bold',
                                        isIncome ? 'text-pos' : 'text-neg'
                                    )}
                                >
                                    {isIncome ? '+' : '-'}
                                    {formatCurrency(Math.abs(Number(t.amount) || 0), currency)}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}

            {onViewAll && filtered.length > limit ? (
                <button
                    type="button"
                    onClick={onViewAll}
                    className="mt-3 self-start text-xs font-bold text-brand hover:underline"
                >
                    View all {filtered.length} transactions →
                </button>
            ) : null}
        </div>
    );
}
