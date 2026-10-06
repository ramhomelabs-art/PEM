import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/personal_expense/AuthContext';
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
    Clock,
    Lock,
    Wallet,
    Info,
    Trash2,
    RotateCcw,
    Smartphone,
    Music,
    Car,
    Laptop,
    Camera,
    ShoppingBag,
    Sliders,
    Edit3,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { cx } from '../ui/cx';
import { API_URL } from '../../config';

const ICON_MAP = {
    Plane: Plane,
    Gamepad2: Gamepad2,
    Coffee: Coffee,
    Gift: Gift,
    Trophy: Trophy,
    Heart: Heart,
    Sparkles: Sparkles,
    Smartphone: Smartphone,
    Music: Music,
    Car: Car,
    Laptop: Laptop,
    Camera: Camera,
    ShoppingBag: ShoppingBag,
};

const ICON_OPTIONS = [
    { key: 'Plane', label: 'Travel', icon: Plane },
    { key: 'Gamepad2', label: 'Gaming', icon: Gamepad2 },
    { key: 'Coffee', label: 'Dining', icon: Coffee },
    { key: 'Smartphone', label: 'Gadget', icon: Smartphone },
    { key: 'ShoppingBag', label: 'Shopping', icon: ShoppingBag },
    { key: 'Car', label: 'Road Trip', icon: Car },
    { key: 'Music', label: 'Concert', icon: Music },
    { key: 'Camera', label: 'Hobby', icon: Camera },
    { key: 'Laptop', label: 'Work', icon: Laptop },
    { key: 'Gift', label: 'Treat', icon: Gift },
    { key: 'Heart', label: 'Self Care', icon: Heart },
    { key: 'Trophy', label: 'Milestone', icon: Trophy },
];

const DEFAULT_GOALS = [
    { id: '1', title: 'Weekend Getaway', target: 25000, iconKey: 'Plane' },
    { id: '2', title: 'Gaming Console / Gadget', target: 45000, iconKey: 'Gamepad2' },
    { id: '3', title: 'Michelin Dining Experience', target: 12000, iconKey: 'Coffee' },
];

export function FunSavingsJarModal({
    isOpen,
    onClose,
    todayUnderSpend = 0,
    todaySpent = 0,
    dailyTarget = 0,
    currency = 'INR',
    user: userProp,
    onReloadTransactions,
    onJarUpdate,
}) {
    const { user: authUser } = useAuth();
    const currentUser = userProp || authUser || (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null);
    const todayKey = new Date().toISOString().split('T')[0];

    const [jarBalance, setJarBalance] = useState(() => {
        const saved = localStorage.getItem('pem-fun-jar-balance');
        if (!saved || saved === '7101' || saved === '8450') {
            localStorage.setItem('pem-fun-jar-balance', '0');
            return 0;
        }
        return Number(saved) || 0;
    });

    const [goals, setGoals] = useState(() => {
        const saved = localStorage.getItem('pem-fun-jar-goals');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return DEFAULT_GOALS;
            }
        }
        return DEFAULT_GOALS;
    });

    const [selectedGoalId, setSelectedGoalId] = useState(() => {
        const saved = localStorage.getItem('pem-fun-jar-selected-goal-id');
        return saved || DEFAULT_GOALS[0].id;
    });

    const selectedGoal = useMemo(() => {
        return goals.find((g) => g.id === selectedGoalId) || goals[0] || DEFAULT_GOALS[0];
    }, [goals, selectedGoalId]);

    const [lastStashedDate, setLastStashedDate] = useState(() => {
        const saved = localStorage.getItem('pem-fun-jar-last-stashed-date');
        const currentBal = Number(localStorage.getItem('pem-fun-jar-balance') || 0);
        // If balance is 0, auto reset the stash lock
        if (currentBal === 0) {
            localStorage.removeItem('pem-fun-jar-last-stashed-date');
            return '';
        }
        return saved || '';
    });

    const isStashedToday = Boolean(lastStashedDate && lastStashedDate === todayKey && jarBalance > 0);

    const [history, setHistory] = useState(() => {
        const saved = localStorage.getItem('pem-fun-jar-history');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.filter((item) => item.amount !== 496 && item.amount !== 850 && item.amount !== 1200 && item.amount !== 2000 || item.realTx);
            } catch {
                return [];
            }
        }
        return [];
    });

    const [customAmount, setCustomAmount] = useState('');
    const [actionTab, setActionTab] = useState('deposit'); // 'deposit' or 'withdraw'
    const [deductFromMainBalance, setDeductFromMainBalance] = useState(true);
    const [depositBackToMainBalance, setDepositBackToMainBalance] = useState(true);
    const [loadingAction, setLoadingAction] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    // Custom Goal Form State
    const [showAddGoal, setShowAddGoal] = useState(false);
    const [showEditTarget, setShowEditTarget] = useState(false);
    const [newGoalTitle, setNewGoalTitle] = useState('');
    const [newGoalTarget, setNewGoalTarget] = useState('');
    const [newGoalIconKey, setNewGoalIconKey] = useState('Plane');
    const [editingTargetAmount, setEditingTargetAmount] = useState('');

    useEffect(() => {
        localStorage.setItem('pem-fun-jar-balance', String(jarBalance));
        if (onJarUpdate) onJarUpdate(jarBalance);
    }, [jarBalance, onJarUpdate]);

    useEffect(() => {
        localStorage.setItem('pem-fun-jar-history', JSON.stringify(history));
    }, [history]);

    useEffect(() => {
        localStorage.setItem('pem-fun-jar-goals', JSON.stringify(goals));
    }, [goals]);

    useEffect(() => {
        if (selectedGoal?.id) {
            localStorage.setItem('pem-fun-jar-selected-goal-id', selectedGoal.id);
        }
    }, [selectedGoal]);

    const goalProgressPct = selectedGoal && selectedGoal.target > 0
        ? Math.min(100, Math.round((jarBalance / selectedGoal.target) * 100))
        : 0;

    const recordStashTransaction = async (amount, desc, shouldDeduct = true) => {
        const uid = currentUser?.id;
        if (!uid || !shouldDeduct) return null;

        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/transactions/manual`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    type: 'expense',
                    amount: parseFloat(amount),
                    category: 'Savings',
                    description: `Fun Money Jar: ${desc}`,
                    userId: uid,
                    paymentMode: 'Cash/Pot Transfer',
                    date: new Date(),
                    source: 'fun_jar_hold',
                }),
            });

            if (res.ok) {
                const txData = await res.json();

                const pendingList = JSON.parse(localStorage.getItem('pem-fun-jar-pending-verifications') || '[]');
                const newVerification = {
                    id: `verify_${Date.now()}`,
                    transactionId: txData.id,
                    amount: parseFloat(amount),
                    goalTitle: selectedGoal?.title || 'Fun Money Goal',
                    date: new Date().toISOString(),
                    dateStr: todayKey,
                    status: 'pending',
                };
                localStorage.setItem('pem-fun-jar-pending-verifications', JSON.stringify([newVerification, ...pendingList]));

                if (onReloadTransactions) onReloadTransactions();
                return txData.id;
            } else {
                const errData = await res.json().catch(() => ({}));
                console.error('Failed to record stash transaction:', res.status, errData);
            }
        } catch (err) {
            console.error('Failed to record stash transaction network error:', err);
        }
        return null;
    };

    const recordWithdrawalTransaction = async (amount, desc, shouldDeposit = true) => {
        const uid = currentUser?.id;
        if (!uid || !shouldDeposit) return null;

        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/transactions/manual`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    type: 'income',
                    amount: parseFloat(amount),
                    category: 'Savings',
                    description: `Fun Pot Return to Main Balance: ${desc}`,
                    userId: uid,
                    paymentMode: 'Cash/Pot Transfer',
                    date: new Date(),
                    source: 'fun_jar_withdraw',
                }),
            });

            if (res.ok) {
                const txData = await res.json();
                if (onReloadTransactions) onReloadTransactions();
                return txData.id;
            } else {
                const errData = await res.json().catch(() => ({}));
                console.error('Failed to record withdrawal transaction:', res.status, errData);
            }
        } catch (err) {
            console.error('Failed to record withdrawal transaction network error:', err);
        }
        return null;
    };

    const handleAction = async () => {
        const val = Number(customAmount) || 0;
        if (val <= 0) return;

        if (actionTab === 'withdraw' && val > jarBalance) {
            return;
        }

        setLoadingAction(true);
        try {
            let txId = null;
            if (actionTab === 'deposit') {
                txId = await recordStashTransaction(val, `${selectedGoal?.title || 'Goal'} Stash`, deductFromMainBalance);
            } else if (actionTab === 'withdraw') {
                txId = await recordWithdrawalTransaction(val, `${selectedGoal?.title || 'Goal'} Withdrawal`, depositBackToMainBalance);
            }

            const newBal = actionTab === 'deposit' ? jarBalance + val : Math.max(0, jarBalance - val);
            setJarBalance(newBal);

            const newEntry = {
                id: String(Date.now()),
                type: actionTab,
                desc: actionTab === 'deposit'
                    ? `Guilt-Free Pot Deposit (${selectedGoal?.title || 'Fun Goal'})`
                    : `Withdrawn to Main Balance (${selectedGoal?.title || 'Fun Goal'})`,
                amount: val,
                realTx: Boolean(txId),
                date: 'Today ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setHistory((prev) => [newEntry, ...prev]);
            setCustomAmount('');

            if (actionTab === 'deposit') {
                setToastMessage(`🪙 Stashed ${formatCurrency(val, currency)}! Remember to put this liquid cash into your physical pot.`);
            } else {
                setToastMessage(`💰 Withdrew ${formatCurrency(val, currency)} from pot and credited back to your Main Balance!`);
            }
            setTimeout(() => setToastMessage(null), 4500);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleAutoRollover = async () => {
        if (todayUnderSpend <= 0 || isStashedToday) return;

        setLoadingAction(true);
        try {
            const txId = await recordStashTransaction(todayUnderSpend, `Safe-to-Spend Daily Underspend`, true);

            const newBal = jarBalance + todayUnderSpend;
            setJarBalance(newBal);
            setLastStashedDate(todayKey);
            localStorage.setItem('pem-fun-jar-last-stashed-date', todayKey);

            const newEntry = {
                id: String(Date.now()),
                type: 'deposit',
                desc: "Today's Safe-to-Spend Surplus Stash",
                amount: todayUnderSpend,
                realTx: Boolean(txId),
                date: 'Today ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setHistory((prev) => [newEntry, ...prev]);

            setToastMessage(`🪙 ${formatCurrency(todayUnderSpend, currency)} stashed! Please move this liquid cash into your physical pot.`);
            setTimeout(() => setToastMessage(null), 4500);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleCreateCustomGoal = (e) => {
        e.preventDefault();
        const trimmedTitle = newGoalTitle.trim();
        const targetVal = Number(newGoalTarget) || 0;
        if (!trimmedTitle || targetVal <= 0) return;

        const newGoal = {
            id: `goal_${Date.now()}`,
            title: trimmedTitle,
            target: targetVal,
            iconKey: newGoalIconKey || 'Plane',
            isCustom: true,
        };

        const updated = [...goals, newGoal];
        setGoals(updated);
        setSelectedGoalId(newGoal.id);
        setShowAddGoal(false);
        setNewGoalTitle('');
        setNewGoalTarget('');

        setToastMessage(`🎯 Custom goal "${trimmedTitle}" set as active target!`);
        setTimeout(() => setToastMessage(null), 3500);
    };

    const handleSaveEditTarget = (e) => {
        e.preventDefault();
        const targetVal = Number(editingTargetAmount) || 0;
        if (targetVal <= 0 || !selectedGoal) return;

        const updated = goals.map((g) =>
            g.id === selectedGoal.id ? { ...g, target: targetVal } : g
        );
        setGoals(updated);
        setShowEditTarget(false);
        setEditingTargetAmount('');

        setToastMessage(`🎯 Updated target for "${selectedGoal.title}" to ${formatCurrency(targetVal, currency)}`);
        setTimeout(() => setToastMessage(null), 3500);
    };

    const handleDeleteGoal = (goalId, e) => {
        e.stopPropagation();
        if (goals.length <= 1) return;

        const updated = goals.filter((g) => g.id !== goalId);
        setGoals(updated);
        if (selectedGoalId === goalId) {
            setSelectedGoalId(updated[0]?.id || DEFAULT_GOALS[0].id);
        }
    };

    const clearJarBalance = () => {
        setJarBalance(0);
        localStorage.setItem('pem-fun-jar-balance', '0');
        setLastStashedDate('');
        localStorage.removeItem('pem-fun-jar-last-stashed-date');
        if (onJarUpdate) onJarUpdate(0);
        setToastMessage('Fun Pot balance has been reset to ₹0 & stash lock cleared.');
        setTimeout(() => setToastMessage(null), 3500);
    };

    const resetTodayStash = () => {
        setLastStashedDate('');
        localStorage.removeItem('pem-fun-jar-last-stashed-date');
        setToastMessage("Today's stash lock reset! You can now test stashing today's surplus again.");
        setTimeout(() => setToastMessage(null), 3500);
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem('pem-fun-jar-history');
        setLastStashedDate('');
        localStorage.removeItem('pem-fun-jar-last-stashed-date');
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
                                        Physical &amp; Digital Pot
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
                            className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.04] text-ink-muted hover:bg-white/[0.08] hover:text-white transition cursor-pointer"
                        >
                            <X size={17} />
                        </button>
                    </div>

                    {/* Body Content */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#0c1427]">
                        {/* Toast Alert Message */}
                        <AnimatePresence>
                            {toastMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="rounded-2xl bg-amber-500/20 border border-amber-500/40 p-3.5 flex items-center gap-3 text-xs font-bold text-amber-200 shadow-lg"
                                >
                                    <Coins size={18} className="text-amber-300 shrink-0" />
                                    <span>{toastMessage}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Live Daily Underspend Alert Banner */}
                        <div className="rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#101a33] to-[#101a33] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
                            <div className="flex items-center gap-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-300">
                                    {isStashedToday ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Zap size={20} />}
                                </span>
                                <div>
                                    {isStashedToday ? (
                                        <>
                                            <p className="text-xs font-black text-emerald-300">
                                                ✓ Today's Safe-to-Spend surplus is securely stashed!
                                            </p>
                                            <p className="text-[11px] text-ink-muted">
                                                Locked {formatCurrency(todayUnderSpend, currency)} into your Fun Jar for today.
                                            </p>
                                        </>
                                    ) : todayUnderSpend > 0 ? (
                                        <>
                                            <p className="text-xs font-black text-amber-300">
                                                You have {formatCurrency(todayUnderSpend, currency)} unspent live allowance today!
                                            </p>
                                            <p className="text-[11px] text-ink-muted">
                                                Today's spend: {formatCurrency(todaySpent, currency)} / Target: {formatCurrency(dailyTarget, currency)}. Lock this surplus directly into your Fun Jar.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-xs font-black text-ink-muted">
                                                No daily surplus remaining for today
                                            </p>
                                            <p className="text-[11px] text-ink-faint">
                                                Today's spend ({formatCurrency(todaySpent, currency)}) has reached or exceeded today's allowance ({formatCurrency(dailyTarget, currency)}).
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {todayUnderSpend > 0 && !isStashedToday && (
                                <button
                                    type="button"
                                    onClick={handleAutoRollover}
                                    disabled={loadingAction}
                                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                    {loadingAction ? 'Stashing...' : `+ Stash ${formatCurrency(todayUnderSpend, currency)} Now`}
                                </button>
                            )}
                            {isStashedToday && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-bold">
                                        <CheckCircle2 size={13} />
                                        Stashed Today
                                    </span>
                                    <button
                                        type="button"
                                        onClick={resetTodayStash}
                                        title="Reset stash lock to test stashing today's amount again"
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                                    >
                                        <RotateCcw size={11} />
                                        Reset Lock
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Middle Section: Fun Jar Tank + Goals + Actions */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                            {/* Visual Liquid Fun Jar */}
                            <div className="md:col-span-5 rounded-3xl bg-[#080e1d] p-5 flex flex-col items-center justify-between relative overflow-hidden shadow-2xl">
                                <div className="w-full flex items-center justify-between text-xs font-bold text-ink-muted">
                                    <span className="uppercase tracking-wider text-[10px]">Available Fun Pool</span>
                                    <span className="text-emerald-400 font-extrabold bg-emerald-500/10 px-2.5 py-0.5 rounded-full text-[10px]">
                                        100% Guilt-Free
                                    </span>
                                </div>

                                {/* Animated Glass Jar Container */}
                                <div className="my-5 relative w-36 h-48 rounded-[36px] border-4 border-amber-400/30 bg-[#0c1427]/80 overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.15)] flex flex-col justify-end">
                                    {/* Jar Neck/Cap */}
                                    <div className="absolute top-0 inset-x-4 h-3 bg-amber-400/40 rounded-b-md" />

                                    {/* Liquid Wave Level */}
                                    <motion.div
                                        className="w-full bg-gradient-to-t from-amber-500 via-pink-500 to-rose-400 opacity-85 relative"
                                        initial={{ height: 0 }}
                                        animate={{ height: `${jarBalance <= 0 ? 0 : Math.max(12, Math.min(100, goalProgressPct))}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                    >
                                        {jarBalance > 0 && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                                                <Coins size={28} className="text-amber-200 animate-pulse" />
                                            </div>
                                        )}
                                    </motion.div>
                                </div>

                                <div className="text-center w-full">
                                    <p className="text-3xl font-black text-white tracking-tight tnum">
                                        {formatCurrency(jarBalance, currency)}
                                    </p>
                                    <div className="flex items-center justify-center gap-1.5 mt-0.5">
                                        <p className="text-xs text-ink-muted font-medium">
                                            {goalProgressPct}% of {selectedGoal ? selectedGoal.title : 'Fun Goal'} ({formatCurrency(selectedGoal ? selectedGoal.target : 0, currency)})
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingTargetAmount(String(selectedGoal?.target || 10000));
                                                setShowEditTarget(true);
                                            }}
                                            title="Edit Goal Target Amount"
                                            className="text-ink-faint hover:text-teal-300 transition cursor-pointer"
                                        >
                                            <Edit3 size={12} />
                                        </button>
                                    </div>

                                    {/* Clear/Reset Button */}
                                    {jarBalance > 0 && (
                                        <button
                                            type="button"
                                            onClick={clearJarBalance}
                                            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-ink-muted hover:text-amber-300 bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1 rounded-lg transition cursor-pointer"
                                        >
                                            <RotateCcw size={12} />
                                            Reset Pool to {formatCurrency(0, currency)}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Right Controls: Goal Picker & Quick Stash/Spend */}
                            <div className="md:col-span-7 space-y-4">
                                {/* Goal Selector Header */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                            Select Target Fun Goal
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddGoal(!showAddGoal)}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-2.5 py-1 rounded-xl transition cursor-pointer"
                                        >
                                            <Plus size={13} />
                                            + Custom Goal
                                        </button>
                                    </div>

                                    {/* Add Custom Goal Inline Form */}
                                    <AnimatePresence>
                                        {showAddGoal && (
                                            <motion.form
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                onSubmit={handleCreateCustomGoal}
                                                className="mb-3 rounded-2xl bg-[#080e1d] border border-teal-500/30 p-3.5 space-y-3 shadow-xl overflow-hidden"
                                            >
                                                <div className="flex items-center justify-between text-xs font-bold text-teal-300">
                                                    <span>Create New Custom Goal</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAddGoal(false)}
                                                        className="text-ink-muted hover:text-white"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[10px] font-semibold text-ink-muted block mb-1">Goal Name</label>
                                                        <input
                                                            type="text"
                                                            value={newGoalTitle}
                                                            onChange={(e) => setNewGoalTitle(e.target.value)}
                                                            placeholder="e.g. Apple Watch Ultra, Bali Trip"
                                                            required
                                                            className="w-full rounded-xl bg-[#101a33] px-3 py-1.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-teal-400"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-semibold text-ink-muted block mb-1">Target Amount ({currency})</label>
                                                        <input
                                                            type="number"
                                                            value={newGoalTarget}
                                                            onChange={(e) => setNewGoalTarget(e.target.value)}
                                                            placeholder="e.g. 35000"
                                                            required
                                                            className="w-full rounded-xl bg-[#101a33] px-3 py-1.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-teal-400"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Icon Selector */}
                                                <div>
                                                    <label className="text-[10px] font-semibold text-ink-muted block mb-1">Choose Icon</label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {ICON_OPTIONS.map((opt) => {
                                                            const IconCmp = opt.icon;
                                                            const isSel = newGoalIconKey === opt.key;
                                                            return (
                                                                <button
                                                                    key={opt.key}
                                                                    type="button"
                                                                    onClick={() => setNewGoalIconKey(opt.key)}
                                                                    className={cx(
                                                                        'h-7 w-7 grid place-items-center rounded-lg transition cursor-pointer',
                                                                        isSel
                                                                            ? 'bg-teal-500 text-black shadow-md'
                                                                            : 'bg-[#101a33] text-ink-muted hover:text-white'
                                                                    )}
                                                                    title={opt.label}
                                                                >
                                                                    <IconCmp size={14} />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="flex justify-end gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAddGoal(false)}
                                                        className="px-3 py-1.5 rounded-xl bg-white/[0.05] text-xs font-semibold text-ink-muted hover:text-white"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-black text-xs font-extrabold shadow-md transition"
                                                    >
                                                        Save &amp; Set Goal
                                                    </button>
                                                </div>
                                            </motion.form>
                                        )}
                                    </AnimatePresence>

                                    {/* Edit Target Amount Quick Modal/Form */}
                                    <AnimatePresence>
                                        {showEditTarget && (
                                            <motion.form
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                onSubmit={handleSaveEditTarget}
                                                className="mb-3 rounded-2xl bg-[#080e1d] border border-amber-500/30 p-3.5 space-y-2.5 shadow-xl overflow-hidden"
                                            >
                                                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                                                    <span>Set Target for "{selectedGoal.title}"</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowEditTarget(false)}
                                                        className="text-ink-muted hover:text-white"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>

                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={editingTargetAmount}
                                                        onChange={(e) => setEditingTargetAmount(e.target.value)}
                                                        placeholder="New Target Amount"
                                                        required
                                                        className="flex-1 rounded-xl bg-[#101a33] px-3.5 py-1.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                                                    />
                                                    <button
                                                        type="submit"
                                                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold shadow-md transition"
                                                    >
                                                        Update Target
                                                    </button>
                                                </div>
                                            </motion.form>
                                        )}
                                    </AnimatePresence>

                                    {/* Goals Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                                        {goals.map((g) => {
                                            const Icon = ICON_MAP[g.iconKey] || Plane;
                                            const isSel = selectedGoal?.id === g.id;
                                            return (
                                                <div
                                                    key={g.id}
                                                    onClick={() => setSelectedGoalId(g.id)}
                                                    className={cx(
                                                        'group relative p-3 rounded-2xl text-left transition overflow-hidden flex flex-col justify-between h-24 cursor-pointer select-none',
                                                        isSel
                                                            ? 'bg-[#101a33] border border-teal-400/50 shadow-[0_0_15px_rgba(20,184,166,0.2)]'
                                                            : 'bg-[#101a33]/60 hover:bg-[#101a33]'
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className={cx('grid h-7 w-7 place-items-center rounded-xl', isSel ? 'bg-teal-400/20 text-teal-300' : 'bg-white/[0.05] text-ink-muted')}>
                                                            <Icon size={14} />
                                                        </span>
                                                        {g.isCustom && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDeleteGoal(g.id, e)}
                                                                title="Delete Goal"
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-ink-faint hover:text-rose-400 transition cursor-pointer"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-white leading-tight truncate">
                                                            {g.title}
                                                        </p>
                                                        <p className="text-[10px] text-ink-muted tnum font-semibold mt-0.5">
                                                            {formatCurrency(g.target, currency)}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Manual Action Box */}
                                <div className="rounded-2xl bg-[#101a33] p-4 shadow-inner space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                                            Quick Jar Action
                                        </span>
                                        <div className="inline-flex rounded-xl bg-[#080e1d] p-1 gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setActionTab('deposit')}
                                                className={cx(
                                                    'px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer',
                                                    actionTab === 'deposit'
                                                        ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                                                        : 'text-ink-muted hover:text-white'
                                                )}
                                            >
                                                + Stash Fun Money
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActionTab('withdraw')}
                                                className={cx(
                                                    'px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer',
                                                    actionTab === 'withdraw'
                                                        ? 'bg-teal-500/20 text-teal-300 shadow-sm'
                                                        : 'text-ink-muted hover:text-white'
                                                )}
                                            >
                                                - Withdraw / Return to Main
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={customAmount}
                                            onChange={(e) => setCustomAmount(e.target.value)}
                                            placeholder={actionTab === 'deposit' ? 'Enter amount to stash (e.g. 1000)' : 'Amount to withdraw (e.g. 500)'}
                                            className="flex-1 rounded-xl bg-[#080e1d] px-3.5 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-400"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAction}
                                            disabled={loadingAction || !customAmount || Number(customAmount) <= 0 || (actionTab === 'withdraw' && Number(customAmount) > jarBalance)}
                                            className={cx(
                                                'px-4 py-2 rounded-xl text-xs font-black shadow-md transition cursor-pointer shrink-0',
                                                actionTab === 'deposit'
                                                    ? 'bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40'
                                                    : 'bg-teal-500 text-black hover:bg-teal-400 disabled:opacity-40'
                                            )}
                                        >
                                            {loadingAction ? '...' : (actionTab === 'deposit' ? 'Stash' : 'Withdraw')}
                                        </button>
                                    </div>

                                    {actionTab === 'deposit' && (
                                        <label className="flex items-center gap-2 text-[11px] text-ink-muted cursor-pointer select-none pt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={deductFromMainBalance}
                                                onChange={(e) => setDeductFromMainBalance(e.target.checked)}
                                                className="rounded accent-amber-400 cursor-pointer"
                                            />
                                            <span>Deduct from Main Balance &amp; record as Savings transfer</span>
                                        </label>
                                    )}

                                    {actionTab === 'withdraw' && (
                                        <label className="flex items-center gap-2 text-[11px] text-teal-300/90 cursor-pointer select-none pt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={depositBackToMainBalance}
                                                onChange={(e) => setDepositBackToMainBalance(e.target.checked)}
                                                className="rounded accent-teal-400 cursor-pointer"
                                            />
                                            <span>Add withdrawn amount back into Main Account Balance</span>
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Fun Jar Activity Ledger */}
                        <div>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    Fun Jar Activity Ledger
                                </span>
                                {history.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={clearHistory}
                                        className="text-[10px] text-ink-muted hover:text-rose-400 flex items-center gap-1 cursor-pointer transition"
                                    >
                                        <Trash2 size={11} />
                                        Clear History
                                    </button>
                                )}
                            </div>
                            {history.length === 0 ? (
                                <div className="rounded-2xl bg-[#101a33]/60 p-6 text-center text-xs text-ink-muted">
                                    No stash activity recorded yet. Beat today's Safe-to-Spend target to auto-stash or add funds above!
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {history.slice(0, 10).map((h) => {
                                        const isHold = h.type === 'deposit' && h.realTx;
                                        return (
                                            <div
                                                key={h.id}
                                                className={cx(
                                                    'flex items-center justify-between p-3 rounded-xl text-xs font-semibold',
                                                    isHold ? 'bg-[#101a33] border border-amber-500/30' : 'bg-[#101a33]'
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span
                                                        className={cx(
                                                            'grid h-7 w-7 place-items-center rounded-lg',
                                                            isHold ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : h.type === 'deposit' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-teal-500/20 text-teal-300'
                                                        )}
                                                    >
                                                        {h.type === 'deposit' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                                    </span>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="font-bold text-white">{h.desc}</p>
                                                            {isHold && (
                                                                <span className="text-[9px] font-extrabold uppercase bg-amber-500/20 border border-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded-full">
                                                                    🕒 Hold
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-ink-muted">{h.date}</p>
                                                    </div>
                                                </div>

                                                <span
                                                    className={cx(
                                                        'font-black tnum',
                                                        isHold ? 'text-amber-400 font-extrabold' : h.type === 'deposit' ? 'text-emerald-400' : 'text-teal-300'
                                                    )}
                                                >
                                                    {isHold ? '🕒 +' : h.type === 'deposit' ? '+' : '-'}{formatCurrency(h.amount, currency)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

export default FunSavingsJarModal;
