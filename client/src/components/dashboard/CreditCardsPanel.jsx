import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertCircle, CreditCard, Eye, EyeOff, Lock, Unlock, Wallet } from 'lucide-react';
import { cx } from '../ui/cx';
import { Button, Progress } from '../ui/primitives';
import { formatCurrency, formatDate } from '../../utils/currency';
import { utilizationTone } from '../../utils/theme';
import { useCardSession } from '../../context/credit_card/CardSessionContext';

const FALLBACK_GRADIENTS = [
    'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
    'linear-gradient(135deg, #0f766e 0%, #10b981 100%)',
    'linear-gradient(135deg, #9f1239 0%, #f43f5e 100%)',
    'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
];

function cardBackground(card, index) {
    const color = card.color;
    if (typeof color === 'string' && color.includes('gradient')) return color;
    if (typeof color === 'string' && color.trim()) return color;
    return FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length];
}

const toneText = {
    pos: 'text-pos',
    warn: 'text-warn',
    neg: 'text-neg',
    muted: 'text-ink-muted',
};

function CreditCardTile({ card, currency, index }) {
    const limit = Number(card.limit) || 0;
    const used = Number(card.used) || 0;
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    const tone = utilizationTone(pct);
    const last4 = (card.number || '').toString().slice(-4);
    const due = card.dueDate || card.paymentDueDate;

    return (
        <article className="rounded-card border border-line bg-sunken p-3">
            <div
                className="relative overflow-hidden rounded-[14px] p-4 text-white shadow-card"
                style={{ background: cardBackground(card, index) }}
            >
                <div className="flex items-start justify-between">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold uppercase tracking-wide">
                            {card.bankName || 'Bank'}
                        </p>
                        <p className="truncate text-xs opacity-80">{card.name || 'Credit Card'}</p>
                    </div>
                    <CreditCard size={20} className="opacity-80" aria-hidden="true" />
                </div>
                <p className="tnum mt-5 text-base tracking-[0.22em] text-white/95">
                    •••• •••• •••• {last4 || '••••'}
                </p>
                <div className="mt-3 flex items-end justify-between text-xs">
                    <span className="opacity-80">{card.expiry || '--/--'}</span>
                    <span className="opacity-90">{card.cardHolder || ''}</span>
                </div>
            </div>

            <div className="mt-3">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Utilisation</span>
                    <span className={cx('tnum font-bold', toneText[tone])}>{pct.toFixed(0)}%</span>
                </div>
                <div className="mt-1.5">
                    <Progress value={pct} tone={tone === 'muted' ? undefined : tone} threshold={70} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                        <dt className="text-ink-faint">Outstanding</dt>
                        <dd className="tnum font-bold text-ink">
                            {formatCurrency(card.totalDue, currency)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-ink-faint">Limit</dt>
                        <dd className="tnum font-bold text-ink-muted">
                            {formatCurrency(limit, currency)}
                        </dd>
                    </div>
                </dl>
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-ink-faint">
                        {due ? `Due ${formatDate(due, { day: 'numeric', month: 'short' })}` : 'No due date'}
                    </span>
                    <Link
                        to="/credit-cards/monthly-bills"
                        className="rounded-control border border-line bg-raised px-2.5 py-1 text-xs font-bold text-ink transition hover:border-line-strong"
                    >
                        Pay now
                    </Link>
                </div>
            </div>
        </article>
    );
}

/** Password prompt shown before credit-card details are revealed. */
function CreditCardLockModal({ onClose, onUnlock }) {
    const { unlock } = useCardSession();
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await unlock(password);
            onUnlock();
        } catch (err) {
            setError(err.message || 'Incorrect password. Please try again.');
            setBusy(false);
        }
    };

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Unlock credit cards"
            onClick={onClose}
            className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
        >
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={submit}
                className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-raised"
            >
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
                    <Lock size={24} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-center text-base font-bold text-ink">Credit cards locked</h3>
                <p className="mt-1 text-center text-xs text-ink-muted">
                    Enter your password to view card details.
                </p>

                <div className="relative mt-5">
                    <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                        aria-hidden="true"
                    />
                    <input
                        autoFocus
                        type={show ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setError('');
                        }}
                        placeholder="Enter your password"
                        className="h-11 w-full rounded-control border border-line bg-sunken pl-9 pr-10 text-sm font-semibold text-ink outline-none transition focus:border-line-strong"
                    />
                    <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        aria-label={show ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                    >
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>

                {error ? (
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-neg">
                        <AlertCircle size={14} aria-hidden="true" /> {error}
                    </p>
                ) : null}

                <div className="mt-5 flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        icon={Unlock}
                        type="submit"
                        className="flex-1"
                        loading={busy}
                        disabled={!password}
                    >
                        Unlock
                    </Button>
                </div>
            </form>
        </div>,
        document.body
    );
}

/** Credit-card list with realistic visuals and utilisation, gated by a password lock. */
export function CreditCardsPanel({ cards = [], currency = 'INR', loading }) {
    const { unlocked, lock } = useCardSession();
    const [promptOpen, setPromptOpen] = useState(false);

    if (loading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="pem-skeleton h-40 w-full rounded-card" />
                ))}
            </div>
        );
    }

    if (!unlocked) {
        return (
            <>
                <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line px-6 py-10 text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
                        <Lock size={24} aria-hidden="true" />
                    </span>
                    <p className="text-sm font-bold text-ink">Credit cards are locked</p>
                    <p className="text-xs text-ink-faint">
                        Enter your password to view card details.
                    </p>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={Unlock}
                        onClick={() => setPromptOpen(true)}
                    >
                        Unlock
                    </Button>
                </div>

                {promptOpen ? (
                    <CreditCardLockModal
                        onClose={() => setPromptOpen(false)}
                        onUnlock={() => setPromptOpen(false)}
                    />
                ) : null}
            </>
        );
    }

    if (!cards.length) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line px-4 py-8 text-center">
                <Wallet size={24} className="text-ink-faint" aria-hidden="true" />
                <p className="text-sm font-bold text-ink-muted">No cards yet</p>
                <Link to="/cards" className="text-xs font-bold text-brand hover:underline">
                    Add a credit card →
                </Link>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-2 flex justify-end">
                <button
                    type="button"
                    onClick={lock}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-ink-faint transition hover:text-ink"
                >
                    <Lock size={12} aria-hidden="true" /> Lock
                </button>
            </div>
            <div className="pem-scroll max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {cards.map((card, index) => (
                    <CreditCardTile key={card.id} card={card} currency={currency} index={index} />
                ))}
            </div>
        </div>
    );
}
