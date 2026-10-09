import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle,
    Archive,
    ArrowDownLeft,
    ArrowUpRight,
    Calendar,
    CheckCircle2,
    Clock,
    Handshake,
    Plus,
    Trash2,
} from 'lucide-react';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';
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

const FIELD =
    'h-10 w-full rounded-control border border-line bg-sunken px-3 text-sm text-ink outline-none transition focus:border-line-strong';

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

const getLocalToday = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60 * 1000);
    return local.toISOString().split('T')[0];
};

const withTimezoneFix = (dateStr) => {
    if (!dateStr) return dateStr;
    const todayStr = getLocalToday();
    if (dateStr === todayStr) return new Date().toISOString();
    const [y, m, d] = dateStr.split('-').map((p) => parseInt(p));
    return new Date(y, m - 1, d, 12, 0, 0).toISOString();
};

const RecordCard = ({ item, onPay, onHistory, onDelete }) => {
    const isBorrow = item.type === 'borrow';
    const paid = Number(item.amountPaid || 0);
    const total = Number(item.amount) || 0;
    const remaining = total - paid;

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="pem-card pem-card-hover flex flex-col gap-4 p-5"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <IconBadge icon={isBorrow ? ArrowDownLeft : ArrowUpRight} tone={isBorrow ? 'neg' : 'pos'} />
                    <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-ink">{item.personName}</h3>
                        <p className="text-xs text-ink-muted">
                            {isBorrow ? 'You borrowed' : 'You lent'}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="tnum text-xl font-extrabold tracking-tight text-ink">
                        {formatCurrency(total)}
                    </p>
                    {paid > 0 ? (
                        <p className="tnum text-xs font-semibold text-pos">
                            Paid {formatCurrency(paid)}
                        </p>
                    ) : null}
                </div>
            </div>

            {paid > 0 ? (
                <div>
                    <Progress value={paid} max={total} tone="pos" />
                    <div className="mt-1.5 flex justify-between text-xs font-semibold">
                        <span className="tnum text-ink-muted">
                            {Math.round((paid / total) * 100)}% settled
                        </span>
                        <span className="tnum text-warn">
                            Remaining {formatCurrency(remaining)}
                        </span>
                    </div>
                </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-ink-muted">
                <span className="flex items-center gap-1.5">
                    <Calendar size={14} /> {formatDate(item.date)}
                </span>
                {item.dueDate ? (
                    <span className="flex items-center gap-1.5 text-warn">
                        <Clock size={14} /> Due {formatDate(item.dueDate)}
                    </span>
                ) : null}
            </div>

            <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" icon={Plus} className="flex-1" onClick={() => onPay(item)}>
                    Record Payment
                </Button>
                <button
                    type="button"
                    onClick={() => onHistory(item)}
                    title="Payment history"
                    aria-label="Payment history"
                    className="grid h-8 w-8 place-items-center rounded-control border border-line bg-raised text-violet transition hover:bg-violet-soft"
                >
                    <Archive size={15} />
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    title="Delete record"
                    aria-label="Delete record"
                    className="grid h-8 w-8 place-items-center rounded-control border border-line bg-raised text-neg transition hover:bg-neg-soft"
                >
                    <Trash2 size={15} />
                </button>
            </div>
        </motion.article>
    );
};

const Borrow = () => {
    const { user } = useAuth();
    const currency = user?.currency || 'INR';

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, action: null, id: null });
    const [toast, setToast] = useState({ message: '', type: 'success', isVisible: false });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type, isVisible: true });
        setTimeout(() => setToast((prev) => ({ ...prev, isVisible: false })), 3000);
    }, []);

    const [paymentForm, setPaymentForm] = useState({
        amount: '',
        paymentDate: getLocalToday(),
        notes: '',
    });

    const [formData, setFormData] = useState({
        type: 'borrow',
        personName: '',
        amount: '',
        date: getLocalToday(),
        dueDate: '',
        description: '',
    });

    useEffect(() => {
        document.title = 'PEM Pro | Borrow & Lending';
    }, [user]);

    const getAuthHeaders = (extra = {}) => {
        const token = localStorage.getItem('token');
        return {
            ...extra,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };
    };

    const fetchRecords = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/borrow/user/${user.id}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setRecords(Array.isArray(data) ? data : []);
            } else {
                setRecords([]);
            }
        } catch (err) {
            console.error('Fetch failed:', err);
            setRecords([]);
            showToast('Failed to fetch records', 'error');
        } finally {
            setLoading(false);
        }
    }, [user, showToast]);

    useEffect(() => {
        if (user?.id) fetchRecords();
    }, [user, fetchRecords]);

    const handleAddRecord = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/borrow`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    ...formData,
                    date: withTimezoneFix(formData.date),
                    userId: user.id,
                }),
            });

            if (res.ok) {
                setIsModalOpen(false);
                setFormData({
                    type: 'borrow',
                    personName: '',
                    amount: '',
                    date: getLocalToday(),
                    dueDate: '',
                    description: '',
                });
                fetchRecords();
                showToast('Record added successfully!');
            } else {
                const data = await res.json();
                showToast('Failed to add: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (err) {
            showToast('Network Error: ' + err.message, 'error');
        }
    };

    const handleSettle = async (id) => {
        try {
            const res = await fetch(`${API_URL}/borrow/settle/${id}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                fetchRecords();
                setConfirmDialog({ isOpen: false, action: null, id: null });
                showToast('Record settled successfully!');
            }
        } catch {
            showToast('Error settling record.', 'error');
        }
    };

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`${API_URL}/borrow/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                fetchRecords();
                setConfirmDialog({ isOpen: false, action: null, id: null });
                showToast('Record deleted successfully!');
            } else {
                showToast('Failed to delete record', 'error');
            }
        } catch {
            showToast('Error deleting record', 'error');
        }
    };

    const openPaymentModal = (record) => {
        setSelectedRecord(record);
        setPaymentForm({ amount: '', paymentDate: getLocalToday(), notes: '' });
        setIsPaymentModalOpen(true);
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/borrow/${selectedRecord.id}/payment`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    ...paymentForm,
                    paymentDate: withTimezoneFix(paymentForm.paymentDate),
                }),
            });

            if (res.ok) {
                setIsPaymentModalOpen(false);
                fetchRecords();
                showToast('Payment recorded successfully!');
            } else {
                const data = await res.json();
                showToast(data.error || 'Failed to record payment', 'error');
            }
        } catch (err) {
            console.error('Payment failed:', err);
            showToast('Error recording payment', 'error');
        }
    };

    const openHistoryModal = async (record) => {
        setSelectedRecord(record);
        setIsHistoryModalOpen(true);
        try {
            const res = await fetch(`${API_URL}/borrow/${record.id}/payments`, {
                headers: getAuthHeaders()
            });
            if (res.ok) setPaymentHistory(await res.json());
        } catch (err) {
            console.error('Failed to fetch history:', err);
        }
    };

    const activeRecords = records.filter((record) => record.status !== 'settled');
    const borrowedRecords = activeRecords.filter((r) => r.type === 'borrow');
    const lentRecords = activeRecords.filter((r) => r.type === 'lend');
    const totalBorrowed = borrowedRecords.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const totalLent = lentRecords.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    if (!user) {
        return (
            <div className="grid min-h-screen place-items-center bg-sunken text-ink-muted">
                Loading...
            </div>
        );
    }

    return (
        <div className="page-container">
            <AnimatePresence>
                {toast.isVisible ? <Toast message={toast.message} type={toast.type} /> : null}
            </AnimatePresence>

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onConfirm={() => {
                    if (confirmDialog.action === 'settle') handleSettle(confirmDialog.id);
                    else if (confirmDialog.action === 'delete') handleDelete(confirmDialog.id);
                }}
                onCancel={() => setConfirmDialog({ isOpen: false, action: null, id: null })}
                title={confirmDialog.action === 'settle' ? 'Settle Record' : 'Delete Record'}
                message={
                    confirmDialog.action === 'settle'
                        ? 'Mark as settled? This will record a transaction.'
                        : 'Are you sure you want to delete this record?'
                }
            />

            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                        Borrow &amp; Lending
                    </h1>
                    <p className="mt-1 text-sm text-ink-muted">Manage debts and receivables.</p>
                </div>
                <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
                    Add Record
                </Button>
            </header>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="You owe" value={formatCurrency(totalBorrowed, currency)} tone="neg" icon={ArrowDownLeft} />
                <StatTile label="Owed to you" value={formatCurrency(totalLent, currency)} tone="pos" icon={ArrowUpRight} />
                <StatTile label="Borrowed records" value={borrowedRecords.length} tone="warn" icon={Handshake} />
                <StatTile label="Lent records" value={lentRecords.length} tone="info" icon={Archive} />
            </div>

            <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                <section className="flex flex-col gap-4">
                    <h2 className="flex items-center gap-2 border-b border-line pb-3 text-sm font-bold text-neg">
                        <ArrowDownLeft size={18} /> Borrowed (You Owe)
                        <Badge tone="neg" className="ml-auto">{borrowedRecords.length}</Badge>
                    </h2>
                    {loading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="pem-skeleton h-52 rounded-card" />
                        ))
                    ) : borrowedRecords.length === 0 ? (
                        <EmptyState icon={ArrowDownLeft} title="No active debts" />
                    ) : (
                        <AnimatePresence>
                            {borrowedRecords.map((item) => (
                                <RecordCard
                                    key={item.id}
                                    item={item}
                                    onPay={openPaymentModal}
                                    onHistory={openHistoryModal}
                                    onDelete={(id) => setConfirmDialog({ isOpen: true, action: 'delete', id })}
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </section>

                <section className="flex flex-col gap-4">
                    <h2 className="flex items-center gap-2 border-b border-line pb-3 text-sm font-bold text-pos">
                        <ArrowUpRight size={18} /> Lent (Owed to You)
                        <Badge tone="pos" className="ml-auto">{lentRecords.length}</Badge>
                    </h2>
                    {loading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="pem-skeleton h-52 rounded-card" />
                        ))
                    ) : lentRecords.length === 0 ? (
                        <EmptyState icon={ArrowUpRight} title="No active receivables" />
                    ) : (
                        <AnimatePresence>
                            {lentRecords.map((item) => (
                                <RecordCard
                                    key={item.id}
                                    item={item}
                                    onPay={openPaymentModal}
                                    onHistory={openHistoryModal}
                                    onDelete={(id) => setConfirmDialog({ isOpen: true, action: 'delete', id })}
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </section>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add new record"
                subtitle="Borrow or lend money"
                icon={Handshake}
                bodyClassName="space-y-4"
            >
                <form onSubmit={handleAddRecord} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'borrow' })}
                            className={`h-11 rounded-control border text-sm font-bold transition ${
                                formData.type === 'borrow'
                                    ? 'border-neg bg-neg text-white'
                                    : 'border-line bg-raised text-ink-muted hover:text-ink'
                            }`}
                        >
                            Borrow (In)
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'lend' })}
                            className={`h-11 rounded-control border text-sm font-bold transition ${
                                formData.type === 'lend'
                                    ? 'border-pos bg-pos text-white'
                                    : 'border-line bg-raised text-ink-muted hover:text-ink'
                            }`}
                        >
                            Lend (Out)
                        </button>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                            Person name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Ravi"
                            value={formData.personName}
                            onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                            required
                            className={FIELD}
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-ink-muted">Amount</label>
                        <input
                            type="number"
                            placeholder="0"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            required
                            className={FIELD}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">Date</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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
                                className={FIELD}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Optional notes..."
                            className={`${FIELD} h-24 resize-none py-2`}
                        />
                    </div>

                    <div className="flex gap-2 pt-1">
                        <Button variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" className="flex-1">
                            Save record
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title="Record payment"
                subtitle={
                    selectedRecord?.type === 'borrow'
                        ? 'Amount you paid back'
                        : 'Amount you received'
                }
                icon={Plus}
                bodyClassName="space-y-4"
            >
                {selectedRecord ? (
                    <form onSubmit={handleRecordPayment} className="space-y-4">
                        <div className="flex items-center justify-between rounded-control border border-line bg-warn-soft px-4 py-3">
                            <span className="text-sm font-bold text-warn">Remaining</span>
                            <span className="tnum text-lg font-extrabold text-warn">
                                {formatCurrency(
                                    selectedRecord.amount - (selectedRecord.amountPaid || 0),
                                    currency
                                )}
                            </span>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Amount *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={paymentForm.amount}
                                onChange={(e) =>
                                    setPaymentForm({ ...paymentForm, amount: e.target.value })
                                }
                                required
                                max={selectedRecord.amount - (selectedRecord.amountPaid || 0)}
                                placeholder="Enter amount"
                                className={FIELD}
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Payment date
                            </label>
                            <input
                                type="date"
                                value={paymentForm.paymentDate}
                                onChange={(e) =>
                                    setPaymentForm({ ...paymentForm, paymentDate: e.target.value })
                                }
                                className={FIELD}
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                                Notes (optional)
                            </label>
                            <textarea
                                value={paymentForm.notes}
                                onChange={(e) =>
                                    setPaymentForm({ ...paymentForm, notes: e.target.value })
                                }
                                placeholder="Add notes..."
                                className={`${FIELD} h-20 resize-none py-2`}
                            />
                        </div>

                        <div className="flex gap-2 pt-1">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => setIsPaymentModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button variant="primary" type="submit" className="flex-1">
                                Record payment
                            </Button>
                        </div>
                    </form>
                ) : null}
            </Modal>

            <Modal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                title="Payment history"
                subtitle={selectedRecord?.personName}
                icon={Archive}
                bodyClassName="space-y-4"
            >
                {selectedRecord ? (
                    <>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <StatTile label="Total" value={formatCurrency(selectedRecord.amount, currency)} />
                            <StatTile
                                label="Paid"
                                value={formatCurrency(selectedRecord.amountPaid || 0, currency)}
                                tone="pos"
                            />
                            <StatTile
                                label="Remaining"
                                value={formatCurrency(
                                    selectedRecord.amount - (selectedRecord.amountPaid || 0),
                                    currency
                                )}
                                tone="warn"
                            />
                        </div>

                        {paymentHistory.length === 0 ? (
                            <EmptyState icon={Archive} title="No payments recorded yet" />
                        ) : (
                            <div className="space-y-2.5">
                                {paymentHistory.map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="rounded-card border border-line bg-sunken p-3.5"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="tnum text-base font-extrabold text-pos">
                                                {formatCurrency(payment.amount, currency)}
                                            </span>
                                            <span className="text-xs text-ink-faint">
                                                {formatDate(payment.paymentDate)}
                                            </span>
                                        </div>
                                        {payment.notes ? (
                                            <p className="mt-1 text-xs text-ink-muted">{payment.notes}</p>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : null}
            </Modal>
        </div>
    );
};

export default Borrow;
