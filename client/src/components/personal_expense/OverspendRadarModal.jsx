import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Radar,
    X,
    ChevronDown,
    ChevronUp,
    SlidersHorizontal,
    AlertCircle,
    CheckCircle2,
    PieChart,
    ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { API_URL } from '../../config';
import { cx } from '../ui/cx';
import { generateMacroForecast } from '../../utils/forecastEngine';
import ForecastSummary from './forecast/ForecastSummary';
import ForecastHeroChart from './forecast/ForecastHeroChart';
import RadarAlert from './forecast/RadarAlert';
import CategoryForecastCard from './forecast/CategoryForecastCard';
import MethodPopover from './forecast/MethodPopover';

/**
 * Month-End Expense Forecast & Overspend Radar Modal
 * Redesigned with pure Asia/Kolkata forecast modeling, single scroll container,
 * zero duplicate metrics/legends/actions, and sleek modern fintech aesthetics.
 */
export function OverspendRadarModal({
    isOpen,
    onClose,
    budgets = [],
    transactions = [],
    bills: propsBills,
    loans: propsLoans,
    currency = 'INR',
    onNavigateBudgets,
}) {
    const { user } = useAuth();

    // Data states for bills & loans if not supplied via props
    const [bills, setBills] = useState(propsBills || []);
    const [loans, setLoans] = useState(propsLoans || []);
    const [loadingObligations, setLoadingObligations] = useState(false);

    // Manual one-off transaction ID overrides
    const [manualOneOffIds, setManualOneOffIds] = useState(new Set());

    // Filter tab: 'all' | 'exceeded' | 'risk' | 'on_track'
    const [activeFilter, setActiveFilter] = useState('all');

    // On-track collapsible section open state
    const [isOnTrackExpanded, setIsOnTrackExpanded] = useState(false);

    // Fetch commitments if needed
    useEffect(() => {
        if (!isOpen || !user?.id) return;

        if (propsBills && propsLoans) {
            setBills(propsBills);
            setLoans(propsLoans);
            return;
        }

        let isMounted = true;
        async function fetchCommitments() {
            setLoadingObligations(true);
            try {
                const [billsRes, loansRes] = await Promise.all([
                    fetch(`${API_URL}/bills/user/${user.id}`, {
                        headers: { Authorization: `Bearer ${user.token}` },
                    }),
                    fetch(`${API_URL}/loans/user/${user.id}`, {
                        headers: { Authorization: `Bearer ${user.token}` },
                    }),
                ]);

                if (!isMounted) return;

                if (billsRes.ok) {
                    const bData = await billsRes.json();
                    setBills(Array.isArray(bData) ? bData : []);
                }
                if (loansRes.ok) {
                    const lData = await loansRes.json();
                    setLoans(Array.isArray(lData) ? lData : []);
                }
            } catch (err) {
                console.warn('Failed to load commitments for forecast modal:', err);
            } finally {
                if (isMounted) setLoadingObligations(false);
            }
        }

        fetchCommitments();
        return () => {
            isMounted = false;
        };
    }, [isOpen, user, propsBills, propsLoans]);

    // Handle Esc key to close modal
    useEffect(() => {
        function handleKeyDown(e) {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Toggle one-off status on transactions
    const handleToggleOneOff = (txId) => {
        if (!txId) return;
        setManualOneOffIds((prev) => {
            const next = new Set(prev);
            if (next.has(txId)) {
                next.delete(txId);
            } else {
                next.add(txId);
            }
            return next;
        });
    };

    // Generate pure mathematical macro forecast
    const macroData = useMemo(() => {
        if (!isOpen) return null;
        return generateMacroForecast({
            budgets,
            transactions,
            bills,
            loans,
            manualOneOffIds,
            now: new Date(),
        });
    }, [isOpen, budgets, transactions, bills, loans, manualOneOffIds]);

    if (!isOpen) return null;

    const {
        asOfSubtitle,
        categoryForecasts = [],
        counts,
        alertMessage,
        timeInfo,
        unbudgetedSpent,
    } = macroData || {};

    // Filter categories based on segmented control
    const filteredCategories = categoryForecasts.filter((c) => {
        if (activeFilter === 'exceeded') {
            return c.state === 'exceeded' || c.state === 'at_limit';
        }
        if (activeFilter === 'risk') {
            return c.state === 'projected_breach' || c.state === 'watch';
        }
        if (activeFilter === 'on_track') {
            return c.state === 'on_track' || c.state === 'insufficient_data';
        }
        return true;
    });

    // In 'all' view, partition into urgent/attention vs on-track categories
    const attentionCategories = categoryForecasts.filter(
        (c) => c.state === 'exceeded' || c.state === 'at_limit' || c.state === 'projected_breach' || c.state === 'watch'
    );
    const onTrackCategories = categoryForecasts.filter(
        (c) => c.state === 'on_track' || c.state === 'insufficient_data'
    );

    const handleAdjustBudgets = () => {
        onClose();
        if (onNavigateBudgets) {
            onNavigateBudgets();
        } else {
            // Default hash or push
            window.location.hash = '#/budgets';
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 lg:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forecast-modal-title"
        >
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Container: Single scroll container with sticky header & summary */}
            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                transition={{ type: 'tween', duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="relative z-10 my-auto flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-[#0c1427] shadow-[0_32px_96px_rgba(0,0,0,0.92)] text-ink"
            >
                {/* Top Subtle Ambient Indicator */}
                <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

                {/* 1. STICKY HEADER */}
                <header className="sticky top-0 z-30 flex items-start justify-between gap-4 border-b border-white/[0.06] bg-[#0c1427]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                            <Radar size={20} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h2 id="forecast-modal-title" className="truncate text-base font-bold tracking-tight text-ink sm:text-lg">
                                Month-End Expense Forecast & Overspend Radar
                            </h2>
                            <p className="mt-0.5 truncate text-xs text-ink-muted">
                                {asOfSubtitle || 'Loading forecast model...'}
                            </p>
                        </div>
                    </div>

                    {/* ONLY CLOSE BUTTON (No footer close) */}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-ink-muted transition hover:bg-white/[0.08] hover:text-ink active:scale-95"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </header>

                {/* 2. SINGLE SCROLL BODY */}
                <div className="custom-dark-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
                    {/* Empty State */}
                    {budgets.length === 0 ? (
                        <div className="my-12 flex flex-col items-center justify-center text-center">
                            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-ink-muted">
                                <PieChart size={24} />
                            </div>
                            <h3 className="mt-4 text-sm font-bold text-ink">No budgets set</h3>
                            <p className="mt-1 max-w-xs text-xs text-ink-muted">
                                Create category budgets to activate intelligent run-rate velocity and overspend radar.
                            </p>
                            <button
                                type="button"
                                onClick={handleAdjustBudgets}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand/90 active:scale-95"
                            >
                                Set Up Budgets
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Summary Row (4 compact macro KPIs) */}
                            <ForecastSummary macroData={macroData} currency={currency} />

                            {/* Single Actionable Alert Banner (Dismissible) */}
                            {alertMessage && <RadarAlert message={alertMessage} />}

                            {/* Hero Cumulative Forecast Chart (with modal's single unified legend) */}
                            <ForecastHeroChart macroData={macroData} currency={currency} />

                            {/* Segmented Filter Control */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.04] pt-4">
                                <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                                    Category Velocity Breakdown
                                </div>

                                {/* Segmented Filter: [All | Exceeded | At risk | On track] */}
                                <div
                                    role="tablist"
                                    aria-label="Forecast category filters"
                                    className="flex items-center rounded-xl bg-surface-raised/70 p-1 text-xs"
                                >
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeFilter === 'all'}
                                        onClick={() => setActiveFilter('all')}
                                        className={cx(
                                            'rounded-lg px-2.5 py-1 font-medium transition',
                                            activeFilter === 'all'
                                                ? 'bg-brand text-white shadow-sm'
                                                : 'text-ink-muted hover:text-ink'
                                        )}
                                    >
                                        All ({counts?.all || 0})
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeFilter === 'exceeded'}
                                        onClick={() => setActiveFilter('exceeded')}
                                        className={cx(
                                            'rounded-lg px-2.5 py-1 font-medium transition',
                                            activeFilter === 'exceeded'
                                                ? 'bg-negative text-white shadow-sm'
                                                : 'text-ink-muted hover:text-ink'
                                        )}
                                    >
                                        Exceeded ({counts?.exceeded || 0})
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeFilter === 'risk'}
                                        onClick={() => setActiveFilter('risk')}
                                        className={cx(
                                            'rounded-lg px-2.5 py-1 font-medium transition',
                                            activeFilter === 'risk'
                                                ? 'bg-warning text-white shadow-sm'
                                                : 'text-ink-muted hover:text-ink'
                                        )}
                                    >
                                        At risk ({(counts?.projected_breach || 0) + (counts?.watch || 0)})
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeFilter === 'on_track'}
                                        onClick={() => setActiveFilter('on_track')}
                                        className={cx(
                                            'rounded-lg px-2.5 py-1 font-medium transition',
                                            activeFilter === 'on_track'
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-ink-muted hover:text-ink'
                                        )}
                                    >
                                        On track ({counts?.on_track || 0})
                                    </button>
                                </div>
                            </div>

                            {/* Category Cards List */}
                            <div className="space-y-3">
                                {activeFilter === 'all' ? (
                                    <>
                                        {/* Attention items rendered open/prominently */}
                                        {attentionCategories.map((c) => (
                                            <CategoryForecastCard
                                                key={c.id || c.category}
                                                categoryForecast={c}
                                                timeInfo={timeInfo}
                                                currency={currency}
                                                onToggleOneOff={handleToggleOneOff}
                                                manualOneOffIds={manualOneOffIds}
                                            />
                                        ))}

                                        {/* On-track categories collapsed into one expandable row */}
                                        {onTrackCategories.length > 0 && (
                                            <div className="overflow-hidden rounded-2xl bg-surface-raised/40">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsOnTrackExpanded((prev) => !prev)}
                                                    aria-expanded={isOnTrackExpanded}
                                                    className="flex w-full items-center justify-between p-4 text-left transition hover:bg-surface-raised/60"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-500/10 text-emerald-400">
                                                            <CheckCircle2 size={14} />
                                                        </span>
                                                        <span className="text-xs font-semibold text-ink">
                                                            {onTrackCategories.length} {onTrackCategories.length === 1 ? 'category' : 'categories'} on track
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-ink-muted">
                                                        <span>{isOnTrackExpanded ? 'Hide' : 'Show all'}</span>
                                                        {isOnTrackExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    </div>
                                                </button>

                                                <AnimatePresence>
                                                    {isOnTrackExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="space-y-3 p-3 pt-0"
                                                        >
                                                            {onTrackCategories.map((c) => (
                                                                <CategoryForecastCard
                                                                    key={c.id || c.category}
                                                                    categoryForecast={c}
                                                                    timeInfo={timeInfo}
                                                                    currency={currency}
                                                                    onToggleOneOff={handleToggleOneOff}
                                                                    manualOneOffIds={manualOneOffIds}
                                                                />
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    filteredCategories.map((c) => (
                                        <CategoryForecastCard
                                            key={c.id || c.category}
                                            categoryForecast={c}
                                            timeInfo={timeInfo}
                                            currency={currency}
                                            onToggleOneOff={handleToggleOneOff}
                                            manualOneOffIds={manualOneOffIds}
                                        />
                                    ))
                                )}

                                {filteredCategories.length === 0 && (
                                    <div className="rounded-xl bg-surface-raised/40 py-8 text-center text-xs text-ink-muted">
                                        No categories match the selected filter.
                                    </div>
                                )}
                            </div>

                            {/* Unbudgeted Spend Clarification Callout (Explicit separation) */}
                            {unbudgetedSpent > 0 && (
                                <div className="flex items-center justify-between rounded-xl bg-surface-sunken/40 px-4 py-2.5 text-xs text-ink-muted">
                                    <span>Unbudgeted category spending this month:</span>
                                    <span className="font-semibold text-ink tabular-nums">
                                        ₹{Math.round(unbudgetedSpent).toLocaleString('en-IN')}
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 3. CLEAN FOOTER (Only "How is this calculated?" popover & "Adjust budgets" action) */}
                <footer className="flex items-center justify-between border-t border-white/[0.06] bg-[#090f1e]/90 px-5 py-3.5 backdrop-blur-md sm:px-6">
                    {/* Popover explaining forecast engine */}
                    <MethodPopover />

                    {/* Single Adjust Budgets Action */}
                    <button
                        type="button"
                        onClick={handleAdjustBudgets}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-white/[0.1] active:scale-95"
                    >
                        <span>Adjust budgets</span>
                        <ExternalLink size={12} aria-hidden="true" />
                    </button>
                </footer>
            </motion.div>
        </div>,
        document.body
    );
}

// Named alias for RadarModal compatibility
export { OverspendRadarModal as RadarModal };
export default OverspendRadarModal;
