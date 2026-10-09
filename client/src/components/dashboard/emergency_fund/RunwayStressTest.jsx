import React, { useState, useMemo } from 'react';
import { AlertTriangle, Flame, ShieldAlert, Zap, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';
import { simulateStressTest } from '../../../utils/emergencyFundCalculator';

export function RunwayStressTest({
    totalLiquid = 0,
    essentialMonthlyBurn = 0,
    lifestyleMonthlyBurn = 0,
    currency = 'INR'
}) {
    const [incomeLoss, setIncomeLoss] = useState(true);
    const [essentialsOnly, setEssentialsOnly] = useState(true);
    const [shockAmount, setShockAmount] = useState(50000);

    const simulation = useMemo(() => {
        return simulateStressTest({
            totalLiquid,
            essentialMonthlyBurn,
            lifestyleMonthlyBurn,
            incomeLoss,
            essentialsOnly,
            shockAmount: Number(shockAmount) || 0
        });
    }, [totalLiquid, essentialMonthlyBurn, lifestyleMonthlyBurn, incomeLoss, essentialsOnly, shockAmount]);

    const handleReset = () => {
        setIncomeLoss(true);
        setEssentialsOnly(true);
        setShockAmount(50000);
    };

    return (
        <div className="rounded-2xl border border-line bg-sunken/60 p-4 sm:p-5 text-xs text-ink-muted space-y-4 backdrop-blur-md shadow-inner">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                        <ShieldAlert size={16} />
                    </div>
                    <div>
                        <h4 className="font-bold text-ink text-sm">Interactive Stress Test Simulator</h4>
                        <p className="text-[11px] text-ink-muted">
                            Model instant shocks to evaluate your real-world financial survival threshold.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleReset}
                    className="text-[11px] text-brand hover:text-brand-soft hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                    <RefreshCw size={12} />
                    <span>Reset</span>
                </button>
            </div>

            {/* Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Control 1: Complete Income Stop */}
                <div className="p-3.5 rounded-xl bg-surface/70 border border-line hover:border-line-strong transition-colors flex flex-col justify-between shadow-sm">
                    <span className="font-semibold text-ink text-[11px] flex items-center gap-1.5 mb-2">
                        <Flame size={13} className="text-amber-400" />
                        Income Halts 100%
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={incomeLoss}
                            onChange={(e) => setIncomeLoss(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-rose-500"></div>
                        <span className="ml-2 text-[10px] text-ink-muted">Zero earnings</span>
                    </label>
                </div>

                {/* Control 2: Freeze to Essentials Only */}
                <div className="p-3.5 rounded-xl bg-surface/70 border border-line hover:border-line-strong transition-colors flex flex-col justify-between shadow-sm">
                    <span className="font-semibold text-ink text-[11px] flex items-center gap-1.5 mb-2">
                        <Zap size={13} className="text-emerald-400" />
                        Cut Discretionary Spend
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={essentialsOnly}
                            onChange={(e) => setEssentialsOnly(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span className="ml-2 text-[10px] text-ink-muted">
                            {essentialsOnly ? 'Essentials only' : 'All spending'}
                        </span>
                    </label>
                </div>

                {/* Control 3: Immediate Financial Shock Amount */}
                <div className="p-3.5 rounded-xl bg-surface/70 border border-line hover:border-line-strong transition-colors flex flex-col justify-between shadow-sm">
                    <label htmlFor="shock-input" className="font-semibold text-ink text-[11px] flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle size={13} className="text-rose-400" />
                        Unforeseen Shock
                    </label>
                    <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint text-xs">₹</span>
                        <input
                            id="shock-input"
                            type="number"
                            min="0"
                            step="10000"
                            value={shockAmount}
                            onChange={(e) => setShockAmount(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full pl-6 pr-2.5 py-1.5 bg-sunken/80 border border-line-strong rounded-lg text-ink font-mono text-xs focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40 transition-all"
                            placeholder="50,000"
                        />
                    </div>
                </div>
            </div>

            {/* Simulation Results Comparison */}
            <div className="p-3.5 rounded-xl bg-surface/90 border border-line flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div>
                    <div className="text-[11px] text-ink-muted font-medium">Post-Shock Projected Runway</div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-xl font-extrabold text-ink tnum">
                            {simulation.simulatedMonthsFormatted} Months
                        </span>
                        <span className="text-xs text-ink-muted font-medium">
                            ({simulation.simulatedDays} days)
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${Number(simulation.deltaMonths) < 0 ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400' : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'}`}>
                            {simulation.deltaMonthsFormatted} Mo impact
                        </span>
                    </div>
                </div>

                <div className="text-right text-[11px] text-ink-muted">
                    <div>Remaining Liquid: <strong className="text-ink font-mono">{formatCurrency(simulation.postShockLiquid, currency)}</strong></div>
                    <div>Simulated Burn: <strong className="text-ink font-mono">{formatCurrency(simulation.effectiveMonthlyBurn, currency)}/mo</strong></div>
                </div>
            </div>
        </div>
    );
}

export default RunwayStressTest;
