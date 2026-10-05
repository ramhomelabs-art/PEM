import React from 'react';
import { TrendingUp, Shield, Layers, DollarSign, ArrowUpRight, ArrowDownRight, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../../utils/currency';
import { Badge, IconBadge } from '../ui/primitives';

const CATEGORY_TONE = {
    'Market': 'pos',
    'Fixed': 'info',
    'Alternative': 'warn',
    'Insurance': 'neg'
};

const InvestmentList = ({ investments, onSelect, onAnalyze, onDelete }) => {
    const { user } = useAuth();
    const formatCurrency = (val) => formatCurrencyUtil(val, user?.currency || 'USD');

    const iconFor = (cat) => {
        switch (cat) {
            case 'Market': return TrendingUp;
            case 'Fixed': return Shield;
            case 'Alternative': return Layers;
            default: return DollarSign;
        }
    };

    if (!investments || investments.length === 0) {
        return <p className="py-10 text-center text-sm text-ink-faint">No active investments found. Start by adding one!</p>;
    }

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {investments.map((inv) => {
                const returns = Number(inv.currentValue) - Number(inv.totalInvested);
                const returnPerc = inv.totalInvested > 0 ? (returns / inv.totalInvested) * 100 : 0;
                const isProfit = returns >= 0;
                const tone = CATEGORY_TONE[inv.category] || 'brand';

                return (
                    <div
                        key={inv.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(inv)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelect(inv);
                            }
                        }}
                        className="cursor-pointer rounded-card border border-line bg-surface p-4 transition hover:border-line-strong hover:bg-raised"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <IconBadge icon={iconFor(inv.category)} tone={tone} />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-ink">{inv.name}</p>
                                    <p className="truncate text-xs text-ink-muted">
                                        {inv.subCategory} • {inv.provider}
                                    </p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                {inv.ticker ? (
                                    <button
                                        type="button"
                                        title="View Live Market Analysis"
                                        aria-label={`Analyze ${inv.name}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAnalyze(inv);
                                        }}
                                        className="grid h-8 w-8 place-items-center rounded-control border border-line text-info transition hover:border-info/40 hover:bg-info-soft"
                                    >
                                        <TrendingUp size={14} aria-hidden="true" />
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    title="Delete Investment"
                                    aria-label={`Delete ${inv.name}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(inv.id);
                                    }}
                                    className="grid h-8 w-8 place-items-center rounded-control border border-line text-ink-faint transition hover:border-neg/30 hover:bg-neg-soft hover:text-neg"
                                >
                                    <Trash2 size={14} aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                        <div className="mt-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">Current Value</p>
                            <p className="tnum mt-1 text-2xl font-extrabold tracking-tight text-ink">{formatCurrency(inv.currentValue)}</p>
                            {inv.ticker ? (
                                <div className="mt-1">
                                    <Badge tone="muted">{inv.ticker}</Badge>
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Invested</p>
                                <p className="tnum mt-0.5 text-sm font-bold text-ink-muted">{formatCurrency(inv.totalInvested)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Returns</p>
                                <p
                                    className={
                                        isProfit
                                            ? 'tnum mt-0.5 flex items-center justify-end gap-1 text-sm font-bold text-pos'
                                            : 'tnum mt-0.5 flex items-center justify-end gap-1 text-sm font-bold text-neg'
                                    }
                                >
                                    {isProfit ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
                                    {formatCurrency(Math.abs(returns))} ({returnPerc.toFixed(1)}%)
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default InvestmentList;