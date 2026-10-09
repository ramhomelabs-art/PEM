import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
    Wallet,
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
        desc: 'New tech gear on 6-month EMI',
        defaults: {
            name: 'New Laptop / Phone',
            type: 'emi',
            amount: 100000,
            months: 6,
            interestRate: 0,
            downPayment: 15000,
            incomeChange: 0,
            expenseCutPct: 0,
        },
    },
    {
        id: 'vacation-trip',
        title: 'Dream Vacation Trip',
        icon: Plane,
        category: 'Expense',
        desc: 'One-off holiday spend next month',
        defaults: {
            name: 'Vacation Getaway',
            type: 'upfront',
            amount: 50000,
            monthOffset: 1,
            months: 1,
            interestRate: 0,
            downPayment: 50000,
            incomeChange: 0,
            expenseCutPct: 0,
        },
    },
    {
        id: 'salary-hike',
        title: 'Salary Hike / Promotion',
        icon: Briefcase,
        category: 'Income',
        desc: 'Extra monthly income increment',
        defaults: {
            name: 'Promotion / New Job',
            type: 'income',
            amount: 0,
            months: 12,
            interestRate: 0,
            downPayment: 0,
            incomeChange: 20000,
            expenseCutPct: 0,
        },
    },
    {
        id: 'lifestyle-diet',
        title: 'Discretionary Budget Cut',
        icon: ShoppingBag,
        category: 'Savings',
        desc: 'Reduce monthly lifestyle burn by 20%',
        defaults: {
            name: 'Dining & Shopping Cut',
            type: 'expense_cut',
            amount: 0,
            months: 12,
            interestRate: 0,
            downPayment: 0,
            incomeChange: 0,
            expenseCutPct: 20,
        },
    },
];

export function FinancialTimeMachineModal({
    isOpen,
    onClose,
    currentBalance = 0,
    monthlyIncome = 0,
    monthlyExpense = 0,
    activeObligations = 0,
    currency = 'INR',
}) {
    // Dynamic starting estimates if user is starting fresh or has active data
    const liveBal = Number(currentBalance) || 0;
    const liveInc = Number(monthlyIncome) || 0;
    const liveExp = Number(monthlyExpense) || 0;

    const [scenarioType, setScenarioType] = useState('emi'); // 'upfront', 'emi', 'income', 'expense_cut'
    const [scenarioName, setScenarioName] = useState('Tech Gadget (EMI)');
    const [purchaseAmount, setPurchaseAmount] = useState(80000);
    const [downPayment, setDownPayment] = useState(15000);
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

    // Calculate Real-Time 12-Month Projections
    const simulation = useMemo(() => {
        const netBaseSavingsPerMonth = liveInc - liveExp;
        const loanPrincipal = Math.max(0, purchaseAmount - downPayment);
        const monthlyInterest = interestRate > 0 && emiTenure > 0
            ? (loanPrincipal * (interestRate / 100)) / emiTenure
            : 0;
        const monthlyEmi = emiTenure > 0 && scenarioType === 'emi'
            ? Math.round((loanPrincipal / emiTenure) + monthlyInterest)
            : 0;

        const monthlyCutSavings = Math.round(liveExp * (expenseCutPct / 100));
        const effectiveNetMonthly = netBaseSavingsPerMonth + incomeDelta + (scenarioType === 'expense_cut' ? monthlyCutSavings : 0);

        let baselineBalance = liveBal;
        let simulatedBalance = liveBal;
        let lowestSimulatedBalance = liveBal;
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
            isFeasible: lowestSimulatedBalance >= 10000,
        };
    }, [
        liveBal,
        liveInc,
        liveExp,
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

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/80 backdrop-blur-md"
                />

                {/* Modal Window */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.95)] z-10 my-6 flex flex-col max-h-[92vh]"
                >
                    {/* Top ambient highlight */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-teal-400 via-emerald-400 to-violet-500 opacity-90" />

                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-line bg-sunken px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400/20 to-violet-500/20 text-teal-600 dark:text-teal-300 shadow-[0_0_20px_rgba(20,184,166,0.2)]">
                                <Sparkles size={20} />
                            </span>
                            <div>
                                <h3 className="text-base font-extrabold tracking-tight text-ink flex items-center gap-2">
                                    "What-If" Financial Time Machine
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-teal-500/15 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 px-2.5 py-0.5 rounded-full">
                                        Future Simulator
                                    </span>
                                </h3>
                                <p className="text-xs text-ink-muted">
                                    Simulate major purchases, EMIs, salary hikes & lifestyle cuts with live financial data.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="grid h-8 w-8 place-items-center rounded-xl bg-raised text-ink-muted hover:bg-line hover:text-ink transition cursor-pointer"
                        >
                            <X size={17} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-surface">
                        {/* Live Financial Foundation Banner */}
                        <div className="rounded-2xl bg-sunken border border-line p-4 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5 text-xs font-bold text-teal-800 dark:text-teal-300">
                                <span className="h-2.5 w-2.5 rounded-full bg-teal-500 animate-ping" />
                                <span>Real-Time Baseline Connected:</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
                                <div>
                                    <span className="text-[10px] text-ink-muted uppercase font-bold block">Current Balance</span>
                                    <span className="font-extrabold text-ink tnum">{formatCurrency(liveBal, currency)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-ink-muted uppercase font-bold block">Monthly Income</span>
                                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tnum">+{formatCurrency(liveInc, currency)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-ink-muted uppercase font-bold block">Monthly Outflow</span>
                                    <span className="font-extrabold text-rose-600 dark:text-rose-400 tnum">-{formatCurrency(liveExp, currency)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-ink-muted uppercase font-bold block">Monthly Net Baseline</span>
                                    <span className={cx('font-extrabold tnum', liveInc - liveExp >= 0 ? 'text-teal-800 dark:text-teal-300' : 'text-amber-600 dark:text-amber-400')}>
                                        {liveInc - liveExp >= 0 ? '+' : ''}{formatCurrency(liveInc - liveExp, currency)}/mo
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 1. Quick Presets */}
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block mb-2.5">
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
                                                'flex flex-col items-start p-3 rounded-2xl transition text-left relative overflow-hidden cursor-pointer',
                                                isSelected
                                                    ? 'bg-gradient-to-br from-teal-500/20 to-[color:var(--pem-surface-raised)] border border-teal-500/40 shadow-[0_0_20px_rgba(20,184,166,0.15)]'
                                                    : 'bg-raised hover:bg-line'
                                            )}
                                        >
                                            <div className="flex items-center justify-between w-full mb-1.5">
                                                <span className={cx('grid h-7 w-7 place-items-center rounded-xl', isSelected ? 'bg-teal-500/20 text-teal-800 dark:text-teal-300' : 'bg-raised text-ink-muted')}>
                                                    <Icon size={14} />
                                                </span>
                                                <span className="text-[10px] font-bold text-ink-muted uppercase">
                                                    {preset.category}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-ink leading-tight">
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
                        <div className="rounded-2xl bg-raised p-4 sm:p-5 shadow-inner">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                                    <Sliders size={14} className="text-teal-600 dark:text-teal-400" />
                                    Configure Simulation Parameters
                                </h4>
                                <div className="inline-flex rounded-xl bg-sunken p-1 gap-1">
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
                                                'px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer',
                                                scenarioType === mode.id
                                                    ? 'bg-teal-500/20 dark:bg-teal-500/30 text-teal-900 dark:text-teal-200 shadow-sm'
                                                    : 'text-ink-muted hover:text-ink'
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
                                            <input
                                                type="number"
                                                value={purchaseAmount}
                                                onChange={(e) => setPurchaseAmount(Number(e.target.value) || 0)}
                                                className="w-full rounded-xl bg-sunken px-3.5 py-2 text-xs font-bold text-ink outline-none focus:ring-1 focus:ring-teal-400"
                                            />
                                        </div>

                                        {scenarioType === 'emi' && (
                                            <>
                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-semibold text-ink-muted">Down Payment</label>
                                                    <input
                                                        type="number"
                                                        value={downPayment}
                                                        onChange={(e) => setDownPayment(Number(e.target.value) || 0)}
                                                        className="w-full rounded-xl bg-sunken px-3.5 py-2 text-xs font-bold text-ink outline-none focus:ring-1 focus:ring-teal-400"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-semibold text-ink-muted">Tenure (Months)</label>
                                                    <select
                                                        value={emiTenure}
                                                        onChange={(e) => setEmiTenure(Number(e.target.value))}
                                                        className="w-full rounded-xl bg-sunken px-3 py-2 text-xs font-bold text-ink outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer"
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
                                                        className="w-full rounded-xl bg-sunken px-3.5 py-2 text-xs font-bold text-ink outline-none focus:ring-1 focus:ring-teal-400"
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
                                            className="w-full rounded-xl bg-sunken px-3.5 py-2 text-xs font-bold text-ink outline-none focus:ring-1 focus:ring-teal-400"
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
                                        className="w-full rounded-xl bg-sunken px-3 py-2 text-xs font-bold text-ink outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer"
                                    >
                                        <option value={6}>6 Months</option>
                                        <option value={12}>12 Months (1 Year)</option>
                                        <option value={24}>24 Months (2 Years)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 3. Real-Time Projections Chart */}
                        <div className="rounded-2xl bg-raised p-4 sm:p-5 shadow-inner space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
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
                                    <span className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
                                        <span className="h-2 w-2 rounded-full bg-teal-500" />
                                        Projected Horizon
                                    </span>
                                </div>
                            </div>

                            <div className="h-64 w-full pt-2 min-w-0 min-h-[250px]">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250} initialDimension={{ width: 600, height: 250 }}>
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
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                                        <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                                        <YAxis
                                            stroke="#64748b"
                                            fontSize={11}
                                            tickLine={false}
                                            tickFormatter={(v) => formatCurrency(v, currency)}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const d = payload[0].payload;
                                                    return (
                                                        <div className="rounded-xl bg-sunken p-3 shadow-2xl border border-line text-xs space-y-1">
                                                            <p className="font-extrabold text-ink">{d.label} (Month {d.month})</p>
                                                            <p className="text-teal-800 dark:text-teal-300 font-bold">
                                                                Projected: {formatCurrency(d.simulated, currency)}
                                                            </p>
                                                            <p className="text-ink-muted">
                                                                Status Quo: {formatCurrency(d.baseline, currency)}
                                                            </p>
                                                            <p className={cx('font-bold', d.difference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
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
                            <div className="rounded-2xl bg-raised p-4 flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                                    Lowest Projected Balance
                                </span>
                                <p className={cx('text-lg font-black tnum mt-1', simulation.lowestSimulatedBalance < 10000 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                                    {formatCurrency(simulation.lowestSimulatedBalance, currency)}
                                </p>
                                <span className="text-[11px] font-medium text-ink-muted mt-1">
                                    {simulation.lowestSimulatedBalance < 10000
                                        ? `⚠️ Danger zone in Month ${simulation.dangerMonth || 1}`
                                        : '✅ Stays safely above emergency reserve'}
                                </span>
                            </div>

                            <div className="rounded-2xl bg-raised p-4 flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                                    Final Balance at Month {forecastMonths}
                                </span>
                                <p className="text-lg font-black tnum text-ink mt-1">
                                    {formatCurrency(simulation.finalSimulated, currency)}
                                </p>
                                <span className={cx('text-[11px] font-bold mt-1', simulation.netDifference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted')}>
                                    {simulation.netDifference >= 0 ? '+' : ''}{formatCurrency(simulation.netDifference, currency)} vs status quo
                                </span>
                            </div>

                            <div className="rounded-2xl bg-raised p-4 flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                                    Decision Verdict
                                </span>
                                <div className="mt-1 flex items-center gap-1.5">
                                    {simulation.isFeasible ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-800 dark:text-emerald-400 bg-emerald-500/15 dark:bg-emerald-500/20 px-2.5 py-1 rounded-full">
                                            <CheckCircle2 size={13} />
                                            Safe &amp; Feasible
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs font-black text-rose-800 dark:text-rose-400 bg-rose-500/15 dark:bg-rose-500/20 px-2.5 py-1 rounded-full">
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
        </AnimatePresence>,
        document.body
    );
}

export default FinancialTimeMachineModal;
