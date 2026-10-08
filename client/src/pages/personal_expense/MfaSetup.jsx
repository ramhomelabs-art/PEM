import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Shield, CheckCircle2, ArrowRight, Loader2, Lock, Copy, Check, Smartphone, KeyRound, AlertCircle, ArrowLeft } from 'lucide-react';
import { API_URL } from '../../config';
import { useTheme } from '../../context/personal_expense/ThemeContext';

const MfaSetup = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userId, token } = location.state || {};
    const { theme } = useTheme();

    const [step, setStep] = useState(1); // 1: QR, 2: Verify, 3: Success
    const [qrData, setQrData] = useState(null);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState('authenticator'); // 'authenticator' | 'companion'

    const fetchQrCode = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const authToken = token || localStorage.getItem('token');
            const mobileServerUrl = `${window.location.protocol}//${window.location.host}`;
            const response = await fetch(`${API_URL}/mfa/setup/generate-qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ serverUrl: mobileServerUrl })
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
    }, [token]);

    useEffect(() => {
        if (!userId) {
            navigate('/login');
            return;
        }
        fetchQrCode();
    }, [userId, fetchQrCode, navigate]);

    const handleCopySecret = () => {
        if (!qrData?.secret) return;
        navigator.clipboard.writeText(qrData.secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const verifySetup = async (e) => {
        e?.preventDefault?.();
        if (otp.length !== 6 || loading) return;
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
                const data = await response.json();
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    if (data.user) {
                        localStorage.setItem('user', JSON.stringify(data.user));
                    }
                }
                setStep(3);
            } else {
                const data = await response.json();
                setError(data.error || 'Invalid verification code. Please check your authenticator app.');
            }
        } catch {
            setError('Verification failed. Please check connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const displayedQr = activeTab === 'companion' && qrData?.companionQrCodeUrl
        ? qrData.companionQrCodeUrl
        : (qrData?.totpQrCodeUrl || qrData?.qrCodeUrl);

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full max-w-lg rounded-3xl border border-slate-800/80 bg-slate-900/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative z-10"
            >
                {/* Step indicator */}
                <div className="flex items-center justify-between mb-6 pb-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                            {step === 3 ? <CheckCircle2 className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                Two-Factor Security
                                <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Step {step} of 3
                                </span>
                            </h1>
                            <p className="text-xs text-slate-400 font-medium">
                                {step === 1 && "Link your authenticator app"}
                                {step === 2 && "Confirm 6-digit one-time code"}
                                {step === 3 && "Account protection activated"}
                            </p>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* STEP 1: Scan QR or copy Secret Key */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* App Selector Tabs */}
                            <div className="flex p-1 rounded-xl bg-slate-950/80 border border-slate-800/90">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('authenticator')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                        activeTab === 'authenticator'
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <QrCode className="w-4 h-4" />
                                    <span>Authenticator App (TOTP)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('companion')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                        activeTab === 'companion'
                                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Smartphone className="w-4 h-4" />
                                    <span>Android Companion</span>
                                </button>
                            </div>

                            {/* QR Frame */}
                            <div className="flex flex-col items-center justify-center">
                                <div className="p-4 bg-white rounded-2xl shadow-xl shadow-emerald-950/30 relative group transition-transform hover:scale-[1.01]">
                                    {loading ? (
                                        <div className="w-56 h-56 flex flex-col items-center justify-center gap-3 bg-slate-100 rounded-xl">
                                            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                                            <span className="text-xs font-bold text-slate-500">Generating Secure QR...</span>
                                        </div>
                                    ) : displayedQr ? (
                                        <img
                                            src={displayedQr}
                                            alt="MFA QR Code"
                                            className="w-56 h-56 object-contain rounded-lg"
                                        />
                                    ) : (
                                        <div className="w-56 h-56 flex flex-col items-center justify-center gap-3 bg-slate-100 rounded-xl text-slate-600">
                                            <AlertCircle className="w-8 h-8 text-rose-500" />
                                            <p className="text-xs font-bold">Failed to load QR code</p>
                                            <button
                                                onClick={fetchQrCode}
                                                className="text-xs font-bold text-emerald-600 hover:underline"
                                            >
                                                Tap to retry
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="mt-3 text-xs text-slate-400 text-center">
                                    Scan with Google Authenticator, Microsoft Authenticator, 1Password, or PEM Companion
                                </p>
                            </div>

                            {/* Manual Key Section */}
                            {qrData?.secret && (
                                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                                            Can&apos;t scan? Enter key manually:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleCopySecret}
                                            className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{copied ? 'COPIED' : 'COPY'}</span>
                                        </button>
                                    </div>
                                    <div className="font-mono text-xs text-emerald-300 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800 break-all select-all tracking-wider text-center">
                                        {qrData.secret}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => setStep(2)}
                                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                                <span>I&apos;ve Scanned & Added It</span>
                                <ArrowRight className="w-4 h-4" />
                            </motion.button>
                        </motion.div>
                    )}

                    {/* STEP 2: Enter Verification Code */}
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
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Enter 6-Digit Authenticator Code
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
                                        Open your authenticator app and enter the active 6-digit security code.
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
                                    Your account is now guarded by Two-Factor Authentication. You will need your authenticator code for all future sign-ins.
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
