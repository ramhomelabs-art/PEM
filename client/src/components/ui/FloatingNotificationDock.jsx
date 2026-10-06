import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    X,
    Calendar,
    CreditCard,
    AlertTriangle,
    MessageCircle,
    ChevronRight,
    Sparkles,
    CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { API_URL } from '../../config';
import { formatCurrency } from '../../utils/currency';

export default function FloatingNotificationDock() {
    const { user } = useAuth();
    const { isDark } = useTheme() || { isDark: true };
    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();

    const [isOpen, setIsOpen] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [billsDue, setBillsDue] = useState([]);
    const [loansDue, setLoansDue] = useState([]);
    const [loading, setLoading] = useState(false);
    const dockRef = useRef(null);

    // Hide floating dock on auth pages
    const isAuthPage = ['/login', '/signup', '/mfa-verify', '/mfa-setup'].includes(location.pathname);

    const fetchAlerts = useCallback(async () => {
        if (!user || isAuthPage) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            setLoading(true);
            const headers = { Authorization: `Bearer ${token}` };

            // 1. Fetch unread messages count
            const msgPromise = fetch(`${API_URL}/messages/unread/count`, { headers })
                .then((r) => (r.ok ? r.json() : { count: 0 }))
                .catch(() => ({ count: 0 }));

            // 2. Fetch bills to inspect upcoming due dates
            const billsPromise = fetch(`${API_URL}/bills`, { headers })
                .then((r) => (r.ok ? r.json() : []))
                .catch(() => []);

            // 3. Fetch loans to inspect upcoming EMIs
            const loansPromise = fetch(`${API_URL}/loans`, { headers })
                .then((r) => (r.ok ? r.json() : []))
                .catch(() => []);

            const [msgData, billsData, loansData] = await Promise.all([
                msgPromise,
                billsPromise,
                loansPromise
            ]);

            setUnreadMessages(msgData?.count || 0);

            // Filter upcoming unpaid bills within the next 7 days
            const now = new Date();
            const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const activeBills = Array.isArray(billsData)
                ? billsData.filter((b) => {
                      if (b.status === 'Paid') return false;
                      const due = new Date(b.dueDate || b.due_date);
                      return due >= new Date(now.setHours(0, 0, 0, 0)) && due <= sevenDaysLater;
                  })
                : [];
            setBillsDue(activeBills);

            // Filter active loans with upcoming EMI
            const activeLoans = Array.isArray(loansData)
                ? loansData.filter((l) => l.status === 'Active' || l.status === 'active')
                : [];
            setLoansDue(activeLoans);
        } catch (err) {
            console.error('Error fetching dock notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [user, isAuthPage]);

    useEffect(() => {
        if (!user || isAuthPage) return;
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 45000); // Poll every 45s
        return () => clearInterval(interval);
    }, [fetchAlerts, user, isAuthPage]);

    // Close popover when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dockRef.current && !dockRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    if (!user || isAuthPage) return null;

    const totalAlertCount = unreadMessages + billsDue.length + loansDue.length;

    const triggerDemoToast = () => {
        toast.financial('Payment of $1,250.00 for Home Loan EMI is scheduled for tomorrow.', {
            title: 'Upcoming Loan EMI',
            badge: 'LOAN ALERT',
            action: {
                label: 'View Loans',
                onClick: () => navigate('/loans')
            }
        });
    };

    return (
        <div ref={dockRef} className="fixed bottom-6 right-6 z-[9990] flex flex-col items-end">
            {/* Floating Popover Card */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.88, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: 15 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
                        className={`mb-3 w-[360px] sm:w-[400px] overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-2xl ${
                            isDark
                                ? 'bg-slate-900/95 border-slate-700/60 text-slate-100 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)]'
                                : 'bg-white/95 border-slate-200 text-slate-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)]'
                        }`}
                        style={{ maxHeight: 'calc(100vh - 120px)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                            <div className="flex items-center gap-2.5">
                                <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/20 text-violet-400">
                                    <Bell size={16} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold tracking-tight">Floating Alerts</h4>
                                    <p className="text-[11px] text-slate-400">
                                        {totalAlertCount > 0 ? `${totalAlertCount} active alerts` : 'All caught up'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={triggerDemoToast}
                                    title="Test Floating Toast Notification"
                                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10 transition"
                                >
                                    <Sparkles size={12} />
                                    <span>Demo</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white/10 transition"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Alert list body */}
                        <div className="max-h-[380px] overflow-y-auto p-4 space-y-3">
                            {totalAlertCount === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <CheckCircle2 size={32} className="text-emerald-500 mb-2 opacity-80" />
                                    <p className="text-xs font-bold text-slate-300">You're fully up to date!</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">No overdue bills, EMIs, or unread messages.</p>
                                </div>
                            ) : null}

                            {/* Unread Messages */}
                            {unreadMessages > 0 && (
                                <div
                                    onClick={() => {
                                        navigate('/');
                                        setIsOpen(false);
                                    }}
                                    className="group flex cursor-pointer items-center justify-between rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 transition hover:border-sky-500/40 hover:bg-sky-500/15"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/20 text-sky-400">
                                            <MessageCircle size={15} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-200">Unread Messages</p>
                                            <p className="text-[11px] text-sky-400/90">{unreadMessages} new message{unreadMessages > 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition" />
                                </div>
                            )}

                            {/* Bills Due Soon */}
                            {billsDue.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400/90 px-1">
                                        Bills Due Soon ({billsDue.length})
                                    </p>
                                    {billsDue.map((bill) => (
                                        <div
                                            key={bill.id}
                                            onClick={() => {
                                                navigate('/bills');
                                                setIsOpen(false);
                                            }}
                                            className="group flex cursor-pointer items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 transition hover:border-amber-500/40 hover:bg-amber-500/15"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
                                                    <Calendar size={15} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-200">{bill.title || bill.name}</p>
                                                    <p className="text-[11px] text-slate-400">
                                                        Due: {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : 'Upcoming'} • {formatCurrency(bill.amount, user?.currency || 'USD')}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Loans with Upcoming EMI */}
                            {loansDue.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-400/90 px-1">
                                        Active Loans & EMI ({loansDue.length})
                                    </p>
                                    {loansDue.map((loan) => (
                                        <div
                                            key={loan.id}
                                            onClick={() => {
                                                navigate('/loans');
                                                setIsOpen(false);
                                            }}
                                            className="group flex cursor-pointer items-center justify-between rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3 transition hover:border-violet-500/40 hover:bg-violet-500/15"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/20 text-violet-400">
                                                    <CreditCard size={15} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-200">{loan.name || loan.lenderName || 'Loan'}</p>
                                                    <p className="text-[11px] text-slate-400">
                                                        Monthly EMI: {formatCurrency(loan.emiAmount || loan.emi_amount, user?.currency || 'USD')}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Quick Action */}
                        <div className="border-t border-white/10 bg-slate-950/40 p-3 text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    fetchAlerts();
                                    toast.info('Notifications refreshed');
                                }}
                                className="text-[11px] font-bold text-slate-400 hover:text-slate-200 transition"
                            >
                                Refresh Alerts
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Action Bell Trigger Button */}
            <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setIsOpen((prev) => !prev)}
                className={`relative flex h-13 w-13 items-center justify-center rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl transition-all ${
                    isDark
                        ? 'bg-slate-900/90 text-slate-100 border border-slate-700/80 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.8)]'
                        : 'bg-white/95 text-slate-800 border border-slate-200 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.18)]'
                }`}
                aria-label="Floating Notification Center"
            >
                <Bell size={22} className={totalAlertCount > 0 ? 'text-violet-400 animate-pulse' : 'text-slate-400'} />

                {/* Animated Unread Badge */}
                {totalAlertCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 text-[10px] font-black text-white shadow-md ring-2 ring-slate-900 animate-bounce">
                        {totalAlertCount > 9 ? '9+' : totalAlertCount}
                    </span>
                )}
            </motion.button>
        </div>
    );
}
