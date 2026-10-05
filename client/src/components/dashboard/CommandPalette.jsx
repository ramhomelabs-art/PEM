import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowDownLeft,
    ArrowUpRight,
    CornerDownLeft,
    Plus,
    Search,
    Receipt,
    Wallet,
    PiggyBank,
} from 'lucide-react';
import { cx } from '../ui/cx';
import { formatCurrency, formatDate } from '../../utils/currency';

const QUICK_LINKS = [
    { id: 'add', label: 'Add transaction', hint: 'New entry', icon: Plus, to: null, action: 'add' },
    { id: 'tx', label: 'Transactions', hint: 'Go to', icon: Receipt, to: '/transactions' },
    { id: 'cards', label: 'Credit cards', hint: 'Go to', icon: Wallet, to: '/cards' },
    { id: 'budgets', label: 'Budgets', hint: 'Go to', icon: PiggyBank, to: '/budgets' },
];

/**
 * Ctrl/Cmd+K global search. Mounted only while open, so it always starts with
 * empty state — no reset effect required.
 */
export function CommandPalette({ transactions = [], currency = 'INR', onClose, onAdd }) {
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        const rows = transactions
            .filter((t) => {
                if (!q) return true;
                return (
                    (t.description || '').toLowerCase().includes(q) ||
                    (t.category || '').toLowerCase().includes(q) ||
                    String(t.amount || '').includes(q)
                );
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 6);
        return rows;
    }, [transactions, query]);

    const items = useMemo(
        () => [
            ...results.map((t) => ({ kind: 'tx', t })),
            ...(query ? [] : QUICK_LINKS.map((l) => ({ kind: 'link', l }))),
        ],
        [results, query]
    );

    const run = (item) => {
        if (!item) return;
        if (item.kind === 'tx') {
            onClose?.();
            navigate('/transactions');
            return;
        }
        if (item.l.action === 'add') {
            onClose?.();
            onAdd?.();
            return;
        }
        if (item.l.to) {
            onClose?.();
            navigate(item.l.to);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') onClose?.();
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex((i) => Math.min(items.length - 1, i + 1));
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            run(items[index]);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
            onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
        >
            <div className="w-full max-w-xl overflow-hidden rounded-card border border-line-strong bg-surface shadow-raised">
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                    <Search size={18} className="text-ink-faint" aria-hidden="true" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIndex(0);
                        }}
                        onKeyDown={onKeyDown}
                        placeholder="Search transactions, categories…"
                        className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                    />
                    <kbd className="rounded border border-line px-1.5 py-0.5 text-xs font-semibold text-ink-faint">
                        Esc
                    </kbd>
                </div>

                <ul className="pem-scroll max-h-[50vh] overflow-y-auto p-2">
                    {items.length === 0 ? (
                        <li className="px-3 py-8 text-center text-sm text-ink-faint">
                            No matches for “{query}”.
                        </li>
                    ) : (
                        items.map((item, i) => {
                            const active = i === index;
                            if (item.kind === 'tx') {
                                const t = item.t;
                                const income = t.type === 'income';
                                return (
                                    <li key={`tx-${t.id}`}>
                                        <button
                                            type="button"
                                            onMouseEnter={() => setIndex(i)}
                                            onClick={() => run(item)}
                                            className={cx(
                                                'flex w-full items-center gap-3 rounded-control px-3 py-2 text-left',
                                                active ? 'bg-raised' : 'hover:bg-raised'
                                            )}
                                        >
                                            <span
                                                className={cx(
                                                    'grid h-8 w-8 shrink-0 place-items-center rounded-[9px]',
                                                    income ? 'bg-pos-soft text-pos' : 'bg-neg-soft text-neg'
                                                )}
                                            >
                                                {income ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-ink">
                                                    {t.description || t.category || 'Transaction'}
                                                </span>
                                                <span className="block text-xs text-ink-faint">
                                                    {t.category} · {formatDate(t.date, { day: 'numeric', month: 'short' })}
                                                </span>
                                            </span>
                                            <span className={cx('tnum text-sm font-bold', income ? 'text-pos' : 'text-neg')}>
                                                {income ? '+' : '-'}
                                                {formatCurrency(Math.abs(Number(t.amount) || 0), currency)}
                                            </span>
                                        </button>
                                    </li>
                                );
                            }

                            const { icon: Icon, label, hint } = item.l;
                            return (
                                <li key={`link-${item.l.id}`}>
                                    <button
                                        type="button"
                                        onMouseEnter={() => setIndex(i)}
                                        onClick={() => run(item)}
                                        className={cx(
                                            'flex w-full items-center gap-3 rounded-control px-3 py-2 text-left',
                                            active ? 'bg-raised' : 'hover:bg-raised'
                                        )}
                                    >
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-raised text-ink-muted">
                                            <Icon size={15} />
                                        </span>
                                        <span className="flex-1 text-sm font-semibold text-ink">{label}</span>
                                        <span className="text-xs text-ink-faint">{hint}</span>
                                        {active ? <CornerDownLeft size={14} className="text-ink-faint" /> : null}
                                    </button>
                                </li>
                            );
                        })
                    )}
                </ul>
            </div>
        </div>
    );
}
