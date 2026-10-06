import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    Calendar,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    AlertTriangle,
    CheckCircle2,
    Sliders,
    Zap,
    Plus,
    X,
    Laptop,
    Plane,
    Briefcase,
    ShoppingBag,
    HelpCircle,
    Info,
    ChevronRight,
    RotateCcw,
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine,
} from 'recharts';
import { formatCurrency } from '../../utils/currency';
import { cx } from '../ui/cx';

const PRESET_SCENARIOS = [
    {
        id: 'big-purchase-emi',
        title: 'Buy Gadget / Laptop (EMI)',
        icon: Laptop,
        category: 'Purchase',
        desc: '₹1,20,000 item on 6-month EMI',
        defaults: {
            name: 'New Laptop / Phone',
            type: 'emi',
            amount: 120000,
            months: 6,
            interestRate: 0,
            downPayment: 20000,
            incomeChange: 0,
            expenseCutPct: 0,
        },
    },
    {
        id: 'vacation-trip',
        title: 'Dream Vacation Trip',
        icon: Plane,
        category: 'Expense',
        desc: 'One-off ₹75,000 expense in Month 2',
        defaults: {
            name: 'Vacation Getaway',
            type: 'upfront',
            amount: 75000,
            monthOffset: 2,
            months: 1,
            interestRate: 0,
            downPayment: 75000,
            incomeChange: 0,
            expenseCutPct: 0,
        },
    },
    {
        id: 'salary-hike',
        title: 'Salary Hike / Promotion',
        icon: Briefcase,
        category: 'Income',
        desc: '+₹25,000 extra monthly income',
        defaults: {
            name: 'Promotion / New Job',
            type: 'income',
            amount: 0,
            months: 12,
            interestRate: 0,
            downPayment: 0,
            incomeChange: 25000,
            expenseCutPct: 0,
        },
    },
    {
        id: 'lifestyle-diet',
        title: 'Frugal Month (-25% Dining/Shop)',
        icon: ShoppingBag,
        category: 'Savings',
        desc: 'Reduce discretionary spend by 25%',
        defaults: {
            name: 'Dining & Shopping Cut',
            type: 'expense_cut',
            amount: 0,
            months: 12,
            interestRate: 0,
            downPayment: 0,
            incomeChange: 0,
            expenseCutPct: 25,
        },
    },
];

export function FinancialTimeMachineModal({
    isOpen,
    onClose,
    currentBalance = 37500,
    monthlyIncome = 85000,
    monthlyExpense = 45000,
    currency = 'INR',
}) {
    const [scenarioType, setScenarioType] = useState('emi'); // 'upfront', 'emi', 'income', 'expense_cut', 'custom'
    const [scenarioName, setScenarioName] = useState('Tech Gadget (EMI)');
    const [purchaseAmount, setPurchaseAmount] = useState(120000);
    const [downPayment, setDownPayment] = useState(20000);
    const [emiTenure, setEmiTenure] = useState(6);
    const [interestRate, setInterestRate] = useState(0);
    const [incomeDelta, setIncomeDelta] = useState(0);
    const [expenseCutPct, setExpenseCutPct] = useState(0);
    const [forecastMonths, setForecastMonths] = useState(12);

    const applyPreset = (preset) => {
        setScenarioType(preset.defaults.type);
        setScenarioName(preset.defaults.name);
        setPurchaseAmount(preset.defaults.amount);
        setDownPayment(preset.defaults.downPayment || 0);
        setEmiTenure(preset.defaults.months || 6);
        setInterestRate(preset.defaults.interestRate || 0);
        setIncomeDelta(preset.defaults.incomeChange || 0);
        setExpenseCutPct(preset.defaults.expenseCutPct || 0);
    };

    // Calculate 12-Month Projections
    const simulation = useMemo(() => {
        const netBaseSavingsPerMonth = monthlyIncome - monthlyExpense;
        const loanPrincipal = Math.max(0, purchaseAmount - downPayment);
        const monthlyInterest = interestRate > 0 ? (loanPrincipal * (interestRate / 100)) / emiTenure : 0;
        const monthlyEmi = emiTenure > 0 && scenarioType === 'emi' ? Math.round((loanPrincipal / emiTenure) + monthlyInterest) : 0;

        const monthlyCutSavings = (monthlyExpense * (expenseCutPct / 100));
        const effectiveNetMonthly = netBaseSavingsPerMonth + incomeDelta + monthlyCutSavings;

        let baselineBalance = currentBalance;
        let simulatedBalance = currentBalance;
        let lowestSimulatedBalance = currentBalance;
        let dangerMonth = null;

        const timeline = [];

        for (let m = 1; m <= forecastMonths; m++) {
            // Baseline trajectory (status quo)
            baselineBalance += netBaseSavingsPerMonth;

            // Scenario impact this month
            let monthImpact = effectiveNetMonthly;

            if (scenarioType === 'upfront' && m === 1) {
                monthImpact -= purchaseAmount;
            } else if (scenarioType === 'emi') {
                if (m === 1 && downPayment > 0) {
                    monthImpact -= downPayment;
                }
                if (m <= emiTenure) {
                    monthImpact -= monthlyEmi;
                }
            }

            simulatedBalance += monthImpact;

            if (simulatedBalance < lowestSimulatedBalance) {
                lowestSimulatedBalance = simulatedBalance;
            }
            if (simulatedBalance < 10000 && !dangerMonth) {
                dangerMonth = m;
            }

            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const now = new Date();
            const dateObj = new Date(now.getFullYear(), now.getMonth() + m, 1);
            const label = `${monthNames[dateObj.getMonth()]} '${String(dateObj.getFullYear()).slice(2)}`;

            timeline.push({
                month: m,
                label,
                baseline: Math.round(baselineBalance),
                simulated: Math.round(simulatedBalance),
                difference: Math.round(simulatedBalance - baselineBalance),
            });
        }

        const finalBaseline = timeline[timeline.length - 1]?.baseline || 0;
        const finalSimulated = timeline[timeline.length - 1]?.simulated || 0;
        const netDifference = finalSimulated - finalBaseline;

        return {
            monthlyEmi,
            monthlyCutSavings,
            lowestSimulatedBalance,
            dangerMonth,
            finalBaseline,
            finalSimulated,
            netDifference,
            timeline,
            isFeasible: lowestSimulatedBalance >= 15000,
        };
    }, [
        currentBalance,
        monthlyIncome,
        monthlyExpense,
        scenarioType,
        purchaseAmount,
        downPayment,
        emiTenure,
        interestRate,
        incomeDelta,
        expenseCutPct,
        forecastMonths,
    ]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/85 backdrop-blur-md"
                />

                {/* Modal Window */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-[#0c1427] shadow-[0_24px_80px_rgba(0,0,0,0.95)] z-10 my-6 flex flex-col max-h-[92vh]"
                >
                    {/* Top ambient highlight */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-teal-400 via-brand to-violet-500 opacity-90" />

                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#080e1d] px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400/20 to-violet-500/20 text-teal-300 shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                                <Sparkles size={20} />
                            </span>
                            <div>
                                <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                                    "What-If" Financial Time Machine
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full">
                                        Future Simulator
                                    </span>
                                </h3>
                                <p className="text-xs text-ink-muted">
                                    Simulate major purchases, EMIs, salary hikes & lifestyle cuts over 12 months.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.04] text-ink-muted hover:bg-white/[0.08] hover:text-white transition"
                        >
                            <X size={17} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-[#0c1427]">
                        {/* 1. Quick Presets */}
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-ink-faint block mb-2.5">
                                Select or Customize Scenario
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {PRESET_SCENARIOS.map((preset) => {
                                    const Icon = preset.icon;
                                    const isSelected = scenarioName === preset.defaults.name;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => applyPreset(preset)}
                                            className={cx(
                                                'flex flex-col items-start p-3 rounded-2xl transition text-left relative overflow-hidden',
                                                isSelected
                                                    ? 'bg-gradient-to-br from-teal-500/20 to-[#101a33] border border-teal-500/40 shadow-[0_0_20px_rgba(20,184,166,0.15)]'
                                                    : 'bg-[#101a33] hover:bg-[#152243]'
                                            )}
                                        >
                                            <div className="flex items-center justify-between w-full mb-1.5">
                                                <span className={cx('grid h-7 w-7 place-items-center rounded-xl', isSelected ? 'bg-teal-400/20 text-teal-300' : 'bg-white/[0.05] text-ink-muted')}>
                                                    <Icon size={14} />
                                                </span>
                                                <span className="text-[10px] font-bold text-ink-faint uppercase">
                                                    {preset.category}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-white leading-tight">
                                                {preset.title}
                                            </p>
                                            <p className="mt-1 text-[11px] text-ink-muted line-clamp-1">
                                                {preset.desc}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. Interactive Simulator Controls */}
                        <div className="rounded-2xl bg-[#101a33] p-4 sm:p-5 shadow-inner">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                                    <Sliders size={14} className="text-teal-400" />
                                    Configure Simulation Parameters
                                </h4>
                                <div className="inline-flex rounded-xl bg-[#080e1d] p-1 gap-1">
                                    {[
                                        { id: 'emi', label: 'EMI Purchase' },
                                        { id: 'upfront', label: 'Upfront Cash' },
                                        { id: 'income', label: 'Income Change' },
                                        { id: 'expense_cut', label: 'Budget Cut' },
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => setScenarioType(mode.id)}
                                            className={cx(
                                                'px-3 py-1 text-xs font-bold rounded-lg transition',
                                                scenarioType === mode.id
                                                    ? 'bg-teal-500/20 text-teal-300 shadow-sm'
                                                    : 'text-ink-muted hover:text-white'
                                            )}
                                        >
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dynamic Inputs Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                                {(scenarioType === 'emi' || scenarioType === 'upfront') && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-ink-muted">Purchase Amount</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={purchaseAmount}
                                                    onChange={(e) => setPurchaseAmount(Number(e.target.value) || 0)}
                                                    className="w-full rounded-xl bg-[#080e1d] px-3.5 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-teal-400"
                                                />
                                            </div>
                                        </div>

                                        {scenarioType === 'emi' && (
                                            <>
                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-semibold text-ink-muted">Down Payment</label>
                                                    <input
                                                        type="number"
                                                        value={downPayment}
                                                        onChange={(e) => setDownPayment(Number(e.target.value) || 0)}
                                                        className="w-full rounded-xl bg-[#080e1d] px-3.5 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-teal-400"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-semibold text-ink-muted">Tenure (Months)</label>
                                                    <select
                                                        value={emiTenure}
                                                        onChange={(e) => setEmiTenure(Number(e.target.value))}
                                                        className="w-full rounded-xl bg-[#080e1d] px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer"
                                                    >
                                                        <option value={3}>3 Months</option>
                                                        <option value={6}>6 Months</option>
                                                        <option value={9}>9 Months</option>
                                                        <option value={12}>12 Months</option>
                                                        <option value={18}>18 Months</option>
                                                        <option value={24}>24 Months</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-semibold text-ink-muted">Interest Rate (Annual %)</label>
                                                    <input
                                                        type="number"
                                                        value={interestRate}
                                                        onChange={(e) => setInterestRate(Number(e.target.value) || 0)}
                                                        className="w-full rounded-xl bg-[#080e1d] px-3.5 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-teal-400"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}

                                {scenarioType === 'income' && (
                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[11px] font-semibold text-ink-muted">Monthly Income Increase (+/-)</label>
                                        <input
                                            type="number"
                                            value={incomeDelta}
                                            onChange={(e) => setIncomeDelta(Number(e.target.value) || 0)}
                                            placeholder="+25000"
                                            className="w-full rounded-xl bg-[#080e1d] px-3.5 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-teal-400"
                                        />
                                    </div>
                                )}

                                {scenarioType === 'expense_cut' && (
                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[11px] font-semibold text-ink-muted">Discretionary Expense Reduction (%): {expenseCutPct}%</label>
                                        <input
                                            type="range"
                                            min="5"
                                            max="50"
                                            step="5"
                                            value={expenseCutPct}
                                            onChange={(e) => setExpenseCutPct(Number(e.target.value))}
                                            className="w-full accent-teal-400 cursor-pointer mt-2"
                                        />
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-ink-muted">Forecast Horizon</label>
                                    <select
                                        value={forecastMonths}
                                        onChange={(e) => setForecastMonths(Number(e.target.value))}
                                        className="w-full rounded-xl bg-[#080e1d] px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer"
                                    >
                                        <option value={6}>6 Months</option>
                                        <option value={12}>12 Months (1 Year)</option>
                                        <option value={24}>24 Months (2 Years)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 3. Real-Time Projections Chart */}
                        <div className="rounded-2xl bg-[#101a33] p-4 sm:p-5 shadow-inner space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                        Projected Bank Balance Trajectory
                                    </h4>
                                    <p className="text-[11px] text-ink-muted">
                                        Comparing status quo vs this scenario over {forecastMonths} months
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-bold">
                                    <span className="flex items-center gap-1.5 text-ink-muted">
                                        <span className="h-2 w-2 rounded-full bg-slate-500" />
                                        Status Quo
                                    </span>
                                    <span className="flex items-center gap-1.5 text-teal-300">
                                        <span className="h-2 w-2 rounded-full bg-teal-400" />
                                        Projected Horizon
                                    </span>
                                </div>
                            </div>

                            <div className="h-64 w-full pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={simulation.timeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                                            </linearGradient>
                                            <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                                        <YAxis
                                            stroke="#64748b"
                                            fontSize={11}
                                            tickLine={false}
                                            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const d = payload[0].payload;
                                                    return (
                                                        <div className="rounded-xl bg-[#080e1d] p-3 shadow-2xl border border-white/[0.08] text-xs space-y-1">
                                                            <p className="font-extrabold text-white">{d.label} (Month {d.month})</p>
                                                            <p className="text-teal-300 font-bold">
                                                                Projected: {formatCurrency(d.simulated, currency)}
                                                            </p>
                                                            <p className="text-slate-400">
                                                                Status Quo: {formatCurrency(d.baseline, currency)}
                                                            </p>
                                                            <p className={cx('font-bold', d.difference >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                                                Impact: {d.difference >= 0 ? '+' : ''}{formatCurrency(d.difference, currency)}
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area type="monotone" dataKey="baseline" stroke="#64748b" strokeWidth={2} fill="url(#baseGrad)" />
                                        <Area type="monotone" dataKey="simulated" stroke="#14b8a6" strokeWidth={2.5} fill="url(#simGrad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 4. Verdict & Impact Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-2xl bg-[#101a33] p-4 flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    Lowest Projected Balance
                                </span>
                                <p className={cx('text-lg font-black tnum mt-1', simulation.lowestSimulatedBalance < 15000 ? 'text-amber-400' : 'text-emerald-400')}>
                                    {formatCurrency(simulation.lowestSimulatedBalance, currency)}
                                </p>
                                <span className="text-[11px] font-medium text-ink-muted mt-1">
                                    {simulation.lowestSimulatedBalance < 15000
                                        ? `⚠️ Danger zone in Month ${simulation.dangerMonth || 1}`
                                        : '✅ Stays above safety cushion'}
                                </span>
                            </div>

                            <div className="rounded-2xl bg-[#101a33] p-4 flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    Final Balance at Month {forecastMonths}
                                </span>
                                <p className="text-lg font-black tnum text-white mt-1">
                                    {formatCurrency(simulation.finalSimulated, currency)}
                                </p>
                                <span className={cx('text-[11px] font-bold mt-1', simulation.netDifference >= 0 ? 'text-emerald-400' : 'text-ink-muted')}>
                                    {simulation.netDifference >= 0 ? '+' : ''}{formatCurrency(simulation.netDifference, currency)} vs status quo
                                </span>
                            </div>

                            <div className="rounded-2xl bg-[#101a33] p-4 flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    Decision Verdict
                                </span>
                                <div className="mt-1 flex items-center gap-1.5">
                                    {simulation.isFeasible ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full">
                                            <CheckCircle2 size={13} />
                                            Safe &amp; Affordable
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs font-black text-rose-400 bg-rose-500/20 px-2.5 py-1 rounded-full">
                                            <AlertTriangle size={13} />
                                            High Cash Risk
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] font-medium text-ink-muted mt-1">
                                    {scenarioType === 'emi' && `Monthly EMI of ${formatCurrency(simulation.monthlyEmi, currency)} for ${emiTenure} months.`}
                                    {scenarioType === 'upfront' && `One-time cash outflow of ${formatCurrency(purchaseAmount, currency)}.`}
                                    {scenarioType === 'expense_cut' && `Saves ${formatCurrency(simulation.monthlyCutSavings, currency)}/month.`}
                                    {scenarioType === 'income' && `Generates ${formatCurrency(incomeDelta * forecastMonths, currency)} extra.`}
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

export default FinancialTimeMachineModal;
