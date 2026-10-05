import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowUpRight, ExternalLink, PieChart as PieIcon } from 'lucide-react';
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
 * - Slices use strictly unique colors without repetition.
 * - Total spend amount and active slice details are shown cleanly UNDER the donut.
 * - Clicking any category (slice or legend item) opens a modal with category-related transactions.
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

    const rows = useMemo(() => groupTiny(data), [data]);
    const total = useMemo(() => rows.reduce((s, d) => s + d.value, 0), [rows]);
    const colors = useMemo(
        () => assignCategoryColors(rows.map((d) => d.category)),
        [rows]
    );
    const focus = hover || activeCategory;
    const focused = rows.find((d) => d.category === focus);
    const focusPct = focused && total > 0 ? (focused.value / total) * 100 : 0;

    const handleCategoryClick = (categoryName) => {
        if (!categoryName) return;
        setModalCategory(categoryName);
        onSelect?.(categoryName);
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="pem-skeleton mx-auto h-[190px] w-[190px] rounded-full" />
                <div className="flex-1 space-y-3">
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 lg:flex-row lg:items-center">
            {/* Donut chart column with Total Spend placed UNDER the donut */}
            <div className="flex flex-col items-center shrink-0">
                <div className="group relative h-[195px] w-[195px] shrink-0 self-center min-w-0 min-h-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 195, height: 195 }}>
                        <PieChart>
                            <Pie
                                data={rows}
                                dataKey="value"
                                nameKey="category"
                                innerRadius={58}
                                outerRadius={92}
                                paddingAngle={3}
                                cornerRadius={6}
                                stroke="var(--pem-surface)"
                                strokeWidth={2}
                                onClick={(_, index) => handleCategoryClick(rows[index]?.category)}
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
                                                filter: isTarget ? `drop-shadow(0 0 6px ${sliceColor}80)` : 'none',
                                            }}
                                        />
                                    );
                                })}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span
                            className={cx(
                                'grid h-10 w-10 place-items-center rounded-full transition-transform duration-300',
                                focus ? 'scale-110' : 'scale-100'
                            )}
                            style={{
                                backgroundColor: focused ? `${colors.get(focused.category)}18` : 'transparent',
                            }}
                        >
                            <PieIcon
                                size={22}
                                className={cx('transition-colors', focused ? 'text-ink' : 'text-ink-faint/30')}
                                aria-hidden="true"
                            />
                        </span>
                    </div>
                </div>

                {/* Amount and category details placed directly UNDER the donut */}
                <div
                    onClick={() => focused && handleCategoryClick(focused.category)}
                    className={cx(
                        'mt-2.5 text-center transition-all duration-200 rounded-control px-3 py-1.5',
                        focused ? 'cursor-pointer hover:bg-raised' : ''
                    )}
                >
                    <div className="flex items-center justify-center gap-1.5">
                        {focused ? (
                            <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: colors.get(focused.category) }}
                            />
                        ) : null}
                        <p className="max-w-[170px] truncate text-xs font-semibold text-ink-muted">
                            {focused ? focused.category : 'Total spend'}
                        </p>
                        {focused ? <ExternalLink size={11} className="text-ink-faint" /> : null}
                    </div>

                    <p className="tnum mt-0.5 text-lg font-extrabold text-ink">
                        {formatCurrency(focused ? focused.value : total, currency)}
                    </p>

                    {focused ? (
                        <p className="tnum text-xs font-bold text-ink-muted">
                            {formatPercent(focusPct)} of total spend
                        </p>
                    ) : (
                        <p className="text-[11px] font-medium text-ink-faint">
                            {rows.length} {rows.length === 1 ? 'category' : 'categories'} · Click to inspect
                        </p>
                    )}
                </div>
            </div>

            {/* Interactive Legend list */}
            <ul className="pem-scroll max-h-[290px] min-h-0 w-full flex-1 space-y-1.5 overflow-y-auto pb-1 pr-2">
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
                                onClick={() => handleCategoryClick(d.category)}
                                aria-pressed={isActive}
                                className={cx(
                                    'group flex w-full items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left transition',
                                    isActive || isHovered
                                        ? 'bg-raised shadow-xs'
                                        : 'hover:bg-raised/70'
                                )}
                            >
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125"
                                    style={{
                                        backgroundColor: color,
                                        boxShadow: `0 0 6px ${color}60`,
                                    }}
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="truncate text-xs font-semibold text-ink group-hover:text-brand transition-colors">
                                            {d.category}
                                        </span>
                                        <span className="flex items-center gap-1.5 shrink-0">
                                            <span className="tnum text-xs font-bold text-ink">
                                                {formatCurrency(d.value, currency)}
                                            </span>
                                            <ArrowUpRight
                                                size={13}
                                                className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity"
                                            />
                                        </span>
                                    </span>
                                    <span className="mt-1 flex items-center gap-2">
                                        <span className="h-1 flex-1 overflow-hidden rounded-pill bg-line">
                                            <span
                                                className="block h-full rounded-pill transition-all duration-300"
                                                style={{ width: `${pct}%`, backgroundColor: color }}
                                            />
                                        </span>
                                        <span className="tnum w-9 shrink-0 text-right text-[11px] text-ink-faint">
                                            {pct.toFixed(0)}%
                                        </span>
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>

            {/* Category Transactions Modal */}
            <CategoryTransactionsModal
                isOpen={Boolean(modalCategory)}
                onClose={() => setModalCategory(null)}
                category={modalCategory}
                transactions={transactions}
                allTransactions={allTransactions}
                range={range}
                currency={currency}
                totalCategorySpend={rows.find((r) => r.category === modalCategory)?.value}
            />
        </div>
    );
}
