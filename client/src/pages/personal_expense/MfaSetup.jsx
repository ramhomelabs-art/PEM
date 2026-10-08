import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, CheckCircle2, ArrowRight, Loader2, KeyRound, AlertCircle,
    ArrowLeft, Smartphone, Key, RefreshCw, SmartphoneNfc, Check
} from 'lucide-react';
import { API_URL } from '../../config';

const MfaSetup = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state || {};
    const effectiveToken = state.token || localStorage.getItem('token');
    const effectiveUserId = state.userId;

    const [activeTab, setActiveTab] = useState('companion'); // 'companion' | 'totp'
    const [step, setStep] = useState(1); // 1: QR, 2: Verify (for totp), 3: Success
    const [qrData, setQrData] = useState(null);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [serverUrl, setServerUrl] = useState('http://10.10.20.4:5005');

    const fetchQrCode = useCallback(async (customUrl) => {
        setLoading(true);
        setError('');
        try {
            const authToken = effectiveToken;
            if (!authToken) {
                navigate('/login');
                return;
            }
            const response = await fetch(`${API_URL}/mfa/setup/generate-qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ serverUrl: customUrl || serverUrl })
            });
            if (response.ok) {
                const data = await response.json();
                setQrData(data);
            } else {
                console.error("QR Fetch Failed", response.status);
                setError("Session expired or invalid. Please try logging in again.");
            }
        } catch (err) {
            console.error('Failed to fetch QR code:', err);
            setError('Failed to generate security QR code.');
        } finally {
            setLoading(false);
        }
    }, [effectiveToken, navigate, serverUrl]);

    useEffect(() => {
        if (!effectiveToken) {
            navigate('/login');
            return;
        }
        fetchQrCode();
    }, [effectiveToken, fetchQrCode, navigate]);

    // Auto-detect when Android companion finishes binding
    useEffect(() => {
        if (step === 3 || !effectiveToken || activeTab !== 'companion') return;

        const checkInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_URL}/mfa/mobile/pending-requests`, {
                    headers: { 'Authorization': `Bearer ${effectiveToken}` }
                });
                if (response.ok) {
                    // Endpoint succeeded meaning user has active device
                    // Check auth profile
                    const meRes = await fetch(`${API_URL}/auth/me`, {
                        headers: { 'Authorization': `Bearer ${effectiveToken}` }
                    });
                    if (meRes.ok) {
                        const meData = await meRes.json();
                        if (meData.user?.mfaConfigured || meData.mfaConfigured) {
                            clearInterval(checkInterval);
                            setStep(3);
                        }
                    }
                }
            } catch (e) {
                // Ignore poll error
            }
        }, 3000);

        return () => clearInterval(checkInterval);
    }, [step, effectiveToken, activeTab]);

    const verifySetup = async (e) => {
        e?.preventDefault?.();
        if (otp.length !== 6) {
            setError('Please enter the full 6-digit code.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const authToken = effectiveToken;
            const response = await fetch(`${API_URL}/mfa/setup/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ token: otp })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setStep(3); // Success
            } else {
                setError(data.error || 'Invalid code. Please try again.');
            }
        } catch (err) {
            console.error('Verification failed:', err);
            setError('Network error during verification.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-emerald-500/30 selection:text-emerald-400">
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl"
            >
                {/* Header Section */}
                <div className="flex flex-col items-center text-center space-y-2 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10 mb-1">
                        <Shield className="w-7 h-7" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Two-Factor Security</h1>
                    <p className="text-xs text-slate-400 max-w-xs">
                        {step === 1 && "Link your device or authenticator to protect your account."}
                        {step === 2 && "Enter the 6-digit code from your authenticator app."}
                        {step === 3 && "Two-factor authentication is now active!"}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {/* STEP 1: Scan QR Code */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-5"
                        >
                            {/* Method Selector Tabs */}
                            <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-bold">
                                <button
                                    onClick={() => setActiveTab('companion')}
                                    className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                        activeTab === 'companion'
                                            ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Smartphone className="w-4 h-4" />
                                    <span>Android App</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('totp')}
                                    className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                        activeTab === 'totp'
                                            ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Key className="w-4 h-4" />
                                    <span>Authenticator</span>
                                </button>
                            </div>

                            {/* QR Code Container */}
                            <div className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800/80 min-h-[220px]">
                                {loading ? (
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                                        <span className="text-xs">Generating QR...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3 text-center">
                                        <div className="p-3 bg-white rounded-2xl inline-block shadow-2xl border-4 border-emerald-500/20">
                                            <img
                                                src={activeTab === 'companion' ? qrData?.companionQrCodeUrl || qrData?.qrCodeUrl : qrData?.totpQrCodeUrl || qrData?.qrCodeUrl}
                                                alt="MFA QR Code"
                                                className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                                            />
                                        </div>

                                        {activeTab === 'companion' && (
                                            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-400">
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Waiting for phone scan...</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Instructions */}
                            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                                {activeTab === 'companion' ? (
                                    <p className="text-[11px] leading-relaxed">
                                        Open <strong>PEM App</strong> on your phone &gt; tap <strong>Scan Web Portal QR</strong> &gt; point at the screen. Device will configure instantly!
                                    </p>
                                ) : (
                                    <p className="text-[11px] leading-relaxed">
                                        Scan with Google Authenticator, Microsoft Authenticator, or 1Password. Then click below to verify.
                                    </p>
                                )}
                            </div>

                            {error && (
                                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {activeTab === 'totp' && (
                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => setStep(2)}
                                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                                >
                                    <span>I&apos;ve Scanned & Added It</span>
                                    <ArrowRight className="w-4 h-4" />
                                </motion.button>
                            )}
                        </motion.div>
                    )}

                    {/* STEP 2: Enter Verification Code (for TOTP) */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <form onSubmit={verifySetup} className="space-y-6">
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
                                        Enter the 6-digit code currently shown in your authenticator app.
                                    </p>
                                </div>

                                {error && (
                                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 text-center justify-center">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <motion.button
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        type="submit"
                                        disabled={otp.length !== 6 || loading}
                                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <span>Verify & Activate MFA</span>
                                                <CheckCircle2 className="w-4 h-4" />
                                            </>
                                        )}
                                    </motion.button>

                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" />
                                        <span>Back to QR Code</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {/* STEP 3: Setup Success */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="space-y-6 text-center"
                        >
                            <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <Shield className="w-10 h-10" />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-white tracking-tight">MFA Activated!</h2>
                                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                                    Your device is paired and protected with Two-Factor Authentication.
                                </p>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => navigate('/')}
                                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                            >
                                Continue to Dashboard
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default MfaSetup;
