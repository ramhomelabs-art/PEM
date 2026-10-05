import { useState, useEffect, useCallback } from 'react';
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
        <div className="page-container" style={{ maxWidth: '1000px' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '50px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <motion.button whileHover={{ x: -5 }} onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}><ArrowLeft size={30} /></motion.button>
                    <h2 style={{ fontSize: '32px', fontWeight: '900', color: theme.text }}>Transaction History</h2>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '5px 12px', borderRadius: '100px', letterSpacing: '2px' }}>{filteredTransactions.length} RECORDS</span>
                </div>
            </div>

            {/* SEARCH & FILTER BAR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            type="text"
                            placeholder="Search by description or category..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                backgroundColor: theme.inputBg,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '16px',
                                padding: '16px 16px 16px 52px',
                                color: theme.text,
                                fontSize: '15px',
                                fontWeight: '700',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <button
                        onClick={exportToPDF}
                        disabled={isExporting || filteredTransactions.length === 0}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            padding: '0 25px',
                            fontWeight: '900',
                            cursor: (isExporting || filteredTransactions.length === 0) ? 'not-allowed' : 'pointer',
                            opacity: (isExporting || filteredTransactions.length === 0) ? 0.5 : 1,
                            boxShadow: '0 10px 20px rgba(16,185,129,0.2)'
                        }}
                    >
                        <FileDown size={20} /> {isExporting ? 'Generating...' : 'Export PDF'}
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', backgroundColor: theme.inputBg, borderRadius: '16px', padding: '4px', border: `1px solid ${theme.border}` }}>
                        {['all', 'day', 'week', 'month', 'year', 'custom'].map(p => (
                            <button
                                key={p}
                                onClick={() => setTimeFilter(p)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    fontSize: '11px',
                                    fontWeight: '900',
                                    textTransform: 'uppercase',
                                    cursor: 'pointer',
                                    backgroundColor: timeFilter === p ? '#10b981' : 'transparent',
                                    color: timeFilter === p ? 'white' : '#64748b',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {['all', 'expense', 'income'].map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    fontSize: '11px',
                                    fontWeight: '900',
                                    textTransform: 'uppercase',
                                    cursor: 'pointer',
                                    backgroundColor: filterType === t ? (t === 'expense' ? '#f43f5e' : t === 'income' ? '#10b981' : '#1e293b') : 'transparent',
                                    color: filterType === t ? 'white' : '#64748b',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {timeFilter === 'custom' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '900', color: '#10b981' }}>START:</label>
                            <input type="date" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '900', color: '#10b981' }}>END:</label>
                            <input type="date" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }} />
                        </div>
                    </motion.div>
                )}
            </div>

            {/* TRANSACTION LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {loading ? (
                    <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                            <Smartphone size={40} color="#10b981" />
                        </motion.div>
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '32px' }}>
                        <p style={{ color: '#64748b', fontWeight: 'bold' }}>No transactions found matching your criteria.</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredTransactions.map((t, i) => {
                            const catData = categories.find(c => c.name === t.category);
                            const Icon = categoryIcons[t.category] || ReceiptText;
                            return (
                                <motion.div
                                    key={t.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    style={{
                                        padding: '24px',
                                        backgroundColor: theme.card,
                                        border: `1px solid ${theme.border}`,
                                        borderRadius: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '20px',
                                        cursor: 'pointer'
                                    }}
                                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)', x: 10 }}
                                >
                                    <div style={{
                                        width: '56px',
                                        height: '56px',
                                        backgroundColor: catData?.color ? `${catData.color}20` : (t.type === 'income' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)'),
                                        borderRadius: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Icon size={24} color={catData?.color || (t.type === 'income' ? '#10b981' : '#f43f5e')} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <h4 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: theme.text }}>{t.description || t.category}</h4>
                                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '100px' }}>{(t.source ? String(t.source).toUpperCase() : 'MANUAL')}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                                            <Calendar size={12} />
                                            <span style={{ color: 'white', fontWeight: '700' }}>
                                                {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: getIANATimezone() })}, {new Date(t.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: getIANATimezone() })}
                                            </span>
                                            <span>•</span>
                                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>{t.category}</span>
                                            <span>•</span>
                                            <span style={{ color: '#0ea5e9', fontWeight: '900' }}>{t.paymentMode === 'Other' ? t.otherPaymentMode : t.paymentMode}</span>
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', fontWeight: '700' }}>
                                            Added by <span style={{ color: '#94a3b8' }}>{t.User?.fullName || t.User?.username || 'System'}</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div>
                                            <div style={{
                                                fontSize: '22px',
                                                fontWeight: '900',
                                                color: t.type === 'income' ? '#10b981' : '#f43f5e',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}>
                                                {t.type === 'income' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                                {t.type === 'expense' && '-'} {formatCurrency(t.amount)}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>SUCCESS</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px' }}>
                                            <button onClick={(e) => { e.stopPropagation(); openEditModal(t); }} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }} title="Edit"><Edit2 size={20} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); setConfirmDialog({ isOpen: true, transactionId: t.id }); }} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }} title="Delete"><Trash2 size={20} /></button>
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




