import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { API_URL, BASE_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Landmark, CreditCard, Plus, Trash2, Copy, Lock, FileText, Upload, Download,
    File, Shield, Calendar, Eye, EyeOff, ShieldCheck, Sparkles, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import SecurityLock from '../../components/personal_expense/SecurityLock';
import PDFViewer from '../../components/personal_expense/PDFViewer';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';
import { formatCurrency } from '../../utils/currency';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const Accounts = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const { toast } = useToast();
    const currency = user?.currency || 'INR';
    const [activeView, setActiveView] = useState('bank'); // 'bank' or 'documents'
    const [banks, setBanks] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [showRunwayTips, setShowRunwayTips] = useState(false);
    const [selectedBank, setSelectedBank] = useState(null);
    const [, setLoading] = useState(true);
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [showCVV, setShowCVV] = useState({});
    const [isLocked, setIsLocked] = useState(true);
    const [viewerDoc, setViewerDoc] = useState(null);
    const [docPassword, setDocPassword] = useState('');
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [modalConfirmDialog, setModalConfirmDialog] = useState({ isOpen: false, docId: null });
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, action: null, id: null });

    // Forms
    const [bankForm, setBankForm] = useState({ name: '', accountNumber: '', ifsc: '', branch: '', balance: '', type: 'Savings' });
    const [cardForm, setCardForm] = useState({ cardNumber: '', cardHolder: '', expiry: '', cvv: '', type: 'Debit', limit: '' });
    const [docForm, setDocForm] = useState({ documentName: '', documentType: 'other', file: null });

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success(`${label} copied to clipboard!`, {
                title: 'Copied',
                badge: 'CLIPBOARD',
                duration: 2500
            });
        });
    };

    const toggleCVV = (cardId) => {
        setShowCVV(prev => ({ ...prev, [cardId]: !prev[cardId] }));
    };

    useEffect(() => {
        document.title = "PEM Pro | Accounts & Documents";
        if (user?.id) {
            fetchBanks();
            fetchDocuments();
            fetchTransactions();
        }
        // fetchBanks reads selectedBank (and auto-selects the first one), so depending on it would refetch whenever the selection changes. Intentionally runs once per user change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const fetchTransactions = async () => {
        try {
            const res = await fetch(`${API_URL}/transactions/user/${user.id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setTransactions(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const runwayData = useMemo(() => {
        const totalLiquid = banks.reduce((s, b) => s + (Number(b.balance) || 0), 0);

        // Calculate last 90 days expenses for accurate monthly burn rate
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

        const recentExpenses = transactions.filter((t) => {
            if (t.type !== 'expense') return false;
            const d = new Date(t.date);
            return d >= ninetyDaysAgo;
        });

        const totalExpenseLast90 = recentExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const monthlyBurn =
            totalExpenseLast90 > 0
                ? Math.round(totalExpenseLast90 / 3)
                : transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0) || 20000;

        const runwayMonths = monthlyBurn > 0 ? totalLiquid / monthlyBurn : 0;
        const runwayMonthsFormatted = runwayMonths.toFixed(1);
        const targetGoal = monthlyBurn * 6;
        const progressPercent = Math.min(100, Math.round((runwayMonths / 6) * 100));

        let badgeText = 'Financial Fortress (6+ Mo Secured)';
        let badgeColor = 'text-emerald-400 bg-emerald-500/15';

        if (runwayMonths < 1) {
            badgeText = 'Critical Runway (< 1 Month Buffer)';
            badgeColor = 'text-rose-400 bg-rose-500/15';
        } else if (runwayMonths < 3) {
            badgeText = 'Moderate Runway (1–3 Months)';
            badgeColor = 'text-amber-400 bg-amber-500/15';
        } else if (runwayMonths < 6) {
            badgeText = 'Solid Runway (3–6 Months)';
            badgeColor = 'text-emerald-400 bg-emerald-500/15';
        }

        return {
            totalLiquid,
            monthlyBurn,
            runwayMonths,
            runwayMonthsFormatted,
            runwayDays: Math.round(runwayMonths * 30),
            targetGoal,
            progressPercent,
            badgeText,
            badgeColor,
        };
    }, [banks, transactions]);

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_URL}/banks/user/${user.id}`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setBanks(data);
                    if (data.length > 0 && !selectedBank) setSelectedBank(data[0]);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDocuments = async () => {
        try {
            console.log('[Accounts] Fetching documents for user:', user.id);
            const res = await fetch(`${API_URL}/documents/user/${user.id}`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                console.log('[Accounts] Documents fetched:', data);
                if (Array.isArray(data)) setDocuments(data);
            } else {
                console.error('[Accounts] Failed to fetch documents:', res.status);
            }
        } catch (err) {
            console.error('[Accounts] Document fetch error:', err);
        }
    };

    useEffect(() => {
        if (viewerDoc) {
            console.log('[Accounts] Viewer opened for document:', viewerDoc);
        }
    }, [viewerDoc]);

    const handleAddBank = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/banks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ ...bankForm, userId: user.id })
            });
            if (res.ok) {
                setIsBankModalOpen(false);
                setBankForm({ name: '', accountNumber: '', ifsc: '', branch: '', balance: '', type: 'Savings' });
                fetchBanks();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddCard = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ ...cardForm, userId: user.id, bankId: selectedBank.id })
            });
            if (res.ok) {
                setIsCardModalOpen(false);
                setCardForm({ cardNumber: '', cardHolder: '', expiry: '', cvv: '', type: 'Debit', limit: '' });
                fetchBanks();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleUploadDocument = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('file', docForm.file);
        formData.append('documentName', docForm.documentName);
        formData.append('documentType', docForm.documentType);
        formData.append('userId', user.id);

        try {
            const res = await fetch(`${API_URL}/documents/upload`, {
                method: 'POST',
                headers: authHeaders(),
                body: formData
            });
            if (res.ok) {
                setIsDocModalOpen(false);
                setDocForm({ documentName: '', documentType: 'other', file: null });
                fetchDocuments();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteBank = async (bankId) => {
        try {
            const res = await fetch(`${API_URL}/banks/${bankId}`, { method: 'DELETE', headers: authHeaders() });
            if (res.ok) {
                if (selectedBank?.id === bankId) setSelectedBank(null);
                fetchBanks();
                setConfirmDialog({ isOpen: false, action: null, id: null });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteCard = async (cardId) => {
        try {
            const res = await fetch(`${API_URL}/cards/${cardId}`, { method: 'DELETE', headers: authHeaders() });
            if (res.ok) {
                fetchBanks();
                setConfirmDialog({ isOpen: false, action: null, id: null });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteDocument = async (docId, skipConfirm = false) => {
        if (!skipConfirm && !window.confirm('Delete this document?')) return false;
        try {
            const res = await fetch(`${API_URL}/documents/${docId}`, { method: 'DELETE', headers: authHeaders() });
            if (res.ok) {
                fetchDocuments();
                return true;
            }
        } catch (err) {
            console.error(err);
        }
        return false;
    };

    const formatCardNumber = (num) => num.replace(/(\d{4})/g, '$1 ').trim();

    const getDocumentIcon = (type) => {
        const icons = {
            pan: Shield,
            aadhar: Shield,
            passport: FileText,
            bank_statement: File,
            other: File
        };
        return icons[type] || File;
    };

    if (!user) {
        return <div style={{ display: 'flex', width: '100vw', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--pem-bg)', color: 'var(--pem-text)' }}><p>Loading...</p></div>;
    }

    if (isLocked) {
        return <SecurityLock onUnlock={() => setIsLocked(false)} />;
    }

    return (
        <div className="page-container">
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onConfirm={() => {
                    if (confirmDialog.action === 'deleteBank') handleDeleteBank(confirmDialog.id);
                    else if (confirmDialog.action === 'deleteCard') handleDeleteCard(confirmDialog.id);
                    else if (confirmDialog.action === 'deleteDocument') handleDeleteDocument(confirmDialog.id, true);
                }}
                onCancel={() => setConfirmDialog({ isOpen: false, action: null, id: null })}
                title={confirmDialog.action === 'deleteBank' ? 'Delete Bank' : confirmDialog.action === 'deleteCard' ? 'Delete Card' : 'Delete Document'}
                message={confirmDialog.action === 'deleteBank' ? 'Delete this bank and all linked cards?' : confirmDialog.action === 'deleteCard' ? 'Delete this card?' : 'Delete this document?'}
            />
            <ConfirmDialog
                isOpen={modalConfirmDialog.isOpen}
                onConfirm={async () => {
                    const success = await handleDeleteDocument(modalConfirmDialog.docId, true);
                    if (success) {
                        setViewerDoc(null);
                    }
                    setModalConfirmDialog({ isOpen: false, docId: null });
                }}
                onCancel={() => setModalConfirmDialog({ isOpen: false, docId: null })}
                title="Delete Document"
                message="Are you sure you want to delete this document from the viewer?"
            />
            {/* HEADER WITH TOGGLE */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Accounts &amp; Documents</h1>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <button onClick={() => setIsLocked(true)} title="Lock" style={{ padding: '12px', backgroundColor: theme.card, borderRadius: '12px', border: `1px solid ${theme.border}`, cursor: 'pointer', color: theme.textSecondary }}>
                        <Lock size={20} />
                    </button>
                    <div style={{ display: 'flex', gap: '5px', backgroundColor: theme.card, padding: '5px', borderRadius: '14px', border: `1px solid ${theme.border}` }}>
                        <button
                            onClick={() => setActiveView('bank')}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '10px',
                                border: 'none',
                                backgroundColor: activeView === 'bank' ? '#10b981' : 'transparent',
                                color: activeView === 'bank' ? 'white' : theme.textSecondary,
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.3s'
                            }}
                        >
                            <Landmark size={18} /> Bank
                        </button>
                        <button
                            onClick={() => setActiveView('documents')}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '10px',
                                border: 'none',
                                backgroundColor: activeView === 'documents' ? '#10b981' : 'transparent',
                                color: activeView === 'documents' ? 'white' : theme.textSecondary,
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.3s'
                            }}
                        >
                            <FileText size={18} /> Documents
                        </button>
                    </div>
                </div>
            </div>

            {/* RUNWAY & LIQUID RESERVE CARD */}
            {runwayData.totalLiquid > 0 && (
                <div className="mb-6 p-5 rounded-2xl border border-line bg-surface/70 backdrop-blur-md shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                                    Emergency Cash Runway
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${runwayData.badgeColor}`}>
                                        {runwayData.badgeText}
                                    </span>
                                </h2>
                                <p className="text-xs text-ink-muted">
                                    Total Liquid Cash: <strong className="text-emerald-400">{formatCurrency(runwayData.totalLiquid, currency)}</strong> &bull; Monthly Burn: <strong className="text-ink">{formatCurrency(runwayData.monthlyBurn, currency)}</strong>
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowRunwayTips(!showRunwayTips)}
                            className="text-xs text-ink-muted hover:text-ink flex items-center gap-1 font-semibold transition cursor-pointer"
                        >
                            {showRunwayTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <span>{showRunwayTips ? 'Hide Target Details' : 'View Target Details'}</span>
                        </button>
                    </div>

                    {/* Progress bar */}
                        <div className="w-full bg-raised rounded-full h-2.5 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${runwayData.progressPercent}%` }}
                        />
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-semibold text-ink-muted mt-1.5">
                        <span>Current Runway: <strong className="text-ink">{runwayData.runwayMonthsFormatted} Months</strong> ({runwayData.runwayDays} Days)</span>
                        <span>6-Month Safety Target: <strong className="text-ink">{formatCurrency(runwayData.targetGoal, currency)}</strong></span>
                    </div>

                    {showRunwayTips && (
                        <div className="mt-3 pt-3 border-t border-line/60 text-xs text-ink-muted grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="p-2.5 rounded-xl bg-surface/50">
                                <p className="font-bold text-ink mb-0.5">Target Fortress Goal</p>
                                <p className="text-[11px]">Recommended reserve is 6 months of living expenses ({formatCurrency(runwayData.targetGoal, currency)}).</p>
                            </div>
                                    <div className="p-2.5 rounded-xl bg-surface/50">
                                <p className="font-bold text-ink mb-0.5">Estimated Survival Days</p>
                                <p className="text-[11px]">Based on your 90-day spending rate, your cash pool supports {runwayData.runwayDays} days without income.</p>
                            </div>
                                    <div className="p-2.5 rounded-xl bg-surface/50">
                                <p className="font-bold text-ink mb-0.5">Liquid Allocation</p>
                                <p className="text-[11px]">Spread across {banks.length} linked bank accounts with full instant liquidity.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* BANK VIEW */}
            {activeView === 'bank' && (
                <div>
                    <div className="flex flex-col lg:flex-row gap-8">
                    {/* LEFT: BANK LIST */}
                    <div className="w-full lg:w-80 flex flex-col gap-5 shrink-0">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', color: theme.text }}>My Banks</h2>
                            <button onClick={() => setIsBankModalOpen(true)} style={{ padding: '10px', backgroundColor: '#10b981', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'white', boxShadow: '0 5px 15px rgba(16,185,129,0.2)' }}>
                                <Plus size={20} />
                            </button>
                        </div>

                        {banks.map(bank => (
                            <div key={bank.id} style={{ padding: '20px', borderRadius: '20px', backgroundColor: selectedBank?.id === bank.id ? theme.inputBg : theme.card, border: selectedBank?.id === bank.id ? '1px solid #10b981' : `1px solid ${theme.border}`, cursor: 'pointer', transition: 'all 0.3s', position: 'relative' }}>
                                <div onClick={() => setSelectedBank(bank)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                                        <div style={{ padding: '10px', backgroundColor: 'var(--pem-surface-raised)', borderRadius: '10px' }}>
                                            <Landmark size={24} color="#10b981" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ margin: 0, fontWeight: 'bold', color: theme.text }}>{bank.name}</h3>
                                            <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>{bank.type} Account</p>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); setConfirmDialog({ isOpen: true, action: 'deleteBank', id: bank.id }); }} style={{ padding: '8px', backgroundColor: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }} title="Delete Bank">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: theme.text }}>
                                        {formatCurrency(bank.balance, currency)}
                                    </h2>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* RIGHT: BANK DETAILS & CARDS */}
                    <div style={{ flex: 1 }}>
                        {selectedBank ? (
                            <>
                                <h1 style={{ fontSize: '36px', fontWeight: '900', marginBottom: '30px', color: theme.text }}>{selectedBank.name} Dashboard</h1>

                                {/* ACCOUNT DETAILS */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
                                    <div style={{ backgroundColor: theme.card, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                                        <p style={{ margin: '0 0 5px 0', color: theme.textSecondary, fontSize: '12px', fontWeight: 'bold' }}>ACCOUNT NUMBER</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: theme.text }}>{selectedBank.accountNumber}</p>
                                            <button onClick={() => copyToClipboard(selectedBank.accountNumber, 'Account Number')} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }} title="Copy">
                                                <Copy size={16} style={{ color: '#10b981' }} />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ backgroundColor: theme.card, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                                        <p style={{ margin: '0 0 5px 0', color: theme.textSecondary, fontSize: '12px', fontWeight: 'bold' }}>IFSC CODE</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: theme.text }}>{selectedBank.ifsc}</p>
                                            <button onClick={() => copyToClipboard(selectedBank.ifsc, 'IFSC Code')} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }} title="Copy">
                                                <Copy size={16} style={{ color: '#10b981' }} />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ backgroundColor: theme.card, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                                        <p style={{ margin: '0 0 5px 0', color: theme.textSecondary, fontSize: '12px', fontWeight: 'bold' }}>BRANCH</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: theme.text }}>{selectedBank.branch}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* CARDS SECTION */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: theme.text }}>Linked Cards</h2>
                                    <button onClick={() => setIsCardModalOpen(true)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Plus size={18} /> Add Card
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                                    {selectedBank.Cards && selectedBank.Cards.map(card => (
                                        <div key={card.id} style={{
                                            width: '340px', height: '200px', borderRadius: '24px', padding: '25px', color: 'white',
                                            background: card.type === 'Credit' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', opacity: 0.8 }}>{card.type.toUpperCase()}</p>
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    <button onClick={() => setConfirmDialog({ isOpen: true, action: 'deleteCard', id: card.id })} style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer' }} title="Delete Card">
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <CreditCard size={24} />
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '26px', fontWeight: 'bold', letterSpacing: '2px', fontFamily: 'monospace', textShadow: '0 2px 4px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {formatCardNumber(card.cardNumber)}
                                                <button onClick={() => copyToClipboard(card.cardNumber, 'Card Number')} style={{ padding: '4px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '4px', cursor: 'pointer' }} title="Copy">
                                                    <Copy size={14} style={{ color: 'white' }} />
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '10px', opacity: 0.8, fontWeight: 'bold' }}>CARD HOLDER</p>
                                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>{card.cardHolder}</p>
                                                </div>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '10px', opacity: 0.8, fontWeight: 'bold' }}>EXPIRES</p>
                                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{card.expiry}</p>
                                                </div>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '10px', opacity: 0.8, fontWeight: 'bold' }}>CVV</p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{showCVV[card.id] ? card.cvv : '***'}</p>
                                                        <button onClick={() => toggleCVV(card.id)} style={{ padding: '2px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', color: 'white' }} title="Toggle CVV">
                                                            {showCVV[card.id] ? 'Hide' : 'Show'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedBank.Cards || selectedBank.Cards.length === 0) && (
                                        <div style={{ width: '100%', padding: '40px', textAlign: 'center', backgroundColor: theme.card, borderRadius: '20px', color: theme.textSecondary, border: `1px solid ${theme.border}` }}>
                                            <CreditCard size={48} style={{ opacity: 0.2 }} />
                                            <p>No cards linked yet.</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: theme.textSecondary }}>
                                <Landmark size={64} style={{ opacity: 0.2, marginBottom: '20px' }} />
                                <h2>Select a Bank to view details</h2>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}

            {/* DOCUMENTS VIEW */}
            {activeView === 'documents' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                        <h2 style={{ fontSize: '28px', fontWeight: '900', color: theme.text }}>My Documents</h2>
                        <button onClick={() => setIsDocModalOpen(true)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Upload size={18} /> Upload Document
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
                        {documents.map(doc => {
                            const Icon = getDocumentIcon(doc.documentType);
                            return (
                                <div key={doc.id} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: '20px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', cursor: 'pointer', transition: 'all 0.3s', position: 'relative', zIndex: 1 }} onClick={() => setViewerDoc(doc)} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ width: '50px', height: '50px', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Icon size={24} color="#10b981" />
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); setConfirmDialog({ isOpen: true, action: 'deleteDocument', id: doc.id }); }} style={{ padding: '8px', backgroundColor: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', zIndex: 2 }} title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div>
                                        <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold', color: theme.text }}>{doc.documentName}</h3>
                                        <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 'bold' }}>{doc.documentType.replace('_', ' ')}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: theme.textSecondary }}>
                                        <Calendar size={14} />
                                        {new Date(doc.uploadedAt).toLocaleDateString()}
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={(e) => { e.stopPropagation(); setViewerDoc(doc); }} style={{ flex: 1, padding: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '10px', color: '#10b981', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 2 }}>
                                            <Eye size={16} /> View
                                        </button>
                                        <a href={`${BASE_URL}/${doc.filePath}`} download onClick={(e) => e.stopPropagation()} style={{ flex: 1, padding: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '10px', textAlign: 'center', color: '#3b82f6', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 2 }}>
                                            <Download size={16} /> Download
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                        {documents.length === 0 && (
                            <div style={{ gridColumn: '1/-1', padding: '60px', textAlign: 'center', backgroundColor: theme.card, borderRadius: '20px', border: `2px dashed ${theme.border}` }}>
                                <FileText size={64} style={{ opacity: 0.2, margin: '0 auto 20px' }} />
                                <h3 style={{ color: theme.textSecondary }}>No documents uploaded yet</h3>
                                <p style={{ color: theme.textSecondary, fontSize: '14px' }}>Upload your important documents like PAN, Aadhar, or bank statements</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODALS */}
            <AnimatePresence>
                {/* BANK MODAL */}
                {isBankModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBankModalOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ width: '100%', maxWidth: '500px', backgroundColor: theme.sidebar, borderRadius: '32px', border: `1px solid ${theme.border}`, padding: '40px', position: 'relative', zIndex: 20 }}>
                            <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '25px', color: theme.text }}>Add Bank</h2>
                            <form onSubmit={handleAddBank} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <input type="text" placeholder="Bank Name" value={bankForm.name} onChange={e => setBankForm({ ...bankForm, name: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                <input type="text" placeholder="Account Number" value={bankForm.accountNumber} onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <input type="text" placeholder="IFSC" value={bankForm.ifsc} onChange={e => setBankForm({ ...bankForm, ifsc: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                    <input type="text" placeholder="Branch" value={bankForm.branch} onChange={e => setBankForm({ ...bankForm, branch: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                </div>
                                <input type="number" placeholder="Initial Balance" value={bankForm.balance} onChange={e => setBankForm({ ...bankForm, balance: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                <button type="submit" style={{ padding: '18px', backgroundColor: '#10b981', color: 'white', fontWeight: '900', border: 'none', borderRadius: '16px', marginTop: '10px', cursor: 'pointer' }}>Add Bank</button>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* CARD MODAL */}
                {isCardModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCardModalOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ width: '100%', maxWidth: '500px', backgroundColor: theme.sidebar, borderRadius: '32px', border: `1px solid ${theme.border}`, padding: '40px', position: 'relative', zIndex: 20 }}>
                            <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '25px', color: theme.text }}>Add Card</h2>
                            <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="button" onClick={() => setCardForm({ ...cardForm, type: 'Debit' })} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: cardForm.type === 'Debit' ? '#3b82f6' : 'transparent', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Debit</button>
                                    <button type="button" onClick={() => setCardForm({ ...cardForm, type: 'Credit' })} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: cardForm.type === 'Credit' ? '#f59e0b' : 'transparent', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Credit</button>
                                </div>
                                <input type="text" placeholder="Card Number (16 digits)" maxLength="16" value={cardForm.cardNumber} onChange={e => setCardForm({ ...cardForm, cardNumber: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                <input type="text" placeholder="Card Holder Name" value={cardForm.cardHolder} onChange={e => setCardForm({ ...cardForm, cardHolder: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <input type="text" placeholder="MM/YY" maxLength="5" value={cardForm.expiry} onChange={e => setCardForm({ ...cardForm, expiry: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                    <input type="password" placeholder="CVV" maxLength="3" value={cardForm.cvv} onChange={e => setCardForm({ ...cardForm, cvv: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                </div>
                                {cardForm.type === 'Credit' && (
                                    <input type="number" placeholder="Credit Limit" value={cardForm.limit} onChange={e => setCardForm({ ...cardForm, limit: e.target.value })} style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                )}
                                <button type="submit" style={{ padding: '18px', backgroundColor: '#10b981', color: 'white', fontWeight: '900', border: 'none', borderRadius: '16px', marginTop: '10px', cursor: 'pointer' }}>Save Card</button>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* DOCUMENT UPLOAD MODAL */}
                {isDocModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDocModalOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ width: '100%', maxWidth: '500px', backgroundColor: theme.sidebar, borderRadius: '32px', border: `1px solid ${theme.border}`, padding: '40px', position: 'relative', zIndex: 20 }}>
                            <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '25px', color: theme.text }}>Upload Document</h2>
                            <form onSubmit={handleUploadDocument} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <input type="text" placeholder="Document Name" value={docForm.documentName} onChange={e => setDocForm({ ...docForm, documentName: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                <select value={docForm.documentType} onChange={e => setDocForm({ ...docForm, documentType: e.target.value })} style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }}>
                                    <option value="pan">PAN Card</option>
                                    <option value="aadhar">Aadhar Card</option>
                                    <option value="passport">Passport</option>
                                    <option value="driving_license">Driving License</option>
                                    <option value="bank_statement">Bank Statement</option>
                                    <option value="tax_return">Tax Return</option>
                                    <option value="invoice">Invoice</option>
                                    <option value="receipt">Receipt</option>
                                    <option value="other">Other</option>
                                </select>
                                <input type="file" onChange={e => setDocForm({ ...docForm, file: e.target.files[0] })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                <button type="submit" style={{ padding: '18px', backgroundColor: '#10b981', color: 'white', fontWeight: '900', border: 'none', borderRadius: '16px', marginTop: '10px', cursor: 'pointer' }}>Upload</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* DOCUMENT VIEWER MODAL */}
            {viewerDoc && createPortal(
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(5px)' }} onClick={() => { setViewerDoc(null); setDocPassword(''); setShowPasswordPrompt(false); }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '1400px', height: '90vh', backgroundColor: theme.sidebar, borderRadius: '24px', border: `1px solid ${theme.border}`, padding: '30px', position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '20px', borderBottom: `1px solid ${theme.border}` }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 5px 0', color: theme.text }}>{viewerDoc.documentName}</h2>
                                <p style={{ margin: 0, fontSize: '14px', color: theme.textSecondary, textTransform: 'uppercase' }}>{viewerDoc.documentType?.replace('_', ' ')}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    setModalConfirmDialog({ isOpen: true, docId: viewerDoc.id });
                                }} style={{ padding: '10px 20px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Trash2 size={18} /> Delete
                                </button>
                                <a href={`${BASE_URL}/${viewerDoc.filePath}`} download={viewerDoc.documentName} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Download size={18} /> Download
                                </a>
                                <button onClick={() => { setViewerDoc(null); setDocPassword(''); setShowPasswordPrompt(false); }} style={{ padding: '10px 20px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                    Close
                                </button>
                            </div>
                        </div>

                        {/* Password Prompt */}
                        {showPasswordPrompt ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ padding: '40px', backgroundColor: theme.card, borderRadius: '16px', border: `1px solid ${theme.border}`, textAlign: 'center', maxWidth: '500px' }}>
                                    <Shield size={48} color="#f59e0b" style={{ margin: '0 auto 20px' }} />
                                    <h3 style={{ color: theme.text, marginBottom: '10px' }}>Password Protected Document</h3>
                                    <p style={{ color: theme.textSecondary, marginBottom: '20px' }}>This document requires a password to view</p>
                                    <input type="password" placeholder="Enter password" value={docPassword} onChange={(e) => setDocPassword(e.target.value)} style={{ width: '100%', maxWidth: '400px', padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none', marginBottom: '15px' }} />
                                    {/* Testing mode: Any password unlocks */}
                                    <button onClick={() => setShowPasswordPrompt(false)} style={{ padding: '12px 30px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Unlock</button>
                                </div>
                            </div>
                        ) : (
                            /* Document Viewer */
                            <div style={{ flex: 1, borderRadius: '16px', border: `1px solid ${theme.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, position: 'relative',                                 backgroundColor: 'var(--pem-surface-raised)' }}>
                                {viewerDoc.mimeType?.startsWith('image/') || viewerDoc.filePath?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                                        <img
                                            src={`${BASE_URL}/${viewerDoc.filePath}`}
                                            alt={viewerDoc.documentName}
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '100%',
                                                objectFit: 'contain',
                                                borderRadius: '8px'
                                            }}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.parentElement.innerHTML = '<p style="color:white">Failed to load image</p>';
                                            }}
                                        />
                                    </div>
                                ) : viewerDoc.mimeType === 'application/pdf' ? (
                                    <PDFViewer fileUrl={`${BASE_URL}/${viewerDoc.filePath}`} fileName={viewerDoc.documentName} password={docPassword} onClose={() => { setViewerDoc(null); setDocPassword(''); }} />
                                ) : viewerDoc.mimeType?.startsWith('text/') ? (
                                    <iframe
                                        src={`${BASE_URL}/${viewerDoc.filePath}`}
                                        style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }}
                                        title={viewerDoc.documentName}
                                        sandbox="allow-same-origin"
                                    />
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '60px' }}>
                                        <FileText size={80} color={theme.textSecondary} style={{ opacity: 0.5, margin: '0 auto 30px' }} />
                                        <h3 style={{ color: theme.text, marginBottom: '15px', fontSize: '24px' }}>Preview Not Available</h3>
                                        <p style={{ color: theme.textSecondary, marginBottom: '30px', fontSize: '16px' }}>This file type cannot be previewed in the browser</p>
                                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <a href={`${BASE_URL}/${viewerDoc.filePath}`} download onClick={(e) => e.stopPropagation()} style={{ padding: '15px 30px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
                                                <Download size={20} />
                                                Download File
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Accounts;



