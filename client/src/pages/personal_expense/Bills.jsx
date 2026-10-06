import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useToast } from '../../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    Clock,
    CreditCard,
    Droplets,
    History,
    MoreHorizontal,
    Plus,
    ReceiptText,
    Smartphone,
    Trash2,
    Wallet,
    Wifi,
    X,
    Zap,
    RefreshCw,
    Sparkles,
} from 'lucide-react';
import { Badge, Button, EmptyState, IconBadge, StatTile } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { cx } from '../../components/ui/cx';
import { formatCurrency, formatDate, relativeDayLabel, daysUntil } from '../../utils/currency';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';
import SubscriptionAuditorModal from '../../components/personal_expense/SubscriptionAuditorModal';

const billIcons = {
    Broadband: Wifi,
    'Mobile Recharge': Smartphone,
    Water: Droplets,
    Electricity: Zap,
    Recharge: Smartphone,
    Other: MoreHorizontal,
};

const BILL_CATEGORIES = ['Broadband', 'Mobile Recharge', 'Electricity', 'Water', 'Recharge', 'Other'];

const STATUS_META = {
    paid: { label: 'Paid', tone: 'pos' },
    generated: { label: 'Bill generated', tone: 'info' },
    unpaid: { label: 'Unpaid', tone: 'neg' },
    overdue: { label: 'Overdue', tone: 'neg' },
};

const statusMeta = (status) => STATUS_META[status] || { label: status || 'Unknown', tone: 'warn' };

const FIELD =
    'h-10 w-full rounded-control border border-line bg-sunken px-3 text-sm text-ink outline-none transition focus:border-line-strong';

const emptyForm = {
    name: '',
    category: 'Broadband',
    provider: '',
    identifier: '',
    amount: '',
    dueDate: '',
    isRecurring: true,
    frequency: 'monthly',
    status: 'unpaid',
};

const Bills = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const currency = user?.currency || 'INR';
    const money = (v) => formatCurrency(v, currency);

    const [bills, setBills] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAuditorOpen, setIsAuditorOpen] = useState(false);
    const [selectedBillHistory, setSelectedBillHistory] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedBill, setSelectedBill] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, action: null, id: null });

    const [formData, setFormData] = useState(emptyForm);

    const fetchBills = useCallback(async () => {
        if (!user || !user.id) return;
        try {
            const [billsRes, txRes] = await Promise.all([
                fetch(`${API_URL}/bills/user/${user.id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                }),
                fetch(`${API_URL}/transactions/user/${user.id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                }),
            ]);
            const [billsData, txData] = await Promise.all([
                billsRes.ok ? billsRes.json() : [],
                txRes.ok ? txRes.json() : [],
            ]);
            setBills(Array.isArray(billsData) ? billsData : []);
            setTransactions(Array.isArray(txData) ? txData : []);
        } catch (err) {
            console.error('Fetch failed:', err);
            setBills([]);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        document.title = 'PEM Pro | Bills & Payments';
        if (user?.id) fetchBills();
        else setLoading(false);
    }, [user, fetchBills]);

    const handleOpenModal = (bill = null) => {
        if (bill) {
            setSelectedBill(bill);
            let idVal = '';
            if (bill.identifiers) {
                const ids =
                    typeof bill.identifiers === 'string'
                        ? JSON.parse(bill.identifiers)
                        : bill.identifiers;
                idVal = ids.value || ids.account || ids.consumerNumber || '';
            }
            setFormData({
                name: bill.name,
                category: bill.category,
                provider: bill.provider || '',
                identifier: idVal,
                amount: bill.amount,
                dueDate: new Date(bill.dueDate).toISOString().slice(0, 10),
                isRecurring: bill.isRecurring,
                frequency: bill.frequency,
                status: bill.status || 'unpaid',
            });
        } else {
            setSelectedBill(null);
            setFormData(emptyForm);
        }
        setIsModalOpen(true);
    };

    const handleAddBill = async (e) => {
        e.preventDefault();
        try {
            const url = selectedBill ? `${API_URL}/bills/${selectedBill.id}` : `${API_URL}/bills`;
            const method = selectedBill ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    ...formData,
                    userId: user.id,
                    identifiers: formData.identifier
                        ? { value: formData.identifier, account: formData.identifier }
                        : null,
                }),
            });
            if (res.ok) {
                setIsModalOpen(false);
                setSelectedBill(null);
                setFormData(emptyForm);
                fetchBills();
                toast.success(selectedBill ? 'Bill updated successfully' : 'New bill added successfully');
            }
        } catch {
            toast.error('Error saving bill');
        }
    };

    const handlePayBill = async (billId) => {
        if (!user || !user.id) return toast.error('User not identified. Please reload.');
        try {
            const res = await fetch(`${API_URL}/bills/${billId}/pay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ paymentMode: 'NetBanking', userId: user.id }),
            });
            if (res.ok) {
                fetchBills();
                toast.financial('Bill paid successfully! Transaction recorded.', {
                    title: 'Payment Completed',
                    badge: 'PAID'
                });
            } else {
                const errData = await res.json();
                toast.error(`Payment failed: ${errData.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error(err);
            toast.error('Payment failed due to network error.');
        }
    };

    const handleDeleteBill = async (billId) => {
        try {
            const res = await fetch(`${API_URL}/bills/${billId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                fetchBills();
                setConfirmDialog({ isOpen: false, action: null, id: null });
                toast.success('Bill deleted successfully');
            } else toast.error('Failed to delete bill');
        } catch {
            toast.error('Error deleting bill');
        }
    };

    const handleDeletePayment = async (txnId) => {
        try {
            const res = await fetch(`${API_URL}/transactions/manual/${txnId}`, { method: 'DELETE' });
            if (res.ok) {
                if (selectedBillHistory) fetchHistory(selectedBillHistory.id);
                fetchBills();
                setConfirmDialog({ isOpen: false, action: null, id: null });
                toast.success('Payment record deleted');
            } else toast.error('Failed to delete payment record');
        } catch {
            toast.error('Error deleting record');
        }
    };

    const fetchHistory = async (billId) => {
        setHistoryLoading(true);
        setHistoryModalOpen(true);
        try {
            const res = await fetch(`${API_URL}/transactions/user/${user.id}`);
            if (res.ok) {
                const data = await res.json();
                const bill = bills.find((b) => b.id === billId);
                const history = data.filter(
                    (t) => t.billId === billId || (t.description && t.description.includes(bill?.name))
                );
                setSelectedBillHistory({ ...bill, transactions: history });
            }
        } catch {
            console.error('History fetch failed');
        } finally {
            setHistoryLoading(false);
        }
    };

    const identifierOf = (bill) => {
        if (!bill.identifiers) return null;
        try {
            const ids =
                typeof bill.identifiers === 'string' ? JSON.parse(bill.identifiers) : bill.identifiers;
            return ids.value || ids.account || ids.consumerNumber || null;
        } catch {
            return null;
        }
    };

    const unpaidBills = bills.filter((b) => b.status !== 'paid');
    const totalDue = unpaidBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const overdueCount = unpaidBills.filter((b) => daysUntil(b.dueDate) < 0).length;
    const dueSoonCount = unpaidBills.filter((b) => {
        const d = daysUntil(b.dueDate);
        return d >= 0 && d <= 7;
    }).length;
    const paidCount = bills.filter((b) => b.status === 'paid').length;

    return (
        <div className="page-container">
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onConfirm={() => {
                    if (confirmDialog.action === 'deleteBill') handleDeleteBill(confirmDialog.id);
                    else if (confirmDialog.action === 'deletePayment')
                        handleDeletePayment(confirmDialog.id);
                }}
                onCancel={() => setConfirmDialog({ isOpen: false, action: null, id: null })}
                title={confirmDialog.action === 'deleteBill' ? 'Delete Bill' : 'Delete Payment'}
                message={
                    confirmDialog.action === 'deleteBill'
                        ? 'Are you sure you want to delete this bill?'
                        : 'Delete this payment record?'
                }
            />

            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                        Bills &amp; Payments
                    </h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Manage your recurring expenses and stay ahead of every due date.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button
                        variant="secondary"
                        icon={RefreshCw}
                        onClick={() => setIsAuditorOpen(true)}
                    >
                        Subscription Auditor
                    </Button>
                    <Button variant="primary" icon={Plus} onClick={() => handleOpenModal(null)}>
                        Add New Bill
                    </Button>
                </div>
            </header>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Total due"
                    value={money(totalDue)}
                    tone="neg"
                    icon={Wallet}
                    hint={`${unpaidBills.length} active`}
                />
                <StatTile
                    label="Due in 7 days"
                    value={dueSoonCount}
                    tone="warn"
                    icon={CalendarClock}
                />
                <StatTile
                    label="Overdue"
                    value={overdueCount}
                    tone={overdueCount > 0 ? 'neg' : 'pos'}
                    icon={AlertTriangle}
                />
                <StatTile label="Paid" value={paidCount} tone="pos" icon={CheckCircle2} />
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="pem-skeleton h-52 rounded-card" />
                    ))}
                </div>
            ) : bills.length === 0 ? (
                <EmptyState
                    icon={ReceiptText}
                    title="No bills added yet"
                    description="Add your broadband, electricity or recharge bills to track them here."
                    action={
                        <Button variant="primary" icon={Plus} onClick={() => handleOpenModal(null)}>
                            Add your first bill
                        </Button>
                    }
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <AnimatePresence>
                        {bills.map((bill) => {
                            const Icon = billIcons[bill.category] || CreditCard;
                            const meta = statusMeta(bill.status);
                            const dueIn = daysUntil(bill.dueDate);
                            const isPaid = bill.status === 'paid';
                            const idVal = identifierOf(bill);
                            return (
                                <motion.article
                                    key={bill.id}
                                    layout
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    onClick={() => handleOpenModal(bill)}
                                    className="pem-card pem-card-hover flex cursor-pointer flex-col gap-4 p-5"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <IconBadge
                                            icon={Icon}
                                            tone={isPaid ? 'pos' : 'brand'}
                                        />
                                        <div className="flex items-center gap-2">
                                            <Badge tone={meta.tone}>{meta.label}</Badge>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConfirmDialog({
                                                        isOpen: true,
                                                        action: 'deleteBill',
                                                        id: bill.id,
                                                    });
                                                }}
                                                title="Delete bill"
                                                aria-label="Delete bill"
                                                className="grid h-7 w-7 place-items-center rounded-control text-ink-faint transition hover:bg-neg-soft hover:text-neg"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="min-w-0">
                                        <h3 className="truncate text-base font-bold text-ink">
                                            {bill.name}
                                        </h3>
                                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                                            {bill.provider ? `${bill.provider} · ` : ''}
                                            {bill.category}
                                            {idVal ? ` · #${idVal}` : ''}
                                        </p>
                                    </div>

                                    <div className="tnum text-2xl font-extrabold tracking-tight text-ink">
                                        {money(bill.amount)}
                                    </div>

                                    <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                                        <CalendarClock size={14} />
                                        Due {formatDate(bill.dueDate)}
                                        {!isPaid ? (
                                            <span
                                                className={cx(
                                                    'ml-auto',
                                                    dueIn < 0 ? 'text-neg' : dueIn <= 7 ? 'text-warn' : 'text-ink-faint'
                                                )}
                                            >
                                                {relativeDayLabel(bill.dueDate)}
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="mt-auto flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            icon={History}
                                            className="flex-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                fetchHistory(bill.id);
                                            }}
                                        >
                                            History
                                        </Button>
                                        {isPaid ? (
                                            <span className="flex flex-1 items-center justify-center gap-1.5 rounded-control bg-pos-soft px-3 text-xs font-bold text-pos">
                                                <CheckCircle2 size={14} />
                                                Paid
                                            </span>
                                        ) : dueIn <= 7 ? (
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                className="flex-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePayBill(bill.id);
                                                }}
                                            >
                                                Pay Now
                                            </Button>
                                        ) : (
                                            <span className="flex flex-1 items-center justify-center rounded-control bg-raised px-3 text-xs font-bold text-ink-muted">
                                                Due in {dueIn} days
                                            </span>
                                        )}
                                    </div>
                                </motion.article>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedBill ? 'Edit bill details' : 'Add new bill'}
                subtitle="Recurring expenses"
                icon={ReceiptText}
                bodyClassName="space-y-4"
            >
                <form onSubmit={handleAddBill} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                            Bill name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Jio Broadband"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            className={FIELD}
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                            Category
                        </label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className={FIELD}
                        >
                            {BILL_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Provider
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. BESCOM"
                                value={formData.provider}
                                onChange={(e) =>
                                    setFormData({ ...formData, provider: e.target.value })
                                }
                                className={FIELD}
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Consumer / A/C no.
                            </label>
                            <input
                                type="text"
                                placeholder="Account number"
                                value={formData.identifier}
                                onChange={(e) =>
                                    setFormData({ ...formData, identifier: e.target.value })
                                }
                                className={FIELD}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Amount
                            </label>
                            <input
                                type="number"
                                placeholder="0"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                                className={FIELD}
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Due date
                            </label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                required
                                className={FIELD}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                            Status
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className={FIELD}
                        >
                            <option value="generated">Generated</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3 rounded-control border border-line bg-sunken p-3.5">
                        <input
                            type="checkbox"
                            checked={formData.isRecurring}
                            onChange={(e) =>
                                setFormData({ ...formData, isRecurring: e.target.checked })
                            }
                            className="h-4 w-4 accent-[var(--pem-accent)]"
                        />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-ink">Recurring bill</p>
                            <p className="text-xs text-ink-muted">Check if this bill repeats</p>
                        </div>
                        {formData.isRecurring ? (
                            <select
                                value={formData.frequency}
                                onChange={(e) =>
                                    setFormData({ ...formData, frequency: e.target.value })
                                }
                                className="h-9 rounded-control border border-line bg-surface px-2 text-xs text-ink outline-none"
                            >
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        ) : null}
                    </div>

                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" className="flex-1">
                            {selectedBill ? 'Update bill' : 'Add bill'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                title="Payment history"
                subtitle={selectedBillHistory?.name || 'Bill payments'}
                icon={History}
                bodyClassName="space-y-2.5"
            >
                {historyLoading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="pem-skeleton h-16 rounded-card" />
                        ))}
                    </div>
                ) : selectedBillHistory?.transactions?.length > 0 ? (
                    selectedBillHistory.transactions.map((txn, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between gap-3 rounded-card border border-line bg-sunken p-3.5"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <IconBadge icon={CheckCircle2} tone="pos" size="sm" />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-ink">
                                        Bill payment
                                    </p>
                                    <p className="text-xs text-ink-muted">
                                        {new Date(txn.date).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="tnum text-sm font-extrabold text-pos">
                                    {money(txn.amount)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setConfirmDialog({
                                            isOpen: true,
                                            action: 'deletePayment',
                                            id: txn.id,
                                        })
                                    }
                                    title="Delete payment"
                                    aria-label="Delete payment"
                                    className="grid h-7 w-7 place-items-center rounded-control text-ink-faint transition hover:bg-neg-soft hover:text-neg"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <EmptyState icon={History} title="No payment history found" />
                )}
            </Modal>

            <SubscriptionAuditorModal
                isOpen={isAuditorOpen}
                onClose={() => setIsAuditorOpen(false)}
                transactions={transactions}
                existingBills={bills}
                currency={currency}
                onAddBill={(sub) => {
                    setIsAuditorOpen(false);
                    setSelectedBill(null);
                    setFormData({
                        ...emptyForm,
                        name: sub.name,
                        amount: sub.amount,
                        frequency: sub.frequency || 'monthly',
                        category: sub.category || 'Other',
                    });
                    setIsModalOpen(true);
                }}
            />
        </div>
    );
};

export default Bills;
