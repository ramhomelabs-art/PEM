import React, { useState } from 'react';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { API_URL } from '../../config';
import { Lock, Unlock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SecurityLock = ({ onUnlock }) => {
    const { theme } = useTheme();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleUnlock = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/auth/verify-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                onUnlock(password);
            } else {
                setError(data.error || 'Incorrect password');
            }
        } catch {
            setError('Verification failed. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl rounded-[24px]">
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="pem-card relative w-full max-w-[420px] p-8 text-center rounded-[24px] border border-white/10 bg-[#0c1427]/95 shadow-raised overflow-hidden"
            >
                {/* Top ambient highlight line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_25px_rgba(16,185,129,0.25)] mx-auto mb-5">
                    <Lock size={32} />
                </div>

                <h2 className="text-2xl font-black text-ink tracking-tight mb-2">Vault Security Check</h2>
                <p className="text-xs leading-relaxed text-ink-muted mb-6">
                    Enter your master password to decrypt and view sensitive account and card details.
                </p>

                <form onSubmit={handleUnlock} className="flex flex-col gap-3.5">
                    <div className="relative w-full">
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            className="h-11 w-full rounded-control border border-line bg-surface/80 pl-10 pr-10 text-sm font-semibold text-ink placeholder:text-ink-muted/70 transition-all focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center text-ink-muted transition hover:text-ink cursor-pointer"
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="flex items-center justify-center gap-2 text-xs font-bold text-rose-400"
                            >
                                <AlertCircle size={14} /> {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="h-11 w-full rounded-control border border-emerald-400/30 bg-gradient-to-r from-emerald-500 to-teal-500 font-black text-slate-950 text-sm shadow-[0_8px_20px_-8px_rgba(16,185,129,0.5)] transition-all hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                        {loading ? 'Verifying…' : (
                            <>
                                <Unlock size={17} /> Unlock Vault
                            </>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default SecurityLock;

