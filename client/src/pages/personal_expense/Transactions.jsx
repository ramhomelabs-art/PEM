import { subscribeToDataChanges } from '../../utils/realtimeSync';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_URL, BASE_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    ReceiptText,
    ArrowLeft,
    Wallet,
    LogOut,
    TrendingUp,
    TrendingDown,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownLeft,
    Coffee,
    Smartphone,
    ShoppingBag,
    Heart,
    Zap,
    Film,
    Calendar,
    Settings,
    Edit2,
    Trash2,
    Plus,
    Handshake,
    Calculator,
    Receipt,
    FileDown,
    ChevronDown,
    CreditCard,
    Archive,
    PieChart,
    User,
    Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TransactionModal, { categoryIcons } from '../../components/personal_expense/TransactionModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';
import { Button } from '../../components/ui/primitives';
import { cx } from '../../components/ui/cx';
import { useCategories } from '../../context/CategoryContext';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import CreditCardTransactionEditModal from '../../components/credit_card/CreditCardTransactionEditModal';

const Transactions = () => {
    const { user, logout } = useAuth();
    const { theme } = useTheme();
    const { categories } = useCategories();
    const { updateTransaction } = useCreditCards();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCcEditOpen, setIsCcEditOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [timeFilter, setTimeFilter] = useState('all');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });
    const [isExporting, setIsExporting] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, transactionId: null });

    const totalExpense = useMemo(
        () => transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
        [transactions]
    );
    const totalIncome = useMemo(
        () => transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
        [transactions]
    );
    const netBalance = totalIncome - totalExpense;

    const fetchTransactions = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/transactions/user/${user.id}`);
            if (res.status === 404 || res.status === 500) {
                const data = await res.json();
                if (data.error && data.error.includes("not found")) {
                    logout();
                    return;
                }
            }
            const data = await res.json();
            setTransactions(data);
        } catch (err) {
            console.error("Failed to fetch transactions", err);
        } finally {
            setLoading(false);
        }
    }, [user, logout]);

    useEffect(() => {
        document.title = "PEM Pro | Transaction Intelligence";
        if (user) {
            fetchTransactions();
        }
    }, [user, fetchTransactions]);

    const handleDelete = async (id) => {
        try {
            const isCC = id.toString().startsWith('cc_');
            const token = localStorage.getItem('token');
            let res;
            if (isCC) {
                const realId = id.replace('cc_', '');
                res = await fetch(`${API_URL}/credit-cards/transactions/${realId}`, { 
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                res = await fetch(`${API_URL}/transactions/manual/${id}`, { 
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
            if (res.ok) {
                fetchTransactions();
                setConfirmDialog({ isOpen: false, transactionId: null });
            } else {
                alert("Delete failed");
            }
        } catch (err) {
            alert("Network error: " + err.message);
        }
    };

    const openEditModal = (entry) => {
        if (entry.isCreditCardTx) {
            setSelectedEntry(entry);
            setIsCcEditOpen(true);
        } else {
            setModalMode('edit');
            setSelectedEntry(entry);
            setIsModalOpen(true);
        }
    };

    const getIANATimezone = () => {
        const mapping = {
            'India': 'Asia/Kolkata',
            'USA': 'America/New_York',
            'UK': 'Europe/London',
            'Dubai': 'Asia/Dubai',
            'Singapore': 'Asia/Singapore',
            'Australia': 'Australia/Sydney',
            'Germany': 'Europe/Berlin',
            'Japan': 'Asia/Tokyo'
        };
        return mapping[user?.country];
    };

    const formatCurrency = (val) => {
        const symbolMap = { 'USD': '$', 'INR': '₹', 'GBP': '£', 'EUR': '€', 'JPY': '¥', 'AUD': 'A$', 'CAD': 'C$', 'AED': 'د.إ', 'SGD': 'S$' };
        const symbol = symbolMap[user?.currency] || user?.currency || '$';
        return `${symbol}${Number(val).toLocaleString()}`;
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.description?.toLowerCase().includes(searchTerm.toLowerCase()) || t.category?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || t.type === filterType;

        if (!matchesSearch || !matchesType) return false;

        if (timeFilter === 'all') return true;

        const tDate = new Date(t.date);
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));

        if (timeFilter === 'day') {
            return tDate >= startOfDay;
        }

        if (timeFilter === 'week') {
            const lastWeek = new Date(now.setDate(now.getDate() - 7));
            return tDate >= lastWeek;
        }

        if (timeFilter === 'month') {
            const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
            return tDate >= lastMonth;
        }

        if (timeFilter === 'year') {
            const lastYear = new Date(now.setFullYear(now.getFullYear() - 1));
            return tDate >= lastYear;
        }

        if (timeFilter === 'custom' && customDates.start && customDates.end) {
            const start = new Date(customDates.start);
            const end = new Date(customDates.end);
            end.setHours(23, 59, 59, 999);
            return tDate >= start && tDate <= end;
        }

        return true;
    });

    const exportToPDF = () => {
        setIsExporting(true);
        const doc = new jsPDF();
        const symbol = user?.currency === 'INR' ? 'Rs.' : '$';

        // Add Header
        doc.setFontSize(22);
        doc.setTextColor(16, 185, 129); // Brand Green
        doc.text('PEM PRO - ACCOUNT STATEMENT', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Account Holder: ${user.fullName || user.username}`, 14, 35);
        doc.text(`Report Period: ${timeFilter.toUpperCase()}`, 14, 40);

        const tableData = filteredTransactions.map(t => [
            new Date(t.date).toLocaleDateString(),
            t.description || t.category,
            t.category,
            t.paymentMode,
            t.type.toUpperCase(),
            `${t.type === 'expense' ? '-' : ''}${symbol}${t.amount}`
        ]);

        autoTable(doc, {
            startY: 50,
            head: [['Date', 'Description', 'Category', 'Mode', 'Type', 'Amount']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            alternateRowStyles: { fillColor: [240, 240, 240] },
            margin: { top: 50 }
        });

        doc.save(`PEM_Statement_${new Date().getTime()}.pdf`);
        setIsExporting(false);
    };

    const menuItems = [
        { icon: LayoutDashboard, label: 'Overview', id: '/' },
        { icon: ReceiptText, label: 'Transactions', id: '/transactions' },
        { icon: CreditCard, label: 'Bills & Payments', id: '/bills' },
        { icon: Calculator, label: 'Loans & EMI', id: '/loans' },
        { icon: Handshake, label: 'Borrow & Lending', id: '/borrow' },
        { icon: PieChart, label: 'Budgets', id: '/budgets' },
        { icon: CreditCard, label: 'Cards', id: '/cards' },
        { icon: Archive, label: 'Archive Data', id: '/archive' },
        { icon: Settings, label: 'Settings', id: '/profile' }
    ];

    if (user?.role === 'admin') {
        menuItems.splice(4, 0, { icon: Target, label: 'Admin Console', id: '/admin' });
    }

    return (
        <div className="page-container">
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onConfirm={() => handleDelete(confirmDialog.transactionId)}
                onCancel={() => setConfirmDialog({ isOpen: false, transactionId: null })}
                title="Delete Transaction"
                message="Are you sure you want to delete this transaction? This action cannot be undone."
            />
            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={user}
                logout={logout}
                onReload={fetchTransactions}
                mode={modalMode}
                editData={selectedEntry}
            />
            <CreditCardTransactionEditModal
                isOpen={isCcEditOpen}
                onClose={() => {
                    setIsCcEditOpen(false);
                    setSelectedEntry(null);
                }}
                user={user}
                editData={selectedEntry}
                onSave={async (updatedData) => {
                    if (selectedEntry) {
                        await updateTransaction(selectedEntry.creditCardId, selectedEntry.realId, {
                            merchant: updatedData.merchant,
                            amount: updatedData.amount,
                            transactionDate: updatedData.transactionDate,
                            category: updatedData.category,
                            type: updatedData.type,
                            description: updatedData.description
                        });
                        fetchTransactions();
                    }
                }}
            />

            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                        Transaction History
                    </h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Track, filter, and audit all personal income and expense records.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <Button
                        variant="secondary"
                        icon={FileDown}
                        onClick={exportToPDF}
                        disabled={isExporting || filteredTransactions.length === 0}
                    >
                        {isExporting ? 'Generating...' : 'Export PDF'}
                    </Button>
                    <Button
                        variant="primary"
                        icon={Plus}
                        onClick={() => {
                            setModalMode('add');
                            setSelectedEntry(null);
                            setIsModalOpen(true);
                        }}
                    >
                        Add Entry
                    </Button>
                </div>
            </header>

            {/* SEARCH & FILTER BAR */}
            <div className="mb-6 flex flex-col gap-3.5">
                <div className="flex flex-wrap gap-3">
                    <div className="relative min-w-0 flex-1">
                        <Search
                            size={18}
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                        />
                        <input
                            type="text"
                            placeholder="Search by description or category..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 w-full rounded-control border border-line bg-surface pl-10 pr-4 text-sm font-medium text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div
                        role="tablist"
                        aria-label="Filter timeframe"
                        className="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-control border border-line bg-sunken p-0.5"
                    >
                        {['all', 'day', 'week', 'month', 'year', 'custom'].map((p) => {
                            const active = timeFilter === p;
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setTimeFilter(p)}
                                    aria-selected={active}
                                    className={cx(
                                        'rounded-[8px] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition',
                                        active
                                            ? 'bg-surface text-ink shadow-card'
                                            : 'text-ink-muted hover:text-ink'
                                    )}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        role="tablist"
                        aria-label="Filter type"
                        className="inline-flex rounded-control border border-line bg-sunken p-0.5"
                    >
                        {['all', 'expense', 'income'].map((t) => {
                            const active = filterType === t;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setFilterType(t)}
                                    aria-selected={active}
                                    className={cx(
                                        'rounded-[8px] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition',
                                        active
                                            ? 'bg-surface text-ink shadow-card'
                                            : 'text-ink-muted hover:text-ink'
                                    )}
                                >
                                    {t}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {timeFilter === 'custom' && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface p-3"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold text-ink">
                            <span className="text-brand">START:</span>
                            <input
                                type="date"
                                value={customDates.start}
                                onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                                className="rounded-control border border-line bg-sunken px-2.5 py-1 text-xs text-ink"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-ink">
                            <span className="text-brand">END:</span>
                            <input
                                type="date"
                                value={customDates.end}
                                onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                                className="rounded-control border border-line bg-sunken px-2.5 py-1 text-xs text-ink"
                            />
                        </div>
                    </motion.div>
                )}
            </div>

            {/* TRANSACTION LIST */}
            <div className="flex flex-col gap-2.5">
                {loading ? (
                    <div className="flex h-52 items-center justify-center">
                        <Smartphone size={32} className="animate-pulse text-brand" />
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <div className="flex h-52 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line text-center">
                        <p className="text-sm font-bold text-ink-muted">No transactions found</p>
                        <p className="text-xs text-ink-faint">Try adjusting your filters or search terms.</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredTransactions.map((t, i) => {
                            const catData = categories.find((c) => c.name === t.category);
                            const Icon = categoryIcons[t.category] || ReceiptText;
                            const isIncome = t.type === 'income';
                            const isHold = t.source === 'fun_jar_hold' || t.source === 'fun_jar';
                            return (
                                <motion.div
                                    key={t.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    onClick={() => openEditModal(t)}
                                    className={cx(
                                        'pem-card flex flex-wrap items-center gap-3 p-3.5 transition sm:gap-4 sm:p-4 cursor-pointer',
                                        isHold
                                            ? 'border-amber-500/40 bg-amber-500/[0.04] shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                                            : 'hover:border-line-strong'
                                    )}
                                    whileHover={{ x: 4 }}
                                >
                                    <div
                                        className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
                                        style={{
                                            backgroundColor: isHold ? 'rgba(245,158,11,0.15)' : catData?.color ? `${catData.color}20` : isIncome ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                                        }}
                                    >
                                        <Icon size={20} color={isHold ? '#f59e0b' : catData?.color || (isIncome ? '#10b981' : '#f43f5e')} />
                                    </div>
                                    <div className="min-w-[170px] flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="m-0 text-sm font-bold text-ink sm:text-base">
                                                {t.description || t.category}
                                            </h4>
                                            {isHold ? (
                                                <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                                                    🕒 TEMPORARY HOLD: POT
                                                </span>
                                            ) : (
                                                <span className="shrink-0 whitespace-nowrap rounded-pill bg-raised px-2 py-0.5 text-[10px] font-bold text-ink-faint">
                                                    {t.source ? String(t.source).toUpperCase() : 'MANUAL'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                                            <Calendar size={12} className="shrink-0" />
                                            <span className="font-medium text-ink">
                                                {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: getIANATimezone() })}, {new Date(t.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: getIANATimezone() })}
                                            </span>
                                            <span>•</span>
                                            <span className="font-semibold text-brand">{t.category}</span>
                                            <span>•</span>
                                            <span className="font-bold text-ink-muted">{t.paymentMode === 'Other' ? t.otherPaymentMode : t.paymentMode}</span>
                                        </div>
                                    </div>
                                    <div className="ml-auto flex items-center gap-3 text-right sm:gap-4">
                                        <div>
                                            <div
                                                className="tnum flex items-center gap-1.5 text-base font-black sm:text-lg"
                                                style={{ color: isHold ? '#f59e0b' : isIncome ? '#10b981' : '#f43f5e' }}
                                            >
                                                {isIncome ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                                                {!isIncome && '-'} {formatCurrency(t.amount)}
                                            </div>
                                            {isHold && (
                                                <span className="text-[10px] font-bold text-amber-400 block">
                                                    Pending Confirmation
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-1.5 border-l border-line pl-3">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); openEditModal(t); }}
                                                className="grid h-8 w-8 place-items-center rounded-control text-ink-muted transition hover:bg-raised hover:text-brand"
                                                title="Edit"
                                            >
                                                <Edit2 size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setConfirmDialog({ isOpen: true, transactionId: t.id }); }}
                                                className="grid h-8 w-8 place-items-center rounded-control text-ink-muted transition hover:bg-raised hover:text-neg"
                                                title="Delete"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

export default Transactions;




