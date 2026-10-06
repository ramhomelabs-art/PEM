import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle,
    Building2,
    CalendarClock,
    Calculator,
    CheckCircle2,
    History,
    Landmark,
    Plus,
    ReceiptText,
    Trash2,
    TrendingDown,
    Wallet,
    FileText,
    Scale,
    ShieldAlert,
    HelpCircle,
    Calendar,
    Percent,
    DollarSign,
    Layers,
} from 'lucide-react';
import {
    Badge,
    Button,
    EmptyState,
    IconBadge,
    Progress,
    StatTile,
} from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatDate } from '../../utils/currency';

const LOAN_CATEGORIES = [
    'Personal Loan',
    'Home Loan',
    'Car Loan',
    'Credit Card EMI',
    'Student Loan',
    'Business Loan',
    'Other',
];

const FIELD =
    'h-10 w-full rounded-control border border-line bg-sunken px-3 text-sm text-ink outline-none transition focus:border-line-strong';

const emptyForm = {
    name: '',
    bankProvider: '',
    totalAmount: '',
    interestRate: '',
    tenureMonths: '',
    category: 'Personal Loan',
    processingFee: '',
    startDate: new Date().toISOString().split('T')[0],
    emiDay: new Date().getDate(),
    terms: '',
};

const calculateEMI = (P, r, n) => {
    if (!P || !r || !n) return 0;
    const R = r / 12 / 100;
    return Math.round((P * R * Math.pow(1 + R, n)) / (Math.pow(1 + R, n) - 1));
};

const Toast = ({ message, type }) => (
    <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        className="fixed left-1/2 top-5 z-[90] flex min-w-[280px] -translate-x-1/2 items-center justify-center gap-2.5 rounded-card border border-line bg-surface px-5 py-3 font-bold text-ink shadow-raised"
    >
        {type === 'error' ? (
            <AlertCircle size={18} className="text-neg" />
        ) : (
            <CheckCircle2 size={18} className="text-pos" />
        )}
        {message}
    </motion.div>
);

const Loans = () => {
    const { user } = useAuth();
    const currency = user?.currency || 'INR';
    const money = (v) => formatCurrency(v, currency);

    const [loans, setLoans] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // History Modal
    const [selectedLoanHistory, setSelectedLoanHistory] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);

    // Breakdown & Terms Modal
    const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
    const [selectedLoanBreakdown, setSelectedLoanBreakdown] = useState(null);
    const [breakdownTab, setBreakdownTab] = useState('summary'); // 'summary' | 'schedule' | 'terms'

    const [toast, setToast] = useState({ message: '', type: 'success', isVisible: false });
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
    });

    const showToast = (message, type = 'success') => {
        setToast({ message, type, isVisible: true });
        setTimeout(() => setToast((prev) => ({ ...prev, isVisible: false })), 3000);
    };

    const [formData, setFormData] = useState(emptyForm);
    const estimatedEMI = calculateEMI(
        formData.totalAmount,
        formData.interestRate,
        formData.tenureMonths
    );
    const totalInterestPreview = formData.totalAmount && formData.tenureMonths && estimatedEMI
        ? Math.max(0, (estimatedEMI * Number(formData.tenureMonths)) - Number(formData.totalAmount))
        : 0;

    const fetchLoans = useCallback(async () => {
        if (!user || !user.id) return;
        try {
            const res = await fetch(`${API_URL}/loans/user/${user.id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setLoans(data);
                else console.error('Loans API did not return an array:', data);
            }
        } catch (err) {
            console.error('Fetch loans failed', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        document.title = 'PEM Pro | Loans & Liabilities';
        if (user?.id) fetchLoans();
    }, [user, fetchLoans]);

    const handleAddLoan = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/loans`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    ...formData,
                    userId: user.id,
                    emiAmount: estimatedEMI,
                    emiDay: parseInt(formData.emiDay, 10) || new Date(formData.startDate).getDate(),
                }),
            });
            if (res.ok) {
                setIsModalOpen(false);
                setFormData(emptyForm);
                fetchLoans();
                showToast('Loan account created successfully!');
            } else {
                const data = await res.json();
                showToast('Failed to create loan: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (err) {
            console.error('Add loan failed', err);
            showToast('Network error: could not connect to server.', 'error');
        }
    };

    const confirmPayEMI = (loan) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Pay EMI',
            message: `Record EMI payment of ${money(loan.emiAmount)} for "${loan.name}"? This will advance the schedule to the next cycle and update your outstanding balance.`,
            onConfirm: () => handlePayEMI(loan),
        });
    };

    const handlePayEMI = async (loan) => {
        try {
            const res = await fetch(`${API_URL}/loans/pay/${loan.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    amount: loan.emiAmount,
                    paymentDate: new Date().toISOString().split('T')[0],
                }),
            });
            if (res.ok) {
                showToast('EMI payment recorded successfully! Marked as PAID for this cycle.');
                fetchLoans();
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                if (breakdownModalOpen && selectedLoanBreakdown?.id === loan.id) {
                    setBreakdownModalOpen(false);
                }
            } else {
                const errData = await res.json();
                showToast(errData.error || 'Payment failed', 'error');
            }
        } catch {
            showToast('Payment failed: Network error', 'error');
        }
    };

    const confirmDeleteLoan = (loanId, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setConfirmDialog({
            isOpen: true,
            title: 'Delete loan',
            message: 'Are you sure you want to delete this loan? This action cannot be undone.',
            onConfirm: () => handleDeleteLoan(loanId),
        });
    };

    const handleDeleteLoan = async (loanId) => {
        try {
            const res = await fetch(`${API_URL}/loans/${loanId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                fetchLoans();
                showToast('Loan deleted successfully');
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            } else showToast('Failed to delete loan', 'error');
        } catch (err) {
            showToast('Network error: ' + err.message, 'error');
        }
    };

    const confirmDeleteEMI = (txnId) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete record',
            message: 'Delete this EMI transaction record?',
            onConfirm: () => handleDeleteEMI(txnId),
        });
    };

    const handleDeleteEMI = async (txnId) => {
        try {
            const res = await fetch(`${API_URL}/transactions/manual/${txnId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                if (selectedLoanHistory) fetchHistory(selectedLoanHistory.id);
                fetchLoans();
                showToast('EMI record deleted');
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            } else showToast('Failed to delete EMI record', 'error');
        } catch {
            showToast('Error deleting record', 'error');
        }
    };

    const fetchHistory = async (loanId) => {
        setHistoryLoading(true);
        try {
            const currentLoan = loans.find((l) => String(l.id) === String(loanId));
            if (!currentLoan) {
                showToast('Loan not found', 'error');
                setHistoryLoading(false);
                return;
            }
            setSelectedLoanHistory({ ...currentLoan, transactions: [] });
            setHistoryModalOpen(true);

            if (!user?.id) {
                showToast('User ID missing', 'error');
                setHistoryLoading(false);
                return;
            }

            const res = await fetch(`${API_URL}/transactions/user/${user.id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const allTransactions = await res.json();
            const loanTransactions = allTransactions.filter((t) => {
                if (t.loanId && String(t.loanId) === String(loanId)) return true;
                const desc = (t.description || '').toLowerCase();
                const loanName = currentLoan.name.toLowerCase();
                return (
                    (t.category === 'Loan EMI' || t.category === 'Loan/EMI') &&
                    desc.includes(loanName)
                );
            });
            loanTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            setSelectedLoanHistory((prev) => ({ ...prev, transactions: loanTransactions }));
        } catch (err) {
            console.error('Failed to fetch loan history:', err);
            showToast(`Error: ${err.message}`, 'error');
        } finally {
            setHistoryLoading(false);
        }
    };

    const openBreakdown = (loan) => {
        setSelectedLoanBreakdown(loan);
        setBreakdownTab('summary');
        setBreakdownModalOpen(true);
    };

    // Calculate Amortization Schedule for Selected Loan
    const amortizationSchedule = useMemo(() => {
        if (!selectedLoanBreakdown) return [];
        const loan = selectedLoanBreakdown;
        const P = parseFloat(loan.totalAmount) || 0;
        const rate = parseFloat(loan.interestRate) || 0;
        const n = parseInt(loan.tenureMonths, 10) || 1;
        const r = rate / 12 / 100;
        const emi = parseFloat(loan.emiAmount) || (r > 0 ? Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) : Math.round(P / n));
        const emiDay = loan.emiDay || 1;
        const completedEmis = loan.completedEmis || 0;
        const isClosed = loan.isClosed;
        const isOverdue = loan.isOverdue;

        const start = loan.startDate ? new Date(loan.startDate) : new Date();
        const schedule = [];
        let balance = P;

        for (let m = 1; m <= n; m++) {
            const interest = r > 0 ? Math.round(balance * r) : 0;
            const principal = m === n ? balance : Math.min(balance, emi - interest);
            const closing = Math.max(0, balance - principal);

            const dueDate = new Date(Date.UTC(
                start.getUTCFullYear(),
                start.getUTCMonth() + m,
                Math.min(emiDay, new Date(start.getUTCFullYear(), start.getUTCMonth() + m + 1, 0).getDate())
            ));

            const isPaid = m <= completedEmis;
            const isCurrent = m === completedEmis + 1 && !isClosed;

            schedule.push({
                installmentNo: m,
                dueDate: dueDate.toISOString().split('T')[0],
                openingBalance: Math.round(balance),
                emi: Math.round(principal + interest),
                principal: Math.round(principal),
                interest: Math.round(interest),
                closingBalance: Math.round(closing),
                status: isPaid ? 'PAID' : (isCurrent ? (isOverdue ? 'OVERDUE' : 'DUE') : 'SCHEDULED'),
            });

            balance = closing;
            if (balance <= 0) break;
        }
        return schedule;
    }, [selectedLoanBreakdown]);

    const activeLoans = loans.filter((l) => l.status !== 'closed');
    const totalOutstanding = loans.reduce((s, l) => s + Number(l.remainingAmount || 0), 0);
    const monthlyEmi = activeLoans.reduce((s, l) => s + Number(l.emiAmount || 0), 0);
    const totalBorrowed = loans.reduce((s, l) => s + Number(l.totalAmount || 0), 0);

    return (
        <div className="page-container">
            <AnimatePresence>
                {toast.isVisible ? <Toast message={toast.message} type={toast.type} /> : null}
            </AnimatePresence>
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                title={confirmDialog.title}
                message={confirmDialog.message}
            />

            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                        Loans &amp; Liabilities
                    </h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Track active loans, smart EMI generation, interest schedules, and repayment terms.
                    </p>
                </div>
                <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
                    Add New Loan
                </Button>
            </header>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Outstanding"
                    value={money(totalOutstanding)}
                    tone="neg"
                    icon={TrendingDown}
                />
                <StatTile label="Monthly EMI" value={money(monthlyEmi)} tone="warn" icon={Wallet} />
                <StatTile label="Active loans" value={activeLoans.length} tone="info" icon={Landmark} />
                <StatTile label="Total borrowed" value={money(totalBorrowed)} tone="violet" icon={Building2} />
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="pem-skeleton h-56 rounded-card" />
                    ))}
                </div>
            ) : loans.length === 0 ? (
                <EmptyState
                    icon={Landmark}
                    title="No active loans"
                    description="Add a loan to track its outstanding balance, reducing interest, and automated EMI schedule."
                    action={
                        <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
                            Add your first loan
                        </Button>
                    }
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence>
                        {loans.map((loan) => {
                            const progress = loan.totalAmount
                                ? ((loan.totalAmount - loan.remainingAmount) / loan.totalAmount) * 100
                                : 0;
                            const isClosed = loan.status === 'closed' || Number(loan.remainingAmount) <= 0;
                            const isEmiPaid = loan.isEmiPaid;
                            const isOverdue = loan.isOverdue;

                            return (
                                <motion.article
                                    key={loan.id}
                                    layout
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    className="pem-card pem-card-hover flex flex-col gap-3.5 p-4 sm:p-5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <IconBadge icon={Building2} tone="neg" />
                                            <div className="min-w-0">
                                                <h3 className="truncate text-base font-bold text-ink">
                                                    {loan.name}
                                                </h3>
                                                <p className="truncate text-xs text-ink-muted">
                                                    {loan.bankProvider} · {loan.category} · {loan.interestRate}% p.a.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {isClosed ? (
                                                <Badge tone="pos">Closed</Badge>
                                            ) : isEmiPaid ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-pos/15 px-2.5 py-0.5 text-[11px] font-bold text-pos">
                                                    <CheckCircle2 size={12} /> Cycle Paid
                                                </span>
                                            ) : isOverdue ? (
                                                <Badge tone="neg">Overdue</Badge>
                                            ) : (
                                                <Badge tone="warn">EMI Due</Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                                                Outstanding Principal
                                            </p>
                                            <p className="tnum text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
                                                {money(loan.remainingAmount)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                                                Monthly EMI
                                            </p>
                                            <p className="tnum text-base sm:text-lg font-extrabold text-neg">
                                                {money(loan.emiAmount)}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <Progress
                                            value={loan.totalAmount - loan.remainingAmount}
                                            max={loan.totalAmount}
                                            tone="pos"
                                        />
                                        <div className="mt-1 flex justify-between text-xs font-semibold text-ink-muted">
                                            <span className="tnum">
                                                {Math.round(progress)}% principal paid
                                            </span>
                                            <span className="tnum">
                                                Total Borrowed {money(loan.totalAmount)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Bar & Next EMI Info */}
                                    <div className="flex flex-wrap items-center gap-2 rounded-control bg-sunken/80 p-2.5 sm:p-3">
                                        <CalendarClock size={16} className="text-ink-muted shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                                                Next EMI Date
                                            </p>
                                            <p className="text-sm font-bold text-ink">
                                                {formatDate(loan.nextEmiDate)}
                                            </p>
                                        </div>

                                        {/* Breakdown & Terms Icon Button */}
                                        <button
                                            type="button"
                                            onClick={() => openBreakdown(loan)}
                                            title="View EMI tenure, principal, interest calculation & terms"
                                            aria-label="View EMI tenure, principal, interest calculation & terms"
                                            className="grid h-8 w-8 place-items-center rounded-control bg-surface hover:bg-raised text-ink-muted hover:text-ink transition active:scale-95"
                                        >
                                            <Calculator size={15} />
                                        </button>

                                        {/* Payment History Button */}
                                        <button
                                            type="button"
                                            onClick={() => fetchHistory(loan.id)}
                                            title="View payment history"
                                            aria-label="View payment history"
                                            className="grid h-8 w-8 place-items-center rounded-control bg-surface hover:bg-raised text-ink-muted hover:text-ink transition active:scale-95"
                                        >
                                            <History size={15} />
                                        </button>

                                        {/* Dynamic EMI Button: PAID vs PAY EMI */}
                                        {isClosed ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-bold bg-pos/15 text-pos select-none">
                                                <CheckCircle2 size={14} /> Closed
                                            </span>
                                        ) : isEmiPaid ? (
                                            <span
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-bold bg-pos/15 text-pos select-none"
                                                title={`This month's EMI is already paid. Next EMI is due on ${formatDate(loan.nextEmiDate)}`}
                                            >
                                                <CheckCircle2 size={14} /> PAID
                                            </span>
                                        ) : isOverdue ? (
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                className="border-0 shadow-none animate-pulse"
                                                onClick={() => confirmPayEMI(loan)}
                                            >
                                                Pay EMI (Overdue)
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                className="border-0 shadow-none"
                                                onClick={() => confirmPayEMI(loan)}
                                            >
                                                Pay EMI
                                            </Button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={(e) => confirmDeleteLoan(loan.id, e)}
                                            title="Delete loan"
                                            aria-label="Delete loan"
                                            className="grid h-8 w-8 place-items-center rounded-control bg-surface hover:bg-neg/15 text-neg transition active:scale-95"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </motion.article>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* --- ADD NEW LOAN MODAL --- */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Loan"
                subtitle="Configure principal, tenure, interest, and EMI payment day"
                icon={Calculator}
                size="md"
                bodyClassName="space-y-4"
            >
                <form onSubmit={handleAddLoan} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Category
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className={FIELD}
                            >
                                {LOAN_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Bank / Provider
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. HDFC Bank, SBI, CRED"
                                value={formData.bankProvider}
                                onChange={(e) =>
                                    setFormData({ ...formData, bankProvider: e.target.value })
                                }
                                required
                                className={FIELD}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                            Loan Name / Purpose
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Bedroom renovation, Car loan"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            className={FIELD}
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                            Principal Amount Borrowed
                        </label>
                        <input
                            type="number"
                            placeholder="e.g. 500000"
                            value={formData.totalAmount}
                            onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                            required
                            className={FIELD}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Annual Interest Rate (% p.a.)
                            </label>
                            <input
                                type="number"
                                step="0.05"
                                placeholder="e.g. 10.5"
                                value={formData.interestRate}
                                onChange={(e) =>
                                    setFormData({ ...formData, interestRate: e.target.value })
                                }
                                required
                                className={FIELD}
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Tenure (Total Months)
                            </label>
                            <input
                                type="number"
                                placeholder="e.g. 24"
                                value={formData.tenureMonths}
                                onChange={(e) =>
                                    setFormData({ ...formData, tenureMonths: e.target.value })
                                }
                                required
                                className={FIELD}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Disbursal Date
                            </label>
                            <input
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => {
                                    const d = e.target.value;
                                    setFormData({
                                        ...formData,
                                        startDate: d,
                                        emiDay: new Date(d).getDate(),
                                    });
                                }}
                                required
                                className={FIELD}
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                EMI Due Day of Month
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="31"
                                placeholder="1 - 31"
                                value={formData.emiDay}
                                onChange={(e) => setFormData({ ...formData, emiDay: e.target.value })}
                                required
                                className={FIELD}
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Processing Fee
                            </label>
                            <input
                                type="number"
                                placeholder="Optional"
                                value={formData.processingFee}
                                onChange={(e) =>
                                    setFormData({ ...formData, processingFee: e.target.value })
                                }
                                className={FIELD}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                            Terms &amp; Notes (Optional)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Account #12345, 0% foreclosure charges, fixed ROI"
                            value={formData.terms}
                            onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                            className={FIELD}
                        />
                    </div>

                    {/* Live Calculation Preview Banner */}
                    <div className="grid grid-cols-3 gap-2 rounded-control border border-line bg-brand-soft p-3 text-center">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Estimated EMI</p>
                            <p className="tnum text-base font-extrabold text-ink">{money(estimatedEMI)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Total Interest</p>
                            <p className="tnum text-base font-extrabold text-ink">{money(totalInterestPreview)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Total Repayment</p>
                            <p className="tnum text-base font-extrabold text-ink">
                                {money((estimatedEMI * (Number(formData.tenureMonths) || 1)) + (Number(formData.processingFee) || 0))}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" className="flex-1">
                            Create Loan
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* --- DETAILED EMI BREAKDOWN, INTEREST & TERMS MODAL --- */}
            <Modal
                isOpen={breakdownModalOpen}
                onClose={() => setBreakdownModalOpen(false)}
                title="Loan Breakdown & Schedule"
                subtitle={selectedLoanBreakdown ? `${selectedLoanBreakdown.name} (${selectedLoanBreakdown.bankProvider})` : ''}
                icon={Calculator}
                size="lg"
                bodyClassName="space-y-4"
            >
                {selectedLoanBreakdown ? (
                    <div>
                        {/* Tab Switcher */}
                        <div className="mb-4 flex border-b border-line">
                            <button
                                type="button"
                                onClick={() => setBreakdownTab('summary')}
                                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                                    breakdownTab === 'summary'
                                        ? 'border-brand text-brand'
                                        : 'border-transparent text-ink-muted hover:text-ink'
                                }`}
                            >
                                <Percent size={14} />
                                Interest &amp; Principle
                            </button>
                            <button
                                type="button"
                                onClick={() => setBreakdownTab('schedule')}
                                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                                    breakdownTab === 'schedule'
                                        ? 'border-brand text-brand'
                                        : 'border-transparent text-ink-muted hover:text-ink'
                                }`}
                            >
                                <Calendar size={14} />
                                Amortization Schedule ({selectedLoanBreakdown.tenureMonths} Mo)
                            </button>
                            <button
                                type="button"
                                onClick={() => setBreakdownTab('terms')}
                                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                                    breakdownTab === 'terms'
                                        ? 'border-brand text-brand'
                                        : 'border-transparent text-ink-muted hover:text-ink'
                                }`}
                            >
                                <Scale size={14} />
                                Terms &amp; Conditions
                            </button>
                        </div>

                        {/* TAB 1: SUMMARY & INTEREST BREAKDOWN */}
                        {breakdownTab === 'summary' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <div className="rounded-control border border-line bg-sunken p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                                            Principle Amount
                                        </p>
                                        <p className="tnum text-lg font-extrabold text-ink">
                                            {money(selectedLoanBreakdown.totalAmount)}
                                        </p>
                                    </div>
                                    <div className="rounded-control border border-line bg-sunken p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                                            Interest Rate
                                        </p>
                                        <p className="tnum text-lg font-extrabold text-ink">
                                            {selectedLoanBreakdown.interestRate}% p.a.
                                        </p>
                                        <p className="text-[10px] text-ink-faint">Reducing Balance</p>
                                    </div>
                                    <div className="rounded-control border border-line bg-sunken p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                                            Monthly EMI
                                        </p>
                                        <p className="tnum text-lg font-extrabold text-neg">
                                            {money(selectedLoanBreakdown.emiAmount)}
                                        </p>
                                    </div>
                                    <div className="rounded-control border border-line bg-sunken p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                                            Total Interest
                                        </p>
                                        <p className="tnum text-lg font-extrabold text-ink">
                                            {money(selectedLoanBreakdown.totalInterest || (selectedLoanBreakdown.emiAmount * selectedLoanBreakdown.tenureMonths - selectedLoanBreakdown.totalAmount))}
                                        </p>
                                    </div>
                                </div>

                                {/* Tenure & Progress */}
                                <div className="rounded-card border border-line bg-sunken p-4">
                                    <div className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
                                        <span className="flex items-center gap-1.5">
                                            <CalendarClock size={15} className="text-brand" />
                                            Tenure Progress: {selectedLoanBreakdown.completedEmis || 0} of {selectedLoanBreakdown.tenureMonths} Months Completed
                                        </span>
                                        <span className="tnum text-ink-muted">
                                            {selectedLoanBreakdown.remainingEmis ?? (selectedLoanBreakdown.tenureMonths - (selectedLoanBreakdown.completedEmis || 0))} Months Remaining
                                        </span>
                                    </div>
                                    <Progress
                                        value={selectedLoanBreakdown.completedEmis || 0}
                                        max={selectedLoanBreakdown.tenureMonths}
                                        tone="pos"
                                    />
                                    <div className="mt-3 grid grid-cols-2 gap-3 pt-1 text-xs">
                                        <div className="flex justify-between border-t border-line pt-2">
                                            <span className="text-ink-muted">Principal Repaid:</span>
                                            <span className="tnum font-bold text-pos">
                                                {money(selectedLoanBreakdown.totalAmount - selectedLoanBreakdown.remainingAmount)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-t border-line pt-2">
                                            <span className="text-ink-muted">Principal Remaining:</span>
                                            <span className="tnum font-bold text-ink">
                                                {money(selectedLoanBreakdown.remainingAmount)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Other Charges & Total Cost Card */}
                                <div className="rounded-card border border-line bg-surface p-4">
                                    <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
                                        Charges &amp; Total Cost of Loan
                                    </h4>
                                    <div className="divide-y divide-line text-xs">
                                        <div className="flex justify-between py-2">
                                            <span className="text-ink-muted">Upfront Processing Fee:</span>
                                            <span className="tnum font-bold text-ink">{money(selectedLoanBreakdown.processingFee || 0)}</span>
                                        </div>
                                        <div className="flex justify-between py-2">
                                            <span className="text-ink-muted">Total Interest over {selectedLoanBreakdown.tenureMonths} Months:</span>
                                            <span className="tnum font-bold text-ink">
                                                {money(selectedLoanBreakdown.totalInterest || (selectedLoanBreakdown.emiAmount * selectedLoanBreakdown.tenureMonths - selectedLoanBreakdown.totalAmount))}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2 font-bold text-sm">
                                            <span className="text-ink">Net Total Loan Repayment:</span>
                                            <span className="tnum text-brand">
                                                {money((selectedLoanBreakdown.emiAmount * selectedLoanBreakdown.tenureMonths) + Number(selectedLoanBreakdown.processingFee || 0))}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: AMORTIZATION SCHEDULE TABLE */}
                        {breakdownTab === 'schedule' && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-ink-muted">
                                    <span>Month-by-month principal vs interest reducing balance schedule</span>
                                    <span className="font-semibold">EMI Due Day: {selectedLoanBreakdown.emiDay || 'Monthly'}</span>
                                </div>
                                <div className="table-scroll max-h-[380px] overflow-y-auto rounded-control border border-line">
                                    <table className="w-full min-w-[640px] text-left text-xs">
                                        <thead className="sticky top-0 bg-surface border-b border-line text-ink-faint uppercase font-bold text-[10px]">
                                            <tr>
                                                <th className="py-2.5 px-3">#</th>
                                                <th className="py-2.5 px-3">Due Date</th>
                                                <th className="py-2.5 px-3 text-right">Opening Bal</th>
                                                <th className="py-2.5 px-3 text-right">EMI</th>
                                                <th className="py-2.5 px-3 text-right">Principal</th>
                                                <th className="py-2.5 px-3 text-right">Interest</th>
                                                <th className="py-2.5 px-3 text-right">Closing Bal</th>
                                                <th className="py-2.5 px-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line">
                                            {amortizationSchedule.map((row) => (
                                                <tr
                                                    key={row.installmentNo}
                                                    className={
                                                        row.status === 'PAID'
                                                            ? 'bg-pos/5'
                                                            : row.status === 'DUE' || row.status === 'OVERDUE'
                                                            ? 'bg-brand/5 font-semibold'
                                                            : 'hover:bg-sunken'
                                                    }
                                                >
                                                    <td className="py-2 px-3 tnum">{row.installmentNo}</td>
                                                    <td className="py-2 px-3">{formatDate(row.dueDate)}</td>
                                                    <td className="py-2 px-3 text-right tnum">{money(row.openingBalance)}</td>
                                                    <td className="py-2 px-3 text-right tnum font-bold">{money(row.emi)}</td>
                                                    <td className="py-2 px-3 text-right tnum text-pos">{money(row.principal)}</td>
                                                    <td className="py-2 px-3 text-right tnum text-neg">{money(row.interest)}</td>
                                                    <td className="py-2 px-3 text-right tnum">{money(row.closingBalance)}</td>
                                                    <td className="py-2 px-3 text-center">
                                                        {row.status === 'PAID' ? (
                                                            <span className="inline-flex items-center gap-1 rounded bg-pos/15 px-1.5 py-0.5 text-[10px] font-bold text-pos">
                                                                <CheckCircle2 size={10} /> Paid
                                                            </span>
                                                        ) : row.status === 'OVERDUE' ? (
                                                            <span className="rounded bg-neg/15 px-1.5 py-0.5 text-[10px] font-bold text-neg">
                                                                Overdue
                                                            </span>
                                                        ) : row.status === 'DUE' ? (
                                                            <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                                                                Due Now
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-ink-faint">
                                                                Upcoming
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: TERMS & CONDITIONS */}
                        {breakdownTab === 'terms' && (
                            <div className="space-y-3.5 text-xs text-ink leading-relaxed">
                                <div className="rounded-card border border-line bg-sunken p-4 space-y-2">
                                    <div className="flex items-center gap-2 font-bold text-ink">
                                        <Building2 size={16} className="text-brand" />
                                        <span>Lender &amp; Regulatory Parameters</span>
                                    </div>
                                    <p className="text-ink-muted">
                                        <strong>Financier:</strong> {selectedLoanBreakdown.bankProvider} · <strong>Category:</strong> {selectedLoanBreakdown.category} · <strong>Interest Method:</strong> Reducing Balance Method (Monthly Rest).
                                    </p>
                                    {selectedLoanBreakdown.terms && (
                                        <p className="mt-1 border-t border-line pt-2 text-ink-muted">
                                            <strong>Account Specific Terms:</strong> {selectedLoanBreakdown.terms}
                                        </p>
                                    )}
                                </div>

                                <div className="rounded-card border border-line bg-sunken p-4 space-y-2">
                                    <div className="flex items-center gap-2 font-bold text-ink">
                                        <Scale size={16} className="text-pos" />
                                        <span>Prepayment &amp; Foreclosure Guidelines</span>
                                    </div>
                                    <p className="text-ink-muted">
                                        As per RBI guidelines, individual borrowers with floating-rate retail term loans incur <strong>0% foreclosure or part-prepayment charges</strong>. You can prepay principal at any time to reduce future interest liabilities.
                                    </p>
                                </div>

                                <div className="rounded-card border border-line bg-sunken p-4 space-y-2">
                                    <div className="flex items-center gap-2 font-bold text-ink">
                                        <ShieldAlert size={16} className="text-neg" />
                                        <span>Penal Charges &amp; Grace Period</span>
                                    </div>
                                    <p className="text-ink-muted">
                                        EMI payments carry a standard 3-day grace period. Late payments attract penal interest of <strong>24% p.a. (2% per month)</strong> on the overdue installment, in addition to standard ECS/NACH bounce fees.
                                    </p>
                                </div>

                                <div className="rounded-card border border-line bg-sunken p-4 space-y-2">
                                    <div className="flex items-center gap-2 font-bold text-ink">
                                        <ReceiptText size={16} className="text-brand" />
                                        <span>Income Tax Deductions</span>
                                    </div>
                                    <p className="text-ink-muted">
                                        {selectedLoanBreakdown.category === 'Home Loan'
                                            ? 'Principal repayment is eligible for deduction up to ₹1,50,000 under Section 80C. Interest payment is deductible up to ₹2,00,000 under Section 24(b).'
                                            : selectedLoanBreakdown.category === 'Student Loan'
                                            ? 'Entire interest paid is eligible for deduction under Section 80E without upper capping for up to 8 continuous assessment years.'
                                            : 'Personal and consumer loans are generally non-tax-deductible unless proven to fund revenue-generating business assets or home improvement.'}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mt-5 flex items-center justify-between border-t border-line pt-3">
                            <Button variant="secondary" onClick={() => setBreakdownModalOpen(false)}>
                                Close
                            </Button>
                            {!selectedLoanBreakdown.isClosed && !selectedLoanBreakdown.isEmiPaid && (
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        setBreakdownModalOpen(false);
                                        confirmPayEMI(selectedLoanBreakdown);
                                    }}
                                >
                                    Pay Current EMI ({money(selectedLoanBreakdown.emiAmount)})
                                </Button>
                            )}
                        </div>
                    </div>
                ) : null}
            </Modal>

            {/* --- PAYMENT HISTORY MODAL --- */}
            <Modal
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                title="Payment History"
                subtitle={selectedLoanHistory?.name || 'EMI payments'}
                icon={ReceiptText}
                bodyClassName="space-y-2.5"
            >
                {historyLoading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="pem-skeleton h-16 rounded-card" />
                        ))}
                    </div>
                ) : selectedLoanHistory?.transactions?.length > 0 ? (
                    selectedLoanHistory.transactions.map((txn, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between gap-3 rounded-card border border-line bg-sunken p-3.5"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <IconBadge icon={CheckCircle2} tone="pos" size="sm" />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-ink">EMI Payment Recorded</p>
                                    <p className="text-xs text-ink-muted">
                                        {new Date(txn.date).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="tnum text-sm font-extrabold text-pos">
                                    {money(txn.amount)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => confirmDeleteEMI(txn.id)}
                                    title="Delete record"
                                    aria-label="Delete record"
                                    className="grid h-7 w-7 place-items-center rounded-control text-ink-faint transition hover:bg-neg-soft hover:text-neg"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <EmptyState icon={History} title="No payment records yet" description="EMI payments recorded through the Pay button will appear here." />
                )}
            </Modal>
        </div>
    );
};

export default Loans;
