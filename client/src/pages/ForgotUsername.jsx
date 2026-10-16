import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UserSearch, Mail, ShieldCheck, Smartphone, ArrowRight, ArrowLeft,
    CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { API_URL } from '../config';

const ForgotUsername = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState('identify');
    const [identifier, setIdentifier] = useState('');
    const [method, setMethod] = useState('email');
    const [code, setCode] = useState('');
    const [recovered, setRecovered] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const requestOtp = async (e) => {
        e?.preventDefault?.();
        if (!identifier.trim()) return;
        setLoading(true);
        setError('');
        setNotice('');
        try {
            const res = await fetch(`${API_URL}/auth/forgot/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: identifier.trim(), purpose: 'username_recovery' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Unable to start username recovery');
            setMethod('email');
            setNotice('If the details match an account, a 6-digit code has been sent to the registered email.');
            setStep('verify');
        } catch (err) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const verifyCode = async (e) => {
        e?.preventDefault?.();
        if (code.length !== 6) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/auth/forgot/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: identifier.trim(), code, method, purpose: 'username_recovery' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Invalid or expired code');
            setRecovered(data.username || '');
            setStep('done');
        } catch (err) {
            setError(err.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const inputClass = 'w-full py-3 pl-11 pr-4 rounded-2xl bg-sunken border-2 border-line focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 text-ink placeholder:text-ink-faint outline-none transition-all';
    const primaryButton = 'w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer';

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-sunken text-ink selection:bg-emerald-500 selection:text-white relative overflow-hidden">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full max-w-md rounded-3xl border border-line bg-surface/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative z-10"
            >
                <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-line">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                        <UserSearch className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-ink">Recover Username</h1>
                        <p className="text-xs text-ink-muted font-medium">We&apos;ll help you find your account</p>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'identify' && (
                        <motion.form
                            key="identify"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            onSubmit={requestOtp}
                            className="space-y-5"
                        >
                            <p className="text-xs text-ink-muted leading-relaxed">
                                Enter your <span className="text-ink font-semibold">email or mobile number</span>.
                                We&apos;ll send a code to your registered email to confirm it&apos;s you.
                            </p>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" size={18} />
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="Email or mobile number"
                                    className={inputClass}
                                    disabled={loading}
                                />
                            </div>
                            {error && <ErrorBanner message={error} />}
                            <button type="submit" disabled={loading || !identifier.trim()} className={primaryButton}>
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (<><span>Send Code</span><ArrowRight size={16} /></>)}
                            </button>
                            <div className="flex items-center justify-between pt-1 text-xs font-semibold">
                                <Link to="/forgot-password" className="text-emerald-400 hover:text-emerald-300">Forgot password?</Link>
                                <Link to="/login" className="text-ink-faint hover:text-ink-muted">Back to login</Link>
                            </div>
                        </motion.form>
                    )}

                    {step === 'verify' && (
                        <motion.form
                            key="verify"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            onSubmit={verifyCode}
                            className="space-y-5"
                        >
                            {notice && (
                                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                                    {method === 'mfa' ? <Smartphone className="w-4 h-4 shrink-0" /> : <Mail className="w-4 h-4 shrink-0" />}
                                    <span>{method === 'mfa'
                                        ? 'Enter the 6-digit code from your authenticator app.'
                                        : notice}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-sunken border border-line">
                                <button
                                    type="button"
                                    onClick={() => { setMethod('email'); setError(''); }}
                                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${method === 'email' ? 'bg-emerald-500 text-slate-950' : 'text-ink-muted hover:text-ink'}`}
                                >
                                    <Mail className="w-3.5 h-3.5" /> Email code
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMethod('mfa'); setError(''); }}
                                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${method === 'mfa' ? 'bg-emerald-500 text-slate-950' : 'text-ink-muted hover:text-ink'}`}
                                >
                                    <Smartphone className="w-3.5 h-3.5" /> Authenticator
                                </button>
                            </div>

                            <div className="space-y-2 text-center">
                                <label className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center justify-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{method === 'mfa' ? 'Enter Authenticator Code' : 'Enter 6-Digit Code'}</span>
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    autoFocus
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="••••••"
                                    className="w-full text-center text-3xl font-mono tracking-[0.35em] py-3.5 px-4 rounded-2xl bg-sunken border-2 border-line focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 text-ink placeholder:text-ink-faint outline-none transition-all shadow-inner"
                                />
                            </div>

                            {error && <ErrorBanner message={error} />}

                            <div className="space-y-3">
                                <button type="submit" disabled={code.length !== 6 || loading} className={primaryButton}>
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (<><span>Reveal Username</span><ArrowRight size={16} /></>)}
                                </button>
                                <div className="flex items-center justify-between text-xs font-semibold">
                                    <button type="button" onClick={requestOtp} disabled={loading} className="text-emerald-400 hover:text-emerald-300 cursor-pointer">
                                        Resend code
                                    </button>
                                    <button type="button" onClick={() => { setError(''); setStep('identify'); }} className="text-ink-faint hover:text-ink-muted cursor-pointer flex items-center gap-1">
                                        <ArrowLeft className="w-3.5 h-3.5" /> Change account
                                    </button>
                                </div>
                            </div>
                        </motion.form>
                    )}

                    {step === 'done' && (
                        <motion.div
                            key="done"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-4 space-y-5"
                        >
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-lg font-bold text-ink">Account Found</h2>
                                <p className="text-xs text-ink-muted">Your username is</p>
                                <p className="text-2xl font-mono font-bold tracking-wider text-emerald-400">{recovered}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className={primaryButton}
                                >
                                    Continue to Login <ArrowRight size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/forgot-password')}
                                    className="w-full py-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                                >
                                    Reset password too
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

const ErrorBanner = ({ message }) => (
    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{message}</span>
    </div>
);

export default ForgotUsername;
