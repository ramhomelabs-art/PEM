import { notifyDataChanged } from '../../utils/realtimeSync';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Coins,
    Gift,
    CheckCircle2,
    XCircle,
    X,
    RotateCcw,
    AlertCircle,
    ArrowRight,
    HelpCircle,
    Clock,
    Sparkles,
    ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { cx } from '../ui/cx';
import { API_URL } from '../../config';

export function FunPotVerificationModal({
    isOpen,
    verificationItem,
    onClose,
    onVerified,
    onRolledBack,
    currency = 'INR',
}) {
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);

    if (!isOpen || !verificationItem) return null;

    const { id, transactionId, amount, goalTitle, date } = verificationItem;

    const formattedDate = date ? new Date(date).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }) : 'Yesterday';

    const handleConfirm = async () => {
        setLoading(true);
        try {
            // 1. If there is a backend transactionId, convert it from temporary hold to permanent
            if (transactionId) {
                try {
                    await fetch(`${API_URL}/transactions/manual/${transactionId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token')}`,
                        },
                        body: JSON.stringify({
                            source: 'manual',
                        }),
                    });
                } catch (err) {
                    console.error('Failed to convert transaction to permanent:', err);
                }
            }

            // Update pending verification list in localStorage
            const savedList = JSON.parse(localStorage.getItem('pem-fun-jar-pending-verifications') || '[]');
            const updated = savedList.map((item) =>
                item.id === id ? { ...item, status: 'confirmed' } : item
            );
            localStorage.setItem('pem-fun-jar-pending-verifications', JSON.stringify(updated));

            setStatusMessage({ type: 'success', text: `Confirmed! ${formatCurrency(amount, currency)} is now a permanent savings record.` });
            setTimeout(() => {
                if (onVerified) onVerified(verificationItem); notifyDataChanged("transactions");
                onClose();
            }, 1200);
        } catch (e) {
            console.error(e);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleRollback = async () => {
        setLoading(true);
        try {
            // 1. If there is a real backend transactionId, delete it to restore main balance
            if (transactionId) {
                try {
                    await fetch(`${API_URL}/transactions/manual/${transactionId}`, {
                        method: 'DELETE',
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem('token')}`,
                        },
                    });
                } catch (err) {
                    console.error('Failed to delete transaction:', err);
                }
            }

            // 2. Roll back jar balance
            const currentJar = Number(localStorage.getItem('pem-fun-jar-balance') || 0);
            const newJar = Math.max(0, currentJar - amount);
            localStorage.setItem('pem-fun-jar-balance', String(newJar));

            // 3. Add reversal entry to jar history
            const history = JSON.parse(localStorage.getItem('pem-fun-jar-history') || '[]');
            const reversalEntry = {
                id: String(Date.now()),
                type: 'withdraw',
                desc: `Unconfirmed Stash Reversal (${goalTitle || 'Fun Pot'})`,
                amount: amount,
                date: 'Just now (Rolled back)',
            };
            localStorage.setItem('pem-fun-jar-history', JSON.stringify([reversalEntry, ...history]));

            // 4. Update verification status
            const savedList = JSON.parse(localStorage.getItem('pem-fun-jar-pending-verifications') || '[]');
            const updated = savedList.map((item) =>
                item.id === id ? { ...item, status: 'rolled_back' } : item
            );
            localStorage.setItem('pem-fun-jar-pending-verifications', JSON.stringify(updated));

            setStatusMessage({ type: 'info', text: `Rolled back ${formatCurrency(amount, currency)}. Your main balance and Fun Jar have been restored.` });
            setTimeout(() => {
                if (onRolledBack) onRolledBack(verificationItem, newJar);
                onClose();
            }, 1400);
        } catch (e) {
            console.error(e);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
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
                    initial={{ opacity: 0, scale: 0.94, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 20 }}
                    className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface border border-amber-500/30 shadow-[0_24px_80px_rgba(0,0,0,0.95)] z-10 p-6 space-y-5 text-center"
                >
                    {/* Top ambient highlight */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500" />

                    {/* Top-Right Close Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close (will remind you next time you log in)"
                        className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-xl bg-raised text-ink-muted hover:bg-line hover:text-ink transition cursor-pointer"
                    >
                        <X size={16} />
                    </button>

                    {/* Icon & Title */}
                    <div className="flex flex-col items-center">
                        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 text-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.3)] mb-3">
                            <Coins size={32} />
                        </span>
                        <h3 className="text-lg font-black tracking-tight text-ink">
                            Physical Pot Deposit Check-In
                        </h3>
                        <p className="text-xs text-ink-muted mt-1 max-w-xs">
                            Keep your physical cash pot and digital balance 100% in sync with real life.
                        </p>
                    </div>

                    {/* Pending Stash Card */}
                    <div className="rounded-2xl bg-sunken border border-line p-4 text-left space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-ink-muted flex items-center gap-1.5 font-medium">
                                <Clock size={13} />
                                Stashed on {formattedDate}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold text-[10px] uppercase tracking-wide">
                                Pending Verification
                            </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                            <div>
                                <p className="text-xs font-bold text-ink">
                                    {goalTitle || 'Fun Money Goal'}
                                </p>
                                <p className="text-[11px] text-ink-muted">
                                    Deducted from Main Account Balance
                                </p>
                            </div>
                            <span className="text-xl font-black text-amber-300 tnum">
                                {formatCurrency(amount, currency)}
                            </span>
                        </div>
                    </div>

                    <p className="text-xs font-semibold text-ink leading-relaxed px-1">
                        Did you physically put this <span className="text-amber-300 font-bold">{formatCurrency(amount, currency)}</span> into your cash jar or savings pot?
                    </p>

                    {statusMessage && (
                        <div
                            className={cx(
                                'p-3 rounded-xl text-xs font-bold text-center',
                                statusMessage.type === 'success'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-teal-500/20 text-teal-300'
                            )}
                        >
                            {statusMessage.text}
                        </div>
                    )}

                    {/* Decision Actions */}
                    {!statusMessage && (
                        <div className="space-y-2 pt-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={loading}
                                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-xs font-black shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                                >
                                    <CheckCircle2 size={16} />
                                    <span>Yes, I Added It</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRollback}
                                    disabled={loading}
                                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-raised hover:bg-line text-rose-300 hover:text-rose-200 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                    <RotateCcw size={15} />
                                    <span>No, Roll It Back</span>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className="text-[11px] font-semibold text-ink-muted hover:text-ink transition cursor-pointer py-1"
                            >
                                Remind Me Next Time I Log In →
                            </button>
                        </div>
                    )}

                    <p className="text-[10px] text-ink-faint">
                        Choosing "No" automatically removes the transaction and restores your main balance.
                    </p>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}

export default FunPotVerificationModal;
