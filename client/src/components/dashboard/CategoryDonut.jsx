import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, Maximize2, PieChart as PieIcon } from 'lucide-react';
import { cx } from '../ui/cx';
import { formatCurrency, formatPercent } from '../../utils/currency';
import { assignCategoryColors } from '../../utils/theme';
import { CategoryTransactionsModal } from './CategoryTransactionsModal';

const OTHERS = '#64748b';

// Only start folding the tail away once there are more slices than this, and
// only ever fold sub-3% rows.
const MAX_SLICES = 12;
const MIN_SHARE = 0.02;

function groupTiny(data) {
    if (data.length <= MAX_SLICES) return data;

    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const tiny = data.filter((d) => d.value / total < MIN_SHARE);
    if (tiny.length < 2) return data;

    const tinyNames = new Set(tiny.map((d) => d.category));
    const rest = data.filter((d) => !tinyNames.has(d.category));
    const othersValue = tiny.reduce((s, d) => s + d.value, 0);

    const existing = rest.find((d) => d.category === 'Others');
    if (existing) existing.value += othersValue;
    else rest.push({ category: 'Others', value: othersValue, grouped: true });

    return rest.sort((a, b) => b.value - a.value);
}

/**
 * Spend-by-category donut:
 * - Enlarged prominent donut with higher outer/inner radius.
 * - Compact category list to balance visual weight.
 * - Clicking the donut, center icon, total spend, or expand button opens an expanded detailed report modal.
 */
export function CategoryDonut({
    data = [],
    currency = 'INR',
    loading,
    activeCategory,
    onSelect,
    transactions = [],
    allTransactions = [],
    range = '1m',
}) {
    const [hover, setHover] = useState(null);
    const [modalCategory, setModalCategory] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalStartExpanded, setModalStartExpanded] = useState(false);

    const rows = useMemo(() => groupTiny(data), [data]);
    const total = useMemo(() => rows.reduce((s, d) => s + d.value, 0), [rows]);
    const colors = useMemo(
        () => assignCategoryColors(rows.map((d) => d.category)),
        [rows]
    );
    const focus = hover || activeCategory;
    const focused = rows.find((d) => d.category === focus);
    const focusPct = focused && total > 0 ? (focused.value / total) * 100 : 0;

    const handleCategoryClick = (categoryName, expand = true) => {
        setModalCategory(categoryName || 'ALL');
        setModalStartExpanded(expand);
        setIsModalOpen(true);
        if (categoryName && categoryName !== 'ALL') {
            onSelect?.(categoryName);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setModalCategory(null);
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="pem-skeleton mx-auto h-[240px] w-[240px] rounded-full" />
                <div className="w-full lg:max-w-[290px] space-y-2.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="pem-skeleton h-4 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    if (!rows.length) {
        return (
            <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line text-center">
                <PieIcon size={26} className="text-ink-faint" aria-hidden="true" />
                <p className="text-sm font-bold text-ink-muted">No spending yet</p>
                <p className="max-w-[200px] text-xs text-ink-faint">
                    Categorised expenses will break down here.
                </p>
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-8">
            {/* Enlarged Donut Chart Column */}
            <div className="flex flex-col items-center shrink-0">
                <div className="group relative h-[245px] w-[245px] shrink-0 self-center min-w-0 min-h-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 245, height: 245 }}>
                        <PieChart>
                            <Pie
                                data={rows}
                                dataKey="value"
                                nameKey="category"
                                innerRadius={74}
                                outerRadius={114}
                                paddingAngle={3}
                                cornerRadius={7}
                                stroke="var(--pem-surface)"
                                strokeWidth={2}
                                onClick={(_, index) => handleCategoryClick(rows[index]?.category, true)}
                                onMouseEnter={(_, index) => setHover(rows[index]?.category)}
                                onMouseLeave={() => setHover(null)}
                            >
                                {rows.map((d) => {
                                    const dim = focus && focus !== d.category;
                                    const isTarget = focus === d.category;
                                    const sliceColor = d.grouped ? OTHERS : colors.get(d.category) ?? OTHERS;
                                    return (
                                        <Cell
                                            key={d.category}
                                            fill={sliceColor}
                                            opacity={dim ? 0.35 : 1}
                                            stroke={isTarget ? '#ffffff' : 'var(--pem-surface)'}
                                            strokeWidth={isTarget ? 3 : 2}
                                            style={{
                                                cursor: 'pointer',
                                                transition: 'opacity 180ms ease, transform 180ms ease',
                                                filter: isTarget ? `drop-shadow(0 0 8px ${sliceColor}90)` : 'none',
                                            }}
                                        />
                                    );
                                })}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div
                        onClick={() => handleCategoryClick(focused ? focused.category : 'ALL', true)}
                        className="cursor-pointer absolute inset-0 flex items-center justify-center"
                        title={focused ? `Inspect ${focused.category}` : 'Inspect detailed report'}
                    >
                        <span
                            className={cx(
                                'grid h-12 w-12 place-items-center rounded-full transition-all duration-300 shadow-sm',
                                focus ? 'scale-110 shadow-md' : 'scale-100 hover:scale-105'
                            )}
                            style={{
                                backgroundColor: focused ? `${colors.get(focused.category)}20` : 'var(--pem-surface-raised, rgba(255,255,255,0.06))',
                            }}
                        >
                            <PieIcon
                                size={24}
                                className={cx('transition-colors', focused ? 'text-ink' : 'text-ink-faint/60')}
                                aria-hidden="true"
                            />
                        </span>
                    </div>
                </div>

                {/* Amount and category details placed directly UNDER the donut - clickable to expand detailed report */}
                <button
                    type="button"
                    onClick={() => handleCategoryClick(focused ? focused.category : 'ALL', true)}
                    className="group mt-1.5 text-center transition-all duration-200 rounded-xl px-3.5 py-1.5 hover:bg-raised/70 border border-transparent hover:border-line/60"
                    title="Click to expand detailed report"
                >
                    <div className="flex items-center justify-center gap-1.5">
                        {focused ? (
                            <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: colors.get(focused.category) }}
                            />
                        ) : null}
                        <p className="max-w-[180px] truncate text-xs font-semibold text-ink-muted group-hover:text-ink transition-colors">
                            {focused ? focused.category : 'Total spend'}
                        </p>
                        <Maximize2 size={11} className="text-ink-faint opacity-60 group-hover:opacity-100 group-hover:text-brand transition-all" />
                    </div>

                    <p className="tnum mt-0.5 text-xl font-black text-ink tracking-tight">
                        {formatCurrency(focused ? focused.value : total, currency)}
                    </p>

                    {focused ? (
                        <p className="tnum text-xs font-bold text-ink-muted">
                            {formatPercent(focusPct)} of total spend · <span className="text-brand">Click to expand</span>
                        </p>
                    ) : (
                        <p className="text-[11px] font-medium text-ink-faint group-hover:text-ink-muted transition-colors">
                            {rows.length} {rows.length === 1 ? 'category' : 'categories'} · <span className="text-brand font-semibold">Click to expand report</span>
                        </p>
                    )}
                </button>
            </div>

            {/* Clean, Full-Width Category List Column */}
            <div className="min-w-0 flex-1 w-full flex flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                        Categories ({rows.length})
                    </span>
                    <button
                        type="button"
                        onClick={() => handleCategoryClick('ALL', true)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline transition"
                    >
                        <Maximize2 size={11} />
                        Detailed report
                    </button>
                </div>

                <ul className="pem-scroll max-h-[265px] min-h-0 w-full space-y-1 overflow-y-auto pb-1 pr-1.5">
                    {rows.map((d) => {
                        const pct = total > 0 ? (d.value / total) * 100 : 0;
                        const color = d.grouped ? OTHERS : colors.get(d.category) ?? OTHERS;
                        const isActive = activeCategory === d.category;
                        const isHovered = hover === d.category;

                        return (
                            <li key={d.category}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setHover(d.category)}
                                    onMouseLeave={() => setHover(null)}
                                    onClick={() => handleCategoryClick(d.category, true)}
                                    aria-pressed={isActive}
                                    className={cx(
                                        'group flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition',
                                        isActive || isHovered
                                            ? 'bg-raised shadow-xs'
                                            : 'hover:bg-raised/70'
                                    )}
                                >
                                    <span
                                        className="h-2 w-2 shrink-0 rounded-full transition-transform group-hover:scale-125"
                                        style={{
                                            backgroundColor: color,
                                            boxShadow: `0 0 5px ${color}60`,
                                        }}
                                    />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="flex items-center justify-between gap-1.5">
                                            <span className="truncate text-xs font-semibold text-ink group-hover:text-brand transition-colors">
                                                {d.category}
                                            </span>
                                            <span className="flex items-center gap-1 shrink-0">
                                                <span className="tnum text-xs font-bold text-ink">
                                                    {formatCurrency(d.value, currency)}
                                                </span>
                                                <ArrowUpRight
                                                    size={12}
                                                    className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity"
                                                />
                                            </span>
                                        </span>
                                        <span className="mt-0.5 flex items-center gap-1.5">
                                            <span className="h-[3px] flex-1 overflow-hidden rounded-pill bg-line">
                                                <span
                                                    className="block h-full rounded-pill transition-all duration-300"
                                                    style={{ width: `${pct}%`, backgroundColor: color }}
                                                />
                                            </span>
                                            <span className="tnum w-7 shrink-0 text-right text-[10.5px] text-ink-faint">
                                                {pct.toFixed(0)}%
                                            </span>
                                        </span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* Detailed Category Report Modal */}
            <CategoryTransactionsModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                initialCategory={modalCategory}
                categories={rows}
                totalSpend={total}
                transactions={transactions}
                allTransactions={allTransactions}
                range={range}
                currency={currency}
                startExpanded={modalStartExpanded}
            />
        </div>
    );
}
