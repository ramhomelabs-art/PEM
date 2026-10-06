import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    Coins,
    Heart,
    Plus,
    Minus,
    Trophy,
    X,
    CheckCircle2,
    Flame,
    Gift,
    Plane,
    Gamepad2,
    Coffee,
    Smile,
    ArrowUpRight,
    ArrowDownLeft,
    Zap,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { cx } from '../ui/cx';

const DEFAULT_GOALS = [
    { id: '1', title: 'Weekend Getaway', target: 25000, icon: Plane, color: 'from-teal-400 to-emerald-500' },
    { id: '2', title: 'Gaming Console / Gadget', target: 45000, icon: Gamepad2, color: 'from-violet-400 to-purple-500' },
    { id: '3', title: 'Michelin Dining Experience', target: 12000, icon: Coffee, color: 'from-amber-400 to-orange-500' },
];

export function FunSavingsJarModal({
    isOpen,
    onClose,
    todayUnderSpend = 496,
    currency = 'INR',
}) {
    const [jarBalance, setJarBalance] = useState(() => {
        const saved = localStorage.getItem('pem-fun-jar-balance');
        return saved ? Number(saved) : 8450;
    });

    const [selectedGoal, setSelectedGoal] = useState(() => DEFAULT_GOALS[0]);
    const [history, setHistory] = useState(() => {
        const saved = localStorage.getItem('pem-fun-jar-history');
        return saved
            ? JSON.parse(saved)
            : [
                  { id: 'h1', type: 'deposit', desc: 'Safe-to-Spend Daily Rollover', amount: 496, date: 'Today' },
                  { id: 'h2', type: 'deposit', desc: 'Safe-to-Spend Daily Rollover', amount: 850, date: 'Yesterday' },
                  { id: 'h3', type: 'withdraw', desc: 'Coffee & Movies with friends', amount: 1200, date: '3 days ago' },
                  { id: 'h4', type: 'deposit', desc: 'Manual bonus stash', amount: 2000, date: '5 days ago' },
              ];
    });

    const [customAmount, setCustomAmount] = useState('');
    const [actionTab, setActionTab] = useState('deposit'); // 'deposit' or 'withdraw'

    useEffect(() => {
        localStorage.setItem('pem-fun-jar-balance', String(jarBalance));
    }, [jarBalance]);

    useEffect(() => {
        localStorage.setItem('pem-fun-jar-history', JSON.stringify(history));
    }, [history]);

    const goalProgressPct = selectedGoal
        ? Math.min(100, Math.round((jarBalance / selectedGoal.target) * 100))
        : 0;

    const handleAction = () => {
        const val = Number(customAmount) || 0;
        if (val <= 0) return;

        if (actionTab === 'withdraw' && val > jarBalance) {
            return;
        }

        const newBal = actionTab === 'deposit' ? jarBalance + val : jarBalance - val;
        setJarBalance(newBal);

        const newEntry = {
            id: String(Date.now()),
            type: actionTab,
            desc: actionTab === 'deposit' ? 'Guilt-Free Deposit' : 'Guilt-Free Spend',
            amount: val,
            date: 'Just now',
        };
        setHistory([newEntry, ...history]);
        setCustomAmount('');
    };

    const handleAutoRollover = () => {
        if (todayUnderSpend <= 0) return;
        setJarBalance((prev) => prev + todayUnderSpend);
        const newEntry = {
            id: String(Date.now()),
            type: 'deposit',
            desc: "Today's Safe-to-Spend Rollover",
            amount: todayUnderSpend,
            date: 'Just now',
        };
        setHistory([newEntry, ...history]);
    };

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
                    <div className="h-[2px] w-full bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 opacity-90" />

                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#080e1d] px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-pink-500/20 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                                <Gift size={20} />
                            </span>
                            <div>
                                <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                                    "Guilt-Free" Fun Money Jar
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full">
                                        Micro-Saver
                                    </span>
                                </h3>
                                <p className="text-xs text-ink-muted">
                                    Spend with 100% zero guilt. Auto-accumulates from days you beat your Safe-to-Spend target!
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
                        {/* Auto-Rollover Banner */}
                        {todayUnderSpend > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#101a33] to-[#101a33] p-4 shadow-sm border border-amber-500/20"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-300">
                                        <Zap size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white">
                                            You have {formatCurrency(todayUnderSpend, currency)} unspent allowance from today!
                                        </p>
                                        <p className="text-[11px] text-ink-muted">
                                            Lock this surplus directly into your Fun Jar so it doesn't vanish into random impulses.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAutoRollover}
                                    className="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 px-4 py-2 text-xs font-extrabold text-black transition shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95"
                                >
                                    + Stash {formatCurrency(todayUnderSpend, currency)} Now
                                </button>
                            </motion.div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                            {/* Left: 3D Visual Fun Jar + Balance Gauge */}
                            <div className="md:col-span-5 rounded-2xl bg-[#101a33] p-5 flex flex-col items-center justify-between text-center shadow-inner relative overflow-hidden">
                                <div className="w-full flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                        Available Fun Pool
                                    </span>
                                    <span className="text-[10px] font-extrabold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full">
                                        100% Guilt-Free
                                    </span>
                                </div>

                                {/* Animated Glass Jar Container */}
                                <div className="relative my-4 flex items-center justify-center">
                                    <div className="relative h-44 w-36 rounded-3xl border-2 border-white/20 bg-gradient-to-b from-white/[0.08] to-white/[0.02] shadow-[0_0_35px_rgba(236,72,153,0.2)] overflow-hidden flex flex-col justify-end p-1.5">
                                        {/* Jar Lid */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-3 w-20 rounded-b-md bg-amber-400/70 border border-amber-300 shadow-md" />

                                        {/* Liquid Coin Fill */}
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${Math.max(15, goalProgressPct)}%` }}
                                            transition={{ duration: 0.8, ease: 'easeOut' }}
                                            className="w-full rounded-2xl bg-gradient-to-t from-pink-600/90 via-amber-500/80 to-amber-400/80 relative overflow-hidden flex items-center justify-center shadow-inner"
                                        >
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white/30 to-transparent opacity-60" />
                                            <Coins className="text-white/40 animate-pulse" size={28} />
                                        </motion.div>
                                    </div>
                                </div>

                                <div className="w-full space-y-1">
                                    <span className="text-2xl sm:text-3xl font-black text-white tnum tracking-tight">
                                        {formatCurrency(jarBalance, currency)}
                                    </span>
                                    <p className="text-[11px] text-ink-muted">
                                        {goalProgressPct}% of {selectedGoal.title} target ({formatCurrency(selectedGoal.target, currency)})
                                    </p>
                                </div>
                            </div>

                            {/* Right: Goals, Add/Withdraw & History */}
                            <div className="md:col-span-7 space-y-4">
                                {/* Goal Selector */}
                                <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner space-y-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-ink-faint block">
                                        Select Target Fun Goal
                                    </span>
                                    <div className="grid grid-cols-3 gap-2">
                                        {DEFAULT_GOALS.map((g) => {
                                            const Icon = g.icon;
                                            const isSel = selectedGoal.id === g.id;
                                            return (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => setSelectedGoal(g)}
                                                    className={cx(
                                                        'flex flex-col items-center p-2.5 rounded-xl transition text-center',
                                                        isSel
                                                            ? 'bg-[#080e1d] border border-teal-500/50 shadow-md'
                                                            : 'bg-[#080e1d]/60 hover:bg-[#080e1d]'
                                                    )}
                                                >
                                                    <span className={cx('grid h-7 w-7 place-items-center rounded-lg mb-1.5', isSel ? 'bg-teal-400/20 text-teal-300' : 'text-ink-muted')}>
                                                        <Icon size={14} />
                                                    </span>
                                                    <span className="text-[11px] font-bold text-white leading-tight line-clamp-1">
                                                        {g.title}
                                                    </span>
                                                    <span className="text-[10px] text-ink-faint tnum mt-0.5">
                                                        {formatCurrency(g.target, currency)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Deposit / Spend Actions */}
                                <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                                            Quick Jar Action
                                        </span>
                                        <div className="inline-flex rounded-lg bg-[#080e1d] p-0.5">
                                            {['deposit', 'withdraw'].map((t) => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => setActionTab(t)}
                                                    className={cx(
                                                        'px-3 py-1 text-xs font-bold rounded-md capitalize transition',
                                                        actionTab === t
                                                            ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                                                            : 'text-ink-muted hover:text-white'
                                                    )}
                                                >
                                                    {t === 'deposit' ? '+ Stash Fun Money' : '- Treat Yourself (Spend)'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="Enter amount (e.g. 1000)"
                                            value={customAmount}
                                            onChange={(e) => setCustomAmount(e.target.value)}
                                            className="flex-1 rounded-xl bg-[#080e1d] px-3.5 py-2 text-xs font-bold text-white placeholder:text-ink-faint outline-none focus:ring-1 focus:ring-amber-400"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAction}
                                            className={cx(
                                                'rounded-xl px-4 py-2 text-xs font-black transition active:scale-95 shadow-sm',
                                                actionTab === 'deposit'
                                                    ? 'bg-amber-500 hover:bg-amber-400 text-black'
                                                    : 'bg-pink-600 hover:bg-pink-500 text-white'
                                            )}
                                        >
                                            {actionTab === 'deposit' ? 'Stash' : 'Spend'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Fun Money Logs */}
                        <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner space-y-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-ink-faint block">
                                Fun Jar Activity Ledger
                            </span>
                            <div className="space-y-2">
                                {history.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#080e1d] text-xs"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className={cx('grid h-7 w-7 place-items-center rounded-lg', item.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-pink-500/15 text-pink-400')}>
                                                {item.type === 'deposit' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                            </span>
                                            <div>
                                                <p className="font-bold text-white">{item.desc}</p>
                                                <p className="text-[10px] text-ink-faint">{item.date}</p>
                                            </div>
                                        </div>
                                        <span className={cx('font-extrabold tnum', item.type === 'deposit' ? 'text-emerald-400' : 'text-pink-400')}>
                                            {item.type === 'deposit' ? '+' : '-'}{formatCurrency(item.amount, currency)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

export default FunSavingsJarModal;
