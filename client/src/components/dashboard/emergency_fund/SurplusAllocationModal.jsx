import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles, X, ArrowRight, TrendingUp, ShieldCheck,
    Target, Compass, AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';

export function SurplusAllocationModal({
    isOpen = false,
    onClose,
    surplusAmount = 0,
    currency = 'INR'
}) {
    const navigate = useNavigate();
    if (!isOpen) return null;

    // Suggested institutional allocation split
    const equitySplit = Math.round(surplusAmount * 0.50);
    const debtSplit = Math.round(surplusAmount * 0.30);
    const goalsSplit = Math.round(surplusAmount * 0.20);

    const handleNavigateInvestments = () => {
        onClose?.();
        navigate('/investments');
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    className="fixed inset-0 bg-sunken/80 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                />

                {/* Modal Container */}
                <motion.div
                    className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-500/30 bg-surface p-6 shadow-2xl z-10 text-ink"
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-400">
                                <Sparkles size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black tracking-tight text-ink">
                                    Surplus Deployment Blueprint
                                </h3>
                                <p className="text-xs text-ink-muted">
                                    Put idle emergency cash above your target to work
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl p-1.5 text-ink-muted hover:bg-line hover:text-ink transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Total Surplus Banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-amber-500/20 mb-5 flex items-center justify-between">
                        <div>
                            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                                Unencumbered Excess Liquid
                            </span>
                            <div className="text-2xl font-black text-ink mt-0.5 tnum">
                                {formatCurrency(surplusAmount, currency)}
                            </div>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                            Available to deploy
                        </span>
                    </div>

                    {/* Suggested Rule-of-Thumb Split */}
                    <div className="space-y-3 mb-5">
                        <div className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                            Suggested 50 / 30 / 20 Deployment Model
                        </div>

                        {/* Bucket 1: 50% Equity Index */}
                        <div className="p-3.5 rounded-2xl bg-sunken/70 border border-line flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                                    <TrendingUp size={16} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-ink">50% Broad Market Index Funds</div>
                                    <div className="text-[11px] text-ink-muted">Long-term wealth compounding (Nifty 50 / S&P 500)</div>
                                </div>
                            </div>
                            <span className="font-extrabold text-sm text-emerald-400 tnum">
                                {formatCurrency(equitySplit, currency)}
                            </span>
                        </div>

                        {/* Bucket 2: 30% Short-term Debt / Arbitrage */}
                        <div className="p-3.5 rounded-2xl bg-sunken/70 border border-line flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
                                    <ShieldCheck size={16} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-ink">30% Arbitrage / Short Duration Debt</div>
                                    <div className="text-[11px] text-ink-muted">Capital stability & tax-efficient parking</div>
                                </div>
                            </div>
                            <span className="font-extrabold text-sm text-sky-400 tnum">
                                {formatCurrency(debtSplit, currency)}
                            </span>
                        </div>

                        {/* Bucket 3: 20% Life Goals */}
                        <div className="p-3.5 rounded-2xl bg-sunken/70 border border-line flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                                    <Target size={16} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-ink">20% Goal Bucket / Sinking Fund</div>
                                    <div className="text-[11px] text-ink-muted">Travel, electronics, skill building, or car maintenance</div>
                                </div>
                            </div>
                            <span className="font-extrabold text-sm text-purple-400 tnum">
                                {formatCurrency(goalsSplit, currency)}
                            </span>
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="p-3 rounded-xl bg-sunken/40 border border-line text-[10px] text-ink-muted leading-relaxed mb-5 flex items-start gap-2">
                        <AlertCircle size={14} className="text-amber-400/80 shrink-0 mt-0.5" />
                        <span>
                            Disclaimer: These suggested proportions follow standard personal finance principles for illustration only and do not constitute registered financial advisory advice.
                        </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-line text-xs font-semibold text-ink-muted hover:bg-line transition-colors cursor-pointer"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={handleNavigateInvestments}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                        >
                            <span>Explore Investments</span>
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

export default SurplusAllocationModal;
