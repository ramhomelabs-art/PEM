import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowDownUp,
    Briefcase,
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
    ReceiptText,
    Search,
    ShoppingBag,
    Tag,
    Wallet,
    X,
    Zap,
} from 'lucide-react';
import { cx } from '../ui/cx';
import { formatCurrency, formatDate } from '../../utils/currency';
import { getCategoryColor } from '../../utils/theme';
import { exportTransactionsCsv } from '../../utils/exportDashboard';

/**
 * Maps category names to representative Lucide icons.
 */
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

/**
 * Maps payment modes to representative Lucide icons for inline display.
 */
const getPaymentMethodIcon = (mode = '') => {
    const m = String(mode).toLowerCase();
    if (m.includes('card') || m.includes('credit') || m.includes('debit')) return CreditCard;
    if (m.includes('cash')) return ReceiptText;
    if (m.includes('bank') || m.includes('net') || m.includes('upi')) return Zap;
    return Wallet;
};

const RANGE_LABELS = {
    '1m': 'This Month',
    '3m': 'Last 3 Months',
    '6m': 'Last 6 Months',
    '1y': 'Last 12 Months',
    custom: 'Custom Range',
};

/**
 * Resolves a clean transaction title without repeating the category name.
 */
export function getTransactionTitle(t) {
    const cat = String(t.category || '').trim().toLowerCase();
    const desc = String(t.description || '').trim();
    const merchant = String(t.merchant || '').trim();
    const note = String(t.note || '').trim();

    if (merchant && merchant.toLowerCase() !== cat) return merchant;
    if (desc && desc.toLowerCase() !== cat) return desc;
    if (note && note.toLowerCase() !== cat) return note;
    if (merchant) return merchant;
    if (desc) return desc;
    if (note) return note;
    return 'Expense';
}

/**
 * Human-friendly date grouping label.
 */
function getDateHeaderLabel(dateStr) {
    if (!dateStr) return 'Recent';
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return formatDate(dateStr, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Category icon container following Rule 6:
 * 36px rounded square at 12% opacity of the category colour, 18px icon.
 */
function CategoryIconBadge({ category, color, isAll = false }) {
     
    const Icon = isAll ? Layers : getCategoryIcon(category);
    return (
        <span
            className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center shrink-0 transition-colors"
            style={{
                backgroundColor: `${color}1f`, // ~12% opacity
                color: color,
            }}
            aria-hidden="true"
        >
            {/* eslint-disable-next-line react-hooks/static-components -- Icon is a stable module-level component */}
            <Icon size={18} />
        </span>
    );
}

/**
 * Header component: Icon + title + subtitle; single close & expand button.
 * Divides from body with the ONLY allowed 1px divider line.
 */
export function ReportHeader({
    title,
    subtitle,
    category,
    categoryColor,
    isAll,
    isExpanded,
    onToggleExpand,
    onClose,
}) {
    return (
        <header className="flex items-center justify-between gap-4 px-6 py-4 shrink-0 border-b border-[var(--divider)]">
            <div className="flex items-center gap-3.5 min-w-0">
                <CategoryIconBadge category={category} color={categoryColor} isAll={isAll} />
                <div className="min-w-0">
                    <h2
                        id="report-modal-title"
                        className="text-[20px] font-semibold text-[var(--text-primary)] leading-tight truncate"
                    >
                        {title}
                    </h2>
                    <p className="text-[13px] text-[var(--text-secondary)] mt-0.5 truncate">
                        {subtitle}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={onToggleExpand}
                    aria-label={isExpanded ? 'Collapse report' : 'Expand report'}
                    title={isExpanded ? 'Collapse report' : 'Expand report'}
                    className="w-[36px] h-[36px] rounded-[12px] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                >
                    {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close dialog"
                    title="Close"
                    className="w-[36px] h-[36px] rounded-[12px] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                >
                    <X size={18} />
                </button>
            </div>
        </header>
    );
}

/**
 * SummaryStrip: Borderless summary metrics separated by spacing only.
 */
export function SummaryStrip({ totalSpent, avgTx, maxTx, currency }) {
    return (
        <section aria-label="Spending Summary" className="px-6 pt-4 pb-2 shrink-0">
            <div className="flex items-center gap-8 sm:gap-12">
                <div>
                    <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)] block">
                        Spent
                    </span>
                    <span className="text-[22px] font-semibold text-[var(--danger)] tabular-nums leading-none block mt-1">
                        {formatCurrency(totalSpent, currency)}
                    </span>
                </div>
                <div>
                    <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)] block">
                        Average
                    </span>
                    <span className="text-[22px] font-semibold text-[var(--text-primary)] tabular-nums leading-none block mt-1">
                        {formatCurrency(avgTx, currency)}
                    </span>
                </div>
                <div>
                    <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)] block">
                        Highest
                    </span>
                    <span className="text-[22px] font-semibold text-[var(--text-primary)] tabular-nums leading-none block mt-1">
                        {formatCurrency(maxTx, currency)}
                    </span>
                </div>
            </div>
        </section>
    );
}

/**
 * FilterBar: Segmented control, borderless search input, and sort dropdown.
 */
export function FilterBar({
    scope,
    onScopeChange,
    periodLabel,
    allCount,
    hasScopeToggle,
    search,
    onSearchChange,
    onClearSearch,
    sortBy,
    onSortChange,
    placeholder = 'Search expenses...',
}) {
    return (
        <div className="px-6 py-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {hasScopeToggle ? (
                <div
                    role="tablist"
                    aria-label="Time Scope"
                    className="bg-[var(--surface)] p-1 rounded-[12px] flex items-center shrink-0"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={scope === 'period'}
                        onClick={() => onScopeChange('period')}
                        className={cx(
                            'px-3 py-1.5 text-[13px] rounded-[8px] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none',
                            scope === 'period'
                                ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-semibold shadow-xs'
                                : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]'
                        )}
                    >
                        {periodLabel}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={scope === 'all'}
                        onClick={() => onScopeChange('all')}
                        className={cx(
                            'px-3 py-1.5 text-[13px] rounded-[8px] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none',
                            scope === 'all'
                                ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-semibold shadow-xs'
                                : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]'
                        )}
                    >
                        All Time ({allCount})
                    </button>
                </div>
            ) : null}

            <div className="relative flex-1 bg-[var(--surface)] rounded-[12px] flex items-center focus-within:ring-2 focus-within:ring-[var(--accent)] transition-all">
                <Search
                    size={18}
                    className="absolute left-3 text-[var(--text-muted)] pointer-events-none"
                    aria-hidden="true"
                />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={placeholder}
                    className="border-none bg-transparent py-2 pl-9 pr-8 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none w-full"
                />
                {search ? (
                    <button
                        type="button"
                        onClick={onClearSearch}
                        aria-label="Clear search query"
                        className="absolute right-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
                    >
                        <X size={14} />
                    </button>
                ) : null}
            </div>

            <button
                type="button"
                onClick={onSortChange}
                aria-label={`Sort transactions. Current: ${
                    sortBy === 'date-desc' ? 'Latest' : sortBy === 'amount-desc' ? 'Highest' : 'Lowest'
                }`}
                title={`Sort: ${
                    sortBy === 'date-desc' ? 'Latest date' : sortBy === 'amount-desc' ? 'Highest amount' : 'Lowest amount'
                }`}
                className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-[12px] px-3 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none shrink-0"
            >
                <ArrowDownUp size={18} aria-hidden="true" />
                <span>
                    {sortBy === 'date-desc'
                        ? 'Latest'
                        : sortBy === 'amount-desc'
                        ? 'Highest'
                        : 'Lowest'}
                </span>
            </button>
        </div>
    );
}

/**
 * CategoryChips: Horizontally scrollable chips with hidden scrollbar and edge fade masks.
 * Keyboard accessible with arrow navigation.
 */
export function CategoryChips({
    categories = [],
    selectedCategory,
    onSelectCategory,
    currency,
}) {
    const listRef = useRef(null);

    const allCategories = useMemo(() => {
        return [{ category: 'ALL', isAll: true }, ...categories];
    }, [categories]);

    const handleKeyDown = (e, index) => {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const nextIdx = (index + 1) % allCategories.length;
            const nextCat = allCategories[nextIdx].category;
            onSelectCategory(nextCat);
            const nextBtn = listRef.current?.querySelectorAll('button')[nextIdx];
            nextBtn?.focus();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prevIdx = (index - 1 + allCategories.length) % allCategories.length;
            const prevCat = allCategories[prevIdx].category;
            onSelectCategory(prevCat);
            const prevBtn = listRef.current?.querySelectorAll('button')[prevIdx];
            prevBtn?.focus();
        }
    };

    return (
        <div className="relative px-6 py-2 shrink-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)]">
            <div
                ref={listRef}
                role="radiogroup"
                aria-label="Filter by category"
                className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1"
            >
                {allCategories.map((c, idx) => {
                    const isAll = c.isAll || c.category === 'ALL';
                    const isSelected = isAll
                        ? selectedCategory === 'ALL' || !selectedCategory
                        : selectedCategory === c.category;
                    const catColor = isAll ? 'var(--accent)' : getCategoryColor(c.category);

                    return (
                        <button
                            key={c.category}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={isSelected ? 0 : -1}
                            onClick={() => onSelectCategory(c.category)}
                            onKeyDown={(e) => handleKeyDown(e, idx)}
                            style={
                                isSelected
                                    ? {
                                          backgroundColor: `${catColor}26`, // 15% opacity accent tint
                                          color: catColor,
                                      }
                                    : undefined
                            }
                            className={cx(
                                'rounded-[12px] px-3 py-1.5 text-[13px] font-medium flex items-center gap-2 shrink-0 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none',
                                isSelected
                                    ? 'font-semibold'
                                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            )}
                        >
                            {!isAll ? (
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: catColor }}
                                    aria-hidden="true"
                                />
                            ) : null}
                            <span>{isAll ? 'All Categories' : c.category}</span>
                            {!isAll && c.value != null ? (
                                <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
                                    {formatCurrency(c.value, currency)}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * CategoryBreakdown: Left panel without outer border, showing category bars.
 * Stackable and collapsible on mobile (<768px).
 */
export function CategoryBreakdown({
    categories = [],
    selectedCategory,
    onSelectCategory,
    grandTotal,
    currency,
}) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    if (!categories.length) return null;

    const content = (
        <div className="space-y-1.5 modal-thin-scroll max-h-[280px] md:max-h-[460px] overflow-y-auto pr-1">
            {categories.map((c) => {
                const pct = grandTotal > 0 ? (c.value / grandTotal) * 100 : 0;
                const color = getCategoryColor(c.category);
                const isSelected = selectedCategory === c.category;

                return (
                    <button
                        key={c.category}
                        type="button"
                        onClick={() => onSelectCategory(c.category)}
                        style={
                            isSelected
                                ? {
                                      backgroundColor: `${color}26`,
                                      color: color,
                                  }
                                : undefined
                        }
                        className={cx(
                            'w-full text-left rounded-[12px] p-2 transition-colors flex flex-col gap-1.5 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none',
                            isSelected
                                ? 'font-semibold'
                                : 'hover:bg-[var(--surface-hover)] text-[var(--text-primary)]'
                        )}
                    >
                        <div className="flex items-center justify-between text-[13px]">
                            <span className="font-medium truncate flex items-center gap-2">
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: color }}
                                    aria-hidden="true"
                                />
                                <span className="truncate">{c.category}</span>
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="tabular-nums font-semibold">
                                    {formatCurrency(c.value, currency)}
                                </span>
                                <span className="text-[12px] text-[var(--text-muted)] tabular-nums w-8 text-right">
                                    {pct.toFixed(0)}%
                                </span>
                            </div>
                        </div>

                        <div className="h-1 w-full rounded-full bg-[var(--surface)] overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${Math.min(pct, 100)}%`,
                                    backgroundColor: color,
                                }}
                            />
                        </div>
                    </button>
                );
            })}
        </div>
    );

    return (
        <aside
            aria-label="Category Breakdown"
            className="w-full md:w-[280px] lg:w-[320px] shrink-0 p-4 md:p-6 space-y-3"
        >
            <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                    Category Breakdown
                </span>
                <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
                    {categories.length} categories
                </span>
            </div>

            {/* Mobile Collapsible Header */}
            <div className="md:hidden">
                <button
                    type="button"
                    onClick={() => setIsMobileOpen((prev) => !prev)}
                    className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-[12px] px-3 py-2 text-[13px] font-medium text-[var(--text-secondary)] flex items-center justify-between transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                >
                    <span>{isMobileOpen ? 'Hide Breakdown' : 'Show Breakdown'}</span>
                    <span className="text-[12px] text-[var(--text-muted)]">{isMobileOpen ? '▲' : '▼'}</span>
                </button>
                {isMobileOpen ? <div className="mt-2">{content}</div> : null}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">{content}</div>
        </aside>
    );
}

/**
 * TransactionRow: Individual expense row with icon, merchant/description title,
 * category chip, payment mode muted text, and danger-colored amount.
 * Never repeats category as title. No borders.
 */
export function TransactionRow({ transaction: t, currency }) {
    const amountNum = Math.abs(Number(t.amount) || 0);
    const itemCat = t.category || 'Expense';
    const itemColor = getCategoryColor(itemCat);
    const rowTitle = getTransactionTitle(t);
     
    const PaymentIcon = getPaymentMethodIcon(t.paymentMode);

    return (
        <li className="group flex items-center justify-between gap-3.5 px-3 py-2.5 rounded-[12px] hover:bg-[var(--surface)] transition-colors">
            <div className="flex items-center gap-3 min-w-0">
                <CategoryIconBadge category={itemCat} color={itemColor} />
                <div className="min-w-0">
                    <p className="text-[15px] font-medium text-[var(--text-primary)] truncate">
                        {rowTitle}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                        <span
                            className="rounded-[6px] px-1.5 py-0.5 text-[12px] font-medium"
                            style={{
                                backgroundColor: `${itemColor}1f`,
                                color: itemColor,
                            }}
                        >
                            {itemCat}
                        </span>
                        {t.paymentMode ? (
                            <span className="text-[13px] text-[var(--text-muted)] flex items-center gap-1">
                                {/* eslint-disable-next-line react-hooks/static-components -- PaymentIcon is a stable module-level component */}
                                <PaymentIcon size={13} aria-hidden="true" />
                                <span className="capitalize">{t.paymentMode}</span>
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="text-right shrink-0">
                <span className="text-[15px] font-semibold text-[var(--danger)] tabular-nums">
                    -{formatCurrency(amountNum, currency)}
                </span>
            </div>
        </li>
    );
}

/**
 * TransactionGroup: Sticky date-header grouping of transactions.
 */
export function TransactionGroup({ label, items = [], currency }) {
    return (
        <div className="space-y-1">
            <div className="sticky top-0 z-10 bg-inherit/90 backdrop-blur-md py-1 px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                {label}
            </div>
            <ul className="space-y-1">
                {items.map((t, idx) => (
                    <TransactionRow
                        key={t.id || t._id || `${t.date}-${t.amount}-${idx}`}
                        transaction={t}
                        currency={currency}
                    />
                ))}
            </ul>
        </div>
    );
}

/**
 * Loading Skeletons state.
 */
function LoadingSkeleton() {
    return (
        <div className="space-y-3 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
                <div
                    key={i}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-[12px] bg-[var(--surface)] animate-pulse"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-[36px] h-[36px] rounded-[10px] bg-[var(--surface-hover)]" />
                        <div className="space-y-1.5">
                            <div className="h-3.5 w-32 rounded-full bg-[var(--surface-hover)]" />
                            <div className="h-2.5 w-20 rounded-full bg-[var(--surface-hover)]" />
                        </div>
                    </div>
                    <div className="h-4 w-16 rounded-full bg-[var(--surface-hover)]" />
                </div>
            ))}
        </div>
    );
}

/**
 * Empty State with "Clear filters" action.
 */
function EmptyState({ onClearFilters }) {
    return (
        <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-center px-4">
            <Inbox size={28} className="text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-[15px] font-medium text-[var(--text-primary)]">
                No expenses match your filters
            </p>
            <p className="text-[13px] text-[var(--text-secondary)] max-w-xs">
                Try searching with a different keyword or resetting your filters.
            </p>
            <button
                type="button"
                onClick={onClearFilters}
                className="mt-1 bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] text-[var(--text-primary)] rounded-[12px] px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            >
                Clear filters
            </button>
        </div>
    );
}

/**
 * Detailed Spending Report Modal Container.
 */
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
    const [isLoading, setIsLoading] = useState(false);

    const modalRef = useRef(null);

    // Synchronize initial state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedCategory(initialCategory || category || 'ALL');
            setIsExpanded(startExpanded);
            setSearch('');
            setScope('period');
            setSortBy('date-desc');
            setIsLoading(false);
        }
    }, [isOpen, initialCategory, category, startExpanded]);

    // Close on Escape key & trap focus
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            // Focus trap
            if (e.key === 'Tab' && modalRef.current) {
                const focusableElements = Array.from(
                    modalRef.current.querySelectorAll(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    )
                ).filter((el) => !el.hasAttribute('disabled'));

                if (!focusableElements.length) return;
                const first = focusableElements[0];
                const last = focusableElements[focusableElements.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
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
                    (t.merchant && t.merchant.toLowerCase().includes(q)) ||
                    (t.note && t.note.toLowerCase().includes(q)) ||
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

    // Group processed transactions by date
    const groupedTransactions = useMemo(() => {
        const groups = [];
        const map = new Map();
        processedTransactions.forEach((t) => {
            const rawDate = t.date ? String(t.date).slice(0, 10) : 'recent';
            if (!map.has(rawDate)) {
                const group = {
                    dateKey: rawDate,
                    label: getDateHeaderLabel(t.date),
                    items: [],
                };
                map.set(rawDate, group);
                groups.push(group);
            }
            map.get(rawDate).items.push(t);
        });
        return groups;
    }, [processedTransactions]);

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

    const categoryColor = isAll ? 'var(--accent)' : getCategoryColor(selectedCategory);
    const periodLabel = RANGE_LABELS[range] || 'Current Period';

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

    const handleExport = () => {
        const catName = isAll ? 'all_spending' : selectedCategory.toLowerCase().replace(/\s+/g, '_');
        exportTransactionsCsv(processedTransactions, `category_${catName}_report.csv`);
    };

    const handleClearFilters = () => {
        setSearch('');
        setSelectedCategory('ALL');
    };

    const modalTitle = isAll ? 'Detailed Spending Report' : selectedCategory;
    const modalSubtitle = `${catTransactions.length} ${
        catTransactions.length === 1 ? 'transaction' : 'transactions'
    } · ${scope === 'period' ? periodLabel : 'All Time'}`;

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="report-modal-title"
                    className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 lg:p-6"
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-sunken/80 backdrop-blur-md"
                        aria-hidden="true"
                    />

                    {/* Modal Card with Strict Design System Tokens */}
                    <motion.div
                        ref={modalRef}
                        layout
                        initial={{ opacity: 0, scale: 0.97, y: 14 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 14 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            '--surface': 'rgba(255, 255, 255, 0.04)',
                            '--surface-hover': 'rgba(255, 255, 255, 0.08)',
                            '--surface-active': 'rgba(20, 184, 166, 0.15)',
                            '--divider': 'rgba(255, 255, 255, 0.06)',
                            '--text-primary': '#f8fafc',
                            '--text-secondary': '#94a3b8',
                            '--text-muted': '#64748b',
                            '--accent': '#14b8a6',
                            '--success': '#10b981',
                            '--danger': '#f43f5e',
                            '--warning': '#f59e0b',
                            '--info': '#38bdf8',
                        }}
                        className={cx(
                            'relative z-10 flex flex-col bg-surface shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] transition-all duration-300 overflow-hidden w-full h-full md:rounded-[20px]',
                            isExpanded
                                ? 'md:h-[90vh] md:max-h-[900px] md:w-[96vw] md:max-w-5xl'
                                : 'md:max-h-[84vh] md:w-full md:max-w-2xl'
                        )}
                    >
                        {/* Header: Title, Subtitle, Close & Expand Button + ONLY 1 Divider Line */}
                        <ReportHeader
                            title={modalTitle}
                            subtitle={modalSubtitle}
                            category={selectedCategory}
                            categoryColor={categoryColor}
                            isAll={isAll}
                            isExpanded={isExpanded}
                            onToggleExpand={() => setIsExpanded((prev) => !prev)}
                            onClose={onClose}
                        />

                        {/* Summary Metrics Strip (Borderless, Spaced) */}
                        <SummaryStrip
                            totalSpent={totalSpent}
                            avgTx={avgTx}
                            maxTx={maxTx}
                            currency={currency}
                        />

                        {/* Filter Bar: Segmented Scope, Search, Sort */}
                        <FilterBar
                            scope={scope}
                            onScopeChange={setScope}
                            periodLabel={periodLabel}
                            allCount={allCount}
                            hasScopeToggle={allTransactions.length > 0 && allCount !== transactions.length}
                            search={search}
                            onSearchChange={setSearch}
                            onClearSearch={() => setSearch('')}
                            sortBy={sortBy}
                            onSortChange={() =>
                                setSortBy((s) =>
                                    s === 'date-desc'
                                        ? 'amount-desc'
                                        : s === 'amount-desc'
                                        ? 'amount-asc'
                                        : 'date-desc'
                                )
                            }
                            placeholder={
                                isAll
                                    ? 'Search all expenses by description or mode...'
                                    : `Search ${selectedCategory} transactions...`
                            }
                        />

                        {/* Category Filter Chips (No scrollbar, Fade edge masks) */}
                        {categories.length > 0 ? (
                            <CategoryChips
                                categories={categories}
                                selectedCategory={selectedCategory}
                                onSelectCategory={setSelectedCategory}
                                currency={currency}
                            />
                        ) : null}

                        {/* Body Area: Left Breakdown (in expanded or responsive) + Right Transactions */}
                        <div
                            className={cx(
                                'flex-1 min-h-0 overflow-hidden flex flex-col',
                                isExpanded ? 'md:flex-row' : ''
                            )}
                        >
                            {/* Left Panel: Category Breakdown */}
                            {isExpanded && categories.length > 0 ? (
                                <CategoryBreakdown
                                    categories={categories}
                                    selectedCategory={selectedCategory}
                                    onSelectCategory={setSelectedCategory}
                                    grandTotal={grandTotal}
                                    currency={currency}
                                />
                            ) : null}

                            {/* Right Panel: Transaction Groups */}
                            <div className="modal-thin-scroll flex-1 overflow-y-auto px-6 py-2">
                                {isLoading ? (
                                    <LoadingSkeleton />
                                ) : !processedTransactions.length ? (
                                    <EmptyState onClearFilters={handleClearFilters} />
                                ) : (
                                    <div className="space-y-4">
                                        {groupedTransactions.map((group) => (
                                            <TransactionGroup
                                                key={group.dateKey}
                                                label={group.label}
                                                items={group.items}
                                                currency={currency}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer: Count info + CSV Export Action only (NO duplicate buttons, NO top line) */}
                        <footer className="flex items-center justify-between px-6 py-4 shrink-0">
                            <span className="text-[13px] text-[var(--text-muted)]">
                                Showing {processedTransactions.length} of {catTransactions.length} entries
                            </span>
                            <button
                                type="button"
                                onClick={handleExport}
                                title="Export transactions to CSV"
                                className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] rounded-[12px] px-3.5 py-1.5 text-[13px] font-medium flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                            >
                                <Download size={15} aria-hidden="true" />
                                <span>Export CSV</span>
                            </button>
                        </footer>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
