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
    Download,
    Film,
    Gift,
    Heart,
    Inbox,
    Layers,
    Maximize2,
    Minimize2,
    PieChart as PieIcon,
    ReceiptText,
    Search,
    ShoppingBag,
    Tag,
    Wallet,
    X,
    Zap,
} from 'lucide-react';
import { cx } from '../ui/cx';
import { formatCurrency, formatDate, formatPercent } from '../../utils/currency';
import { getCategoryColor } from '../../utils/theme';
import { exportTransactionsCsv } from '../../utils/exportDashboard';

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
    custom: 'Custom Range',
};

function CategoryBadgeIcon({ category, size = 20 }) {
    const Icon = getCategoryIcon(category);
    return createElement(Icon, { size, 'aria-hidden': 'true' });
}

export function CategoryTransactionsModal({
    isOpen,
    onClose,
    initialCategory,
    category,
    categories = [],
    totalSpend = 0,
    transactions = [],
    allTransactions = [],
    currency = 'INR',
    range = '1m',
    startExpanded = false,
}) {
    const activeInitial = initialCategory || category || 'ALL';
    const [selectedCategory, setSelectedCategory] = useState(activeInitial);
    const [isExpanded, setIsExpanded] = useState(startExpanded);
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState('period'); // 'period' | 'all'
    const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc' | 'amount-desc' | 'amount-asc'

    // Synchronize initial state when modal opens or category prop updates
    useEffect(() => {
        if (isOpen) {
            setSelectedCategory(initialCategory || category || 'ALL');
            setIsExpanded(startExpanded);
            setSearch('');
            setScope('period');
            setSortBy('date-desc');
        }
    }, [isOpen, initialCategory, category, startExpanded]);

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

    const isAll = !selectedCategory || selectedCategory === 'ALL' || selectedCategory === 'All Categories';

    // Filter transactions for active category or all expenses
    const catTransactions = useMemo(() => {
        if (!sourceTransactions.length) return [];
        return sourceTransactions.filter((t) => {
            const isExpense = t.type === 'expense' || !t.type;
            if (!isExpense) return false;
            if (isAll) return true;
            return (
                String(t.category ?? '').toLowerCase().trim() ===
                String(selectedCategory).toLowerCase().trim()
            );
        });
    }, [selectedCategory, sourceTransactions, isAll]);

    // Apply search filter and sorting
    const processedTransactions = useMemo(() => {
        let list = [...catTransactions];

        if (search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(
                (t) =>
                    (t.description && t.description.toLowerCase().includes(q)) ||
                    (t.paymentMode && t.paymentMode.toLowerCase().includes(q)) ||
                    (t.category && t.category.toLowerCase().includes(q))
            );
        }

        list.sort((a, b) => {
            const amtA = Number(a.amount) || 0;
            const amtB = Number(b.amount) || 0;
            if (sortBy === 'amount-desc') return amtB - amtA;
            if (sortBy === 'amount-asc') return amtA - amtB;
            return new Date(b.date) - new Date(a.date);
        });

        return list;
    }, [catTransactions, search, sortBy]);

    // Summary calculations
    const totalSpent = useMemo(() => {
        return catTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }, [catTransactions]);

    const grandTotal = useMemo(() => {
        if (totalSpend > 0) return totalSpend;
        return sourceTransactions
            .filter((t) => t.type === 'expense' || !t.type)
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }, [totalSpend, sourceTransactions]);

    const maxTx = useMemo(() => {
        if (!catTransactions.length) return 0;
        return Math.max(...catTransactions.map((t) => Number(t.amount) || 0));
    }, [catTransactions]);

    const avgTx = useMemo(() => {
        if (!catTransactions.length) return 0;
        return totalSpent / catTransactions.length;
    }, [catTransactions, totalSpent]);

    // Payment method breakdown for analytics
    const paymentModeBreakdown = useMemo(() => {
        const map = new Map();
        catTransactions.forEach((t) => {
            const mode = (t.paymentMode || 'Other').trim();
            const val = Math.abs(Number(t.amount) || 0);
            map.set(mode, (map.get(mode) || 0) + val);
        });
        return Array.from(map.entries())
            .map(([mode, val]) => ({
                mode,
                amount: val,
                pct: totalSpent > 0 ? (val / totalSpent) * 100 : 0,
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [catTransactions, totalSpent]);

    const categoryColor = isAll ? 'var(--pem-brand, #38bdf8)' : getCategoryColor(selectedCategory);
    const periodLabel = RANGE_LABELS[range] || 'Current Period';

    // Count for all time to show in scope toggle
    const allCount = useMemo(() => {
        if (!allTransactions.length) return catTransactions.length;
        return allTransactions.filter((t) => {
            const isExpense = t.type === 'expense' || !t.type;
            if (!isExpense) return false;
            if (isAll) return true;
            return (
                String(t.category ?? '').toLowerCase().trim() ===
                String(selectedCategory).toLowerCase().trim()
            );
        }).length;
    }, [selectedCategory, allTransactions, catTransactions.length, isAll]);

    // Share of total spending
    const shareOfTotal = grandTotal > 0 ? (totalSpent / grandTotal) * 100 : 100;

    const handleExport = () => {
        const catName = isAll ? 'all_spending' : selectedCategory.toLowerCase().replace(/\s+/g, '_');
        exportTransactionsCsv(processedTransactions, `category_${catName}_report.csv`);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="category-modal-title"
                    className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6"
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

                    {/* Modal Card with Expand / Collapse Transition */}
                    <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className={cx(
                            'relative z-10 flex flex-col rounded-2xl border border-line-strong bg-surface shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] transition-all duration-300 overflow-hidden',
                            isExpanded
                                ? 'h-[90vh] max-h-[90vh] w-[96vw] max-w-5xl'
                                : 'max-h-[82vh] w-full max-w-xl'
                        )}
                    >
                        {/* Header */}
                        <header className="flex items-start justify-between gap-4 border-b border-line/80 p-4 sm:p-5 shrink-0 bg-surface/95 backdrop-blur-sm">
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
                                    {isAll ? (
                                        <Layers size={24} />
                                    ) : (
                                        <CategoryBadgeIcon category={selectedCategory} size={24} />
                                    )}
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2
                                            id="category-modal-title"
                                            className="truncate text-xl font-bold tracking-tight text-ink"
                                        >
                                            {isAll ? 'Detailed Spending Report' : selectedCategory}
                                        </h2>
                                        {!isAll ? (
                                            <span
                                                className="h-2 w-2 shrink-0 rounded-full"
                                                style={{
                                                    backgroundColor: categoryColor,
                                                    boxShadow: `0 0 8px ${categoryColor}`,
                                                }}
                                            />
                                        ) : null}
                                        <span className="hidden sm:inline-flex items-center rounded-pill bg-raised px-2 py-0.5 text-[10px] font-semibold text-ink-muted border border-line/60">
                                            {isExpanded ? 'Full Report' : 'Compact View'}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">
                                        <span>{catTransactions.length} {catTransactions.length === 1 ? 'transaction' : 'transactions'}</span>
                                        <span>·</span>
                                        <span>{scope === 'period' ? periodLabel : 'All Time'}</span>
                                        {!isAll && grandTotal > 0 ? (
                                            <>
                                                <span>·</span>
                                                <span className="font-semibold text-brand">
                                                    {formatPercent(shareOfTotal)} of total spend
                                                </span>
                                            </>
                                        ) : null}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                                <div className="text-right hidden sm:block">
                                    <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">
                                        Total Spent
                                    </p>
                                    <p className="tnum text-lg font-black tracking-tight text-neg">
                                        {formatCurrency(totalSpent, currency)}
                                    </p>
                                </div>

                                {/* Expand / Collapse Toggle Button */}
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded((prev) => !prev)}
                                    aria-label={isExpanded ? 'Collapse report' : 'Expand detailed report'}
                                    title={isExpanded ? 'Collapse to compact view' : 'Expand to detailed report'}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-line/40 bg-raised/50 px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-raised hover:text-brand"
                                >
                                    {isExpanded ? (
                                        <>
                                            <Minimize2 size={15} />
                                            <span className="hidden md:inline">Collapse</span>
                                        </>
                                    ) : (
                                        <>
                                            <Maximize2 size={15} />
                                            <span className="hidden md:inline">Expand Report</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close dialog"
                                    className="grid h-8 w-8 place-items-center rounded-full bg-raised/50 text-ink-muted transition hover:bg-raised hover:text-ink border border-line/40"
                                >
                                    <X size={16} aria-hidden="true" />
                                </button>
                            </div>
                        </header>

                        {/* Category Selector Bar (Pills) */}
                        {categories.length > 0 ? (
                            <div className="border-b border-line/50 bg-raised/20 px-4 py-2 shrink-0">
                                <div className="pem-scroll flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCategory('ALL')}
                                        className={cx(
                                            'shrink-0 rounded-pill px-3 py-1 font-semibold transition-all flex items-center gap-1.5 border',
                                            isAll
                                                ? 'bg-brand text-slate-950 font-bold border-brand shadow-[0_0_12px_rgba(20,184,166,0.35)]'
                                                : 'bg-raised/30 text-ink-muted hover:bg-raised/70 hover:text-ink border-line/30'
                                        )}
                                    >
                                        <Layers size={13} />
                                        <span>All Categories</span>
                                        <span className="opacity-80">({categories.length})</span>
                                    </button>

                                    {categories.map((c) => {
                                        const isCurrent = !isAll && selectedCategory === c.category;
                                        const cColor = getCategoryColor(c.category);
                                        return (
                                            <button
                                                key={c.category}
                                                type="button"
                                                onClick={() => setSelectedCategory(c.category)}
                                                style={
                                                    isCurrent
                                                        ? {
                                                              backgroundColor: `${cColor}22`,
                                                              color: cColor,
                                                              borderColor: `${cColor}60`,
                                                              boxShadow: `0 0 10px ${cColor}25`,
                                                          }
                                                        : undefined
                                                }
                                                className={cx(
                                                    'shrink-0 rounded-pill px-2.5 py-1 font-medium transition-all flex items-center gap-1.5 border',
                                                    isCurrent
                                                        ? 'font-bold'
                                                        : 'bg-raised/30 text-ink-muted hover:bg-raised/70 hover:text-ink border-line/30'
                                                )}
                                            >
                                                <span
                                                    className="h-2 w-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: cColor }}
                                                />
                                                <span>{c.category}</span>
                                                <span className="tnum text-[11px] opacity-75">
                                                    {formatCurrency(c.value, currency)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        {/* Top Telemetry / Analytics Metrics */}
                        <div className="border-b border-line bg-raised/20 px-4 py-2.5 sm:px-6 shrink-0">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                                {/* Scope Selector */}
                                {allTransactions.length > 0 && allCount !== transactions.length ? (
                                    <div className="inline-flex rounded-control border border-line bg-sunken p-0.5 shrink-0 self-start sm:self-auto">
                                        <button
                                            type="button"
                                            onClick={() => setScope('period')}
                                            className={cx(
                                                'rounded-[8px] px-2.5 py-1 text-xs font-semibold transition',
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
                                                'rounded-[8px] px-2.5 py-1 text-xs font-semibold transition',
                                                scope === 'all'
                                                    ? 'bg-surface text-ink shadow-card'
                                                    : 'text-ink-muted hover:text-ink'
                                            )}
                                        >
                                            All Time ({allCount})
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-xs font-medium text-ink-muted">
                                        Period: <strong className="text-ink">{periodLabel}</strong>
                                    </span>
                                )}

                                {/* Telemetry Cards */}
                                <div className="grid grid-cols-3 gap-2 sm:gap-2.5 flex-1 sm:max-w-md">
                                    <div className="rounded-xl border border-neg/25 bg-neg-soft/20 p-2 text-center transition hover:bg-neg-soft/30">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-neg/80">
                                            Spent
                                        </p>
                                        <p className="tnum mt-0.5 text-xs sm:text-sm font-black text-neg truncate">
                                            {formatCurrency(totalSpent, currency)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-info/25 bg-info-soft/15 p-2 text-center transition hover:bg-info-soft/25">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-info/80">
                                            Average
                                        </p>
                                        <p className="tnum mt-0.5 text-xs sm:text-sm font-black text-info truncate">
                                            {formatCurrency(avgTx, currency)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-warn/25 bg-warn-soft/15 p-2 text-center transition hover:bg-warn-soft/25">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-warn/80">
                                            Highest
                                        </p>
                                        <p className="tnum mt-0.5 text-xs sm:text-sm font-black text-warn truncate">
                                            {formatCurrency(maxTx, currency)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Search, Sort, and Export Bar */}
                        <div className="flex items-center gap-2 px-4 pt-3 pb-2 sm:px-6 shrink-0">
                            <div className="relative flex-1">
                                <Search
                                    size={15}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                                />
                                <input
                                    type="text"
                                    placeholder={
                                        isAll
                                            ? 'Search all expenses by description or mode...'
                                            : `Search ${selectedCategory} transactions...`
                                    }
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full rounded-xl border border-line/40 bg-sunken py-1.5 pl-9 pr-8 text-xs text-ink placeholder:text-ink-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-1 focus:ring-brand transition"
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
                                    setSortBy((s) =>
                                        s === 'date-desc' ? 'amount-desc' : s === 'amount-desc' ? 'amount-asc' : 'date-desc'
                                    )
                                }
                                title={`Sorting: ${
                                    sortBy === 'date-desc'
                                        ? 'Latest date'
                                        : sortBy === 'amount-desc'
                                        ? 'Highest amount'
                                        : 'Lowest amount'
                                }`}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-line/40 bg-raised/40 px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-raised hover:text-ink transition shrink-0"
                            >
                                <ArrowDownUp size={13} />
                                <span className="hidden sm:inline">
                                    {sortBy === 'date-desc'
                                        ? 'Latest'
                                        : sortBy === 'amount-desc'
                                        ? 'Highest'
                                        : 'Lowest'}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={handleExport}
                                title="Export transactions to CSV"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-line/40 bg-raised/40 px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-raised hover:text-ink transition shrink-0"
                            >
                                <Download size={13} />
                                <span className="hidden sm:inline">CSV</span>
                            </button>
                        </div>

                        {/* Main Content Area - Responsive Layout (Side-by-side in expanded mode) */}
                        <div className={cx('flex-1 min-h-0 overflow-hidden flex flex-col', isExpanded ? 'md:flex-row' : '')}>
                            {/* Left Column Analytics (Visible in Expanded Mode) */}
                            {isExpanded ? (
                                <div className="w-full md:w-[320px] shrink-0 border-b md:border-b-0 md:border-r border-line bg-raised/20 p-4 space-y-4 overflow-y-auto pem-scroll">
                                    {/* Category Distribution Breakdown */}
                                    {categories.length > 0 ? (
                                        <div className="rounded-2xl border border-line/40 bg-surface/60 backdrop-blur-sm p-3.5">
                                            <div className="flex items-center justify-between mb-2.5">
                                                <h3 className="text-xs font-bold text-ink flex items-center gap-1.5">
                                                    <PieIcon size={14} className="text-brand" />
                                                    Category Breakdown
                                                </h3>
                                                <span className="text-[10px] text-ink-faint">
                                                    {categories.length} categories
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {categories.map((c) => {
                                                    const pct = grandTotal > 0 ? (c.value / grandTotal) * 100 : 0;
                                                    const cColor = getCategoryColor(c.category);
                                                    const isCur = !isAll && selectedCategory === c.category;
                                                    return (
                                                        <button
                                                            key={c.category}
                                                            type="button"
                                                            onClick={() => setSelectedCategory(c.category)}
                                                            style={
                                                                isCur
                                                                    ? {
                                                                          backgroundColor: `${cColor}15`,
                                                                          borderColor: `${cColor}50`,
                                                                      }
                                                                    : undefined
                                                            }
                                                            className={cx(
                                                                'w-full text-left rounded-xl p-2 transition flex flex-col gap-1 border',
                                                                isCur
                                                                    ? 'shadow-xs'
                                                                    : 'border-transparent hover:bg-raised/60'
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="font-semibold text-ink truncate flex items-center gap-1.5">
                                                                    <span
                                                                        className="h-2 w-2 rounded-full shrink-0"
                                                                        style={{ backgroundColor: cColor }}
                                                                    />
                                                                    {c.category}
                                                                </span>
                                                                <span className="tnum font-bold text-ink shrink-0">
                                                                    {formatCurrency(c.value, currency)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-1 flex-1 rounded-pill bg-line/60 overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-pill transition-all"
                                                                        style={{ width: `${pct}%`, backgroundColor: cColor }}
                                                                    />
                                                                </div>
                                                                <span className="tnum text-[10px] text-ink-faint w-7 text-right">
                                                                    {pct.toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Payment Modes Distribution */}
                                    {paymentModeBreakdown.length > 0 ? (
                                        <div className="rounded-2xl border border-line/40 bg-surface/60 backdrop-blur-sm p-3.5">
                                            <div className="flex items-center justify-between mb-2.5">
                                                <h3 className="text-xs font-bold text-ink flex items-center gap-1.5">
                                                    <Wallet size={14} className="text-brand" />
                                                    Payment Methods
                                                </h3>
                                                <span className="text-[10px] text-ink-faint">
                                                    {paymentModeBreakdown.length} modes
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {paymentModeBreakdown.map((pm) => (
                                                    <div key={pm.mode} className="space-y-1">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-ink-muted capitalize font-medium">
                                                                {pm.mode}
                                                            </span>
                                                            <span className="tnum font-bold text-ink">
                                                                {formatCurrency(pm.amount, currency)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1 flex-1 rounded-pill bg-line/60 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-pill bg-brand transition-all"
                                                                    style={{ width: `${pm.pct}%` }}
                                                                />
                                                            </div>
                                                            <span className="tnum text-[10px] text-ink-faint w-7 text-right">
                                                                {pm.pct.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            {/* Right Column / Main Transactions List */}
                            <div className="pem-scroll flex-1 overflow-y-auto px-4 pb-4 sm:px-6 pt-1">
                                {!processedTransactions.length ? (
                                    <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-center">
                                        <Inbox size={28} className="text-ink-faint" aria-hidden="true" />
                                        <p className="text-sm font-bold text-ink-muted">
                                            {search ? 'No matching transactions' : 'No transactions recorded'}
                                        </p>
                                        <p className="max-w-xs text-xs text-ink-faint">
                                            {search
                                                ? 'Try searching with a different description or keyword.'
                                                : isAll
                                                ? 'No expense transactions found for this period.'
                                                : `No expenses found under ${selectedCategory} for this period.`}
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="space-y-1">
                                        {processedTransactions.map((t, idx) => {
                                            const amountNum = Math.abs(Number(t.amount) || 0);
                                            const itemCat = t.category || selectedCategory || 'Expense';
                                            const itemColor = getCategoryColor(itemCat);

                                            return (
                                                <li
                                                    key={t.id || t._id || `${t.date}-${t.amount}-${idx}`}
                                                    className="group flex items-center justify-between gap-3.5 rounded-xl border border-transparent hover:border-line/40 bg-raised/20 hover:bg-raised/70 px-3 py-2.5 transition-all duration-150"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span
                                                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all duration-200 group-hover:scale-105"
                                                            style={{
                                                                backgroundColor: `${itemColor}20`,
                                                                color: itemColor,
                                                                border: `1px solid ${itemColor}35`,
                                                                boxShadow: `0 0 10px ${itemColor}20`,
                                                            }}
                                                        >
                                                            <CategoryBadgeIcon category={itemCat} size={16} />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-xs sm:text-sm font-semibold text-ink group-hover:text-brand transition-colors">
                                                                {t.description || itemCat}
                                                            </p>
                                                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                                                                <span className="flex items-center gap-1 font-medium">
                                                                    <Calendar size={11} />
                                                                    {formatDate(t.date, {
                                                                        day: 'numeric',
                                                                        month: 'short',
                                                                        year: 'numeric',
                                                                    })}
                                                                </span>
                                                                <span
                                                                    className="rounded-pill px-2 py-0.5 font-semibold text-[10px]"
                                                                    style={{
                                                                        backgroundColor: `${itemColor}18`,
                                                                        color: itemColor,
                                                                        border: `1px solid ${itemColor}30`,
                                                                    }}
                                                                >
                                                                    {itemCat}
                                                                </span>
                                                                {t.paymentMode ? (
                                                                    <span className="rounded-pill bg-sunken px-2 py-0.5 font-medium capitalize text-ink-muted">
                                                                        {t.paymentMode}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right shrink-0">
                                                        <span className="tnum text-sm sm:text-base font-black text-neg">
                                                            -{formatCurrency(amountNum, currency)}
                                                        </span>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <footer className="flex items-center justify-between border-t border-line/60 bg-raised/30 px-4 py-2.5 sm:px-6 shrink-0">
                            <span className="text-xs text-ink-muted">
                                Showing {processedTransactions.length} of {catTransactions.length} entries
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded((prev) => !prev)}
                                    className="rounded-control bg-raised/60 px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-raised border border-line/40"
                                >
                                    {isExpanded ? 'Collapse' : 'Expand Report'}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-control bg-brand px-4 py-1.5 text-xs font-bold text-slate-950 transition hover:opacity-90 shadow-[0_0_12px_rgba(20,184,166,0.3)]"
                                >
                                    Close
                                </button>
                            </div>
                        </footer>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
