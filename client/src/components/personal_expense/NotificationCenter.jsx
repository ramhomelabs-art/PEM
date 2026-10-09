import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    Bell,
    CalendarClock,
    CheckCircle2,
    MessageCircle,
    StickyNote,
    X,
    CreditCard,
    ArrowUpRight
} from 'lucide-react';
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
                'group relative flex items-start gap-3 rounded-xl bg-raised p-3 transition shadow-sm',
                onClick && 'cursor-pointer hover:bg-line'
            )}
        >
            <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-xl', t.wrap)}>
                <Icon size={15} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-ink">{title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{meta}</p>
            </div>
            {onDismiss ? (
                <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDismiss();
                    }}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-ink-faint transition hover:bg-line hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
                >
                    <X size={13} aria-hidden="true" />
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
    onOpenNotes,
}) => {
    const navigate = useNavigate();
    const [tab, setTab] = useState('active');
    const popoverRef = useRef(null);

    const totalActive =
        (activeReminders.bills?.length || 0) +
        (activeReminders.loans?.length || 0) +
        (activeReminders.borrow?.length || 0) +
        (activeReminders.notes?.length || 0) +
        (budgetAlerts?.length || 0) +
        (messages?.length || 0);

    // Close on click outside and escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                onClose?.();
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose?.();
            }
        };

        // Defer attachment so the triggering click doesn't immediately dismiss
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleOutsideClick);
            document.addEventListener('keydown', handleKeyDown);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    const handleItemClick = (path) => {
        navigate(path);
        onClose?.();
    };

    const handleMessageClick = (message) => {
        if (onOpenMessages) onOpenMessages(message.sender);
        onClose?.();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={popoverRef}
                    initial={{ opacity: 0, scale: 0.94, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 8 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="absolute right-0 top-full mt-2.5 z-50 w-[380px] sm:w-[420px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.9)] flex flex-col max-h-[min(560px,calc(100vh-80px))]"
                    role="dialog"
                    aria-label="Floating Notifications"
                >
                    {/* Top ambient highlight line */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-brand/50 to-transparent opacity-70" />

                    {/* Caret pointing directly to the Bell button */}
                    <div className="absolute -top-1.5 right-3.5 h-3 w-3 rotate-45 border-l border-t border-line bg-surface" />

                    {/* Popover Header */}
                    <div className="flex items-center justify-between border-b border-line bg-sunken px-4 py-3.5 sm:px-5">
                        <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand shadow-[0_0_10px_rgba(20,184,166,0.15)]">
                                <Bell size={16} aria-hidden="true" />
                            </span>
                            <div>
                                <h3 className="text-sm font-bold tracking-tight text-ink">Notifications</h3>
                                <p className="text-[11px] font-semibold text-ink-muted">
                                    {totalActive} active alert{totalActive !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Tab Switcher */}
                            <div className="inline-flex rounded-lg bg-raised p-0.5">
                                {['active', 'history'].map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setTab(t)}
                                        className={cx(
                                            'rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition',
                                            tab === t
                                                ? 'bg-brand/20 text-brand shadow-sm'
                                                : 'text-ink-muted hover:text-ink'
                                        )}
                                    >
                                        {t}
                                        {t === 'active' && totalActive > 0 ? ` (${totalActive})` : ''}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close notifications"
                                className="grid h-7 w-7 place-items-center rounded-lg bg-raised text-ink-muted hover:bg-line hover:text-ink transition"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Notification Content Body */}
                    <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 bg-surface">
                        {tab === 'active' ? (
                            totalActive === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-raised/60 px-6 py-10 text-center shadow-inner">
                                    <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                                        <CheckCircle2 size={20} aria-hidden="true" />
                                    </div>
                                    <p className="text-xs font-bold text-ink">You&apos;re all caught up!</p>
                                    <p className="text-[11px] text-ink-muted">No pending bills, loan EMIs, or messages.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Unread Messages */}
                                    {messages.length > 0 && (
                                        <section className="space-y-1.5">
                                            <h4 className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-info">
                                                Unread messages ({messages.length})
                                            </h4>
                                            {messages.map((msg) => (
                                                <Row
                                                    key={msg.id}
                                                    tone="info"
                                                    title={`New message from ${msg.sender?.fullName || msg.sender?.username || 'User'}`}
                                                    meta={msg.message}
                                                    onClick={() => handleMessageClick(msg)}
                                                />
                                            ))}
                                        </section>
                                    )}

                                    {/* Budget Alerts */}
                                    {budgetAlerts.length > 0 && (
                                        <section className="space-y-1.5">
                                            <h4 className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-neg">
                                                Budget alerts ({budgetAlerts.length})
                                            </h4>
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
                                    )}

                                    {/* Bills Due */}
                                    {activeReminders.bills?.length > 0 && (
                                        <section className="space-y-1.5">
                                            <h4 className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-warn">
                                                Bills due ({activeReminders.bills.length})
                                            </h4>
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
                                    )}

                                    {/* EMIs Due */}
                                    {activeReminders.loans?.length > 0 && (
                                        <section className="space-y-1.5">
                                            <h4 className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-neg">
                                                EMIs due ({activeReminders.loans.length})
                                            </h4>
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
                                    )}

                                    {/* Borrow / Debt Settling */}
                                    {activeReminders.borrow?.length > 0 && (
                                        <section className="space-y-1.5">
                                            <h4 className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-pos">
                                                Debt settling ({activeReminders.borrow.length})
                                            </h4>
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
                                    )}

                                    {/* Smart Reminders */}
                                    {activeReminders.notes?.length > 0 && (
                                        <section className="space-y-1.5">
                                            <h4 className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet">
                                                Reminders ({activeReminders.notes.length})
                                            </h4>
                                            {activeReminders.notes.map((note) => (
                                                <Row
                                                    key={`note-${note.id}`}
                                                    tone="violet"
                                                    title={`Reminder: ${note.title || 'Smart Keep Note'}`}
                                                    meta={`${note.message ? note.message + ' · ' : ''}${safeDate(note.due)}`}
                                                    onClick={() => {
                                                        if (onOpenNotes) onOpenNotes(note);
                                                        onClose?.();
                                                    }}
                                                    onDismiss={() => onDismiss && onDismiss(`note-${note.id}`)}
                                                />
                                            ))}
                                        </section>
                                    )}
                                </div>
                            )
                        ) : historyData.length === 0 ? (
                            <div className="rounded-xl bg-raised/60 px-6 py-10 text-center text-xs text-ink-faint">
                                No recent history recorded.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {historyData.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-xl bg-raised p-3 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="truncate text-xs font-bold text-ink">{item.title}</p>
                                            <span className="shrink-0 text-[10px] text-ink-faint">{item.time}</span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-ink-muted">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NotificationCenter;
