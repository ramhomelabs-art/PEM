import { Link } from 'react-router-dom';
import { CalendarClock, HandCoins, Receipt, CheckCircle2 } from 'lucide-react';
import { cx } from '../ui/cx';
import { daysUntil, formatCurrency, formatDate } from '../../utils/currency';

const KIND = {
    bill: { icon: Receipt, label: 'Bill' },
    emi: { icon: CalendarClock, label: 'EMI' },
    borrow: { icon: HandCoins, label: 'Borrow' },
};

function DaysBadge({ days }) {
    if (days === null) return null;
    if (days < 0) {
        return (
            <span className="tnum rounded-pill bg-neg-soft px-2 py-0.5 text-xs font-bold text-neg">
                {Math.abs(days)}d overdue
            </span>
        );
    }
    if (days <= 3) {
        return (
            <span className="tnum rounded-pill bg-warn-soft px-2 py-0.5 text-xs font-bold text-warn">
                {days === 0 ? 'Today' : `${days}d left`}
            </span>
        );
    }
    return (
        <span className="tnum rounded-pill bg-raised px-2 py-0.5 text-xs font-semibold text-ink-muted">
            {days}d left
        </span>
    );
}

/**
 * Timeline of upcoming bills / EMIs / borrows. Days-left badges escalate
 * amber (<=3d) then red (overdue).
 */
export function DueList({ items = [], currency = 'INR', loading }) {
    if (loading) {
        return (
            <ul className="space-y-3" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3">
                        <div className="pem-skeleton h-9 w-9 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <div className="pem-skeleton h-3 w-2/3" />
                            <div className="pem-skeleton h-2.5 w-1/3" />
                        </div>
                    </li>
                ))}
            </ul>
        );
    }

    if (!items.length) {
        return (
            <div className="flex items-center gap-3 rounded-card border border-dashed border-line px-4 py-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pos-soft text-pos">
                    <CheckCircle2 size={18} aria-hidden="true" />
                </span>
                <p className="text-sm text-ink-muted">All clear — nothing due in the next 30 days.</p>
            </div>
        );
    }

    return (
        <ol className="relative space-y-3">
            <span className="absolute left-[17px] top-2 bottom-2 w-px bg-line" aria-hidden="true" />
            {items.map((item) => {
                const { icon: Icon, label } = KIND[item.kind] || KIND.bill;
                const days = daysUntil(item.dueDate);
                const row = (
                    <div className="relative flex items-center gap-3">
                        <span
                            className={cx(
                                'z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface',
                                days !== null && days < 0
                                    ? 'text-neg'
                                    : days !== null && days <= 3
                                      ? 'text-warn'
                                      : 'text-ink-muted'
                            )}
                        >
                            <Icon size={16} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                                <span className="shrink-0 rounded-pill bg-raised px-1.5 py-0.5 text-xs font-medium text-ink-faint">
                                    {label}
                                </span>
                            </div>
                            <p className="tnum text-xs text-ink-faint">
                                {formatDate(item.dueDate, { day: 'numeric', month: 'short' })} ·{' '}
                                {formatCurrency(item.amount, currency)}
                            </p>
                        </div>
                        <DaysBadge days={days} />
                    </div>
                );

                return (
                    <li key={item.id}>
                        {item.href ? (
                            <Link to={item.href} className="block rounded-control transition hover:bg-raised">
                                {row}
                            </Link>
                        ) : (
                            <div className="rounded-control">{row}</div>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
