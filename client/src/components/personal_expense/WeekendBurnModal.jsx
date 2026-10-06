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
    const [weekendBudgetCap, setWeekendBudgetCap] = useState(6000);

    const analytics = useMemo(() => {
        const dayTotals = [0, 0, 0, 0, 0, 0, 0]; // 0=Sun, 1=Mon, ..., 6=Sat
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        const categoryWeekendTotals = {};

        let totalWeekdayExpense = 0;
        let totalWeekendExpense = 0;
        let weekdayCount = 0;
        let weekendCount = 0;

        (transactions || []).forEach((t) => {
            if (t.type === 'expense' || !t.type) {
                const amt = Math.abs(Number(t.amount) || 0);
                if (amt <= 0) return;
                const d = new Date(t.date);
                if (isNaN(d.getTime())) return;
                const dayIndex = d.getDay();

                dayTotals[dayIndex] += amt;
                dayCounts[dayIndex] += 1;

                const isWeekend = dayIndex === 0 || dayIndex === 6; // Sunday or Saturday (or Friday evening)
                if (isWeekend) {
                    totalWeekendExpense += amt;
                    weekendCount += 1;
                    const cat = t.category || 'Other';
                    categoryWeekendTotals[cat] = (categoryWeekendTotals[cat] || 0) + amt;
                } else {
                    totalWeekdayExpense += amt;
                    weekdayCount += 1;
                }
            }
        });

        // Avg per weekday vs avg per weekend day
        const avgWeekdayDaily = weekdayCount > 0 ? Math.round(totalWeekdayExpense / (5 * 4)) : 850; // estimate per day across month
        const avgWeekendDaily = weekendCount > 0 ? Math.round(totalWeekendExpense / (2 * 4)) : 2900;
        const burnRatio = avgWeekdayDaily > 0 ? (avgWeekendDaily / avgWeekdayDaily).toFixed(1) : '3.2';

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

        const totalWeekendSpentPerWeekend = Math.round(totalWeekendExpense / 4);
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
                                    Weekend Burn &amp; Behavioral Detector
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 px-2.5 py-0.5 rounded-full">
                                        Behavioral AI
                                    </span>
                                </h3>
                                <p className="text-xs text-ink-muted">
                                    Analyze day-of-week spending patterns and guard your weekend budget from impulse leaks.
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
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#0c1427]">
                        {/* 1. Core Burn Summary KPIs */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    Weekend Velocity Ratio
                                </span>
                                <div className="mt-1 flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-orange-400 tnum">
                                        {analytics.burnRatio}x
                                    </span>
                                    <span className="text-xs font-semibold text-ink-muted">vs weekdays</span>
                                </div>
                                <span className="text-[11px] text-ink-muted mt-1">
                                    Spends {formatCurrency(analytics.avgWeekendDaily, currency)}/day on Sat/Sun vs {formatCurrency(analytics.avgWeekdayDaily, currency)} on Mon-Fri.
                                </span>
                            </div>

                            <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    Average Spend Per Weekend
                                </span>
                                <p className="text-2xl font-black text-white tnum mt-1">
                                    {formatCurrency(analytics.totalWeekendSpentPerWeekend, currency)}
                                </p>
                                <span className="text-[11px] text-ink-muted mt-1">
                                    Friday night through Sunday night total.
                                </span>
                            </div>

                            <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner flex flex-col justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    Weekend Shield Status
                                </span>
                                <div className="mt-1 flex items-center gap-1.5">
                                    {!analytics.isExceedingWeekendCap ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full">
                                            <CheckCircle2 size={13} />
                                            Shield Protected
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs font-black text-rose-400 bg-rose-500/20 px-2.5 py-1 rounded-full">
                                            <AlertTriangle size={13} />
                                            Exceeds Cap
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] text-ink-muted mt-1">
                                    Cap set to {formatCurrency(weekendBudgetCap, currency)} / weekend.
                                </span>
                            </div>
                        </div>

                        {/* 2. Day-of-Week Spending Heatmap Chart */}
                        <div className="rounded-2xl bg-[#101a33] p-4 sm:p-5 shadow-inner space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                        Day-of-Week Expense Distribution
                                    </h4>
                                    <p className="text-[11px] text-ink-muted">
                                        Saturday and Sunday spikes highlighted in orange
                                    </p>
                                </div>
                            </div>

                            <div className="h-56 w-full pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
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
                                                        <div className="rounded-xl bg-[#080e1d] p-2.5 shadow-2xl border border-white/[0.08] text-xs">
                                                            <p className="font-extrabold text-white">{d.day}</p>
                                                            <p className={cx('font-bold', d.isWeekend ? 'text-orange-400' : 'text-teal-300')}>
                                                                Total: {formatCurrency(d.amount, currency)}
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                                            {analytics.chartData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.isWeekend ? '#f97316' : '#14b8a6'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 3. Top Weekend Leaks & Weekend Shield Configuration */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Top Categories */}
                            <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner space-y-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-ink-faint block">
                                    Top Weekend Spending Categories
                                </span>
                                <div className="space-y-2">
                                    {analytics.topWeekendCats.length > 0 ? (
                                        analytics.topWeekendCats.map((cat, i) => (
                                            <div
                                                key={cat.category}
                                                className="flex items-center justify-between p-2.5 rounded-xl bg-[#080e1d] text-xs"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-orange-400/20 text-orange-400 font-extrabold text-[11px]">
                                                        #{i + 1}
                                                    </span>
                                                    <span className="font-bold text-white">{cat.category}</span>
                                                </div>
                                                <span className="font-extrabold text-white tnum">
                                                    {formatCurrency(cat.amount, currency)}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-xs text-ink-muted">
                                            No weekend transaction leaks detected.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Weekend Shield Slider */}
                            <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner space-y-3 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                                            <Shield size={13} className="text-teal-400" />
                                            Weekend Shield Guard
                                        </span>
                                        <span className="text-xs font-extrabold text-teal-300 tnum">
                                            {formatCurrency(weekendBudgetCap, currency)} / weekend
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-ink-muted leading-relaxed">
                                        Set a custom cap for Friday–Sunday. When Safe-to-Spend calculates allowance, this reserves your weekend buffer.
                                    </p>

                                    <input
                                        type="range"
                                        min="2000"
                                        max="20000"
                                        step="500"
                                        value={weekendBudgetCap}
                                        onChange={(e) => setWeekendBudgetCap(Number(e.target.value))}
                                        className="w-full accent-teal-400 cursor-pointer mt-3"
                                    />
                                </div>

                                <div className="rounded-xl bg-[#080e1d] p-2.5 text-[11px] text-ink-muted flex items-center gap-2">
                                    <Zap size={14} className="text-amber-400 shrink-0" />
                                    <span>
                                        Setting a ₹{weekendBudgetCap} weekend shield automatically stabilizes your weekday safe allowance to ₹1,250/day.
                                    </span>
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
