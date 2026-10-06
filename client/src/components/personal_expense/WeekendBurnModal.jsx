import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Flame,
    Calendar,
    Sparkles,
    Shield,
    TrendingUp,
    Utensils,
    ShoppingBag,
    Film,
    Beer,
    Coffee,
    X,
    AlertTriangle,
    CheckCircle2,
    Sliders,
    Zap,
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Cell,
} from 'recharts';
import { formatCurrency } from '../../utils/currency';
import { cx } from '../ui/cx';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WeekendBurnModal({
    isOpen,
    onClose,
    transactions = [],
    currency = 'INR',
}) {
    const [weekendBudgetCap, setWeekendBudgetCap] = useState(() => {
        const saved = localStorage.getItem('pem-weekend-shield-cap');
        return saved ? Number(saved) : 5000;
    });

    const handleCapChange = (val) => {
        setWeekendBudgetCap(val);
        localStorage.setItem('pem-weekend-shield-cap', String(val));
    };

    const analytics = useMemo(() => {
        const dayTotals = [0, 0, 0, 0, 0, 0, 0]; // 0=Sun, 1=Mon, ..., 6=Sat
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        const uniqueDatesByDay = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];
        const categoryWeekendTotals = {};

        let totalWeekdayExpense = 0;
        let totalWeekendExpense = 0;

        (transactions || []).forEach((t) => {
            if (t.type === 'expense' || !t.type) {
                const amt = Math.abs(Number(t.amount) || 0);
                if (amt <= 0) return;
                const d = new Date(t.date);
                if (isNaN(d.getTime())) return;
                const dayIndex = d.getDay();
                const dateKey = t.date ? String(t.date).slice(0, 10) : '';

                dayTotals[dayIndex] += amt;
                dayCounts[dayIndex] += 1;
                if (dateKey) uniqueDatesByDay[dayIndex].add(dateKey);

                const isWeekend = dayIndex === 0 || dayIndex === 6; // Sunday or Saturday
                if (isWeekend) {
                    totalWeekendExpense += amt;
                    const cat = t.category || 'Discretionary';
                    categoryWeekendTotals[cat] = (categoryWeekendTotals[cat] || 0) + amt;
                } else {
                    totalWeekdayExpense += amt;
                }
            }
        });

        // Count actual unique days in user data
        const weekdayDaysCount = Math.max(1, [1, 2, 3, 4, 5].reduce((sum, idx) => sum + uniqueDatesByDay[idx].size, 0));
        const weekendDaysCount = Math.max(1, [0, 6].reduce((sum, idx) => sum + uniqueDatesByDay[idx].size, 0));

        // Avg per weekday vs avg per weekend day
        const avgWeekdayDaily = Math.round(totalWeekdayExpense / weekdayDaysCount);
        const avgWeekendDaily = Math.round(totalWeekendExpense / weekendDaysCount);
        const burnRatio = avgWeekdayDaily > 0 ? (avgWeekendDaily / avgWeekdayDaily).toFixed(1) : (avgWeekendDaily > 0 ? '2.0' : '1.0');

        const chartData = [
            { day: 'Mon', amount: Math.round(dayTotals[1]), isWeekend: false },
            { day: 'Tue', amount: Math.round(dayTotals[2]), isWeekend: false },
            { day: 'Wed', amount: Math.round(dayTotals[3]), isWeekend: false },
            { day: 'Thu', amount: Math.round(dayTotals[4]), isWeekend: false },
            { day: 'Fri', amount: Math.round(dayTotals[5]), isWeekend: false },
            { day: 'Sat', amount: Math.round(dayTotals[6]), isWeekend: true },
            { day: 'Sun', amount: Math.round(dayTotals[0]), isWeekend: true },
        ];

        const topWeekendCats = Object.entries(categoryWeekendTotals)
            .map(([cat, amt]) => ({ category: cat, amount: amt }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 4);

        const totalWeekendSpentPerWeekend = Math.round(totalWeekendExpense / Math.max(1, Math.ceil(weekendDaysCount / 2)));
        const isExceedingWeekendCap = totalWeekendSpentPerWeekend > weekendBudgetCap;

        return {
            chartData,
            totalWeekdayExpense,
            totalWeekendExpense,
            avgWeekdayDaily,
            avgWeekendDaily,
            burnRatio,
            topWeekendCats,
            totalWeekendSpentPerWeekend,
            isExceedingWeekendCap,
        };
    }, [transactions, weekendBudgetCap]);

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

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-[#0c1427] shadow-[0_24px_80px_rgba(0,0,0,0.95)] z-10 my-6 flex flex-col max-h-[92vh]"
                >
                    {/* Top ambient highlight line */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-orange-400 via-rose-500 to-amber-400 opacity-90" />

                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#080e1d] px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-orange-400/20 to-rose-500/20 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                                <Flame size={20} />
                            </span>
                            <div>
                                <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                                    Weekend Burn &amp; Impulse Detector
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 px-2.5 py-0.5 rounded-full">
                                        Behavioral AI
                                    </span>
                                </h3>
                                <p className="text-xs text-ink-muted">
                                    Real-time velocity check: Detects weekend surges & protects your financial momentum.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.04] text-ink-muted hover:bg-white/[0.08] hover:text-white transition cursor-pointer"
                        >
                            <X size={17} />
                        </button>
                    </div>

                    {/* Body Content */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-[#0c1427]">
                        {/* Highlights Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-2xl bg-[#101a33] p-4 flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    Weekend Burn Velocity
                                </span>
                                <p className="text-2xl font-black text-orange-400 tracking-tight tnum mt-1">
                                    {analytics.burnRatio}x Weekdays
                                </p>
                                <span className="text-[11px] font-medium text-ink-muted mt-1">
                                    Avg weekend daily spend: {formatCurrency(analytics.avgWeekendDaily, currency)} vs weekday {formatCurrency(analytics.avgWeekdayDaily, currency)}
                                </span>
                            </div>

                            <div className="rounded-2xl bg-[#101a33] p-4 flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    Total Weekend Outflows
                                </span>
                                <p className="text-2xl font-black text-white tracking-tight tnum mt-1">
                                    {formatCurrency(analytics.totalWeekendExpense, currency)}
                                </p>
                                <span className="text-[11px] font-medium text-ink-muted mt-1">
                                    Across all logged Saturday &amp; Sunday transactions
                                </span>
                            </div>

                            <div className="rounded-2xl bg-[#101a33] p-4 flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    Weekend Shield Status
                                </span>
                                <div className="mt-1">
                                    {analytics.isExceedingWeekendCap ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-black">
                                            <AlertTriangle size={13} />
                                            Exceeding Shield Cap
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black">
                                            <CheckCircle2 size={13} />
                                            Within Shield Limit
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] font-medium text-ink-muted mt-1">
                                    Shield Target: {formatCurrency(weekendBudgetCap, currency)} / weekend
                                </span>
                            </div>
                        </div>

                        {/* Day of Week Spend Velocity Chart */}
                        <div className="rounded-2xl bg-[#101a33] p-4 sm:p-5 shadow-inner space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                        Day-of-Week Spend Velocity
                                    </h4>
                                    <p className="text-[11px] text-ink-muted">
                                        Real spend by day of week across your transactions
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-bold">
                                    <span className="flex items-center gap-1.5 text-slate-400">
                                        <span className="h-2 w-2 rounded-full bg-slate-500" />
                                        Weekday
                                    </span>
                                    <span className="flex items-center gap-1.5 text-orange-400">
                                        <span className="h-2 w-2 rounded-full bg-orange-500" />
                                        Weekend
                                    </span>
                                </div>
                            </div>

                            <div className="h-56 w-full pt-2 min-w-0 min-h-[220px]">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220} initialDimension={{ width: 600, height: 220 }}>
                                    <BarChart data={analytics.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
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
                                                        <div className="rounded-xl bg-[#080e1d] p-3 shadow-2xl border border-white/[0.08] text-xs space-y-1">
                                                            <p className="font-extrabold text-white">{d.day} ({d.isWeekend ? 'Weekend' : 'Weekday'})</p>
                                                            <p className="text-orange-400 font-bold">
                                                                Total Spend: {formatCurrency(d.amount, currency)}
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                            {analytics.chartData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.isWeekend ? '#f97316' : '#475569'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Weekend Leak Categories & Shield Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Top Weekend Leak Categories */}
                            <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-2">
                                    <Zap size={14} className="text-orange-400" />
                                    Top Weekend Leak Categories
                                </h4>
                                {analytics.topWeekendCats.length === 0 ? (
                                    <p className="text-xs text-ink-muted">No weekend expenses recorded yet.</p>
                                ) : (
                                    <div className="space-y-2.5">
                                        {analytics.topWeekendCats.map((item, i) => (
                                            <div key={item.category} className="flex items-center justify-between text-xs font-semibold">
                                                <div className="flex items-center gap-2">
                                                    <span className="h-6 w-6 grid place-items-center rounded-lg bg-orange-500/10 text-orange-400 text-[11px] font-bold">
                                                        #{i + 1}
                                                    </span>
                                                    <span className="text-white">{item.category}</span>
                                                </div>
                                                <span className="font-bold text-orange-400 tnum">
                                                    {formatCurrency(item.amount, currency)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Weekend Shield Guard Config */}
                            <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                                        <Shield size={14} className="text-teal-400" />
                                        Weekend Shield Budget Guard
                                    </h4>
                                    <span className="text-xs font-black text-teal-300 tnum">
                                        {formatCurrency(weekendBudgetCap, currency)}
                                    </span>
                                </div>
                                <p className="text-[11px] text-ink-muted leading-relaxed">
                                    Set your maximum acceptable burn rate for Friday night through Sunday.
                                </p>
                                <input
                                    type="range"
                                    min="1000"
                                    max="30000"
                                    step="500"
                                    value={weekendBudgetCap}
                                    onChange={(e) => handleCapChange(Number(e.target.value))}
                                    className="w-full accent-teal-400 cursor-pointer mt-2"
                                />
                                <div className="flex justify-between text-[10px] text-ink-faint font-semibold">
                                    <span>{formatCurrency(1000, currency)}</span>
                                    <span>{formatCurrency(15000, currency)}</span>
                                    <span>{formatCurrency(30000, currency)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

export default WeekendBurnModal;
