import { motion } from 'framer-motion';
import { ShieldAlert, Clock } from 'lucide-react';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { SESSION_WARNING_MS } from '../../utils/session';

const SessionTimeoutModal = ({ secondsLeft = 60, onStay, onLogout }) => {
    const { theme } = useTheme();

    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const label = `${mins}:${String(secs).padStart(2, '0')}`;
    const totalWarnSec = Math.max(1, Math.round(SESSION_WARNING_MS / 1000));
    const pct = Math.min(100, Math.max(0, (secondsLeft / totalWarnSec) * 100));

    return (
        <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-warning-title"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(2, 6, 23, 0.65)',
                backdropFilter: 'blur(6px)',
                padding: '20px',
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '24px',
                    padding: '28px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                    textAlign: 'center',
                }}
            >
                <div
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)' }}
                >
                    <ShieldAlert size={32} className="text-amber-500" />
                </div>

                <h2 className="mt-4 text-xl font-black tracking-tight" style={{ color: theme.text }}>
                    Session About to Expire
                </h2>
                <p className="mt-2 text-sm" style={{ color: theme.textSecondary }}>
                    You’ve been inactive for a while. For your security you’ll be signed out automatically.
                </p>

                <div
                    className="mt-5 flex items-center justify-center gap-3 rounded-2xl px-4 py-3"
                    style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}
                >
                    <Clock size={20} style={{ color: theme.textSecondary }} />
                    <span className="text-3xl font-black tabular-nums" style={{ color: theme.text }}>
                        {label}
                    </span>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: theme.border }}>
                    <motion.div
                        className="h-full rounded-full bg-amber-500"
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ ease: 'linear', duration: 0.9 }}
                    />
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                        type="button"
                        onClick={onStay}
                        className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 active:scale-[0.98]"
                    >
                        Stay signed in
                    </button>
                    <button
                        type="button"
                        onClick={onLogout}
                        className="flex-1 rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-[0.98]"
                        style={{ background: theme.inputBg, color: theme.text, border: `1px solid ${theme.border}` }}
                    >
                        Sign out now
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default SessionTimeoutModal;
