import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, CheckCircle2, ArrowRight, Loader2, KeyRound,
    AlertCircle, ArrowLeft, Smartphone, RefreshCw, Lock,
    ShieldCheck, Timer, Copy, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';

const MfaSetup = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();
    const state = location.state || {};
    const effectiveToken = state.token || localStorage.getItem('token');

    const [step, setStep] = useState(1); // 1: QR Scan, 2: Manual TOTP verify, 3: Success
    const [qrData, setQrData] = useState(null);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [paired, setPaired] = useState(false);
    const [timeLeft, setTimeLeft] = useState(600);

    const fetchQrCode = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const authToken = effectiveToken;
            if (!authToken) {
                navigate('/login');
                return;
            }
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const serverUrlPayload = isLocal ? undefined : `${window.location.protocol}//${window.location.host}`;
            const response = await fetch(`${API_URL}/mfa/setup/generate-qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(serverUrlPayload ? { serverUrl: serverUrlPayload } : {})
            });
            if (response.ok) {
                const data = await response.json();
                setQrData(data);
                if (data.expiresAt) {
                    const diffSec = Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
                    setTimeLeft(diffSec || 600);
                } else {
                    setTimeLeft(600);
                }
            } else {
                setError('Failed to generate secure QR code. Please try again.');
            }
        } catch (err) {
            console.error('Failed to fetch QR code:', err);
            setError('Network error generating QR code.');
        } finally {
            setLoading(false);
        }
    }, [effectiveToken, navigate]);

    useEffect(() => {
        if (!effectiveToken) {
            navigate('/login');
            return;
        }
        fetchQrCode();
    }, [effectiveToken, fetchQrCode, navigate]);

    // Live countdown timer for pairing session
    useEffect(() => {
        if (step !== 1 || !qrData) return;
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    fetchQrCode();
                    return 600;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [step, qrData, fetchQrCode]);

    const formattedTime = `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`;

    // Auto-detect Android companion pairing by polling /auth/me for mfaConfigured flag
    useEffect(() => {
        if (step !== 1 || paired || !effectiveToken) return;

        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${effectiveToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const isConfigured = data.mfaConfigured ?? data.user?.mfaConfigured;
                    if (isConfigured) {
                        clearInterval(pollInterval);
                        setPaired(true);
                        setStep(3);
                    }
                }
            } catch (e) {
                // Ignore poll errors silently
            }
        }, 2500);

        return () => clearInterval(pollInterval);
    }, [step, effectiveToken, paired]);

    const verifySetup = async (e) => {
        e?.preventDefault?.();
        if (otp.length !== 6) {
            setError('Please enter the full 6-digit code.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/mfa/setup/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${effectiveToken}`
                },
                body: JSON.stringify({ token: otp })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                if (data.user && data.token) {
                    login(data.user, data.token);
                }
                setStep(3);
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

    const handleContinue = async () => {
        try {
            if (effectiveToken) {
                const res = await fetch(`${API_URL}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${effectiveToken}` }
                });
                if (res.ok) {
                    const userData = await res.json();
                    login(userData, effectiveToken);
                    navigate('/');
                    return;
                }
            }
        } catch (e) {
            console.error('Finalize session error:', e);
        }
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-sunken flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg bg-surface border border-line rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
            >
                {/* Header */}
                <div className="flex flex-col items-center text-center space-y-2 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10 mb-1">
                        <Shield className="w-7 h-7" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-ink tracking-tight">Register Your Security Device</h1>
                    <p className="text-xs text-ink-muted max-w-sm">
                        {step === 1 && "Scan the Zero-Knowledge Encrypted QR code exclusively with the PEM Android Companion App."}
                        {step === 2 && "Enter the 6-digit code shown in your authenticator app to confirm setup."}
                        {step === 3 && "Two-factor authentication is now active on your account!"}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {/* STEP 1: Advanced Encrypted QR Code Scan */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            {/* Futuristic QR Code Container */}
                            <div className="relative flex flex-col items-center justify-center p-6 rounded-3xl bg-sunken border border-line shadow-2xl overflow-hidden">
                                {/* Ambient Background Glow */}
                                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />

                                {/* Top Security & Expiration Bar */}
                                <div className="flex items-center justify-between w-full mb-4 px-1 z-10">
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold tracking-wide">
                                        <Lock className="w-3 h-3 text-emerald-400" />
                                        <span>AES-256-GCM Zero-Knowledge</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-line text-ink-muted text-[11px] font-mono">
                                        <Timer className="w-3 h-3 text-amber-400" />
                                        <span>{formattedTime}</span>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-3 text-ink-muted z-10">
                                        <Loader2 className="w-9 h-9 animate-spin text-emerald-400" />
                                        <span className="text-xs font-medium">Synthesizing zero-knowledge encrypted QR...</span>
                                    </div>
                                ) : error && !qrData ? (
                                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center space-y-3 z-10">
                                        <AlertCircle className="w-6 h-6 mx-auto text-rose-400" />
                                        <p>{error}</p>
                                        <button
                                            onClick={fetchQrCode}
                                            className="px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-white text-xs font-bold"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : qrData ? (
                                    <div className="relative flex flex-col items-center z-10">
                                        {/* Clean High-Speed QR Enclosure Frame */}
                                        <div className="relative p-3.5 bg-white rounded-2xl shadow-2xl border-2 border-emerald-500/40 group overflow-hidden">
                                            {/* Cyber Corner HUD Brackets */}
                                            <div className="absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-600 pointer-events-none" />
                                            <div className="absolute top-1 right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-600 pointer-events-none" />
                                            <div className="absolute bottom-1 left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-600 pointer-events-none" />
                                            <div className="absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-600 pointer-events-none" />

                                            {/* Unobstructed High-Contrast QR Code */}
                                            <img
                                                src={qrData.companionQrCodeUrl || qrData.qrCodeUrl}
                                                alt="PEM Encrypted Pairing QR"
                                                className="w-52 h-52 sm:w-56 sm:h-56 object-contain block relative z-10"
                                            />
                                        </div>

                                        {/* Status & Live Regenerate Action */}
                                        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
                                            <div className="flex items-center gap-2 font-semibold text-emerald-400">
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Awaiting PEM App Scan...</span>
                                            </div>
                                            <button
                                                onClick={fetchQrCode}
                                                disabled={loading}
                                                className="text-ink-muted hover:text-emerald-400 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                                                title="Regenerate Pairing Envelope"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                <span>Regenerate</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {/* Financial Protection Notice */}
                            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-emerald-300/90 leading-relaxed flex items-start gap-2.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-ink font-semibold">Strictly Restricted to PEM Companion App:</strong>
                                    <span> External QR scanners, Google Lens, and unauthorized cameras cannot decrypt or view this payload. All URLs, tokens, and keys are encrypted.</span>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="p-3.5 rounded-xl bg-sunken/40 border border-line space-y-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                                    <Smartphone className="w-4 h-4 text-emerald-400" />
                                    <span>Pairing Instructions:</span>
                                </div>
                                <ol className="list-decimal list-inside space-y-1 text-[11px] text-ink-muted leading-relaxed">
                                    <li>Open the <strong className="text-ink">PEM Companion App</strong> on your Android phone.</li>
                                    <li>Tap <strong className="text-ink">&quot;Scan Web Portal QR&quot;</strong> on the Pair Device screen.</li>
                                    <li>Align your camera inside the target viewfinder.</li>
                                    <li>The app will automatically decrypt and securely bind the device.</li>
                                </ol>
                            </div>

                            {/* Manual TOTP fallback */}
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                className="w-full py-2 text-xs font-semibold text-ink-muted hover:text-ink flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>Already set up — Enter TOTP code manually</span>
                            </button>
                        </motion.div>
                    )}

                    {/* STEP 2: Manual TOTP Verify (fallback) */}
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
                                    <label className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center justify-center gap-1.5">
                                        <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Enter 6-Digit Code</span>
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
                                    <p className="text-xs text-ink-muted">Enter the 6-digit code from your authenticator app.</p>
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
                                                <span>Verify & Activate</span>
                                                <CheckCircle2 className="w-4 h-4" />
                                            </>
                                        )}
                                    </motion.button>

                                    <button
                                        type="button"
                                        onClick={() => { setStep(1); setError(''); setOtp(''); }}
                                        className="w-full py-2.5 text-xs font-semibold text-ink-muted hover:text-ink flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" />
                                        <span>Back to QR Code</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {/* STEP 3: Success */}
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
                                <h2 className="text-2xl font-black text-ink tracking-tight">Device Registered!</h2>
                                <p className="text-xs text-ink-muted leading-relaxed max-w-sm mx-auto">
                                    Your Android companion app is linked. Future logins will send a push notification to your phone for approval.
                                </p>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={handleContinue}
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
