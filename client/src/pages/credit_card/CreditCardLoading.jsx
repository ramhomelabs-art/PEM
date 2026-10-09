import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { useCardSession } from '../../context/credit_card/CardSessionContext';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';

const CreditCardLoading = () => {
    const navigate = useNavigate();
    const { unlocked } = useCardSession();
    const { loading, cards } = useCreditCards();
    const [progress, setProgress] = useState(8);

    // Guard + gentle progress while the real card data loads.
    useEffect(() => {
        if (!unlocked) {
            navigate('/credit-cards', { replace: true });
            return undefined;
        }

        if (loading) {
            const interval = setInterval(() => {
                setProgress((prev) => (prev >= 90 ? 90 : prev + 2));
            }, 200);
            return () => clearInterval(interval);
        }

        // Data ready (or no cards) — fill the bar, then open the dashboard.
        setProgress(100);
        const timeout = setTimeout(() => navigate('/credit-cards/dashboard', { replace: true }), 600);
        return () => clearTimeout(timeout);
    }, [unlocked, loading, cards, navigate]);

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-4">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,var(--pem-accent-soft),transparent_55%)]"
            />

            <motion.div
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="relative mb-12 flex h-[230px] w-[380px] max-w-full flex-col justify-between overflow-hidden rounded-card bg-gradient-to-br from-violet to-info p-7 text-white shadow-raised"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-extrabold uppercase tracking-wide opacity-90">PEM Pro</p>
                        <p className="text-sm font-bold opacity-80">Secure Card Vault</p>
                    </div>
                    <CreditCard size={26} className="opacity-80" aria-hidden="true" />
                </div>
                <p className="tnum text-lg tracking-[0.28em] opacity-95">•••• •••• •••• ••••</p>
                <div className="flex items-end justify-between text-[11px] opacity-85">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                        <ShieldCheck size={13} aria-hidden="true" /> Verifying access
                    </span>
                    <span>EXPIRES ••/••</span>
                </div>
            </motion.div>

            <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-center text-base font-extrabold text-ink"
            >
                Preparing your credit card dashboard…
            </motion.h2>

            <div className="mt-4 h-2 w-[380px] max-w-full overflow-hidden rounded-pill bg-raised">
                <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.3 }}
                    className="h-full rounded-pill bg-gradient-to-r from-brand to-info"
                />
            </div>
            <p className="tnum mt-2 text-xs font-bold text-ink-faint">{progress}%</p>
        </div>
    );
};

export default CreditCardLoading;
