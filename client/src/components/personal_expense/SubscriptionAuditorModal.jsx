import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Plus,
    X,
    Receipt,
    RefreshCw,
    Search,
    ShieldAlert,
    Wallet,
    Calendar,
    ArrowUpRight,
    Zap,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge, Button, IconBadge } from '../ui/primitives';
import { formatCurrency, formatDate } from '../../utils/currency';
import { cx } from '../ui/cx';

/**
 * Subscription & Recurring Expense Auditor
 * Automatically scans transaction history to discover recurring payments,
 * detects silent price increases, flags potential duplicate/zombie subscriptions,
 * and calculates annualized financial bleed with one-click bill sync.
 */
export function SubscriptionAuditorModal({
    isOpen,
    onClose,
    transactions = [],
    existingBills = [],
    currency = 'INR',
    onAddBill,
}) {
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'untracked' | 'hikes' | 'zombies'
    const [searchQuery, setSearchQuery] = useState('');
    const [cancelledSubscriptions, setCancelledSubscriptions] = useState(new Set());

    // Deep scanning algorithm for recurring patterns
    const auditedSubscriptions = useMemo(() => {
        if (!Array.isArray(transactions) || transactions.length === 0) return [];

        // 1. Group expense transactions by normalized merchant / description name
        const groups = new Map();

        const cleanName = (t) => {
            const raw = t.merchant || t.description || t.title || t.category || 'Subscription';
            return raw.trim().toLowerCase();
        };

        const expenses = transactions.filter((t) => (t.type === 'expense' || !t.type) && t.date);

        for (const tx of expenses) {
            const name = cleanName(tx);
            if (!name || name.length < 2) continue;

            if (!groups.has(name)) {
                groups.set(name, {
                    name: tx.merchant || tx.description || tx.title || name,
                    category: tx.category || 'Subscription',
                    txs: [],
                });
            }
            groups.get(name).txs.push({
                ...tx,
                dateObj: new Date(tx.date),
                numAmount: Math.abs(Number(tx.amount) || 0),
            });
        }

        const recurringList = [];
        const now = new Date();

        // 2. Evaluate frequency and price variance across history
        for (const [key, grp] of groups.entries()) {
            if (grp.txs.length < 2) continue; // Needs at least 2 occurrences

            // Sort chronologically ascending
            const sorted = [...grp.txs].sort((a, b) => a.dateObj - b.dateObj);
            const intervals = [];
            for (let i = 1; i < sorted.length; i++) {
                const diffDays = Math.round((sorted[i].dateObj - sorted[i - 1].dateObj) / 86400000);
                intervals.push(diffDays);
            }

            // Check if average interval is ~monthly (20-45 days) or ~quarterly/annual
            const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;
            const isMonthlyCandidate = avgInterval >= 20 && avgInterval <= 45;
            const isWeeklyCandidate = avgInterval >= 5 && avgInterval <= 10;
            const isAnnualCandidate = avgInterval >= 330 && avgInterval <= 390;

            if (!isMonthlyCandidate && !isWeeklyCandidate && !isAnnualCandidate) {
                // If it occurred 3+ times with similar amounts, still consider it
                const amounts = sorted.map((t) => t.numAmount);
                const avgAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;
                const amtVariance = amounts.every((a) => Math.abs(a - avgAmt) / (avgAmt || 1) < 0.15);
                if (sorted.length < 3 || !amtVariance) continue;
            }

            const latestTx = sorted[sorted.length - 1];
            const previousTx = sorted[sorted.length - 2];
            const latestAmount = latestTx.numAmount;
            const previousAmount = previousTx.numAmount;

            // Detect price drift / hike
            const hasPriceHike = latestAmount > previousAmount && (latestAmount - previousAmount) / (previousAmount || 1) >= 0.05;
            const hikePercent = hasPriceHike
                ? Math.round(((latestAmount - previousAmount) / previousAmount) * 100)
                : 0;

            // Check if already tracked in Bills
            const isTrackedInBills = existingBills.some((b) => {
                const bName = (b.name || b.provider || '').toLowerCase();
                const sName = grp.name.toLowerCase();
                return bName.includes(sName) || sName.includes(bName);
            });

            // Cadence label
            let frequency = 'monthly';
            if (isWeeklyCandidate) frequency = 'weekly';
            if (isAnnualCandidate) frequency = 'yearly';

            // Calculate annual cost
            let annualMultiplier = 12;
            if (frequency === 'weekly') annualMultiplier = 52;
            if (frequency === 'yearly') annualMultiplier = 1;
            const annualBleed = latestAmount * annualMultiplier;

            // Zombie / dormant heuristic: recurring payment with high frequency or low variation
            const daysSinceLast = Math.round((now - latestTx.dateObj) / 86400000);
            const isZombieCandidate = !isTrackedInBills && daysSinceLast <= 40 && sorted.length >= 3;

            recurringList.push({
                id: key,
                displayName: grp.name,
                category: grp.category,
                latestAmount,
                previousAmount,
                hasPriceHike,
                hikePercent,
                hikeAmount: latestAmount - previousAmount,
                frequency,
                annualBleed,
                occurrences: sorted.length,
                lastBilledDate: latestTx.date,
                isTrackedInBills,
                isZombieCandidate,
                history: sorted.slice(-4),
            });
        }

        return recurringList.sort((a, b) => b.annualBleed - a.annualBleed);
    }, [transactions, existingBills]);

    // Financial Metrics Summary
    const metrics = useMemo(() => {
        const active = auditedSubscriptions.filter((s) => !cancelledSubscriptions.has(s.id));
        const totalMonthlyBleed = active.reduce((sum, s) => {
            if (s.frequency === 'weekly') return sum + s.latestAmount * 4.33;
            if (s.frequency === 'yearly') return sum + s.latestAmount / 12;
            return sum + s.latestAmount;
        }, 0);

        const totalAnnualBleed = active.reduce((sum, s) => sum + s.annualBleed, 0);
        const untrackedCount = active.filter((s) => !s.isTrackedInBills).length;
        const hikeCount = active.filter((s) => s.hasPriceHike).length;

        // Potential savings if cancelled items are removed
        const cancelledTotalAnnualSavings = auditedSubscriptions
            .filter((s) => cancelledSubscriptions.has(s.id))
            .reduce((sum, s) => sum + s.annualBleed, 0);

        return {
            totalSubscriptions: active.length,
            totalMonthlyBleed: Math.round(totalMonthlyBleed),
            totalAnnualBleed: Math.round(totalAnnualBleed),
            untrackedCount,
            hikeCount,
            cancelledTotalAnnualSavings: Math.round(cancelledTotalAnnualSavings),
        };
    }, [auditedSubscriptions, cancelledSubscriptions]);

    // Filtered list
    const filteredList = useMemo(() => {
        return auditedSubscriptions.filter((sub) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                if (!sub.displayName.toLowerCase().includes(q) && !sub.category.toLowerCase().includes(q)) {
                    return false;
                }
            }
            if (filterTab === 'untracked') return !sub.isTrackedInBills && !cancelledSubscriptions.has(sub.id);
            if (filterTab === 'hikes') return sub.hasPriceHike && !cancelledSubscriptions.has(sub.id);
            if (filterTab === 'zombies') return sub.isZombieCandidate && !sub.isTrackedInBills && !cancelledSubscriptions.has(sub.id);
            return true;
        });
    }, [auditedSubscriptions, filterTab, searchQuery, cancelledSubscriptions]);

    const toggleSimulateCancel = (subId) => {
        setCancelledSubscriptions((prev) => {
            const next = new Set(prev);
            if (next.has(subId)) {
                next.delete(subId);
            } else {
                next.add(subId);
            }
            return next;
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Subscription & Recurring Expense Auditor"
            subtitle="Auto-detect silent recurring payments, price hikes, and annual leaks"
            icon={RefreshCw}
            size="xl"
            bodyClassName="p-0 overflow-hidden"
        >
            <div className="flex flex-col max-h-[80vh]">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 gap-3 border-b border-line/60 bg-sunken/40 p-4 sm:grid-cols-4">
                    <div className="rounded-control bg-surface p-3 border border-line/40">
                        <span className="text-[11px] font-semibold text-ink-muted">Monthly Bleed</span>
                        <div className="mt-1 text-base font-extrabold text-ink tnum">
                            {formatCurrency(metrics.totalMonthlyBleed, currency)}
                            <span className="text-[10px] font-normal text-ink-faint">/mo</span>
                        </div>
                    </div>

                    <div className="rounded-control bg-surface p-3 border border-line/40">
                        <span className="text-[11px] font-semibold text-ink-muted">Annualized Impact</span>
                        <div className="mt-1 text-base font-extrabold text-amber-400 tnum">
                            {formatCurrency(metrics.totalAnnualBleed, currency)}
                            <span className="text-[10px] font-normal text-ink-faint">/yr</span>
                        </div>
                    </div>

                    <div className="rounded-control bg-surface p-3 border border-line/40">
                        <span className="text-[11px] font-semibold text-ink-muted">Untracked in Bills</span>
                        <div className="mt-1 text-base font-extrabold text-violet tnum">
                            {metrics.untrackedCount}{' '}
                            <span className="text-[10px] font-normal text-ink-faint">stealth subs</span>
                        </div>
                    </div>

                    <div className="rounded-control bg-surface p-3 border border-line/40">
                        <span className="text-[11px] font-semibold text-ink-muted">Price Increases</span>
                        <div className="mt-1 text-base font-extrabold text-neg tnum">
                            {metrics.hikeCount}{' '}
                            <span className="text-[10px] font-normal text-ink-faint">detected</span>
                        </div>
                    </div>
                </div>

                {/* Simulated Cancellation Savings Alert Banner */}
                {metrics.cancelledTotalAnnualSavings > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-center justify-between bg-emerald-500/10 px-4 py-2.5 border-b border-emerald-500/20 text-xs text-emerald-400"
                    >
                        <div className="flex items-center gap-2">
                            <Sparkles size={15} />
                            <span>
                                <strong>Simulation Active:</strong> You would save{' '}
                                <strong className="tnum font-bold underline">
                                    {formatCurrency(metrics.cancelledTotalAnnualSavings, currency)}/year
                                </strong>{' '}
                                by cutting the selected subscriptions!
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCancelledSubscriptions(new Set())}
                            className="text-[11px] font-bold text-ink-muted hover:text-ink underline"
                        >
                            Reset
                        </button>
                    </motion.div>
                )}

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-line/40 px-4 py-3 bg-surface">
                    <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                        {[
                            { id: 'all', label: `All (${auditedSubscriptions.length})` },
                            { id: 'untracked', label: `Untracked (${metrics.untrackedCount})` },
                            { id: 'hikes', label: `Price Hikes (${metrics.hikeCount})` },
                        ].map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setFilterTab(t.id)}
                                className={cx(
                                    'rounded-control px-2.5 py-1 text-xs font-semibold transition',
                                    filterTab === t.id
                                        ? 'bg-brand/15 text-brand shadow-sm'
                                        : 'bg-sunken text-ink-muted hover:text-ink'
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-2.5 top-2.5 text-ink-faint" />
                        <input
                            type="text"
                            placeholder="Search subscriptions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-control border border-line bg-sunken pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-brand"
                        />
                    </div>
                </div>

                {/* Subscription List */}
                <div className="overflow-y-auto p-4 space-y-2.5 divide-y-0">
                    {filteredList.length === 0 ? (
                        <div className="py-12 text-center text-ink-muted">
                            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400 opacity-60" />
                            <p className="text-sm font-semibold">No subscriptions match your filter</p>
                            <p className="text-xs text-ink-faint mt-0.5">
                                Your recurring expenses appear healthy with no untracked leaks.
                            </p>
                        </div>
                    ) : (
                        filteredList.map((sub) => {
                            const isCancelled = cancelledSubscriptions.has(sub.id);

                            return (
                                <motion.div
                                    key={sub.id}
                                    layout
                                    className={cx(
                                        'group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-control p-3.5 border transition-all duration-200',
                                        isCancelled
                                            ? 'opacity-40 bg-sunken/40 border-line/30 line-through'
                                            : 'bg-surface hover:bg-raised border-line/50 hover:border-line'
                                    )}
                                >
                                    {/* Left: Info */}
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand font-bold text-sm">
                                            {sub.displayName.slice(0, 2).toUpperCase()}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-sm font-bold text-ink truncate capitalize">
                                                    {sub.displayName}
                                                </h4>

                                                {sub.isTrackedInBills ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.2 text-[10px] font-semibold text-emerald-400">
                                                        <CheckCircle2 size={10} /> Tracked in Bills
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.2 text-[10px] font-semibold text-amber-400">
                                                        <AlertTriangle size={10} /> Untracked Stealth Sub
                                                    </span>
                                                )}

                                                {sub.hasPriceHike && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.2 text-[10px] font-bold text-rose-400">
                                                        <TrendingUp size={10} /> +{sub.hikePercent}% Price Hike
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                                                <span>Category: <strong className="text-ink">{sub.category}</strong></span>
                                                <span>•</span>
                                                <span>Billed {sub.occurrences}x</span>
                                                <span>•</span>
                                                <span>Last: {formatDate(sub.lastBilledDate, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Cost & Quick Actions */}
                                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/30">
                                        <div className="text-left sm:text-right">
                                            <div className="text-sm font-extrabold text-ink tnum">
                                                {formatCurrency(sub.latestAmount, currency)}
                                                <span className="text-[11px] font-normal text-ink-muted">/{sub.frequency === 'yearly' ? 'yr' : 'mo'}</span>
                                            </div>
                                            <div className="text-[10px] text-ink-faint tnum">
                                                {formatCurrency(sub.annualBleed, currency)} / year
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {!sub.isTrackedInBills && onAddBill && (
                                                <Button
                                                    size="xs"
                                                    variant="secondary"
                                                    icon={Plus}
                                                    onClick={() => {
                                                        onAddBill({
                                                            name: sub.displayName,
                                                            amount: sub.latestAmount,
                                                            frequency: sub.frequency,
                                                            category: sub.category === 'Subscription' ? 'Other' : sub.category,
                                                        });
                                                    }}
                                                    title="Add this subscription to your Bills tracker"
                                                >
                                                    Track as Bill
                                                </Button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => toggleSimulateCancel(sub.id)}
                                                className={cx(
                                                    'rounded-control px-2.5 py-1 text-xs font-semibold transition',
                                                    isCancelled
                                                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                                        : 'bg-sunken text-ink-muted hover:text-neg hover:bg-neg/10'
                                                )}
                                                title={isCancelled ? 'Re-enable subscription' : 'Simulate cancellation to test runway savings'}
                                            >
                                                {isCancelled ? 'Keep' : 'Simulate Cut'}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

                {/* Footer Insight */}
                <div className="border-t border-line/40 bg-sunken/30 p-3 px-4 text-xs text-ink-muted flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-ink-faint">
                        <Zap size={13} className="text-brand" />
                        Auditor continuously scans all incoming transactions for repeating billing cycles.
                    </span>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default SubscriptionAuditorModal;
