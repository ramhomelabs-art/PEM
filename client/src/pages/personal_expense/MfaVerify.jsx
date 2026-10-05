import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle, ArrowRight, Smartphone as PhoneIcon, Lock, Loader2, User as UserIcon, Star, Flame } from 'lucide-react';
import { API_URL, BASE_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useTheme } from '../../context/personal_expense/ThemeContext';

const MfaVerify = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();
    const { userId, mfaMethod, requestId } = location.state || {};
    const { theme, mode } = useTheme();

    const [otp, setOtp] = useState('');
    const [status, setStatus] = useState(() =>
        mfaMethod === 'push' || mfaMethod === 'both' ? 'polling' : 'idle'
    ); // idle, polling, verifying, success, error
    const [error, setError] = useState('');
    const [showTotp, setShowTotp] = useState(false);
    const [authenticatedUser, setAuthenticatedUser] = useState(null);

    const handleSuccess = useCallback((token, user) => {
        setAuthenticatedUser(user);
        setStatus('success');

        setTimeout(() => {
            login(user, token);
            navigate('/');
        }, 900);
    }, [login, navigate]);

    // Polls the MFA approval endpoint until the request is approved, denied or
    // expires. Not async: it returns the interval cleanup so the effect below
    // can always tear the timer down on unmount or method change.
    const startPolling = useCallback(() => {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_URL}/mfa/auth/status/${requestId}`);
                if (!response.ok) return;
                const data = await response.json();
                if (data.status === 'approved') {
                    if (!data.user) {
                        console.error('MFA approved but no user in response', data);
                    }
                    clearInterval(pollInterval);
                    handleSuccess(data.token, data.user || { username: 'Unknown User' });
                } else if (data.status === 'denied') {
                    clearInterval(pollInterval);
                    setStatus('error');
                    setError('Login request was denied on your device.');
                } else if (data.status === 'expired') {
                    clearInterval(pollInterval);
                    setStatus('error');
                    setError('Approval request expired.');
                }
            } catch {
                // Transient poll failure; the next tick retries.
            }
        }, 2000);

        return () => clearInterval(pollInterval);
    }, [requestId, handleSuccess]);

    useEffect(() => {
        if (!userId) {
            navigate('/login');
            return undefined;
        }

        if (mfaMethod === 'push' || mfaMethod === 'both') {
            return startPolling();
        }
        return undefined;
    }, [userId, mfaMethod, navigate, startPolling]);

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        if (otp.length !== 6) return;

        setStatus('verifying');
        setError('');

        try {
            const response = await fetch(`${API_URL}/mfa/auth/verify-totp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, code: otp })
            });

            const data = await response.json();
            if (response.ok) {
                handleSuccess(data.token, data.user);
            } else {
                setStatus('error');
                setError(data.error || 'Invalid OTP');
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch {
            setStatus('error');
            setError('Verification failed. Please try again.');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    // --- STYLES COPIED FROM LOGIN.JSX FOR CONSISTENCY ---
    const containerStyle = {
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: theme.bg
    };

    const cardStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '32px',
        background: mode === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.border}`,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        zIndex: 100,
        textAlign: 'center',
        boxSizing: 'border-box'
    };

    const inputStyle = {
        height: '52px',
        fontSize: '24px',
        letterSpacing: '0.5em',
        borderRadius: '16px',
        width: '100%',
        textAlign: 'center',
        boxSizing: 'border-box',
        fontFamily: 'monospace'
    };

    const buttonStyle = {
        height: '52px',
        fontSize: '18px',
        borderRadius: '16px',
        width: '100%',
        boxSizing: 'border-box'
    };

    return (
        <div style={containerStyle}>
            {/* Background Elements matching Login */}
            <div className="animated-bg"></div>
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="auth-card"
                style={cardStyle}
            >
                <AnimatePresence mode="wait">
                    {status === 'success' ? (
                        <motion.div
                            key="success"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-full max-w-md mx-auto"
                        >
                            {/* Modal-style Card */}
                            <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl success-inner-card border border-slate-700/50 shadow-2xl">
                                <div className="flex flex-col items-center space-y-6">

                                    {/* Circular Avatar with Ring - Corrected Layout */}
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.1, duration: 0.5 }}
                                        className="success-avatar-wrapper"
                                    >
                                        {/* Animated Success Rings - ABSOLUTE POSITIONED */}
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            pointerEvents: 'none'
                                        }}>
                                            <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                                                <motion.circle
                                                    cx="110"
                                                    cy="110"
                                                    r="90"
                                                    stroke="#10b981"
                                                    strokeWidth="4"
                                                    strokeLinecap="round"
                                                    fill="none"
                                                    initial={{ pathLength: 0, opacity: 0, rotate: -90 }}
                                                    animate={{ pathLength: 1, opacity: 1, rotate: -90 }}
                                                    transition={{ duration: 0.6, delay: 0.05, ease: "easeOut" }}
                                                />
                                                <motion.circle
                                                    cx="110"
                                                    cy="110"
                                                    r="102"
                                                    stroke="#10b981"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    fill="none"
                                                    opacity="0.4"
                                                    initial={{ pathLength: 0, opacity: 0, rotate: 90 }}
                                                    animate={{ pathLength: 1, opacity: 0.4, rotate: 90 }}
                                                    transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
                                                />
                                            </svg>
                                        </div>

                                        {/* Avatar Image - ABSOLUTE CENTERED */}
                                        <div className="success-avatar-img">
                                            {authenticatedUser?.profilePhoto ? (
                                                <img
                                                    src={authenticatedUser.profilePhoto.startsWith('http') ? authenticatedUser.profilePhoto : `${BASE_URL}/${authenticatedUser.profilePhoto.replace(/\\/g, '/')}`}
                                                    alt="Profile"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        if (e.currentTarget.nextSibling) {
                                                            e.currentTarget.nextSibling.style.display = 'flex';
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        borderRadius: '50%'
                                                    }}
                                                />
                                            ) : null}
                                            <div
                                                style={{
                                                    display: authenticatedUser?.profilePhoto ? 'none' : 'flex',
                                                    width: '100%',
                                                    height: '100%',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: '#334155'
                                                }}
                                            >
                                                <UserIcon size={70} className="text-slate-500" />
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Star Icon - OUTSIDE Ring Container */}
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 10 }}
                                        className="flex justify-center"
                                    >
                                        <Star size={42} fill="white" className="text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]" />
                                    </motion.div>

                                    {/* Text Hierarchy */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.15 }}
                                        className="space-y-3 text-center"
                                    >
                                        <h1 className="text-4xl font-black text-white tracking-wide">SUCCESS!</h1>

                                        <div className="space-y-1">
                                            <p className="text-lg text-slate-200 font-medium">
                                                Welcome, {authenticatedUser?.fullName || authenticatedUser?.username || 'User'}
                                            </p>
                                            <p className="text-sm text-slate-400 italic">
                                                &quot;Your financial journey continues today&quot;
                                            </p>
                                        </div>
                                    </motion.div>

                                    {/* Flame Icons with Bounce Animation */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.8 }}
                                        className="flex flex-col items-center gap-0 pt-2"
                                    >
                                        <motion.div
                                            animate={{ y: [0, -8, 0] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                        >
                                            <Flame size={32} fill="white" className="text-white/60" />
                                        </motion.div>
                                        <motion.div
                                            animate={{ y: [0, -8, 0] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                                            className="-mt-2"
                                        >
                                            <Flame size={24} fill="white" className="text-white/40" />
                                        </motion.div>
                                    </motion.div>

                                    {/* Loading Indicator */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1 }}
                                        className="pt-4 flex items-center gap-2"
                                    >
                                        <Loader2 className="animate-spin text-emerald-400" size={18} />
                                        <p className="text-emerald-400/90 text-sm font-semibold tracking-wide">Entering Dashboard...</p>
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="form" className="w-full">
                            {/* Header Icon */}
                            <div className="flex flex-col items-center mb-10">
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 10 }}
                                    className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-cyan-500 rounded-[28px] flex items-center justify-center shadow-2xl mb-6 shadow-emerald-500/20"
                                >
                                    <Shield size={48} className="text-white" />
                                </motion.div>
                                <h1 className="text-4xl font-black tracking-tighter mb-2" style={{ color: theme.text }}>SECURITY CHECK</h1>
                                <p className="text-lg font-bold uppercase tracking-[0.1em]" style={{ color: theme.textSecondary }}>
                                    Two-Step Verification
                                </p>
                            </div>

                            {(mfaMethod === 'push' || mfaMethod === 'both') && !showTotp && (
                                <div className="w-full">
                                    <div className="mb-8 p-6 bg-blue-500/10 rounded-3xl border border-blue-500/30 flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 shrink-0">
                                            <PhoneIcon size={24} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-white font-bold text-lg">App Approval Sent</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="relative flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                                </span>
                                                <p className="text-sm text-blue-300 font-medium">Waiting for response...</p>
                                            </div>
                                        </div>
                                    </div>

                                    {mfaMethod === 'push' && (
                                        <button
                                            onClick={() => setShowTotp(true)}
                                            className="mb-8 text-blue-400 hover:text-blue-300 font-bold transition-colors text-sm uppercase tracking-wider flex items-center justify-center w-full gap-2"
                                        >
                                            <span>Try another way</span>
                                            <ArrowRight size={14} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {(mfaMethod === 'totp' || mfaMethod === 'both' || showTotp) && (
                                <form onSubmit={handleOtpSubmit} className="flex flex-col gap-6 w-full px-4">

                                    {mfaMethod === 'both' && (
                                        <div className="relative my-2">
                                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gray-700/50"></div>
                                            <span className="relative z-10 mx-auto block w-fit px-4 text-xs font-black uppercase tracking-widest text-gray-500" style={{ backgroundColor: mode === 'dark' ? '#0f172a' : '#fff' }}>
                                                OR ENTER CODE
                                            </span>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <div className="relative w-full">
                                            <input
                                                type="text"
                                                maxLength="6"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                                placeholder="000000"
                                                style={{ ...inputStyle, background: theme.inputBg, color: theme.text, borderColor: theme.border }}
                                                className="focus:outline-none focus:border-emerald-500 transition-all font-bold border-2"
                                                autoFocus={mfaMethod !== 'push'} // Don't autofocus if push is primary, unless only totp
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 text-red-500 font-bold text-center"
                                        >
                                            {error}
                                        </motion.div>
                                    )}

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="submit"
                                        disabled={otp.length !== 6 || status === 'verifying'}
                                        style={buttonStyle}
                                        className="bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-black shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {status === 'verifying' ? <Loader2 className="animate-spin" /> : (
                                            <>
                                                <span>VERIFY NOW</span>
                                                <ArrowRight size={24} />
                                            </>
                                        )}
                                    </motion.button>

                                    {showTotp && mfaMethod === 'push' && (
                                        <button
                                            type="button"
                                            onClick={() => setShowTotp(false)}
                                            className="text-gray-400 hover:text-white font-bold transition-colors text-sm uppercase tracking-wider mt-2"
                                        >
                                            Use App Approval
                                        </button>
                                    )}
                                </form>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default MfaVerify;
