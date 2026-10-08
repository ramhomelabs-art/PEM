import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle2, ArrowRight, Loader2, KeyRound, AlertCircle } from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';

const MfaVerify = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();
    const { userId } = location.state || {};

    const [otp, setOtp] = useState('');
    const [status, setStatus] = useState('idle'); // idle | verifying | success | error
    const [error, setError] = useState('');
    const [authenticatedUser, setAuthenticatedUser] = useState(null);

    const handleSuccess = useCallback((token, user) => {
        setAuthenticatedUser(user);
        setStatus('success');

        setTimeout(() => {
            login(user, token);
            navigate('/');
        }, 900);
    }, [login, navigate]);

    useEffect(() => {
        if (!userId) {
            navigate('/login');
        }
    }, [userId, navigate]);

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
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-900/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative z-10"
            >
                {/* Header */}
                <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            Security Verification
                        </h1>
                        <p className="text-xs text-slate-400 font-medium">
                            Enter 6-digit Authenticator code to continue
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
                                <h2 className="text-lg font-bold text-white">Authenticated!</h2>
                                <p className="text-xs text-slate-400">
                                    Welcome back{authenticatedUser?.fullName ? `, ${authenticatedUser.fullName}` : ''}. Redirecting...
                                </p>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="challenge" className="space-y-6">
                            <form onSubmit={handleOtpSubmit} className="space-y-6">
                                <div className="space-y-3 text-center">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1.5">
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
                                            className="w-full text-center text-3xl font-mono tracking-[0.35em] py-3.5 px-4 rounded-2xl bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 text-white placeholder:text-slate-600 outline-none transition-all shadow-inner"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        From Google Authenticator, Microsoft Authenticator, or 1Password.
                                    </p>
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

                                    <button
                                        type="button"
                                        onClick={() => navigate('/login')}
                                        className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
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
