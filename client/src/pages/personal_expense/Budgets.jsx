import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCategories } from '../../context/CategoryContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle,
    ArrowRight,
    Coffee,
    Edit2,
    Film,
    Heart,
    PieChart,
    Plus,
    ReceiptText,
    Search,
    ShoppingBag,
    Target,
    Trash2,
    Wallet,
    Zap,
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
import { formatCurrency } from '../../utils/currency';

export const categoryIcons = {
    Food: { icon: Coffee, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
    Shopping: { icon: ShoppingBag, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    Travel: { icon: ArrowRight, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
    Medical: { icon: Heart, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    Utility: { icon: Zap, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    Entertainment: { icon: Film, color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
    General: { icon: ReceiptText, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    Others: { icon: Search, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

const FIELD =
    'h-10 w-full rounded-control border border-line bg-sunken px-3 text-sm text-ink outline-none transition focus:border-line-strong';

const BudgetModal = ({ isOpen, onClose, user, onReload, mode, editData }) => {
    const { categories } = useCategories();
    const [formData, setFormData] = useState(() =>
        mode === 'edit' && editData
            ? { category: editData.category, amountLimit: editData.amountLimit, period: editData.period }
            : { category: 'General', amountLimit: '', period: 'monthly' }
    );

    const categoryOptions = categories
        .filter((c) => c.type === 'expense' || c.type === 'both')
        .map((c) => c.name);
    const finalOptions = categoryOptions.length > 0 ? categoryOptions : Object.keys(categoryIcons);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = mode === 'edit' ? `${API_URL}/budgets/${editData.id}` : `${API_URL}/budgets`;
        const method = mode === 'edit' ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, userId: user.id }),
            });
            if (res.ok) {
                onReload();
                onClose();
            }
        } catch (err) {
            console.error('Budget operation failed', err);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'edit' ? 'Edit budget' : 'Set new budget'}
            subtitle="Monthly spending limit"
            icon={Target}
            bodyClassName="space-y-4"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="mb-1.5 block text-xs font-bold text-ink-muted">Category</label>
                    <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className={FIELD}
                    >
                        {finalOptions.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                        Amount limit
                    </label>
                    <input
                        type="number"
                        required
                        placeholder="Enter limit amount"
                        value={formData.amountLimit}
                        onChange={(e) => setFormData({ ...formData, amountLimit: e.target.value })}
                        className={FIELD}
                    />
                </div>

                <div className="flex gap-2 pt-1">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" className="flex-1">
                        {mode === 'edit' ? 'Update budget' : 'Create budget'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

const Budgets = () => {
    const { user } = useAuth();
    const currency = user?.currency || 'INR';
    const [budgets, setBudgets] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedBudget, setSelectedBudget] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, budgetId: null });

    const fetchData = useCallback(async () => {
        try {
            const [budgetRes, transRes] = await Promise.all([
                fetch(`${API_URL}/budgets/user/${user.id}`),
                fetch(`${API_URL}/transactions/user/${user.id}`),
            ]);
            const [bData, tData] = await Promise.all([budgetRes.json(), transRes.json()]);
            setBudgets(Array.isArray(bData) ? bData : []);
            setTransactions(Array.isArray(tData) ? tData : []);
        } catch (err) {
            console.error('Failed to fetch data', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) fetchData();
    }, [user, fetchData]);

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`${API_URL}/budgets/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
                setConfirmDialog({ isOpen: false, budgetId: null });
            }
        } catch (err) {
            console.error('Delete failed', err);
        }
    };

    const calculateSpent = (category) => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return transactions
            .filter((t) => {
                const tDate = new Date(t.date);
                return (
                    t.type === 'expense' &&
                    t.category === category &&
                    tDate.getMonth() === currentMonth &&
                    tDate.getFullYear() === currentYear
                );
            })
            .reduce((sum, t) => sum + Number(t.amount), 0);
    };

    const totalLimit = budgets.reduce((s, b) => s + Number(b.amountLimit || 0), 0);
    const totalSpent = budgets.reduce((s, b) => s + calculateSpent(b.category), 0);
    const overCount = budgets.filter((b) => calculateSpent(b.category) >= Number(b.amountLimit)).length;

    return (
        <div className="page-container mx-auto w-full max-w-[1000px]">
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onConfirm={() => handleDelete(confirmDialog.budgetId)}
                onCancel={() => setConfirmDialog({ isOpen: false, budgetId: null })}
                title="Delete Budget"
                message="Are you sure you want to delete this budget? This action cannot be undone."
            />
            <BudgetModal
                key={`${isModalOpen ? 'open' : 'closed'}-${modalMode}-${selectedBudget?.id ?? 'new'}-${selectedBudget?.amountLimit ?? ''}-${selectedBudget?.period ?? ''}-${selectedBudget?.category ?? ''}`}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={user}
                onReload={fetchData}
                mode={modalMode}
                editData={selectedBudget}
            />

            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-ink">
                        Budgets &amp; Targets
                    </h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Manage your monthly spending limits.
                    </p>
                </div>
                <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => {
                        setModalMode('add');
                        setIsModalOpen(true);
                    }}
                >
                    Set New Budget
                </Button>
            </header>

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Total limit" value={formatCurrency(totalLimit, currency)} tone="info" icon={Target} />
                <StatTile label="Total spent" value={formatCurrency(totalSpent, currency)} tone="warn" icon={Wallet} />
                <StatTile
                    label="Remaining"
                    value={formatCurrency(totalLimit - totalSpent, currency)}
                    tone={totalLimit - totalSpent < 0 ? 'neg' : 'pos'}
                    icon={PieChart}
                />
                <StatTile label="Over budget" value={overCount} tone="neg" icon={AlertCircle} />
            </div>

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="pem-skeleton h-40 rounded-card" />
                    ))}
                </div>
            ) : budgets.length === 0 ? (
                <EmptyState
                    icon={Target}
                    title="No budgets set yet"
                    description="Start by setting a limit for a category like Food or Shopping."
                    action={
                        <Button
                            variant="primary"
                            icon={Plus}
                            onClick={() => {
                                setModalMode('add');
                                setIsModalOpen(true);
                            }}
                        >
                            Set your first budget
                        </Button>
                    }
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <AnimatePresence>
                        {budgets.map((budget) => {
                            const spent = calculateSpent(budget.category);
                            const limit = Number(budget.amountLimit) || 0;
                            const percent = limit ? Math.min((spent / limit) * 100, 100) : 0;
                            const isWarning = percent > 85;
                            const isDanger = percent >= 100;
                            const info = categoryIcons[budget.category] || categoryIcons['Others'];
                            const Icon = info.icon;
                            const tone = isDanger ? 'neg' : isWarning ? 'warn' : 'pos';

                            return (
                                <motion.article
                                    key={budget.id}
                                    layout
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    className="pem-card pem-card-hover flex flex-col gap-4 p-5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <IconBadge icon={Icon} tone={tone === 'pos' ? 'info' : tone} />
                                            <div className="min-w-0">
                                                <h3 className="truncate text-base font-bold text-ink">
                                                    {budget.category}
                                                </h3>
                                                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                                                    Monthly budget
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedBudget(budget);
                                                    setModalMode('edit');
                                                    setIsModalOpen(true);
                                                }}
                                                title="Edit budget"
                                                aria-label="Edit budget"
                                                className="grid h-8 w-8 place-items-center rounded-control text-pos transition hover:bg-pos-soft"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setConfirmDialog({ isOpen: true, budgetId: budget.id })
                                                }
                                                title="Delete budget"
                                                aria-label="Delete budget"
                                                className="grid h-8 w-8 place-items-center rounded-control text-neg transition hover:bg-neg-soft"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between gap-3">
                                        <p className="tnum text-2xl font-extrabold tracking-tight text-ink">
                                            {formatCurrency(spent, currency)}
                                        </p>
                                        <p className="tnum text-sm font-semibold text-ink-muted">
                                            / {formatCurrency(limit, currency)}
                                        </p>
                                    </div>

                                    <div>
                                        <Progress value={spent} max={limit} tone={tone} />
                                        <div className="mt-1.5 flex items-center justify-between">
                                            <Badge tone={tone}>{Math.round(percent)}% used</Badge>
                                            <span className="tnum text-xs font-semibold text-ink-muted">
                                                {formatCurrency(Math.max(limit - spent, 0), currency)} left
                                            </span>
                                        </div>
                                    </div>

                                    {isDanger ? (
                                        <div className="flex items-center gap-2 rounded-control border border-neg bg-neg-soft px-3 py-2 text-xs font-bold text-neg">
                                            <AlertCircle size={14} /> Budget exceeded
                                        </div>
                                    ) : null}
                                </motion.article>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default Budgets;
