import { useState, useEffect } from 'react';
import { useAuth } from '../context/personal_expense/AuthContext';
import { useTheme } from '../context/personal_expense/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, User, Lock, ArrowRight, Star, Heart, Flame, Eye, EyeOff } from 'lucide-react';
import { API_URL, BASE_URL } from '../config';
import { peekLogoutReason } from '../utils/session';

const Login = () => {
    const [rememberMe, setRememberMe] = useState(() => {
        return localStorage.getItem('rememberMe') === 'true' || Boolean(localStorage.getItem('rememberedUsername'));
    });
    const [username, setUsername] = useState(() => localStorage.getItem('rememberedUsername') || '');
    const [password, setPassword] = useState(() => {
        try {
            const saved = localStorage.getItem('rememberedPassword');
            if (!saved) return '';
            try {
                return decodeURIComponent(escape(atob(saved)));
            } catch {
                return atob(saved);
            }
        } catch {
            return '';
        }
    });
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const [needsSetup, setNeedsSetup] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [showRecovery, setShowRecovery] = useState(false);
    const [sessionNotice] = useState(() => {
        const reason = peekLogoutReason();
        if (reason === 'idle') return 'You were signed out automatically after a period of inactivity.';
        if (reason === 'expired') return 'Your session expired. Please sign in again.';
        return null;
    });

    useEffect(() => {
        document.title = "PEM Pro | Secure Gateway";
        fetch(`${API_URL}/server/setup-status`)
            .then(res => res.json())
            .then(data => {
                if (data && (data.setupCompleted === false || data.isInitialized === false || data.adminExists === false)) {
                    setNeedsSetup(true);
                    navigate('/setup', { replace: true });
                }
            })
            .catch(() => {});
    }, [navigate]);

    const handleRememberMeChange = (e) => {
        const checked = e.target.checked;
        setRememberMe(checked);
        if (!checked) {
            localStorage.removeItem('rememberMe');
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberedPassword');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setStatus('loading');

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Immediately save or clear credentials before any MFA redirects
                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true');
                    localStorage.setItem('rememberedUsername', username);
                    if (password) {
                        try {
                            localStorage.setItem('rememberedPassword', btoa(unescape(encodeURIComponent(password))));
                        } catch {
                            localStorage.setItem('rememberedPassword', btoa(password));
                        }
                    }
                } else {
                    localStorage.removeItem('rememberMe');
                    localStorage.removeItem('rememberedUsername');
                    localStorage.removeItem('rememberedPassword');
                }

                const userData = {
                    id: data.id,
                    username: data.username,
                    role: data.role,
                    country: data.country,
                    currency: data.currency,
                    timezone: data.timezone,
                    profilePhoto: data.profilePhoto,
                    fullName: data.fullName,
                    mobile: data.mobile,
                    dob: data.dob
                };

                // Check for MFA Requirement BEFORE showing success
                if (data.mfaRequired) {
                    // Navigate immediately to MFA Verify
                    navigate('/mfa-verify', {
                        state: {
                            userId: data.userId,
                            mfaMethod: data.mfaMethod,
                            requestId: data.requestId,
                            mfaChallenge: data.mfaChallenge
                        }
                    });
                    return;
                }

                if (data.needsSetup) {
                    // Navigate immediately to MFA Setup
                    navigate('/mfa-setup', { state: { userId: data.userId, token: data.token } });
                    return;
                }

                // Only show success animation if NO MFA is needed and we are fully logged in
                setLoggedInUser(userData);
                setStatus('success');
                login(userData, data.token); // Set Auth Context immediately for smooth transition

                setTimeout(() => {
                    navigate('/');
                }, 900);
            } else {
                const attempts = typeof data?.attempts === 'number' ? data.attempts : failedAttempts + 1;
                setFailedAttempts(attempts);
                if (data?.showForgotPassword || data?.locked || attempts >= 3) {
                    setShowRecovery(true);
                }
                setStatus('error');
                setTimeout(() => setStatus('idle'), 1500);
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 1500);
        }
    };

    const { theme, mode } = useTheme();

    // ABSOLUTE INLINE STYLES FOR PERFECT ALIGNMENT
    const containerStyle = {
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflowY: 'auto',
        padding: '45px 20px',
        boxSizing: 'border-box',
        backgroundColor: theme.bg
    };

    const cardStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '32px',
        background: mode === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.85)', // Adaptive
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
        fontSize: '18px',
        borderRadius: '16px',
        paddingLeft: '56px',
        width: '100%',
        boxSizing: 'border-box'
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
            <div className="animated-bg"></div>
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>

            <motion.div
                key="login-card"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    x: status === 'error' ? [0, -10, 10, -10, 10, 0] : 0
                }}
                transition={{ duration: 0.5 }}
                className="auth-card"
                style={cardStyle}
            >
                <AnimatePresence mode="wait">
                    {status === 'success' && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full max-w-md mx-auto"
                        >
                            {/* Modal-style Card */}
                            <div
                                className="backdrop-blur-xl rounded-3xl success-inner-card shadow-2xl"
                                style={{
                                    backgroundColor: mode === 'dark' ? 'rgba(30, 41, 59, 0.4)' : 'rgba(248, 250, 252, 0.75)',
                                    border: `1px solid ${theme.border}`
                                }}
                            >
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
                                             {loggedInUser?.profilePhoto ? (
                                                 <img
                                                     src={loggedInUser.profilePhoto.startsWith('http') ? loggedInUser.profilePhoto : `${BASE_URL}/${loggedInUser.profilePhoto.replace(/\\/g, '/')}`}
                                                     alt="Profile"
                                                     style={{
                                                         width: '100%',
                                                         height: '100%',
                                                         objectFit: 'cover',
                                                         borderRadius: '50%'
                                                     }}
                                                     onError={(e) => {
                                                         e.currentTarget.onerror = null;
                                                         e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${loggedInUser?.username || 'Guest'}`;
                                                     }}
                                                 />
                                             ) : (
                                                 <img
                                                     src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${loggedInUser?.username || 'Guest'}`}
                                                     alt="Avatar"
                                                     style={{
                                                         width: '100%',
                                                         height: '100%',
                                                         objectFit: 'cover',
                                                         borderRadius: '50%'
                                                     }}
                                                 />
                                             )}
                                        </div>
                                    </motion.div>

                                    {/* Star Icon - OUTSIDE Ring Container */}
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 10 }}
                                        className="flex justify-center"
                                    >
                                        <Star size={42} fill={theme.text} style={{ color: theme.text }} className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]" />
                                    </motion.div>

                                    {/* Text Hierarchy */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.15 }}
                                        className="space-y-3 text-center"
                                    >
                                        <h1 className="text-3xl font-black sm:text-4xl tracking-wide" style={{ color: theme.text }}>SUCCESS!</h1>

                                        <div className="space-y-1">
                                            <p className="text-lg font-medium" style={{ color: theme.text }}>
                                                Welcome, {loggedInUser?.fullName || loggedInUser?.username || 'User'}
                                            </p>
                                            <p className="text-sm italic" style={{ color: theme.textSecondary }}>
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
                                            <Flame size={32} fill={theme.text} style={{ color: theme.textSecondary }} />
                                        </motion.div>
                                        <motion.div
                                            animate={{ y: [0, -8, 0] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                                            className="-mt-2"
                                        >
                                            <Flame size={24} fill={theme.textSecondary} style={{ color: theme.textSecondary }} />
                                        </motion.div>
                                    </motion.div>

                                </div>
                            </div>
                        </motion.div>
                    )}

                    {status === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full flex flex-col items-center justify-center space-y-8"
                        >
                            <motion.div
                                animate={{
                                    scale: [1, 1.15, 1],
                                    rotate: [0, -5, 5, -5, 5, 0]
                                }}
                                transition={{ duration: 0.4, repeat: Infinity }}
                                className="text-[180px] drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]"
                            >
                                😡
                            </motion.div>

                            <div className="space-y-4">
                                <h2 className="text-3xl font-black sm:text-4xl text-red-500 uppercase tracking-widest bg-red-500/10 px-6 py-2 rounded-2xl">
                                    ACCESS DENIED!
                                </h2>
                                <div className="text-3xl font-black leading-tight" style={{ color: theme.text }}>
                                    &quot;Wrong username and <br /> Password Sir!!&quot;
                                </div>
                            </div>

                            <motion.div
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ repeat: Infinity, duration: 1 }}
                                className="text-red-400 text-lg font-black uppercase tracking-[0.2em]"
                            >
                                System Locked • Retrying
                            </motion.div>
                        </motion.div>
                    )}

                    {(status === 'idle' || status === 'loading') && (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full"
                        >
                            <div className="auth-header-container">
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 10 }}
                                    className="auth-header-logo bg-gradient-to-tr from-emerald-500 to-cyan-500 shadow-2xl shadow-emerald-500/20"
                                >
                                    <Wallet size={48} className="text-white" />
                                </motion.div>
                                <h1 className="auth-header-title tracking-tighter" style={{ color: theme.text }}>PEM</h1>
                                <p className="auth-header-subtitle" style={{ color: theme.textSecondary }}>Personal Management</p>
                            </div>

                            {needsSetup && (
                                <div className="mb-6 mx-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left">
                                    <p className="font-bold flex items-center gap-1.5 text-sm mb-1 text-amber-400">
                                        <span>⚙️ Initial Setup Required</span>
                                    </p>
                                    <p className="text-amber-200/80 mb-3">
                                        No administrator account detected. Configure the initial server management account to get started without MFA.
                                    </p>
                                    <Link
                                        to="/server-setup"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
                                    >
                                        Start Initial Server Setup →
                                    </Link>
                                </div>
                            )}

                            {sessionNotice && (
                                <div className="mb-6 mx-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs text-left flex items-start gap-2">
                                    <span className="text-base leading-none">⏱️</span>
                                    <span>{sessionNotice}</span>
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="flex flex-col gap-6 w-full px-4">
                                <div className="relative w-full">
                                    <User className="absolute left-5 top-[14px] text-gray-400" size={24} />
                                    <input
                                        type="text"
                                        placeholder="Username or Email"
                                        required
                                        style={{ ...inputStyle, background: theme.inputBg, color: theme.text, borderColor: theme.border }}
                                        className="focus:outline-none focus:border-emerald-500 transition-all font-bold"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        disabled={status === 'loading'}
                                    />
                                </div>
                                <div className="relative w-full">
                                    <Lock className="absolute left-5 top-[14px] text-gray-400" size={24} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Password"
                                        required
                                        style={{ ...inputStyle, background: theme.inputBg, color: theme.text, borderColor: theme.border }}
                                        className="focus:outline-none focus:border-emerald-500 transition-all font-bold pr-14"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={status === 'loading'}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-5 top-[14px] text-gray-400 hover:text-emerald-500 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 self-start px-4">
                                    <input
                                        type="checkbox"
                                        id="rememberMe"
                                        className="w-5 h-5 accent-emerald-500 cursor-pointer"
                                        checked={rememberMe}
                                        onChange={handleRememberMeChange}
                                    />
                                    <label htmlFor="rememberMe" className="font-bold cursor-pointer select-none" style={{ color: theme.textSecondary }}>
                                        Remember login credentials
                                    </label>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={status === 'loading'}
                                    style={buttonStyle}
                                    className="bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-black shadow-2xl transition-all flex items-center justify-center gap-3 mt-4"
                                >
                                    {status === 'loading' ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>VERIFYING...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span>SIGN IN NOW</span>
                                            <ArrowRight size={24} />
                                        </>
                                    )}
                                </motion.button>
                            </form>

                            {showRecovery && (
                                <div className="mt-6 mx-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-left">
                                    <p className="text-sm font-bold text-rose-400 mb-1">
                                        Having trouble signing in?
                                    </p>
                                    <p className="text-xs text-rose-200/80 mb-3">
                                        After repeated failed attempts, you can recover access using email verification or your authenticator app.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Link
                                            to="/forgot-password"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition"
                                        >
                                            Forgot password?
                                        </Link>
                                        <Link
                                            to="/forgot-username"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sunken border border-line text-ink font-bold text-xs hover:text-emerald-400 transition"
                                        >
                                            Forgot username?
                                        </Link>
                                    </div>
                                </div>
                            )}

                            <div className="mt-14 text-center">
                                <p className="text-xl font-bold" style={{ color: theme.textSecondary }}>
                                    Don&apos;t have an account?{' '}
                                    <Link to="/signup" className="text-emerald-500 font-extrabold underline underline-offset-8">
                                        Join PEM Pro
                                    </Link>
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default Login;




