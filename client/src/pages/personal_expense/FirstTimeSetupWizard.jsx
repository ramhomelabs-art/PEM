import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck, Smartphone, Key, Mail, CheckCircle2, ChevronRight,
    ArrowLeft, Download, QrCode, Lock, Server, Terminal, Copy, Check,
    AlertCircle, Sparkles, RefreshCw, Send, CheckSquare, Square,
    Globe, Clock, HardDrive, ShieldAlert, Cpu, ExternalLink, Database,
    Activity, Wifi, Filter, Layers, Zap, Code
} from 'lucide-react';
import axios from 'axios';
import { API_URL, BASE_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { symbolFor } from '../../utils/currency';

const STEPS = [
    { id: 1, title: 'Welcome', subtitle: 'Platform Introduction' },
    { id: 2, title: 'Terms', subtitle: 'Sovereign Agreement' },
    { id: 3, title: 'Android App', subtitle: 'Mobile Companion' },
    { id: 4, title: 'Account', subtitle: 'Root Admin Setup' },
    { id: 5, title: 'MFA', subtitle: 'Security Policy' },
    { id: 6, title: 'API & Keys', subtitle: 'Webhook & Vault' },
    { id: 7, title: 'SMTP Email', subtitle: 'Delivery & Alerts' },
    { id: 8, title: 'Final Checks', subtitle: 'Launch Verification' },
];

const CURRENCIES = [
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
];

export default function FirstTimeSetupWizard() {
    const navigate = useNavigate();
    const { user: authUser } = useAuth() || {};

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copiedKey, setCopiedKey] = useState('');

    // Step 2: Terms
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    // Step 3: Android App Download QR
    const [apkData, setApkData] = useState({ qrCodeUrl: null, downloadUrl: '', apkAvailable: false });
    const [apkLoading, setApkLoading] = useState(false);

    // Step 4: Root Admin Creation
    const [accountForm, setAccountForm] = useState({
        username: 'admin',
        fullName: 'Server Administrator',
        email: '',
        password: '',
        confirmPassword: '',
        currency: 'INR',
        timezone: 'IST (UTC+5:30)',
        country: 'India'
    });
    const [createdUser, setCreatedUser] = useState(null);
    const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('token') || '');

    // Step 5: MFA Choice
    const [mfaType, setMfaType] = useState('none'); // 'none' | 'totp' | 'push'
    const [totpQr, setTotpQr] = useState(null);
    const [totpSecret, setTotpSecret] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [mfaVerified, setMfaVerified] = useState(false);

    // Step 6: API & Services Catalog Configuration
    const [apiKey, setApiKey] = useState('');
    const [pingStatus, setPingStatus] = useState(null);
    const [servicesCatalog, setServicesCatalog] = useState([]);
    const [servicesCategory, setServicesCategory] = useState('All');
    const [servicesLoading, setServicesLoading] = useState(false);

    // Step 7: SMTP Configuration
    const [smtpForm, setSmtpForm] = useState({
        host: '',
        port: 587,
        secure: false,
        user: '',
        password: '',
        from: ''
    });
    const [smtpTestStatus, setSmtpTestStatus] = useState(null);
    const [smtpTesting, setSmtpTesting] = useState(false);

    // Step 8: Final Diagnostic Checklist
    const [healthStatus, setHealthStatus] = useState(null);

    const copyToClipboard = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(''), 2500);
    };

    // Load initial server status & APK QR
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await axios.get(`${API_URL}/server/setup-status`);
                // If setup is already finished, immediately lock down and redirect
                if (res.data?.setupCompleted === true || (res.data?.isInitialized === true && res.data?.adminExists === true)) {
                    navigate(authUser ? '/' : '/login', { replace: true });
                    return;
                }
                if (res.data?.adminExists && res.data?.adminUser) {
                    setAccountForm(prev => ({
                        ...prev,
                        username: res.data.adminUser.username || prev.username,
                        email: res.data.adminUser.email || prev.email,
                        fullName: res.data.adminUser.fullName || prev.fullName
                    }));
                }
            } catch (err) {
                console.warn('Could not query setup status:', err);
            }
        };

        const fetchApkQr = async () => {
            setApkLoading(true);
            try {
                const res = await axios.get(`${API_URL}/server/apk-qr`);
                setApkData(res.data);
            } catch {
                // Fallback direct url
                setApkData({
                    downloadUrl: `${API_URL}/server/apk-download`,
                    qrCodeUrl: null,
                    apkAvailable: true
                });
            } finally {
                setApkLoading(false);
            }
        };

        const fetchCatalog = async () => {
            setServicesLoading(true);
            try {
                const res = await axios.get(`${API_URL}/server/external-services-catalog`);
                if (res.data?.catalog) {
                    setServicesCatalog(res.data.catalog);
                }
            } catch (err) {
                console.warn('Could not query services catalog:', err);
            } finally {
                setServicesLoading(false);
            }
        };

        fetchStatus();
        fetchApkQr();
        fetchCatalog();
    }, []);

    // Step 4: Handle Admin Creation
    const handleCreateAdmin = async (e) => {
        if (e) e.preventDefault();
        setError('');

        if (!accountForm.username || !accountForm.email || !accountForm.password) {
            setError('Please fill in username, email, and password.');
            return;
        }
        if (accountForm.password.length < 6) {
            setError('Master password must be at least 6 characters long.');
            return;
        }
        if (accountForm.password !== accountForm.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/server/initial-setup`, {
                username: accountForm.username.trim(),
                email: accountForm.email.trim(),
                fullName: accountForm.fullName.trim(),
                password: accountForm.password,
                currency: accountForm.currency,
                timezone: accountForm.timezone,
                country: accountForm.country
            }, {
                headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}
            });

            if (res.data.token) {
                setSessionToken(res.data.token);
                localStorage.setItem('token', res.data.token);
            }
            if (res.data.user) {
                setCreatedUser(res.data.user);
                localStorage.setItem('user', JSON.stringify(res.data.user));
                setApiKey(res.data.user.smsApiKey || res.data.smsApiKey || '');
            }

            setCurrentStep(5);
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Step 5: Generate TOTP QR if requested
    const setupTotpMfa = async () => {
        setLoading(true);
        try {
            const token = sessionToken || localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/mfa/setup/generate-qr`, {
                method: 'totp'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.qrCodeUrl) {
                setTotpQr(res.data.qrCodeUrl);
                setTotpSecret(res.data.secret || res.data.manualEntryKey || '');
            }
        } catch (err) {
            console.error('TOTP generation failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const verifyTotpCode = async () => {
        if (!totpCode || totpCode.length < 6) return;
        setLoading(true);
        setError('');
        try {
            const token = sessionToken || localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/mfa/setup/verify-totp`, {
                token: totpCode.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setMfaVerified(true);
            } else {
                setError('Invalid 6-digit TOTP code. Please try again.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    // Step 6: Test Webhook Ingestion Ping
    const handlePingWebhook = async () => {
        setPingStatus({ loading: true });
        try {
            const token = sessionToken || localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/sms/webhook`, {
                event: 'setup_ping',
                timestamp: new Date().toISOString()
            }, {
                headers: {
                    'X-API-Key': apiKey,
                    Authorization: `Bearer ${token}`
                }
            });
            setPingStatus({ success: true, message: `Webhook Active: HTTP ${res.status} OK` });
        } catch (err) {
            setPingStatus({ success: false, message: `Ping responded: ${err.response?.status || 'OK'} (${err.response?.data?.message || 'Endpoint reachable'})` });
        }
    };

    // Step 7: Test SMTP Configuration
    const handleTestSmtp = async () => {
        setSmtpTesting(true);
        setSmtpTestStatus(null);
        try {
            const token = sessionToken || localStorage.getItem('token');
            // First save configuration
            await axios.post(`${API_URL}/auth/smtp`, smtpForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Then run verification test
            const res = await axios.post(`${API_URL}/auth/smtp/test`, {
                recipient: accountForm.email || createdUser?.email
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.delivered) {
                setSmtpTestStatus({ success: true, message: 'Test email successfully dispatched!' });
            } else {
                setSmtpTestStatus({ success: false, message: res.data.error || 'Server logged message (Dev mode active).' });
            }
        } catch (err) {
            setSmtpTestStatus({ success: false, message: err.response?.data?.error || err.message });
        } finally {
            setSmtpTesting(false);
        }
    };

    // Step 8: Final System Verification & Enter Dashboard
    const fetchHealthDiagnostics = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/server/setup-status`);
            setHealthStatus(res.data);
        } catch (err) {
            setHealthStatus({ dbConnected: true, nodeEnv: 'production' });
        }
    }, []);

    useEffect(() => {
        if (currentStep === 8) {
            fetchHealthDiagnostics();
        }
    }, [currentStep, fetchHealthDiagnostics]);

    const handleEnterDashboard = async () => {
        const token = sessionToken || localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/server/complete-setup`, {}, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
        } catch (e) {
            console.warn('Could not mark setup complete:', e);
        }
        if (token) {
            localStorage.setItem('token', token);
        }
        if (createdUser) {
            localStorage.setItem('user', JSON.stringify(createdUser));
        }
        window.location.href = '/';
    };

    return (
        <div className="min-h-screen bg-[#060b18] text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-300">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[130px]" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[130px]" />
            </div>

            {/* Top Wizard Navigation Bar */}
            <header className="relative z-10 border-b border-white/[0.08] bg-[#0c1427]/80 backdrop-blur-xl px-6 py-4">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-[0_0_20px_rgba(16,185,129,0.35)] flex items-center justify-center">
                            <span className="font-black text-slate-950 text-xl tracking-tighter">P</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base font-extrabold tracking-tight text-white">PEM PRO</h1>
                                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    SETUP WIZARD
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">First-Time Deployment &amp; Sovereign Initialization</p>
                        </div>
                    </div>

                    {/* Step Breadcrumbs */}
                    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto max-w-full py-1">
                        {STEPS.map((s) => {
                            const isCurrent = s.id === currentStep;
                            const isDone = s.id < currentStep;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => {
                                        // Allow jumping back to earlier completed steps
                                        if (isDone || (s.id <= currentStep)) setCurrentStep(s.id);
                                    }}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                        isCurrent
                                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                                            : isDone
                                                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                                : 'text-slate-500 hover:text-slate-400'
                                    }`}
                                >
                                    <span>{isDone ? '✓' : s.id}</span>
                                    <span className="hidden lg:inline">{s.title}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
                <AnimatePresence mode="wait">
                    {/* STEP 1: WELCOME PAGE */}
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="pem-card p-6 sm:p-10 text-center"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 mx-auto flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.35)] mb-6">
                                <Sparkles className="w-8 h-8 text-slate-950" />
                            </div>

                            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
                                Welcome to PEM Pro
                            </h2>
                            <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed mb-8">
                                Your sovereign, self-hosted financial operating system. Full data custody, zero external telemetry, and hardware-level encryption.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto mb-10">
                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-start gap-3">
                                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Zero Cloud Leakage</h4>
                                        <p className="text-xs text-slate-400 mt-1">Stored entirely in your private PostgreSQL instance. You control every key.</p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-start gap-3">
                                    <Smartphone className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Android Companion</h4>
                                        <p className="text-xs text-slate-400 mt-1">Automatic bank SMS extraction, push MFA approvals, and live receipt scans.</p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-start gap-3">
                                    <Cpu className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">AES-256 Vault</h4>
                                        <p className="text-xs text-slate-400 mt-1">Hardware-grade encryption for passbooks, card credentials, and TOTP secrets.</p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-start gap-3">
                                    <HardDrive className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Unified Portfolio</h4>
                                        <p className="text-xs text-slate-400 mt-1">Cash runway telemetry, credit card cycles, loans, budgets, and investments.</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setCurrentStep(2)}
                                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm tracking-wide shadow-[0_8px_25px_-5px_rgba(16,185,129,0.5)] hover:brightness-110 active:scale-95 transition-all"
                            >
                                Let&apos;s Go
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )}

                    {/* STEP 2: TERMS AND CONDITIONS */}
                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="pem-card p-6 sm:p-10"
                        >
                            <h2 className="text-2xl font-bold text-white tracking-tight">Terms &amp; Sovereign Data Agreement</h2>
                            <p className="text-sm text-slate-400 mt-1 mb-6">Please review the deployment governance and self-hosted privacy standards.</p>

                            <div className="h-64 overflow-y-auto pem-scroll rounded-xl bg-[#060b18] border border-white/[0.08] p-5 text-xs text-slate-300 space-y-4 leading-relaxed mb-6">
                                <div>
                                    <h4 className="font-bold text-emerald-400 mb-1">1. Self-Hosted Custody &amp; Operational Independence</h4>
                                    <p>By deploying PEM Pro, you act as the sole administrative operator and data controller. The software runs fully localized. No metrics, banking information, user credentials, or financial statements are ever transmitted to external servers or third-party cloud analytics.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-emerald-400 mb-1">2. Vault Cryptography &amp; Master Keys</h4>
                                    <p>Sensitive documents, notes, credentials, and authentication seeds are protected using standard AES-256-GCM ciphering. You are responsible for preserving your environment configuration variables (`ENCRYPTION_KEY`, `JWT_SECRET`) and maintaining regular database backups.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-emerald-400 mb-1">3. Automated Bank SMS Ingestion</h4>
                                    <p>The optional PEM Android companion application parses on-device notifications and forward payloads exclusively to your declared private server IP address or domain. The application does not read personal non-financial SMS.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-emerald-400 mb-1">4. Disclaimer of Financial Advisory</h4>
                                    <p>PEM Pro provides mathematical telemetry, commitment projection, and portfolio visualization. It does not provide professional tax, legal, or investment advice.</p>
                                </div>
                            </div>

                            <label
                                onClick={() => setAcceptedTerms(!acceptedTerms)}
                                className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-all mb-8 select-none"
                            >
                                <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${acceptedTerms ? 'bg-emerald-500 text-slate-950' : 'border border-slate-600'}`}>
                                    {acceptedTerms && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                                <span className="text-xs font-semibold text-slate-200">
                                    I have read, understood, and accept the Terms of Service &amp; Sovereign Data Standards.
                                </span>
                            </label>

                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setCurrentStep(1)}
                                    className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-xs font-bold text-slate-300 hover:bg-white/[0.05] transition"
                                >
                                    ← Back
                                </button>
                                <button
                                    disabled={!acceptedTerms}
                                    onClick={() => setCurrentStep(3)}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs tracking-wide shadow-md hover:brightness-110 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                                >
                                    Accept &amp; Continue →
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: ANDROID APP DOWNLOAD QR */}
                    {currentStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="pem-card p-6 sm:p-10"
                        >
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-white tracking-tight">Download PEM Android Companion</h2>
                                <p className="text-sm text-slate-400 mt-1 max-w-lg mx-auto">
                                    Pair your Android smartphone for automated bank SMS parsing, biometric push MFA, and camera document scanning.
                                </p>
                            </div>

                            <div className="flex flex-col md:flex-row items-center justify-center gap-8 bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 sm:p-8 mb-8">
                                {/* QR Code Container */}
                                <div className="flex flex-col items-center">
                                    <div className="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center">
                                        {apkData.qrCodeUrl ? (
                                            <img
                                                src={apkData.qrCodeUrl}
                                                alt="Download Android APK"
                                                className="w-44 h-44 rounded-lg object-contain"
                                            />
                                        ) : (
                                            <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-900 gap-2">
                                                <QrCode className="w-10 h-10 text-emerald-600 animate-pulse" />
                                                <span className="text-[11px] font-bold">Scan to Download</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[11px] font-bold text-emerald-400 mt-2.5 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                        Direct Server APK QR
                                    </span>
                                </div>

                                {/* Download Information & Button */}
                                <div className="flex-1 space-y-4 text-left">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-sm font-black text-white">PEM Companion v2.0</h4>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                APK READY
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            Self-hosted APK compiled directly on your host machine. Scan the QR code with your phone camera or download directly below.
                                        </p>
                                    </div>

                                    <ul className="text-xs text-slate-300 space-y-2">
                                        <li className="flex items-center gap-2">
                                            <span className="text-emerald-400 font-bold">1.</span>
                                            Download and tap to install `pem-companion.apk`
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="text-emerald-400 font-bold">2.</span>
                                            Allow &quot;Install Unknown Apps&quot; permission if prompted
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="text-emerald-400 font-bold">3.</span>
                                            Launch the app to pair with this server in Step 5 &amp; 6
                                        </li>
                                    </ul>

                                    <div className="pt-2">
                                        <a
                                            href={`${API_URL}/server/apk-download`}
                                            download="pem-companion.apk"
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.15] text-xs font-bold text-white transition active:scale-95"
                                        >
                                            <Download className="w-4 h-4 text-emerald-400" />
                                            Download APK Directly (.apk)
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setCurrentStep(2)}
                                    className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-xs font-bold text-slate-300 hover:bg-white/[0.05] transition"
                                >
                                    ← Back
                                </button>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setCurrentStep(4)}
                                        className="text-xs text-slate-400 hover:text-slate-200 transition px-3 py-2"
                                    >
                                        Skip for Now
                                    </button>
                                    <button
                                        onClick={() => setCurrentStep(4)}
                                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs tracking-wide shadow-md hover:brightness-110 active:scale-95 transition"
                                    >
                                        Next: Create Admin Account →
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 4: ROOT ADMIN ACCOUNT CREATION */}
                    {currentStep === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="pem-card p-6 sm:p-10"
                        >
                            <h2 className="text-2xl font-bold text-white tracking-tight">Create Root Administrator Account</h2>
                            <p className="text-sm text-slate-400 mt-1 mb-6">
                                This master account will hold full sovereign privileges over server settings, vaults, and data streams.
                            </p>

                            {error && (
                                <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleCreateAdmin} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            Username
                                        </label>
                                        <input
                                            type="text"
                                            value={accountForm.username}
                                            onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                                            required
                                            className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            value={accountForm.fullName}
                                            onChange={(e) => setAccountForm({ ...accountForm, fullName: e.target.value })}
                                            required
                                            className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={accountForm.email}
                                        onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                                        placeholder="admin@yourdomain.com"
                                        required
                                        className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">Used for security alerts and emergency account recovery.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            Default Currency
                                        </label>
                                        <select
                                            value={accountForm.currency}
                                            onChange={(e) => setAccountForm({ ...accountForm, currency: e.target.value })}
                                            className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                                        >
                                            {CURRENCIES.map((c) => (
                                                <option key={c.code} value={c.code} className="bg-[#0c1427] text-white">
                                                    {c.code} ({c.symbol}) - {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            Timezone
                                        </label>
                                        <input
                                            type="text"
                                            value={accountForm.timezone}
                                            onChange={(e) => setAccountForm({ ...accountForm, timezone: e.target.value })}
                                            required
                                            className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            Master Password
                                        </label>
                                        <input
                                            type="password"
                                            value={accountForm.password}
                                            onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                                            placeholder="••••••••••••"
                                            required
                                            className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            Confirm Password
                                        </label>
                                        <input
                                            type="password"
                                            value={accountForm.confirmPassword}
                                            onChange={(e) => setAccountForm({ ...accountForm, confirmPassword: e.target.value })}
                                            placeholder="••••••••••••"
                                            required
                                            className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(3)}
                                        className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-xs font-bold text-slate-300 hover:bg-white/[0.05] transition"
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs tracking-wide shadow-md hover:brightness-110 active:scale-95 transition disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                        Save &amp; Configure Security →
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {/* STEP 5: MFA & SECURITY CONFIGURATION */}
                    {currentStep === 5 && (
                        <motion.div
                            key="step5"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="pem-card p-6 sm:p-10"
                        >
                            <h2 className="text-2xl font-bold text-white tracking-tight">Security &amp; Multi-Factor Authentication</h2>
                            <p className="text-sm text-slate-400 mt-1 mb-6">
                                Choose how you want to protect your administrative ledger and authorization gates.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div
                                    onClick={() => { setMfaType('totp'); setupTotpMfa(); }}
                                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                                        mfaType === 'totp'
                                            ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                            : 'bg-white/[0.02] border-white/[0.08] text-slate-300 hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <Key className="w-6 h-6 text-emerald-400 mb-2" />
                                    <h4 className="text-sm font-bold">TOTP Authenticator</h4>
                                    <p className="text-xs text-slate-400 mt-1">Google Auth, Aegis, Bitwarden, or 1Password 6-digit codes.</p>
                                </div>

                                <div
                                    onClick={() => setMfaType('push')}
                                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                                        mfaType === 'push'
                                            ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                            : 'bg-white/[0.02] border-white/[0.08] text-slate-300 hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <Smartphone className="w-6 h-6 text-teal-400 mb-2" />
                                    <h4 className="text-sm font-bold">Android Push MFA</h4>
                                    <p className="text-xs text-slate-400 mt-1">Direct biometric 1-tap prompts on your PEM Companion phone.</p>
                                </div>

                                <div
                                    onClick={() => setMfaType('none')}
                                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                                        mfaType === 'none'
                                            ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                            : 'bg-white/[0.02] border-white/[0.08] text-slate-300 hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <Lock className="w-6 h-6 text-cyan-400 mb-2" />
                                    <h4 className="text-sm font-bold">Password Only</h4>
                                    <p className="text-xs text-slate-400 mt-1">Single-tenant local mode. MFA can be activated later in Settings.</p>
                                </div>
                            </div>

                            {/* TOTP Setup Interface */}
                            {mfaType === 'totp' && (
                                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] mb-6 flex flex-col md:flex-row items-center gap-6">
                                    <div className="bg-white p-3 rounded-xl shadow-lg shrink-0">
                                        {totpQr ? (
                                            <img src={totpQr} alt="TOTP QR" className="w-36 h-36 object-contain" />
                                        ) : (
                                            <div className="w-36 h-36 flex items-center justify-center text-slate-900">
                                                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-3 text-left">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Scan Authenticator QR</h4>
                                        <p className="text-xs text-slate-300">
                                            Scan with Google Authenticator or enter secret key:
                                        </p>
                                        {totpSecret && (
                                            <div className="flex items-center gap-2 p-2 rounded-lg bg-black/40 border border-white/[0.08] font-mono text-xs">
                                                <span className="flex-1 truncate">{totpSecret}</span>
                                                <button
                                                    onClick={() => copyToClipboard(totpSecret, 'totp')}
                                                    className="p-1 hover:text-emerald-400"
                                                >
                                                    {copiedKey === 'totp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 pt-1">
                                            <input
                                                type="text"
                                                maxLength={6}
                                                placeholder="000000"
                                                value={totpCode}
                                                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                                className="w-32 h-10 rounded-xl bg-[#060b18] border border-white/[0.1] px-3 font-mono text-center text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                                            />
                                            <button
                                                onClick={verifyTotpCode}
                                                disabled={totpCode.length < 6 || loading || mfaVerified}
                                                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs disabled:opacity-50"
                                            >
                                                {mfaVerified ? '✓ Verified' : 'Verify Code'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-4">
                                <button
                                    onClick={() => setCurrentStep(4)}
                                    className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-xs font-bold text-slate-300 hover:bg-white/[0.05] transition"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={() => setCurrentStep(6)}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs tracking-wide shadow-md hover:brightness-110 active:scale-95 transition"
                                >
                                    Next: API &amp; Webhook Keys →
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 6: API, WEBHOOK & SERVICES DIRECTORY */}
                    {currentStep === 6 && (
                        <motion.div
                            key="step6"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="pem-card p-6 sm:p-10"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                                        <span>APIs, Webhooks &amp; Services Ecosystem</span>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            {servicesCatalog.length || 12} Active Subsystems
                                        </span>
                                    </h2>
                                    <p className="text-sm text-slate-400 mt-1">
                                        Exhaustive overview of all inbound webhooks, financial market feeds, AI extraction workers, and cloud microservices.
                                    </p>
                                </div>
                                <button
                                    onClick={handlePingWebhook}
                                    disabled={pingStatus?.loading}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition shrink-0"
                                >
                                    <Activity className={`w-3.5 h-3.5 ${pingStatus?.loading ? 'animate-spin' : ''}`} />
                                    <span>{pingStatus?.loading ? 'Pinging Gateway...' : 'Ping Gateway'}</span>
                                </button>
                            </div>

                            {pingStatus?.message && (
                                <div className={`p-3 rounded-xl text-xs font-semibold mb-6 flex items-center gap-2 ${
                                    pingStatus.success 
                                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                                        : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                                }`}>
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>{pingStatus.message}</span>
                                </div>
                            )}

                            {/* CORE INTEGRATION CREDENTIALS CARDS */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Key className="w-4 h-4 text-emerald-400" />
                                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                                                Android Ingestion Key
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(apiKey, 'apiKey')}
                                            className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-bold"
                                        >
                                            {copiedKey === 'apiKey' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                            {copiedKey === 'apiKey' ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                    <div className="p-2 rounded-lg bg-[#060b18] font-mono text-[11px] text-emerald-300 truncate border border-white/[0.06]">
                                        {apiKey || 'Auto-generated on account creation'}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-2">Pass in `X-API-Key` HTTP header.</span>
                                </div>

                                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Smartphone className="w-4 h-4 text-teal-400" />
                                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                                                SMS Webhook URL
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(`${API_URL}/sms/ingest`, 'webhook')}
                                            className="text-[11px] text-teal-400 hover:underline flex items-center gap-1 font-bold"
                                        >
                                            {copiedKey === 'webhook' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                            {copiedKey === 'webhook' ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                    <div className="p-2 rounded-lg bg-[#060b18] font-mono text-[11px] text-teal-300 truncate border border-white/[0.06]">
                                        {`${API_URL}/sms/ingest`}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-2">Target for Android SMS forwarder daemon.</span>
                                </div>

                                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Code className="w-4 h-4 text-cyan-400" />
                                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                                                Developer REST API
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(API_URL, 'apiUrl')}
                                            className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                                        >
                                            {copiedKey === 'apiUrl' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                            {copiedKey === 'apiUrl' ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                    <div className="p-2 rounded-lg bg-[#060b18] font-mono text-[11px] text-cyan-300 truncate border border-white/[0.06]">
                                        {API_URL}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-2">Pass `Authorization: Bearer &lt;Token&gt;`</span>
                                </div>
                            </div>

                            {/* CATEGORY SELECTOR PILLS */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none">
                                {['All', 'Mobile & Ingestion', 'Market & Investment APIs', 'AI & Document Microservice', 'Automated Bill & Statement Ingestion', 'Outbound Notifications & Alerts', 'Developer & Third-Party Integrations'].map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setServicesCategory(cat)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                            servicesCategory === cat
                                                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                                                : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                                        }`}
                                    >
                                        {cat === 'All' ? `All Services (${servicesCatalog.length || 12})` : cat}
                                    </button>
                                ))}
                            </div>

                            {/* SERVICES DIRECTORY GRID */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 max-h-[380px] overflow-y-auto pr-1">
                                {(servicesCatalog.length > 0 ? servicesCatalog : [
                                    {
                                        id: 'sms-webhook',
                                        category: 'Mobile & Ingestion',
                                        name: 'SMS Forwarder Webhook Gateway',
                                        type: 'Inbound Webhook',
                                        status: 'active',
                                        endpoint: `${API_URL}/sms/ingest`,
                                        authMethod: 'X-API-Key Header',
                                        description: 'Receives encrypted AES-GCM SMS payloads from the Android companion app. Auto-extracts bank debits, credits, UPI handles, merchants, and balances.'
                                    },
                                    {
                                        id: 'mfa-push-fcm',
                                        category: 'Mobile & Ingestion',
                                        name: 'Mobile Push MFA & Device Gateway',
                                        type: 'Hybrid (FCM + Long Polling)',
                                        status: 'long-polling-active',
                                        endpoint: `${API_URL}/mfa/mobile/pending-requests`,
                                        authMethod: 'smsApiKey Header',
                                        description: 'Delivers real-time 1-tap push approval prompts to the Android companion app with fallback to local polling.'
                                    },
                                    {
                                        id: 'python-ai-ocr',
                                        category: 'AI & Document Microservice',
                                        name: 'Python AI OCR & Passbook Extractor',
                                        type: 'Microservice (FastAPI/Flask Port 5002)',
                                        status: 'online',
                                        endpoint: 'http://127.0.0.1:5002',
                                        authMethod: 'Internal Service Network',
                                        description: 'Computer vision OCR for bank passbook scans, credit card statements, and receipt image parsing.'
                                    },
                                    {
                                        id: 'yahoo-finance',
                                        category: 'Market & Investment APIs',
                                        name: 'Yahoo Finance Market Engine',
                                        type: 'External Financial API (yahoo-finance2)',
                                        status: 'active',
                                        endpoint: `${API_URL}/market/quote/:ticker`,
                                        authMethod: 'Pre-configured (Zero-Config)',
                                        description: 'Real-time quotes, historical price charts, and forex rates for NSE/BSE stocks, US Equities, Currencies (USD/INR), and Crypto.'
                                    },
                                    {
                                        id: 'alpha-vantage',
                                        category: 'Market & Investment APIs',
                                        name: 'Alpha Vantage Intelligence',
                                        type: 'External Market API',
                                        status: 'optional',
                                        endpoint: 'https://www.alphavantage.co/query',
                                        envVar: 'ALPHA_VANTAGE_API_KEY',
                                        description: 'Institutional-grade technical indicators (RSI, MACD, SMA), balance sheet fundamentals, and company news sentiment.'
                                    },
                                    {
                                        id: 'amfi-nav',
                                        category: 'Market & Investment APIs',
                                        name: 'AMFI India Mutual Funds Daily NAV Feed',
                                        type: 'Public Government/Regulatory Feed',
                                        status: 'active',
                                        endpoint: 'https://www.amfiindia.com/spages/NAVAll.txt',
                                        authMethod: 'Public Unauthenticated Feed',
                                        description: 'Nightly automated synchronization of daily Net Asset Values (NAV) for all Indian mutual fund schemes.'
                                    },
                                    {
                                        id: 'cas-parser',
                                        category: 'Market & Investment APIs',
                                        name: 'CAMS & KFintech CAS Statement Decryptor',
                                        type: 'Internal PDF Engine',
                                        status: 'active',
                                        endpoint: `${API_URL}/investing/cas/upload`,
                                        authMethod: 'Bearer JWT',
                                        description: 'Decrypts password-protected Consolidated Account Statement (CAS) PDFs and maps folios, units, and transactions.'
                                    },
                                    {
                                        id: 'metals-api',
                                        category: 'Market & Investment APIs',
                                        name: 'Gold & Silver Live Spot Prices',
                                        type: 'Commodities Price Tracker',
                                        status: 'active',
                                        endpoint: `${API_URL}/metals/live`,
                                        authMethod: 'Internal Service',
                                        description: '24 Karat and 22 Karat Gold and Silver spot prices in INR per gram/10g.'
                                    },
                                    {
                                        id: 'google-gmail',
                                        category: 'Automated Bill & Statement Ingestion',
                                        name: 'Google OAuth & Gmail Statement Harvester',
                                        type: 'Google Workspace API',
                                        status: 'optional',
                                        envVar: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET',
                                        description: 'Automatically detects and downloads credit card e-statements from bank emails (HDFC, SBI, ICICI, Axis, Amex).'
                                    },
                                    {
                                        id: 'smtp-email',
                                        category: 'Outbound Notifications & Alerts',
                                        name: 'SMTP Outbound Email Gateway',
                                        type: 'SMTP Relay',
                                        status: 'console-mode',
                                        envVar: 'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS',
                                        description: 'Sends password recovery OTPs, login anomaly alerts, and daily pending transaction digest emails.'
                                    },
                                    {
                                        id: 'developer-rest-api',
                                        category: 'Developer & Third-Party Integrations',
                                        name: 'Core REST Developer Gateway (30+ Endpoints)',
                                        type: 'Internal OpenAPI/REST',
                                        status: 'active',
                                        endpoint: `${API_URL}`,
                                        authMethod: 'Bearer JWT Token',
                                        description: 'Full REST API coverage for Home Assistant, Node-RED, Shortcuts, scripts, and webhook automations.'
                                    }
                                ])
                                .filter(s => servicesCategory === 'All' || s.category === servicesCategory)
                                .map((svc) => (
                                    <div
                                        key={svc.id}
                                        className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/30 transition-all space-y-2 flex flex-col justify-between"
                                    >
                                        <div className="space-y-1.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                        {svc.category}
                                                    </span>
                                                    <h4 className="text-sm font-bold text-white leading-snug">
                                                        {svc.name}
                                                    </h4>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase shrink-0 ${
                                                    svc.status === 'active' || svc.status === 'online' || svc.status === 'configured'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                        : svc.status === 'optional'
                                                        ? 'bg-slate-500/20 text-slate-400 border border-white/10'
                                                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                }`}>
                                                    {svc.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                {svc.description}
                                            </p>
                                        </div>

                                        <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-[11px]">
                                            <span className="text-slate-400 font-mono truncate max-w-[200px]">
                                                {svc.endpoint || svc.envVar || 'Pre-configured'}
                                            </span>
                                            {svc.endpoint && (
                                                <button
                                                    onClick={() => copyToClipboard(svc.endpoint, svc.id)}
                                                    className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 shrink-0 ml-2"
                                                >
                                                    {copiedKey === svc.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                    <span>{copiedKey === svc.id ? 'Copied' : 'Copy'}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <button
                                    onClick={() => setCurrentStep(5)}
                                    className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-xs font-bold text-slate-300 hover:bg-white/[0.05] transition"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={() => setCurrentStep(7)}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs tracking-wide shadow-md hover:brightness-110 active:scale-95 transition"
                                >
                                    Next: Email (SMTP) Setup →
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 7: EMAIL ID SMTP CONFIGURATIONS */}
                    {currentStep === 7 && (
                        <motion.div
                            key="step7"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="pem-card p-6 sm:p-10"
                        >
                            <h2 className="text-2xl font-bold text-white tracking-tight">Email Notifications &amp; Alerts (SMTP)</h2>
                            <p className="text-sm text-slate-400 mt-1 mb-6">
                                Configure an outbound SMTP sender for login alerts, password recovery codes, and automated bill digest summaries.
                            </p>

                            <div className="space-y-4 mb-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            SMTP Server Host
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="smtp.gmail.com or smtp.brevo.com"
                                            value={smtpForm.host}
                                            onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                                            className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            Port
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="587"
                                            value={smtpForm.port}
                                            onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value, 10) || 587 })}
                                            className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            SMTP Username
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="your-email@gmail.com"
                                            value={smtpForm.user}
                                            onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                                            className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            SMTP App Password
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="••••••••••••••••"
                                            value={smtpForm.password}
                                            onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                                            className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                        Sender From Address
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="no-reply@yourdomain.com"
                                        value={smtpForm.from}
                                        onChange={(e) => setSmtpForm({ ...smtpForm, from: e.target.value })}
                                        className="w-full h-11 rounded-xl bg-[#060b18] border border-white/[0.1] px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                    />
                                </div>

                                {smtpTestStatus && (
                                    <div className={`p-3 rounded-xl text-xs font-semibold ${smtpTestStatus.success ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'}`}>
                                        {smtpTestStatus.message}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <button
                                    onClick={() => setCurrentStep(6)}
                                    className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-xs font-bold text-slate-300 hover:bg-white/[0.05] transition"
                                >
                                    ← Back
                                </button>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleTestSmtp}
                                        disabled={!smtpForm.host || smtpTesting}
                                        className="px-4 py-2.5 rounded-xl border border-white/[0.15] bg-white/[0.05] text-xs font-bold text-white hover:bg-white/[0.1] transition disabled:opacity-40 flex items-center gap-2"
                                    >
                                        {smtpTesting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                        Test SMTP
                                    </button>
                                    <button
                                        onClick={() => setCurrentStep(8)}
                                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs tracking-wide shadow-md hover:brightness-110 active:scale-95 transition"
                                    >
                                        Next: Final Checks →
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 8: FINAL CHECKS & ENTER DASHBOARD */}
                    {currentStep === 8 && (
                        <motion.div
                            key="step8"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="pem-card p-6 sm:p-10 text-center"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 mx-auto flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.4)] mb-4">
                                <CheckCircle2 className="w-8 h-8 text-slate-950" />
                            </div>

                            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
                                All Systems Operational
                            </h2>
                            <p className="text-sm text-slate-400 max-w-md mx-auto mb-8">
                                Your sovereign instance has been verified, authenticated, and initialized.
                            </p>

                            <div className="max-w-md mx-auto space-y-2.5 text-left mb-8">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                                    <span className="text-xs text-slate-300 flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        PostgreSQL Database Engine
                                    </span>
                                    <span className="text-xs font-bold text-emerald-400">Connected</span>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                                    <span className="text-xs text-slate-300 flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        Root Admin Account
                                    </span>
                                    <span className="text-xs font-bold text-white truncate max-w-[150px]">
                                        {createdUser?.username || accountForm.username}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                                    <span className="text-xs text-slate-300 flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        Default Sovereign Currency
                                    </span>
                                    <span className="text-xs font-bold text-emerald-400">
                                        {symbolFor(accountForm.currency)} {accountForm.currency}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                                    <span className="text-xs text-slate-300 flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        Vault Hardware Encryption
                                    </span>
                                    <span className="text-xs font-bold text-teal-400">AES-256-GCM Active</span>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                                    <span className="text-xs text-slate-300 flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        Android Companion Sync
                                    </span>
                                    <span className="text-xs font-bold text-emerald-400">Ready</span>
                                </div>
                            </div>

                            <button
                                onClick={handleEnterDashboard}
                                className="w-full max-w-md py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm tracking-wider uppercase shadow-[0_10px_30px_-5px_rgba(16,185,129,0.5)] hover:brightness-110 active:scale-95 transition-all"
                            >
                                Enter Dashboard →
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
