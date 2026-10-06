import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Lightbulb,
    PiggyBank,
    Sparkles,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { cx } from '../ui/cx';
import { generateInsights } from '../../utils/insightsEngine';

const SEVERITY_CONFIG = {
    warning: {
        icon: AlertTriangle,
        bg: 'bg-warn-soft/20',
        text: 'text-warn',
        chipBg: 'bg-warn-soft/25 text-warn',
    },
    opportunity: {
        icon: Sparkles,
        bg: 'bg-violet-soft/20',
        text: 'text-violet',
        chipBg: 'bg-violet-soft/25 text-violet',
    },
    positive: {
        icon: TrendingUp,
        bg: 'bg-pos-soft/20',
        text: 'text-pos',
        chipBg: 'bg-pos-soft/25 text-pos',
    },
    info: {
        icon: Lightbulb,
        bg: 'bg-info-soft/20',
        text: 'text-info',
        chipBg: 'bg-info-soft/25 text-info',
    },
};

/**
 * InsightItem: Renders a single ranked financial insight.
 * Features a coloured 36px icon container, bold title, one-line detail,
 * and a small trend chip without any per-row buttons.
 */
export function InsightItem({ insight }) {
    const config = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.info;
    const Icon = config.icon;

    return (
        <li className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--pem-surface-raised,rgba(255,255,255,0.03))] hover:bg-[rgba(255,255,255,0.06)] p-3 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
                <span
                    className={cx(
                        'w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-transform',
                        config.bg,
                        config.text
                    )}
                    aria-hidden="true"
                >
                    <Icon size={18} />
                </span>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate leading-tight">
                        {insight.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted truncate">
                        {insight.detail}
                    </p>
                </div>
            </div>

            {insight.trend ? (
                <span
                    className={cx(
                        'shrink-0 rounded-[8px] px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                        config.chipBg
                    )}
                >
                    {insight.trend}
                </span>
            ) : null}
        </li>
    );
}

/**
 * InsightsCard: Ranked feed of at most 4 auto-generated smart insights.
 * Replaces old heatmaps, provides loading skeletons, empty state, and
 * a clean "See all insights" text link.
 */
export function InsightsCard({
    insights: initialInsights,
    transactions = [],
    budgets = [],
    currency = 'INR',
    loading = false,
    error = null,
    onSeeAll,
}) {
    const [modalOpen, setModalOpen] = useState(false);

    // Compute insights dynamically from live data if not directly provided
    const items = useMemo(() => {
        if (Array.isArray(initialInsights) && initialInsights.length > 0) {
            return initialInsights.slice(0, 4);
        }
        if (transactions.length > 0) {
            return generateInsights({ transactions, budgets, currency });
        }
        return [];
    }, [initialInsights, transactions, budgets, currency]);

    // Loading skeleton
    if (loading) {
        return (
            <div className="space-y-2.5" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="flex items-center gap-3 rounded-[12px] bg-[var(--pem-surface-raised,rgba(255,255,255,0.03))] p-3 animate-pulse"
                    >
                        <div className="w-9 h-9 rounded-[10px] bg-[rgba(255,255,255,0.06)] shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-1/2 rounded bg-[rgba(255,255,255,0.06)]" />
                            <div className="h-2.5 w-3/4 rounded bg-[rgba(255,255,255,0.04)]" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex items-center gap-3 rounded-[12px] bg-[var(--pem-surface-raised,rgba(255,255,255,0.03))] p-3.5 text-xs text-neg">
                <AlertTriangle size={18} className="shrink-0" aria-hidden="true" />
                <span>Unable to generate insights right now.</span>
            </div>
        );
    }

    // Empty state
    if (!items.length) {
        return (
            <div className="flex items-center gap-3 rounded-[12px] bg-[var(--pem-surface-raised,rgba(255,255,255,0.03))] p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-pos-soft/20 text-pos">
                    <CheckCircle2 size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                        All good, nothing needs attention
                    </p>
                    <p className="text-xs text-ink-muted">
                        Your budgets and spending trends are healthy.
                    </p>
                </div>
            </div>
        );
    }

    const handleSeeAllClick = () => {
        if (onSeeAll) {
            onSeeAll();
        } else {
            setModalOpen(true);
        }
    };

    return (
        <div className="flex flex-col gap-2.5">
            <ul className="space-y-2">
                {items.map((item) => (
                    <InsightItem key={item.id} insight={item} />
                ))}
            </ul>

            <div className="mt-1 flex items-center justify-between">
                <button
                    type="button"
                    onClick={handleSeeAllClick}
                    className="text-xs font-semibold text-brand hover:underline transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded-[6px] px-1 py-0.5"
                >
                    See all insights →
                </button>
            </div>

            {/* In-card modal for See all insights if no external handler provided */}
            {modalOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="all-insights-title"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
                    onClick={() => setModalOpen(false)}
                >
                    <div
                        className="relative w-full max-w-lg rounded-[20px] bg-surface p-6 shadow-2xl space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 id="all-insights-title" className="text-lg font-bold text-ink">
                                Financial Insights
                            </h3>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="rounded-[10px] p-1.5 text-ink-muted hover:text-ink hover:bg-[rgba(255,255,255,0.06)]"
                            >
                                ✕
                            </button>
                        </div>
                        <ul className="space-y-2 max-h-[60vh] overflow-y-auto modal-thin-scroll pr-1">
                            {items.map((item) => (
                                <InsightItem key={item.id} insight={item} />
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
