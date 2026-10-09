import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Check, Lock, Zap, Clock } from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';

export function LiquidityBreakdownTooltip({
    liquidity = {},
    currency = 'INR'
}) {
    const [open, setOpen] = useState(false);
    const { instant = 0, nearLiquid = 0, locked = 0, totalRunwayLiquid = 0 } = liquidity;

    return (
        <div className="relative inline-block">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                className="text-ink-faint hover:text-ink transition-colors p-0.5 rounded cursor-pointer"
                title="View Liquidity Tier Breakdown"
                aria-label="View Liquidity Tier Breakdown"
            >
                <Info size={13} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3.5 rounded-2xl border border-line-strong bg-surface/95 backdrop-blur-xl shadow-2xl z-30 text-xs text-ink space-y-2.5 pointer-events-auto"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                    >
                        <div className="font-bold text-ink text-[11px] border-b border-line pb-1.5 flex items-center justify-between">
                            <span>Liquidity Tiers Breakdown</span>
                            <span className="text-[10px] text-emerald-400 font-semibold">Tiers 1 & 2 Active</span>
                        </div>

                        {/* Tier 1: Instant */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
                                <Zap size={12} className="text-emerald-400" />
                                <span>Instant (Savings/Cash)</span>
                            </div>
                            <span className="font-bold text-ink tnum">
                                {formatCurrency(instant, currency)}
                            </span>
                        </div>

                        {/* Tier 2: Near-Liquid */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
                                <Clock size={12} className="text-sky-400" />
                                <span>Near-Liquid (Liquid MFs)</span>
                            </div>
                            <span className="font-bold text-ink tnum">
                                {formatCurrency(nearLiquid, currency)}
                            </span>
                        </div>

                        {/* Total in Runway */}
                        <div className="flex items-center justify-between pt-1 border-t border-line text-[11px] font-bold text-brand">
                            <span>Runway Total (T1 + T2)</span>
                            <span className="tnum">{formatCurrency(totalRunwayLiquid, currency)}</span>
                        </div>

                        {/* Tier 3: Locked (Not included) */}
                        {locked > 0 && (
                            <div className="flex items-center justify-between pt-1 border-t border-line text-[10px] text-ink-muted">
                                <div className="flex items-center gap-1.5">
                                    <Lock size={11} className="text-amber-400" />
                                    <span>Locked/FD (Excluded)</span>
                                </div>
                                <span className="tnum">{formatCurrency(locked, currency)}</span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default LiquidityBreakdownTooltip;
