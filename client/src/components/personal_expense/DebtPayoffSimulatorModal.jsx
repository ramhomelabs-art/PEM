import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Flame,
    Snowflake,
    Zap,
    TrendingDown,
    Calendar,
    ArrowRight,
    Trophy,
    Sparkles,
    ShieldCheck,
    CheckCircle2,
    DollarSign,
    Layers,
    Info,
    X,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/primitives';
import { formatCurrency } from '../../utils/currency';
import { cx } from '../ui/cx';

export function DebtPayoffSimulatorModal({
    isOpen,
    onClose,
    loans = [],
    currency = 'INR',
}) {
    const [extraPayment, setExtraPayment] = useState(3000);
    const [strategy, setStrategy] = useState('avalanche'); // 'avalanche' | 'snowball'

    // Filter active loans
    const activeDebts = useMemo(() => {
        return (loans || [])
            .filter((l) => l.status !== 'closed' && Number(l.remainingAmount) > 0)
            .map((l) => ({
                id: l.id,
                name: l.name,
                provider: l.bankProvider || 'Bank',
                balance: Number(l.remainingAmount),
                rate: Number(l.interestRate) || 10,
                minEmi: Number(l.emiAmount) || Math.round((Number(l.remainingAmount) * 0.1) / 12),
            }));
    }, [loans]);

    // Simulation Engine for Baseline, Snowball, and Avalanche
    const simulation = useMemo(() => {
        if (activeDebts.length === 0) {
            return {
                baseline: { months: 0, interest: 0 },
                snowball: { months: 0, interest: 0, sequence: [] },
                avalanche: { months: 0, interest: 0, sequence: [] },
            };
        }

        const runSim = (orderFn, extraAmt) => {
            // Deep clone debts
            const debts = activeDebts.map((d) => ({ ...d }));
            debts.sort(orderFn);

            let months = 0;
            let totalInterest = 0;
            const payoffSequence = [];
            let freedPayment = 0;
            const maxMonths = 360;

            while (debts.some((d) => d.balance > 0) && months < maxMonths) {
                months += 1;
                let availableExtra = extraAmt + freedPayment;

                // 1. Accrue monthly interest
                for (const d of debts) {
                    if (d.balance > 0) {
                        const monthlyInterest = d.balance * (d.rate / 12 / 100);
                        d.balance += monthlyInterest;
                        totalInterest += monthlyInterest;
                    }
                }

                // 2. Pay minimums
                for (const d of debts) {
                    if (d.balance > 0) {
                        const payment = Math.min(d.minEmi, d.balance);
                        d.balance -= payment;
                        if (d.balance <= 0.01) {
                            d.balance = 0;
                            freedPayment += d.minEmi;
                            payoffSequence.push({
                                id: d.id,
                                name: d.name,
                                month: months,
                                provider: d.provider,
                            });
                        }
                    }
                }

                // 3. Apply extra payment to the target debt in priority order
                for (const d of debts) {
                    if (d.balance > 0 && availableExtra > 0) {
                        const extraApplied = Math.min(availableExtra, d.balance);
                        d.balance -= extraApplied;
                        availableExtra -= extraApplied;
                        if (d.balance <= 0.01) {
                            d.balance = 0;
                            freedPayment += d.minEmi;
                            if (!payoffSequence.find((p) => p.id === d.id)) {
                                payoffSequence.push({
                                    id: d.id,
                                    name: d.name,
                                    month: months,
                                    provider: d.provider,
                                });
                            }
                        }
                    }
                }
            }

            return {
                months,
                interest: Math.round(totalInterest),
                sequence: payoffSequence,
            };
        };

        // Baseline: no extra payment, natural order
        const baseline = runSim(() => 0, 0);

        // Snowball: lowest balance first
        const snowball = runSim((a, b) => a.balance - b.balance, Number(extraPayment) || 0);

        // Avalanche: highest APR first
        const avalanche = runSim((a, b) => b.rate - a.rate, Number(extraPayment) || 0);

        return { baseline, snowball, avalanche };
    }, [activeDebts, extraPayment]);

    const activePlan = strategy === 'avalanche' ? simulation.avalanche : simulation.snowball;
    const interestSaved = Math.max(0, simulation.baseline.interest - activePlan.interest);
    const monthsSaved = Math.max(0, simulation.baseline.months - activePlan.months);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Debt Payoff Strategy Simulator"
            subtitle="Compare Snowball vs. Avalanche payoff models across your liabilities"
            icon={Zap}
            size="lg"
            bodyClassName="space-y-4"
        >
            {activeDebts.length === 0 ? (
                <div className="py-8 text-center">
                    <Trophy size={42} className="mx-auto mb-2 text-pos opacity-90" />
                    <h3 className="text-base font-bold text-ink">Zero Active Debts!</h3>
                    <p className="text-xs text-ink-muted">
                        You have no outstanding loans or liabilities to pay off.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Strategy Switcher */}
                    <div className="grid grid-cols-2 gap-2 rounded-control bg-sunken p-1">
                        <button
                            type="button"
                            onClick={() => setStrategy('avalanche')}
                            className={cx(
                                'flex items-center justify-center gap-2 rounded-control py-2 text-xs font-bold transition active:scale-98',
                                strategy === 'avalanche'
                                    ? 'bg-brand text-slate-950 shadow-sm'
                                    : 'text-ink-muted hover:text-ink'
                            )}
                        >
                            <Flame size={15} />
                            <span>Debt Avalanche (Save Max ₹)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setStrategy('snowball')}
                            className={cx(
                                'flex items-center justify-center gap-2 rounded-control py-2 text-xs font-bold transition active:scale-98',
                                strategy === 'snowball'
                                    ? 'bg-brand text-slate-950 shadow-sm'
                                    : 'text-ink-muted hover:text-ink'
                            )}
                        >
                            <Snowflake size={15} />
                            <span>Debt Snowball (Quick Wins)</span>
                        </button>
                    </div>

                    {/* Strategy Description Banner */}
                    <div className="rounded-control bg-surface p-3.5 text-xs leading-relaxed text-ink-muted">
                        {strategy === 'avalanche' ? (
                            <p>
                                <strong>Avalanche Focus:</strong> Targets debts with the{' '}
                                <span className="text-brand font-bold">highest interest rate first</span>.
                                Mathematically optimal to minimize overall interest paid and get out of debt fastest.
                            </p>
                        ) : (
                            <p>
                                <strong>Snowball Focus:</strong> Knocks out the{' '}
                                <span className="text-brand font-bold">smallest balance first</span>.
                                Provides rapid psychological momentum and frees up cash flow early.
                            </p>
                        )}
                    </div>

                    {/* Extra Monthly Payment Slider / Input */}
                    <div className="rounded-card bg-surface p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-ink-faint">
                                    Extra Monthly Contribution
                                </label>
                                <p className="text-[11px] text-ink-muted">
                                    Additional cash allocated to debt payoff each month
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="tnum text-lg font-extrabold text-brand">
                                    +{formatCurrency(extraPayment, currency)}
                                </span>
                                <span className="text-xs text-ink-muted font-medium"> / mo</span>
                            </div>
                        </div>

                        <input
                            type="range"
                            min="0"
                            max="25000"
                            step="500"
                            value={extraPayment}
                            onChange={(e) => setExtraPayment(Number(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer"
                        />

                        {/* Quick Preset Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {[1000, 2500, 5000, 10000].map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setExtraPayment(preset)}
                                    className={cx(
                                        'rounded-control px-2.5 py-1 text-xs font-bold transition',
                                        extraPayment === preset
                                            ? 'bg-brand/20 text-brand'
                                            : 'bg-sunken text-ink-muted hover:text-ink'
                                    )}
                                >
                                    +{formatCurrency(preset, currency)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payoff Comparison Summary Cards */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-card bg-surface p-3.5">
                            <span className="text-[11px] font-bold uppercase text-ink-faint">
                                Months to Debt-Free
                            </span>
                            <div className="mt-1 flex items-baseline gap-1.5">
                                <span className="tnum text-2xl font-extrabold text-ink">
                                    {activePlan.months}
                                </span>
                                <span className="text-xs font-semibold text-ink-muted">months</span>
                            </div>
                            {monthsSaved > 0 && (
                                <p className="mt-1 text-[11px] font-bold text-pos">
                                    ⚡ {monthsSaved} months sooner
                                </p>
                            )}
                        </div>

                        <div className="rounded-card bg-surface p-3.5">
                            <span className="text-[11px] font-bold uppercase text-ink-faint">
                                Total Interest Paid
                            </span>
                            <div className="mt-1">
                                <span className="tnum text-xl font-extrabold text-ink">
                                    {formatCurrency(activePlan.interest, currency)}
                                </span>
                            </div>
                            <p className="mt-1 text-[11px] text-ink-faint">
                                vs {formatCurrency(simulation.baseline.interest, currency)} standard
                            </p>
                        </div>

                        <div className="rounded-card bg-emerald-500/10 p-3.5">
                            <span className="text-[11px] font-bold uppercase text-emerald-400">
                                Total Interest Saved
                            </span>
                            <div className="mt-1">
                                <span className="tnum text-2xl font-extrabold text-emerald-400">
                                    {formatCurrency(interestSaved, currency)}
                                </span>
                            </div>
                            <p className="mt-1 text-[11px] font-medium text-emerald-300/80">
                                Kept in your pocket!
                            </p>
                        </div>
                    </div>

                    {/* Roadmap: Sequence of Payoff */}
                    <div className="rounded-card bg-surface p-4">
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink">
                            Target Payoff Sequence
                        </h4>
                        <div className="space-y-2">
                            {activePlan.sequence.length > 0 ? (
                                activePlan.sequence.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between rounded-control bg-sunken/80 px-3 py-2 text-xs"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className="grid h-5 w-5 place-items-center rounded-full bg-brand/20 text-[10px] font-extrabold text-brand">
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <p className="font-bold text-ink">{item.name}</p>
                                                <p className="text-[10px] text-ink-muted">{item.provider}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-pos/15 px-2 py-0.5 text-[10px] font-bold text-pos">
                                                <CheckCircle2 size={11} /> Cleared in {item.month} mo
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-ink-muted">Simulating payoff roadmap...</p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-1">
                        <Button variant="secondary" onClick={onClose} className="border-0 bg-surface hover:bg-raised">
                            Close Simulator
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

export default DebtPayoffSimulatorModal;
