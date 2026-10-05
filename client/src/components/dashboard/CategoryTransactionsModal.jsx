import { createElement, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowDownUp,
    ArrowUpRight,
    Briefcase,
    Calendar,
    Car,
    Coffee,
    CreditCard,
    Film,
    Gift,
    Heart,
    Inbox,
    ReceiptText,
    Search,
    ShoppingBag,
    Tag,
    X,
    Zap,
} from 'lucide-react';
import { cx } from '../ui/cx';
import { formatCurrency, formatDate } from '../../utils/currency';
import { getCategoryColor } from '../../utils/theme';

const getCategoryIcon = (category = '') => {
    const c = String(category).toLowerCase();
    if (c.includes('shop')) return ShoppingBag;
    if (c.includes('food') || c.includes('dine') || c.includes('eat') || c.includes('grocer')) return Coffee;
    if (c.includes('util') || c.includes('bill') || c.includes('power') || c.includes('elect')) return Zap;
    if (c.includes('travel') || c.includes('transport') || c.includes('trip') || c.includes('fuel')) return Car;
    if (c.includes('medic') || c.includes('health') || c.includes('doctor')) return Heart;
    if (c.includes('entertain') || c.includes('movie') || c.includes('film')) return Film;
    if (c.includes('debt') || c.includes('loan') || c.includes('emi') || c.includes('card')) return CreditCard;
    if (c.includes('work') || c.includes('salary') || c.includes('business')) return Briefcase;
    if (c.includes('gift')) return Gift;
    return Tag;
};

const RANGE_LABELS = {
    '1m': 'This Month',
    '3m': 'Last 3 Months',
    '6m': 'Last 6 Months',
    '1y': 'Last 12 Months',
    'custom': 'Custom Range',
};

function CategoryBadgeIcon({ category, size = 24 }) {
    const Icon = getCategoryIcon(category);
    return createElement(Icon, { size, 'aria-hidden': 'true' });
}

export function CategoryTransactionsModal({
    isOpen,
    onClose,
    category,
    transactions = [],
    allTransactions = [],
    currency = 'INR',
    range = '1m',
}) {
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState('period'); // 'period' | 'all'
    const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc' | 'amount-desc'

    // Reset state when category or isOpen changes
    const [prevOpen, setPrevOpen] = useState(isOpen);
    const [prevCategory, setPrevCategory] = useState(category);

    if (isOpen !== prevOpen || category !== prevCategory) {
        setPrevOpen(isOpen);
        setPrevCategory(category);
        if (isOpen) {
            setSearch('');
            setScope('period');
            setSortBy('date-desc');
        }
    }

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Active dataset based on scope toggle
    const sourceTransactions = useMemo(() => {
        if (scope === 'all' && allTransactions.length > 0) {
            return allTransactions;
        }
        return transactions;
    }, [scope, transactions, allTransactions]);

    // Filter transactions for this category
    const catTransactions = useMemo(() => {
        if (!category || !sourceTransactions.length) return [];
        return sourceTransactions.filter((t) => {
            const isExpense = t.type === 'expense' || !t.type;
            const matchesCat =
                String(t.category ?? '').toLowerCase().trim() ===
                String(category).toLowerCase().trim();
            return isExpense && matchesCat;
        });
    }, [category, sourceTransactions]);

    // Apply search filter and sorting
    const processedTransactions = useMemo(() => {
        let list = [...catTransactions];

        // Search query
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(
                (t) =>
                    (t.description && t.description.toLowerCase().includes(q)) ||
                    (t.paymentMode && t.paymentMode.toLowerCase().includes(q)) ||
                    (t.category && t.category.toLowerCase().includes(q))
            );
        }

        // Sorting
        list.sort((a, b) => {
            if (sortBy === 'amount-desc') {
                return (Number(b.amount) || 0) - (Number(a.amount) || 0);
            }
            return new Date(b.date) - new Date(a.date);
        });

        return list;
    }, [catTransactions, search, sortBy]);

    // Summary calculations (always consistent with the active category dataset)
    const totalSpent = useMemo(() => {
        return catTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }, [catTransactions]);

    const maxTx = useMemo(() => {
        if (!catTransactions.length) return 0;
        return Math.max(...catTransactions.map((t) => Number(t.amount) || 0));
    }, [catTransactions]);

    const avgTx = useMemo(() => {
        if (!catTransactions.length) return 0;
        return totalSpent / catTransactions.length;
    }, [catTransactions, totalSpent]);

    const categoryColor = getCategoryColor(category);
    const periodLabel = RANGE_LABELS[range] || 'Current Period';

    // Count for all time to show in scope toggle
    const allCount = useMemo(() => {
        if (!category || !allTransactions.length) return catTransactions.length;
        return allTransactions.filter((t) => {
            const isExpense = t.type === 'expense' || !t.type;
            return (
                isExpense &&
                String(t.category ?? '').toLowerCase().trim() ===
                    String(category).toLowerCase().trim()
            );
        }).length;
    }, [category, allTransactions, catTransactions.length]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="category-modal-title"
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
                        aria-hidden="true"
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col rounded-2xl border border-line-strong bg-surface shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]"
                    >
                        {/* Header */}
                        <header className="flex items-start justify-between gap-4 border-b border-line/80 p-5 sm:p-6">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <span
                                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl shadow-inner transition-transform"
                                    style={{
                                        backgroundColor: `${categoryColor}20`,
                                        color: categoryColor,
                                        border: `1.5px solid ${categoryColor}40`,
                                        boxShadow: `0 0 16px ${categoryColor}25`,
                                    }}
                                >
                                    <CategoryBadgeIcon category={category} size={24} />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2
                                            id="category-modal-title"
                                            className="truncate text-xl font-bold tracking-tight text-ink"
                                        >
                                            {category}
                                        </h2>
                                        <span
                                            className="h-2 w-2 shrink-0 rounded-full"
                                            style={{
                                                backgroundColor: categoryColor,
                                                boxShadow: `0 0 8px ${categoryColor}`,
                                            }}
                                        />
                                    </div>
                                    <p className="mt-0.5 text-xs text-ink-muted">
                                        {catTransactions.length}{' '}
                                        {catTransactions.length === 1 ? 'transaction' : 'transactions'} ·{' '}
                                        {scope === 'period' ? periodLabel : 'All Time'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <p className="text-[11px] font-medium text-ink-faint uppercase tracking-wider">
                                        Total Spent
                                    </p>
                                    <p className="tnum text-lg font-black tracking-tight text-neg">
                                        {formatCurrency(totalSpent, currency)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close dialog"
                                    className="grid h-8 w-8 place-items-center rounded-full bg-raised/70 text-ink-muted transition hover:bg-raised hover:text-ink border border-line"
                                >
                                    <X size={16} aria-hidden="true" />
                                </button>
                            </div>
                        </header>

                        {/* Scope Toggle & Telemetry */}
                        <div className="border-b border-line bg-raised/30 px-5 py-3 sm:px-6">
                            {/* Scope Selector */}
                            {allTransactions.length > 0 && allCount !== transactions.length ? (
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <div className="inline-flex rounded-control border border-line bg-sunken p-0.5">
                                        <button
                                            type="button"
                                            onClick={() => setScope('period')}
                                            className={cx(
                                                'rounded-[8px] px-3 py-1 text-xs font-semibold transition',
                                                scope === 'period'
                                                    ? 'bg-surface text-ink shadow-card'
                                                    : 'text-ink-muted hover:text-ink'
                                            )}
                                        >
                                            {periodLabel}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setScope('all')}
                                            className={cx(
                                                'rounded-[8px] px-3 py-1 text-xs font-semibold transition',
                                                scope === 'all'
                                                    ? 'bg-surface text-ink shadow-card'
                                                    : 'text-ink-muted hover:text-ink'
                                            )}
                                        >
                                            All Time ({allCount})
                                        </button>
                                    </div>
                                    <span className="text-[11px] text-ink-faint">
                                        Filtered to {scope === 'period' ? periodLabel : 'all history'}
                                    </span>
                                </div>
                            ) : null}

                            {/* Telemetry Cards */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl border border-line/60 bg-surface/70 p-2.5">
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                                        Entries
                                    </p>
                                    <p className="tnum mt-0.5 text-sm font-bold text-ink">
                                        {catTransactions.length}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-line/60 bg-surface/70 p-2.5">
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                                        Average Spend
                                    </p>
                                    <p className="tnum mt-0.5 text-sm font-bold text-ink">
                                        {formatCurrency(avgTx, currency)}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-line/60 bg-surface/70 p-2.5 text-right">
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                                        Highest Spend
                                    </p>
                                    <p className="tnum mt-0.5 text-sm font-bold text-neg">
                                        {formatCurrency(maxTx, currency)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Search & Sort Bar */}
                        <div className="flex items-center gap-2 px-5 pt-3.5 pb-2 sm:px-6">
                            <div className="relative flex-1">
                                <Search
                                    size={15}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                                />
                                <input
                                    type="text"
                                    placeholder={`Search ${category} transactions...`}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full rounded-xl border border-line bg-raised/50 py-2 pl-9 pr-8 text-xs text-ink placeholder:text-ink-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-1 focus:ring-brand transition"
                                />
                                {search ? (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                                    >
                                        <X size={14} />
                                    </button>
                                ) : null}
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setSortBy((s) => (s === 'date-desc' ? 'amount-desc' : 'date-desc'))
                                }
                                title={`Sorting by ${sortBy === 'date-desc' ? 'Latest date' : 'Highest amount'}`}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-raised/50 px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-raised hover:text-ink transition shrink-0"
                            >
                                <ArrowDownUp size={13} />
                                <span className="hidden sm:inline">
                                    {sortBy === 'date-desc' ? 'Latest' : 'Highest'}
                                </span>
                            </button>
                        </div>

                        {/* Transactions List */}
                        <div className="pem-scroll flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
                            {!processedTransactions.length ? (
                                <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-center">
                                    <Inbox size={28} className="text-ink-faint" aria-hidden="true" />
                                    <p className="text-sm font-bold text-ink-muted">
                                        {search ? 'No matching transactions' : 'No transactions recorded'}
                                    </p>
                                    <p className="max-w-xs text-xs text-ink-faint">
                                        {search
                                            ? 'Try searching with a different description or keyword.'
                                            : `No expenses found under ${category} for this period.`}
                                    </p>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {processedTransactions.map((t, idx) => {
                                        const amountNum = Math.abs(Number(t.amount) || 0);
                                        return (
                                            <li
                                                key={t.id || t._id || `${t.date}-${t.amount}-${idx}`}
                                                className="group flex items-center justify-between gap-3.5 rounded-xl border border-line/50 bg-raised/40 p-3 transition-all duration-150 hover:border-line-strong hover:bg-raised"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span
                                                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105"
                                                        style={{
                                                            backgroundColor: `${categoryColor}15`,
                                                            color: categoryColor,
                                                            border: `1px solid ${categoryColor}30`,
                                                        }}
                                                    >
                                                        <CategoryBadgeIcon category={category} size={17} />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-xs font-bold text-ink group-hover:text-brand transition-colors">
                                                            {t.description || t.category || 'Expense'}
                                                        </p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                                                            <span className="flex items-center gap-1 font-medium">
                                                                <Calendar size={11} />
                                                                {formatDate(t.date, {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric',
                                                                })}
                                                            </span>
                                                            {t.paymentMode ? (
                                                                <span className="rounded-md bg-sunken px-1.5 py-0.5 font-medium capitalize text-ink-muted">
                                                                    {t.paymentMode}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span className="tnum text-sm font-black text-neg">
                                                        -{formatCurrency(amountNum, currency)}
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* Footer */}
                        <footer className="flex items-center justify-between border-t border-line/80 bg-raised/40 px-5 py-3 sm:px-6">
                            <span className="text-xs text-ink-muted">
                                Showing {processedTransactions.length} of {catTransactions.length} entries
                            </span>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-control bg-raised px-4 py-1.5 text-xs font-bold text-ink transition hover:bg-raised/70 border border-line"
                            >
                                Close
                            </button>
                        </footer>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
