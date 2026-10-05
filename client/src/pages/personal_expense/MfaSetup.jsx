import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Shield, CheckCircle, ArrowRight, Loader2, Lock } from 'lucide-react';
import { API_URL } from '../../config';
import { useTheme } from '../../context/personal_expense/ThemeContext';

const MfaSetup = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userId, token } = location.state || {};
    const { theme, mode } = useTheme();

    const [step, setStep] = useState(1); // 1: QR, 2: Verify, 3: Success
    const [qrData, setQrData] = useState(null);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchQrCode = useCallback(async () => {
        setLoading(true);
        try {
            const authToken = token || localStorage.getItem('token');
            const response = await fetch(`${API_URL}/mfa/setup/generate-qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setQrData(data);
            } else {
                console.error("QR Fetch Failed", response.status);
                setError("Session expired. Please login again.");
            }
        } catch (err) {
            console.error('Failed to fetch QR code:', err);
            setError('Failed to generate QR code.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!userId) {
            navigate('/login');
            return;
        }
        fetchQrCode();
    }, [userId, fetchQrCode, navigate]);

    const verifySetup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const authToken = token || localStorage.getItem('token');
            const response = await fetch(`${API_URL}/mfa/setup/totp/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ code: otp })
            });

            if (response.ok) {
                setStep(3);
            } else {
                const data = await response.json();
                setError(data.error || 'Invalid verification code');
            }
        } catch {
            setError('Verification failed. Please try again.');
        } finally {
            setLoading(false);
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
                {/* Header Icon */}
                <div className="mb-10">
                    <motion.div
                        whileHover={{ scale: 1.1, rotate: 10 }}
                        className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-cyan-500 rounded-[28px] flex items-center justify-center shadow-2xl mb-6 shadow-emerald-500/20 mx-auto"
                    >
                        {step === 1 && <QrCode size={48} className="text-white" />}
                        {step === 2 && <Shield size={48} className="text-white" />}
                        {step === 3 && <CheckCircle size={48} className="text-white" />}
                    </motion.div>

                    <h1 className="text-4xl font-black tracking-tighter mb-2" style={{ color: theme.text }}>
                        {step === 1 && "SECURE ACCOUNT"}
                        {step === 2 && "VERIFY DEVICE"}
                        {step === 3 && "ALL SET!"}
                    </h1>
                    <p className="text-lg font-bold uppercase tracking-[0.1em]" style={{ color: theme.textSecondary }}>
                        {step === 1 && "Two-Factor Authentication"}
                        {step === 2 && "Enter OTP Code"}
                        {step === 3 && "Protection Active"}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="w-full flex flex-col items-center"
                        >
                            <div className="bg-white p-4 rounded-3xl mb-8 shadow-xl shadow-blue-900/10 relative overflow-hidden group">
                                {loading ? (
                                    <div className="h-64 w-64 flex flex-col items-center justify-center gap-4">
                                        <Loader2 className="animate-spin text-blue-600" size={48} />
                                        <span className="text-slate-400 font-bold animate-pulse">GENERATING QR...</span>
                                    </div>
                                ) : qrData ? (
                                    <div className="relative">
                                        <img src={qrData.qrCodeUrl} alt="MFA QR Code" className="w-64 h-64 object-contain mix-blend-multiply" />
                                    </div>
                                ) : (
                                    <div className="h-64 w-64 flex flex-col items-center justify-center text-slate-500">
                                        <p className="font-bold mb-4">FAILED TO LOAD</p>
                                        <button onClick={fetchQrCode} className="text-blue-600 hover:underline font-black">RETRY</button>
                                    </div>
                                )}
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setStep(2)}
                                style={buttonStyle}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black shadow-2xl flex items-center justify-center gap-3"
                            >
                                <span>I&apos;VE SCANNED IT</span>
                                <ArrowRight size={24} />
                            </motion.button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="w-full"
                        >
                            <form onSubmit={verifySetup} className="flex flex-col gap-6 w-full px-4">
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
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-center text-sm font-bold opacity-60" style={{ color: theme.textSecondary }}>
                                        Enter the 6-digit code from your app
                                    </p>
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
                                    disabled={otp.length !== 6 || loading}
                                    style={buttonStyle}
                                    className="bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-black shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : (
                                        <>
                                            <span>VERIFY & FINISH</span>
                                            <CheckCircle size={24} />
                                        </>
                                    )}
                                </motion.button>

                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-gray-400 hover:text-white font-bold transition-colors text-sm uppercase tracking-wider"
                                >
                                    Go back to QR Code
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            className="text-center w-full"
                        >
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-8 mb-8">
                                <p className="text-emerald-400 font-bold text-lg leading-relaxed">
                                    MFA is now active. Your account is secured with military-grade protection.
                                </p>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/login')}
                                style={buttonStyle}
                                className="bg-slate-800 text-white font-black shadow-2xl hover:bg-slate-700"
                            >
                                RETURN TO LOGIN
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default MfaSetup;
