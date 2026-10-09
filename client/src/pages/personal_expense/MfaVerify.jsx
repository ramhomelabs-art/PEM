import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle2, ArrowRight, Smartphone, Loader2, KeyRound, AlertCircle, Sparkles } from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';

const MfaVerify = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();
    const { userId, mfaMethod, requestId } = location.state || {};

    const hasPush = Boolean(requestId && (mfaMethod === 'push' || mfaMethod === 'both'));

    const [otp, setOtp] = useState('');
    const [status, setStatus] = useState(() => (hasPush ? 'polling' : 'idle')); // idle | polling | verifying | success | error
    const [error, setError] = useState('');
    const [mode, setMode] = useState(() => (hasPush ? 'push' : 'totp')); // 'push' | 'totp'
    const [authenticatedUser, setAuthenticatedUser] = useState(null);

    const handleSuccess = useCallback((token, user) => {
        setAuthenticatedUser(user);
        setStatus('success');

        setTimeout(() => {
            login(user, token);
            navigate('/');
        }, 900);
    }, [login, navigate]);

    // Background push approval poller
    const startPolling = useCallback(() => {
        if (!requestId) return undefined;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_URL}/mfa/auth/status/${requestId}`);
                if (!response.ok) return;

                const data = await response.json();
                if (data.status === 'approved') {
                    clearInterval(pollInterval);
                    handleSuccess(data.token, data.user || { username: 'User' });
                } else if (data.status === 'denied') {
                    clearInterval(pollInterval);
                    setStatus('error');
                    setError('Login request was declined on your device.');
                    setMode('totp');
                } else if (data.status === 'expired') {
                    clearInterval(pollInterval);
                    setStatus('error');
                    setError('Push request timed out. Please enter code manually.');
                    setMode('totp');
                }
            } catch {
                // Transient poll error
            }
        }, 2000);

        return () => clearInterval(pollInterval);
    }, [requestId, handleSuccess]);

    useEffect(() => {
        if (!userId) {
            navigate('/login');
            return undefined;
        }

        if (hasPush && mode === 'push' && status !== 'success') {
            return startPolling();
        }
        return undefined;
    }, [userId, hasPush, mode, status, navigate, startPolling]);

    const handleOtpSubmit = async (e) => {
        e?.preventDefault?.();
        if (otp.length !== 6 || status === 'verifying') return;
        setStatus('verifying');
        setError('');

        try {
            const response = await fetch(`${API_URL}/mfa/auth/verify-totp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, code: otp })
            });

            if (response.ok) {
                const data = await response.json();
                handleSuccess(data.token, data.user);
            } else {
                const data = await response.json();
                setStatus('idle');
                setError(data.error || 'Invalid verification code. Please check your authenticator app.');
            }
        } catch {
            setStatus('idle');
            setError('Verification failed. Please check your connection.');
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-sunken text-ink selection:bg-emerald-500 selection:text-white relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full max-w-md rounded-3xl border border-line bg-surface/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative z-10"
            >
                {/* Header */}
                <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-line">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
                            Two-Factor Security
                        </h1>
                        <p className="text-xs text-ink-muted font-medium">
                            {mode === 'push' ? 'Approve login on paired device' : 'Enter 6-digit Authenticator code'}
                        </p>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* Success state */}
                    {status === 'success' ? (
                        <motion.div
                            key="success"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center py-6 space-y-4"
                        >
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-lg font-bold text-ink">Authenticated!</h2>
                                <p className="text-xs text-ink-muted">
                                    Welcome back{authenticatedUser?.fullName ? `, ${authenticatedUser.fullName}` : ''}. Redirecting...
                                </p>
                            </div>
                        </motion.div>
                    ) : mode === 'push' && hasPush ? (
                        /* PUSH MODE */
                        <motion.div
                            key="push-mode"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="p-6 rounded-2xl bg-sunken/80 border border-line text-center space-y-4">
                                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                                    <Smartphone className="w-7 h-7 text-emerald-400 animate-pulse" />
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-sm font-bold text-ink flex items-center justify-center gap-1.5">
                                        <Sparkles className="w-4 h-4 text-emerald-400" />
                                        <span>Check Paired Device</span>
                                    </p>
                                    <p className="text-xs text-ink-muted leading-relaxed max-w-xs mx-auto">
                                        Tap <span className="text-emerald-400 font-semibold">Approve</span> on your Android phone prompt to log in instantly.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode('totp');
                                        setError('');
                                    }}
                                    className="w-full py-2.5 px-3 rounded-xl bg-surface border border-line text-xs font-semibold text-ink-muted hover:text-ink hover:border-line transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Enter 6-Digit Code Instead</span>
                                </button>
                            </div>

                            {error && (
                                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 justify-center text-center">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="w-full py-2 text-xs font-semibold text-ink-faint hover:text-ink-muted transition-colors cursor-pointer text-center"
                            >
                                Back to Login
                            </button>
                        </motion.div>
                    ) : (
                        /* TOTP MODE */
                        <motion.div
                            key="totp-mode"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <form onSubmit={handleOtpSubmit} className="space-y-6">
                                <div className="space-y-3 text-center">
                                    <label className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center justify-center gap-1.5">
                                        <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Enter 6-Digit Authenticator Code</span>
                                    </label>
                                    <div className="relative max-w-xs mx-auto">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={6}
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                            placeholder="••••••"
                                            className="w-full text-center text-3xl font-mono tracking-[0.35em] py-3.5 px-4 rounded-2xl bg-sunken border-2 border-line focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 text-ink placeholder:text-ink-faint outline-none transition-all shadow-inner"
                                            autoFocus
                                        />
                                    </div>

                                </div>

                                {error && (
                                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 justify-center text-center">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <motion.button
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        type="submit"
                                        disabled={otp.length !== 6 || status === 'verifying'}
                                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                                    >
                                        {status === 'verifying' ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <span>Verify & Sign In</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </motion.button>

                                    {hasPush && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMode('push');
                                                setError('');
                                                setStatus('polling');
                                            }}
                                            className="w-full py-2 text-xs font-semibold text-ink-muted hover:text-ink flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                                            <span>Switch Back to Mobile Push Approval</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => navigate('/login')}
                                        className="w-full py-2 text-xs font-semibold text-ink-faint hover:text-ink-muted transition-colors cursor-pointer text-center"
                                    >
                                        Back to Login
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default MfaVerify;
