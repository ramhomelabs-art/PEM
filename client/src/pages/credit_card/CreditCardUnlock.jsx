import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, ArrowLeft, Eye, EyeOff, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { useCardSession } from '../../context/credit_card/CardSessionContext';
import { Button } from '../../components/ui/primitives';
import { cx } from '../../components/ui/cx';

const CreditCardUnlock = () => {
    const navigate = useNavigate();
    const { unlock } = useCardSession();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleUnlock = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await unlock(password);
            navigate('/credit-cards/loading');
        } catch (err) {
            setError(err.message || 'Incorrect password. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10">
            <button
                type="button"
                onClick={() => navigate('/')}
                className="absolute left-6 top-6 inline-flex items-center gap-2 text-sm font-bold text-ink-muted transition hover:text-ink"
            >
                <ArrowLeft size={18} aria-hidden="true" /> Back to Dashboard
            </button>

            <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full max-w-md rounded-card border border-line bg-surface p-8 shadow-raised"
            >
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-[18px] bg-brand-soft text-brand">
                    <CreditCard size={30} aria-hidden="true" />
                </div>

                <div className="mt-5 text-center">
                    <h1 className="text-xl font-extrabold tracking-tight text-ink">Credit Cards</h1>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                        This is a secure zone. Re-enter your account password to view card
                        numbers, CVV and statements.
                    </p>
                </div>

                <form onSubmit={handleUnlock} className="mt-6 flex flex-col gap-4">
                    <div className="relative">
                        <Lock
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                            aria-hidden="true"
                        />
                        <input
                            autoFocus
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            placeholder="Enter your password"
                            required
                            className={cx(
                                'h-11 w-full rounded-control border bg-sunken pl-9 pr-10 text-sm font-semibold text-ink outline-none transition',
                                error ? 'border-neg' : 'border-line focus:border-line-strong'
                            )}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {error ? (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-neg"
                        >
                            <AlertCircle size={14} aria-hidden="true" /> {error}
                        </motion.p>
                    ) : null}

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        icon={Lock}
                        loading={loading}
                        disabled={!password}
                        className="w-full"
                    >
                        {loading ? 'Verifying…' : 'Unlock Credit Cards'}
                    </Button>
                </form>

                <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-ink-faint">
                    <ShieldCheck size={13} aria-hidden="true" />
                    Card details are encrypted at rest and require a fresh unlock.
                </p>
            </motion.div>
        </div>
    );
};

export default CreditCardUnlock;
