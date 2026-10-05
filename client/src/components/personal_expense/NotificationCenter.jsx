import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    Bell,
    CalendarClock,
    CheckCircle2,
    MessageCircle,
    StickyNote,
    X,
} from 'lucide-react';
import { SlideOver } from '../ui/SlideOver';
import { cx } from '../ui/cx';
import { formatCurrency } from '../../utils/currency';

const TONES = {
    info: { icon: MessageCircle, wrap: 'bg-info-soft text-info' },
    neg: { icon: AlertTriangle, wrap: 'bg-neg-soft text-neg' },
    warn: { icon: CalendarClock, wrap: 'bg-warn-soft text-warn' },
    pos: { icon: CheckCircle2, wrap: 'bg-pos-soft text-pos' },
    violet: { icon: StickyNote, wrap: 'bg-violet-soft text-violet' },
};

const safeDate = (value) => {
    if (!value) return 'No date';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'No date' : d.toLocaleDateString();
};

function Row({ tone = 'info', title, meta, onClick, onDismiss }) {
    const t = TONES[tone] || TONES.info;
    const Icon = t.icon;

    return (
        <div
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={
                onClick
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onClick();
                          }
                      }
                    : undefined
            }
            className={cx(
                'group relative flex items-start gap-3 rounded-card border border-line bg-sunken p-3.5 transition',
                onClick && 'cursor-pointer hover:border-line-strong hover:bg-raised'
            )}
        >
            <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-[10px]', t.wrap)}>
                <Icon size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{meta}</p>
            </div>
            {onDismiss ? (
                <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDismiss();
                    }}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-control text-ink-faint transition hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
                >
                    <X size={14} aria-hidden="true" />
                </button>
            ) : null}
        </div>
    );
}

const NotificationCenter = ({
    isOpen,
    onClose,
    activeReminders = { bills: [], loans: [], borrow: [], notes: [] },
    budgetAlerts = [],
    historyData = [],
    messages = [],
    onDismiss,
    onOpenMessages,
}) => {
    const navigate = useNavigate();
    const [tab, setTab] = useState('active');

    const totalActive =
        (activeReminders.bills?.length || 0) +
        (activeReminders.loans?.length || 0) +
        (activeReminders.borrow?.length || 0) +
        (activeReminders.notes?.length || 0) +
        (budgetAlerts?.length || 0) +
        (messages?.length || 0);

    const handleItemClick = (path) => {
        navigate(path);
        onClose();
    };

    const handleMessageClick = (message) => {
        if (onOpenMessages) onOpenMessages(message.sender);
        onClose();
    };

    return (
        <SlideOver
            isOpen={isOpen}
            onClose={onClose}
            title="Notifications"
            subtitle={`${totalActive} active`}
            icon={Bell}
        >
            <div className="mb-4 inline-flex rounded-control border border-line bg-sunken p-0.5">
                {['active', 'history'].map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={cx(
                            'rounded-[8px] px-3 py-1 text-xs font-semibold capitalize transition',
                            tab === t
                                ? 'bg-surface text-ink shadow-card'
                                : 'text-ink-muted hover:text-ink'
                        )}
                    >
                        {t}
                        {t === 'active' ? ` (${totalActive})` : ''}
                    </button>
                ))}
            </div>

            {tab === 'active' ? (
                totalActive === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line px-6 py-12 text-center">
                        <CheckCircle2 size={28} className="text-pos" aria-hidden="true" />
                        <p className="text-sm font-bold text-ink-muted">You&apos;re all caught up</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {messages.length > 0 ? (
                            <section className="space-y-2">
                                <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-info">
                                    Unread messages ({messages.length})
                                </h3>
                                {messages.map((msg) => (
                                    <Row
                                        key={msg.id}
                                        tone="info"
                                        title={`New message from ${msg.sender?.fullName || msg.sender?.username || 'someone'}`}
                                        meta={msg.message}
                                        onClick={() => handleMessageClick(msg)}
                                    />
                                ))}
                            </section>
                        ) : null}

                        {budgetAlerts.length > 0 ? (
                            <section className="space-y-2">
                                <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-neg">
                                    Budget alerts ({budgetAlerts.length})
                                </h3>
                                {budgetAlerts.map((budget, i) => (
                                    <Row
                                        key={`budget-${i}`}
                                        tone="neg"
                                        title={`Budget exceeded: ${budget.category}`}
                                        meta={`Spent ${formatCurrency(budget.spent)} of ${formatCurrency(budget.amountLimit)}`}
                                        onClick={() => handleItemClick('/budgets')}
                                        onDismiss={() => onDismiss && onDismiss(`budget-${budget.category}`)}
                                    />
                                ))}
                            </section>
                        ) : null}

                        {activeReminders.bills?.length > 0 ? (
                            <section className="space-y-2">
                                <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-warn">
                                    Bills due ({activeReminders.bills.length})
                                </h3>
                                {activeReminders.bills.map((bill) => (
                                    <Row
                                        key={`bill-${bill.id}`}
                                        tone="warn"
                                        title={`Bill due: ${bill.name}`}
                                        meta={`${formatCurrency(bill.amount)} · due ${safeDate(bill.dueDate)}`}
                                        onClick={() => handleItemClick('/bills')}
                                        onDismiss={() => onDismiss && onDismiss(`bill-${bill.id}`)}
                                    />
                                ))}
                            </section>
                        ) : null}

                        {activeReminders.loans?.length > 0 ? (
                            <section className="space-y-2">
                                <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-neg">
                                    EMIs due ({activeReminders.loans.length})
                                </h3>
                                {activeReminders.loans.map((loan) => (
                                    <Row
                                        key={`loan-${loan.id}`}
                                        tone="neg"
                                        title={`EMI due: ${loan.name}`}
                                        meta={`${formatCurrency(loan.emiAmount)} · ${safeDate(loan.nextEmiDate)}`}
                                        onClick={() => handleItemClick('/loans')}
                                        onDismiss={() => onDismiss && onDismiss(`loan-${loan.id}`)}
                                    />
                                ))}
                            </section>
                        ) : null}

                        {activeReminders.borrow?.length > 0 ? (
                            <section className="space-y-2">
                                <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-pos">
                                    Debt settling ({activeReminders.borrow.length})
                                </h3>
                                {activeReminders.borrow.map((item) => (
                                    <Row
                                        key={`borrow-${item.id}`}
                                        tone="pos"
                                        title={`Debt settling: ${item.person}`}
                                        meta={`${formatCurrency(item.amount)} · due ${safeDate(item.dueDate)}`}
                                        onClick={() => handleItemClick('/borrow')}
                                        onDismiss={() => onDismiss && onDismiss(`borrow-${item.id}`)}
                                    />
                                ))}
                            </section>
                        ) : null}

                        {activeReminders.notes?.length > 0 ? (
                            <section className="space-y-2">
                                <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-violet">
                                    Reminders ({activeReminders.notes.length})
                                </h3>
                                {activeReminders.notes.map((note) => (
                                    <Row
                                        key={`note-${note.id}`}
                                        tone="violet"
                                        title={`Reminder: ${note.title}`}
                                        meta={`${note.message || ''}${note.due ? ` · ${new Date(note.due).toLocaleString()}` : ''}`}
                                        onDismiss={() => onDismiss && onDismiss(`note-${note.id}`)}
                                    />
                                ))}
                            </section>
                        ) : null}
                    </div>
                )
            ) : historyData.length === 0 ? (
                <div className="rounded-card border border-dashed border-line px-6 py-12 text-center text-sm text-ink-faint">
                    No recent history.
                </div>
            ) : (
                <div className="space-y-2">
                    {historyData.map((item) => (
                        <div
                            key={item.id}
                            className="rounded-card border border-line bg-sunken p-3.5"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-sm font-bold text-ink">{item.title}</p>
                                <span className="shrink-0 text-xs text-ink-faint">{item.time}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-ink-muted">{item.desc}</p>
                        </div>
                    ))}
                </div>
            )}
        </SlideOver>
    );
};

export default NotificationCenter;
