import { AlertTriangle, Lightbulb, PiggyBank, TrendingUp } from 'lucide-react';
import { cx } from '../ui/cx';

const ICONS = {
    'trending-up': TrendingUp,
    alert: AlertTriangle,
    piggy: PiggyBank,
};

const TONE = {
    pos: { text: 'text-pos', bg: 'bg-pos-soft' },
    neg: { text: 'text-neg', bg: 'bg-neg-soft' },
    warn: { text: 'text-warn', bg: 'bg-warn-soft' },
    info: { text: 'text-info', bg: 'bg-info-soft' },
    violet: { text: 'text-violet', bg: 'bg-violet-soft' },
};

/** Three auto-generated tips from `useInsights`. */
export function InsightsCard({ insights = [], loading }) {
    if (loading) {
        return (
            <ul className="space-y-3" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="flex items-start gap-3">
                        <div className="pem-skeleton h-8 w-8 rounded-[10px]" />
                        <div className="flex-1 space-y-2">
                            <div className="pem-skeleton h-3 w-2/3" />
                            <div className="pem-skeleton h-2.5 w-1/2" />
                        </div>
                    </li>
                ))}
            </ul>
        );
    }

    if (!insights.length) {
        return (
            <div className="flex items-center gap-3 rounded-card border border-dashed border-line px-4 py-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-violet-soft text-violet">
                    <Lightbulb size={18} aria-hidden="true" />
                </span>
                <p className="text-sm text-ink-muted">
                    Not enough activity yet — insights appear once you have data.
                </p>
            </div>
        );
    }

    return (
        <ul className="space-y-2.5">
            {insights.map((tip) => {
                const Icon = ICONS[tip.icon] || Lightbulb;
                const tone = TONE[tip.tone] || TONE.info;
                return (
                    <li
                        key={tip.id}
                        className="flex items-start gap-3 rounded-control border border-line bg-sunken p-3"
                    >
                        <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-[10px]', tone.bg, tone.text)}>
                            <Icon size={16} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">{tip.title}</p>
                            <p className="mt-0.5 text-xs text-ink-muted">{tip.detail}</p>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
