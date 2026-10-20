import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { API_URL, BASE_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Landmark, CreditCard, Plus, Trash2, Copy, Lock, FileText, Upload, Download,
    File, Shield, Calendar, Eye, EyeOff, ShieldCheck, Sparkles, ChevronDown, ChevronUp, AlertCircle, Pencil
} from 'lucide-react';
import SecurityLock from '../../components/personal_expense/SecurityLock';
import PDFViewer from '../../components/personal_expense/PDFViewer';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';
import { VirtualCard } from '../../components/personal_expense/accounts/VirtualCard';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../../components/ui/primitives';
import { cx } from '../../components/ui/cx';
import {
    encryptField, decryptFieldStrict, isEncrypted,
    maskAccountNumber, clearClipboardAfterTimeout
} from '../../lib/crypto';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const getDocumentUrl = (filePath, download = false) => {
    if (!filePath) return '';
    const token = localStorage.getItem('token');
    const base = `${BASE_URL}/${filePath}`;
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (download) params.set('download', '1');
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
};

const EMPTY_BANK_FORM = { name: '', accountHolderName: '', accountNumber: '', ifsc: '', micrCode: '', branch: '', balance: '', type: 'Savings' };
const EMPTY_CARD_FORM = { cardNumber: '', cardHolder: '', expiry: '', cvv: '', type: 'Debit', limit: '', bankId: '', bankName: '' };

const Accounts = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const { toast } = useToast();
    const currency = user?.currency || 'INR';
    const [activeView, setActiveView] = useState('bank'); // 'bank' or 'documents'
    const [banks, setBanks] = useState([]);
    const [allCards, setAllCards] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [showRunwayTips, setShowRunwayTips] = useState(false);
    const [selectedBank, setSelectedBank] = useState(null);
    const [, setLoading] = useState(true);
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [isLocked, setIsLocked] = useState(true);
    const [vaultPassphrase, setVaultPassphrase] = useState('');
    const [editingBank, setEditingBank] = useState(null);
    const [viewerDoc, setViewerDoc] = useState(null);
    const [docPassword, setDocPassword] = useState('');
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [modalConfirmDialog, setModalConfirmDialog] = useState({ isOpen: false, docId: null });
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, action: null, id: null });

    // Forms
    const [bankForm, setBankForm] = useState({ ...EMPTY_BANK_FORM });
    const [cardForm, setCardForm] = useState({ ...EMPTY_CARD_FORM });
    const [docForm, setDocForm] = useState({ documentName: '', documentType: 'other', file: null });

    // Standalone cards (cards not linked to any active bank account)
    const standaloneCards = useMemo(() => {
        const bankIds = new Set(banks.map(b => b.id));
        return allCards.filter(c => !c.bankId || !bankIds.has(c.bankId));
    }, [allCards, banks]);

    const copyToClipboard = async (text, label) => {
        if (!text) return;
        let valueToCopy = text;
        if (isEncrypted(text)) {
            const res = await decryptFieldStrict(text, vaultPassphrase);
            if (res.success) {
                valueToCopy = res.value;
            } else {
                toast.error("Can't decrypt field to copy. Please check your vault unlock.", { title: 'Security', badge: 'ENCRYPTION' });
                return;
            }
        }
        navigator.clipboard.writeText(valueToCopy).then(() => {
            toast.success(`${label} copied to clipboard!`, {
                title: 'Copied',
                badge: 'CLIPBOARD',
                duration: 2500
            });
            clearClipboardAfterTimeout(30000);
        });
    };

    useEffect(() => {
        document.title = "PEM Pro | Accounts & Documents";
        if (user?.id) {
            fetchBanks();
            fetchCards();
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
                    setSelectedBank(prev => {
                        if (prev === 'standalone') return 'standalone';
                        if (!prev && data.length > 0) return data[0];
                        if (prev && typeof prev === 'object') {
                            const updated = data.find(b => b.id === prev.id);
                            return updated || (data.length > 0 ? data[0] : 'standalone');
                        }
                        return prev;
                    });
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCards = async () => {
        try {
            const res = await fetch(`${API_URL}/cards`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setAllCards(data);
                }
            }
        } catch (err) {
            console.error('[Accounts] Cards fetch error:', err);
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

    const closeBankModal = () => {
        setIsBankModalOpen(false);
        setEditingBank(null);
    };

    const openEditBank = (bank) => {
        setEditingBank(bank);
        setBankForm({
            name: bank.name || '',
            accountHolderName: bank.accountHolderName || '',
            accountNumber: bank.accountNumber || '',
            ifsc: bank.ifsc || '',
            micrCode: bank.micrCode || '',
            branch: bank.branch || '',
            balance: bank.balance ?? '',
            type: bank.type || 'Savings'
        });
        setIsBankModalOpen(true);
    };

    const handleAddBank = async (e) => {
        e.preventDefault();
        try {
            const isEdit = Boolean(editingBank);
            let rawAcc = String(bankForm.accountNumber || '').trim();
            let encAcc = rawAcc;
            if (rawAcc && !isEncrypted(rawAcc)) {
                encAcc = await encryptField(rawAcc, vaultPassphrase);
            }
            const payload = isEdit
                ? { ...bankForm, accountNumber: encAcc }
                : { ...bankForm, userId: user.id, accountNumber: encAcc };

            const res = await fetch(isEdit ? `${API_URL}/banks/${editingBank.id}` : `${API_URL}/banks`, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const saved = await res.json();
                closeBankModal();
                setBankForm({ ...EMPTY_BANK_FORM });
                if (isEdit && selectedBank?.id === editingBank.id) {
                    setSelectedBank((prev) => ({ ...prev, ...saved }));
                }
                fetchBanks();
                toast.success(isEdit ? 'Bank updated' : 'Bank added', { title: 'Accounts', badge: 'BANK', duration: 2500 });
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || 'Failed to save bank', { title: 'Accounts', badge: 'BANK' });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddCard = async (e) => {
        e.preventDefault();
        try {
            let encCard = String(cardForm.cardNumber || '').trim();
            if (encCard && !isEncrypted(encCard)) {
                encCard = await encryptField(encCard, vaultPassphrase);
            }
            let encCvv = String(cardForm.cvv || '').trim();
            if (encCvv && encCvv !== '***' && !isEncrypted(encCvv)) {
                encCvv = await encryptField(encCvv, vaultPassphrase);
            } else {
                encCvv = '***';
            }

            let targetBankId = cardForm.bankId;
            if (targetBankId === undefined || targetBankId === '') {
                targetBankId = (selectedBank && selectedBank !== 'standalone') ? selectedBank.id : null;
            } else if (targetBankId === 'standalone') {
                targetBankId = null;
            }

            let targetBankName = cardForm.bankName ? cardForm.bankName.trim() : '';
            if (targetBankId) {
                const matchedBank = banks.find(b => b.id === targetBankId);
                if (matchedBank) targetBankName = matchedBank.name;
            }

            const res = await fetch(`${API_URL}/cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({
                    ...cardForm,
                    cardNumber: encCard,
                    cvv: encCvv,
                    userId: user.id,
                    bankId: targetBankId,
                    bankName: targetBankName || null
                })
            });
            if (res.ok) {
                setIsCardModalOpen(false);
                setCardForm({ ...EMPTY_CARD_FORM });
                fetchBanks();
                fetchCards();
                toast.success('Card saved successfully', { title: 'Cards', badge: 'CARD', duration: 2500 });
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || 'Failed to save card', { title: 'Cards', badge: 'CARD' });
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
                fetchCards();
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
                fetchCards();
                setConfirmDialog({ isOpen: false, action: null, id: null });
                toast.success('Card deleted', { title: 'Cards', badge: 'CARD', duration: 2500 });
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
        return <SecurityLock onUnlock={(password) => { setVaultPassphrase(password || ''); setIsLocked(false); }} />;
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
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Accounts &amp; Documents</h1>
                    <p className="mt-1 text-sm text-ink-muted">Manage encrypted bank vaults, linked debit/credit cards, and identity records.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setVaultPassphrase(''); setIsLocked(true); }}
                        title="Lock Vault"
                        className="grid h-10 w-10 place-items-center rounded-control border border-line bg-surface text-ink-muted transition-all hover:border-line-strong hover:bg-raised hover:text-ink active:scale-95 cursor-pointer shadow-sm"
                    >
                        <Lock size={18} />
                    </button>
                    <div className="inline-flex rounded-control border border-line bg-sunken p-1">
                        <button
                            type="button"
                            onClick={() => setActiveView('bank')}
                            className={cx(
                                'flex items-center gap-2 rounded-[8px] px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer',
                                activeView === 'bank'
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                                    : 'text-ink-muted hover:text-ink'
                            )}
                        >
                            <Landmark size={15} /> Bank
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView('documents')}
                            className={cx(
                                'flex items-center gap-2 rounded-[8px] px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer',
                                activeView === 'documents'
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                                    : 'text-ink-muted hover:text-ink'
                            )}
                        >
                            <FileText size={15} /> Documents
                        </button>
                    </div>
                </div>
            </div>

            {/* RUNWAY & LIQUID RESERVE CARD */}
            {runwayData.totalLiquid > 0 && (
                <div className="pem-card pem-card-hover mb-6 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-sm">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-sm font-extrabold text-ink flex items-center gap-2">
                                    Emergency Cash Runway
                                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${runwayData.badgeColor}`}>
                                        {runwayData.badgeText}
                                    </span>
                                </h2>
                                <p className="text-xs text-ink-muted mt-0.5">
                                    Total Liquid Cash: <strong className="text-emerald-400">{formatCurrency(runwayData.totalLiquid, currency)}</strong> &bull; Monthly Burn: <strong className="text-ink">{formatCurrency(runwayData.monthlyBurn, currency)}</strong>
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowRunwayTips(!showRunwayTips)}
                            className="text-xs text-ink-muted hover:text-emerald-400 flex items-center gap-1 font-bold transition cursor-pointer"
                        >
                            {showRunwayTips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            <span>{showRunwayTips ? 'Hide Target Details' : 'View Target Details'}</span>
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-raised rounded-full h-2.5 overflow-hidden border border-white/5">
                        <div
                            className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 h-2.5 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                            style={{ width: `${runwayData.progressPercent}%` }}
                        />
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-semibold text-ink-muted mt-2">
                        <span>Current Runway: <strong className="text-emerald-400">{runwayData.runwayMonthsFormatted} Months</strong> ({runwayData.runwayDays} Days)</span>
                        <span>6-Month Safety Target: <strong className="text-ink">{formatCurrency(runwayData.targetGoal, currency)}</strong></span>
                    </div>

                    {showRunwayTips && (
                        <div className="mt-4 pt-4 border-t border-line/60 text-xs text-ink-muted grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl bg-sunken border border-line">
                                <p className="font-bold text-ink mb-1">Target Fortress Goal</p>
                                <p className="text-[11px] leading-relaxed">Recommended reserve is 6 months of living expenses ({formatCurrency(runwayData.targetGoal, currency)}).</p>
                            </div>
                            <div className="p-3 rounded-xl bg-sunken border border-line">
                                <p className="font-bold text-ink mb-1">Estimated Survival Days</p>
                                <p className="text-[11px] leading-relaxed">Based on your 90-day spending rate, your cash pool supports {runwayData.runwayDays} days without income.</p>
                            </div>
                            <div className="p-3 rounded-xl bg-sunken border border-line">
                                <p className="font-bold text-ink mb-1">Liquid Allocation</p>
                                <p className="text-[11px] leading-relaxed">Spread across {banks.length} linked bank accounts with full instant liquidity.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* BANK VIEW */}
            {activeView === 'bank' && (
                <div>
                    <div className="flex flex-col lg:flex-row gap-8">
                    {/* LEFT: BANK & CARDS LIST */}
                    <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-extrabold tracking-tight text-ink">My Accounts</h2>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={CreditCard}
                                    onClick={() => {
                                        setCardForm({
                                            ...EMPTY_CARD_FORM,
                                            bankId: (selectedBank && selectedBank !== 'standalone') ? selectedBank.id : 'standalone',
                                            bankName: (selectedBank && selectedBank !== 'standalone') ? selectedBank.name : ''
                                        });
                                        setIsCardModalOpen(true);
                                    }}
                                    title="Add Card"
                                >
                                    + Card
                                </Button>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    icon={Plus}
                                    onClick={() => { setEditingBank(null); setBankForm({ ...EMPTY_BANK_FORM }); setIsBankModalOpen(true); }}
                                    title="Add Bank"
                                >
                                    + Bank
                                </Button>
                            </div>
                        </div>

                        {/* Banks List */}
                        <div className="flex flex-col gap-3">
                            <p className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
                                Bank Accounts ({banks.length})
                            </p>
                            {banks.map(bank => {
                                const isSelected = selectedBank?.id === bank.id;
                                return (
                                    <div
                                        key={bank.id}
                                        onClick={() => setSelectedBank(bank)}
                                        className={cx(
                                            'group relative rounded-2xl p-4 transition-all duration-200 cursor-pointer select-none pem-card',
                                            isSelected
                                                ? 'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_24px_-4px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/30'
                                                : 'pem-card-hover hover:border-line-strong'
                                        )}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={cx(
                                                'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors',
                                                isSelected ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'bg-surface-raised text-emerald-400'
                                            )}>
                                                <Landmark size={19} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="m-0 truncate text-sm font-extrabold text-ink group-hover:text-emerald-400 transition-colors">
                                                    {bank.name}
                                                </h3>
                                                <p className="m-0 text-xs font-semibold text-ink-muted">
                                                    {bank.type} Account
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setConfirmDialog({ isOpen: true, action: 'deleteBank', id: bank.id }); }}
                                                className="grid h-8 w-8 place-items-center rounded-lg text-rose-400 transition-all hover:bg-rose-500/15 hover:text-rose-300 cursor-pointer"
                                                title="Delete Bank"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="flex items-baseline justify-between">
                                            <h2 className="m-0 text-xl font-black text-ink tracking-tight">
                                                {formatCurrency(bank.balance, currency)}
                                            </h2>
                                            <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                                                {(bank.Cards || []).length} {((bank.Cards || []).length === 1) ? 'card' : 'cards'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Standalone Cards Sidebar Entry */}
                            <div className="mt-2">
                                <p className="px-1 mb-2 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
                                    Cards Portfolio
                                </p>
                                <div
                                    onClick={() => setSelectedBank('standalone')}
                                    className={cx(
                                        'group relative rounded-2xl p-4 transition-all duration-200 cursor-pointer select-none pem-card',
                                        selectedBank === 'standalone'
                                            ? 'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_24px_-4px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/30'
                                            : 'pem-card-hover hover:border-line-strong'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cx(
                                            'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors',
                                            selectedBank === 'standalone' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'bg-surface-raised text-emerald-400'
                                        )}>
                                            <CreditCard size={19} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="m-0 text-sm font-extrabold text-ink group-hover:text-emerald-400 transition-colors">
                                                    Standalone Cards
                                                </h3>
                                                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                                                    {standaloneCards.length}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-xs text-ink-muted">
                                                Unlinked Debit &amp; Credit Cards
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: BANK DETAILS & CARDS */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {selectedBank === 'standalone' || (!selectedBank && standaloneCards.length > 0 && banks.length === 0) ? (
                            /* STANDALONE CARDS DASHBOARD */
                            <div>
                                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight">
                                                Standalone Cards
                                            </h1>
                                            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-black text-emerald-400">
                                                {standaloneCards.length} {standaloneCards.length === 1 ? 'Card' : 'Cards'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-ink-muted">
                                            Cards not linked to any active bank account in your system (e.g. corporate cards, external debit/credit cards).
                                        </p>
                                    </div>
                                    <Button
                                        variant="primary"
                                        icon={Plus}
                                        onClick={() => {
                                            setCardForm({ ...EMPTY_CARD_FORM, bankId: 'standalone' });
                                            setIsCardModalOpen(true);
                                        }}
                                    >
                                        Add Standalone Card
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                                    {standaloneCards.map(card => (
                                        <div key={card.id} className="relative w-full max-w-[440px]">
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDialog({ isOpen: true, action: 'deleteCard', id: card.id })}
                                                className="absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-lg bg-rose-500/80 text-white transition hover:bg-rose-500 shadow-md cursor-pointer"
                                                title="Delete Card"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                            <VirtualCard
                                                card={card}
                                                bankName={card.bankName || 'Standalone Card'}
                                                passphrase={vaultPassphrase}
                                                onRequestUnlock={() => setIsLocked(true)}
                                                isUnlocked={!isLocked}
                                            />
                                        </div>
                                    ))}

                                    {standaloneCards.length === 0 && (
                                        <div className="col-span-full flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-dashed border-line bg-surface/40">
                                            <CreditCard size={48} className="opacity-25 text-emerald-400 mb-4" />
                                            <h3 className="m-0 text-base font-bold text-ink">No Standalone Cards</h3>
                                            <p className="mt-1 mb-5 text-xs text-ink-muted">Add debit or credit cards not tied to any of your listed bank accounts.</p>
                                            <Button
                                                variant="primary"
                                                icon={Plus}
                                                onClick={() => {
                                                    setCardForm({ ...EMPTY_CARD_FORM, bankId: 'standalone' });
                                                    setIsCardModalOpen(true);
                                                }}
                                            >
                                                Add First Standalone Card
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : selectedBank ? (
                            <>
                                <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                                    <div>
                                        <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight">{selectedBank.name} Dashboard</h1>
                                        <p className="mt-1 text-xs text-ink-muted">Encrypted vault records, linked cards, and transaction activity.</p>
                                    </div>
                                    <Button variant="secondary" icon={Pencil} onClick={() => openEditBank(selectedBank)}>
                                        Edit Bank
                                    </Button>
                                </div>

                                {/* ACCOUNT DETAILS */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 mb-8">
                                    <div className="pem-card pem-card-hover p-4">
                                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-1">ACCOUNT HOLDER</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-base font-extrabold text-ink">{selectedBank.accountHolderName || '—'}</p>
                                            {selectedBank.accountHolderName && (
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(selectedBank.accountHolderName, 'Account Holder')}
                                                    className="grid h-7 w-7 place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/15 transition cursor-pointer"
                                                    title="Copy"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="pem-card pem-card-hover p-4">
                                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-1">ACCOUNT NUMBER</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="tnum font-mono text-base font-extrabold text-ink">{maskAccountNumber(selectedBank.accountNumber) || '—'}</p>
                                            {selectedBank.accountNumber && (
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(selectedBank.accountNumber, 'Account Number')}
                                                    className="grid h-7 w-7 place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/15 transition cursor-pointer"
                                                    title="Copy"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="pem-card pem-card-hover p-4">
                                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-1">IFSC CODE</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="tnum font-mono text-base font-extrabold text-ink">{selectedBank.ifsc || '—'}</p>
                                            {selectedBank.ifsc && (
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(selectedBank.ifsc, 'IFSC Code')}
                                                    className="grid h-7 w-7 place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/15 transition cursor-pointer"
                                                    title="Copy"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="pem-card pem-card-hover p-4">
                                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-1">MICR CODE</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="tnum font-mono text-base font-extrabold text-ink">{selectedBank.micrCode || '—'}</p>
                                            {selectedBank.micrCode && (
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(selectedBank.micrCode, 'MICR Code')}
                                                    className="grid h-7 w-7 place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/15 transition cursor-pointer"
                                                    title="Copy"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="pem-card pem-card-hover p-4">
                                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-1">BRANCH</p>
                                        <p className="truncate text-base font-extrabold text-ink">{selectedBank.branch || '—'}</p>
                                    </div>
                                </div>

                                {/* CARDS SECTION */}
                                <div className="flex items-center justify-between gap-3 mb-5">
                                    <div>
                                        <h2 className="text-lg font-extrabold text-ink tracking-tight">Linked Cards</h2>
                                        <p className="text-xs text-ink-muted">Cards tied directly to {selectedBank.name}</p>
                                    </div>
                                    <Button
                                        variant="primary"
                                        icon={Plus}
                                        onClick={() => {
                                            setCardForm({ ...EMPTY_CARD_FORM, bankId: selectedBank.id, bankName: selectedBank.name });
                                            setIsCardModalOpen(true);
                                        }}
                                    >
                                        Add Card
                                    </Button>
                                </div>

                                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', marginBottom: standaloneCards.length > 0 ? '45px' : '0' }}>
                                    {selectedBank.Cards && selectedBank.Cards.map(card => (
                                        <div key={card.id} style={{ position: 'relative', width: '100%', maxWidth: '440px' }}>
                                            <button onClick={() => setConfirmDialog({ isOpen: true, action: 'deleteCard', id: card.id })} style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, padding: '8px', backgroundColor: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer' }} title="Delete Card">
                                                <Trash2 size={16} />
                                            </button>
                                            <VirtualCard
                                                card={card}
                                                bankName={card.bankName || selectedBank.name}
                                                passphrase={vaultPassphrase}
                                                onRequestUnlock={() => setIsLocked(true)}
                                                isUnlocked={!isLocked}
                                            />
                                        </div>
                                    ))}
                                    {(!selectedBank.Cards || selectedBank.Cards.length === 0) && (
                                        <div style={{ width: '100%', padding: '40px', textAlign: 'center', backgroundColor: theme.card, borderRadius: '20px', color: theme.textSecondary, border: `1px solid ${theme.border}` }}>
                                            <CreditCard size={48} style={{ opacity: 0.2 }} />
                                            <p style={{ marginTop: '10px', marginBottom: 0 }}>No cards linked to this bank account yet.</p>
                                        </div>
                                    )}
                                </div>

                                {/* STANDALONE CARDS SECTION (UNDER BANK DASHBOARD) */}
                                {standaloneCards.length > 0 && (
                                    <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '35px', marginTop: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: theme.text, margin: 0 }}>Standalone Cards</h2>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '999px',
                                                        backgroundColor: 'rgba(16,185,129,0.15)',
                                                        color: '#10b981',
                                                        fontSize: '11px',
                                                        fontWeight: '800'
                                                    }}>
                                                        {standaloneCards.length}
                                                    </span>
                                                </div>
                                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>Unlinked cards in your portfolio</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setCardForm({ ...EMPTY_CARD_FORM, bankId: 'standalone' });
                                                    setIsCardModalOpen(true);
                                                }}
                                                style={{ backgroundColor: theme.card, color: theme.text, border: `1px solid ${theme.border}`, padding: '8px 16px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                                            >
                                                <Plus size={15} color="#10b981" /> Add Standalone Card
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                                            {standaloneCards.map(card => (
                                                <div key={card.id} style={{ position: 'relative', width: '100%', maxWidth: '440px' }}>
                                                    <button onClick={() => setConfirmDialog({ isOpen: true, action: 'deleteCard', id: card.id })} style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, padding: '8px', backgroundColor: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer' }} title="Delete Card">
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <VirtualCard
                                                        card={card}
                                                        bankName={card.bankName || 'Standalone Card'}
                                                        passphrase={vaultPassphrase}
                                                        onRequestUnlock={() => setIsLocked(true)}
                                                        isUnlocked={!isLocked}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ height: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: theme.textSecondary }}>
                                <Landmark size={64} style={{ opacity: 0.2, marginBottom: '20px' }} />
                                <h2>Select a Bank or Standalone Cards to view details</h2>
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold', color: theme.text }}>{doc.documentName}</h3>
                                            {doc.source === 'scan' && (
                                                <span style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px', padding: '2px 8px', borderRadius: '999px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', marginBottom: '5px' }}>SCANNED</span>
                                            )}
                                        </div>
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
                                        <a href={getDocumentUrl(doc.filePath, true)} download onClick={(e) => e.stopPropagation()} style={{ flex: 1, padding: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '10px', textAlign: 'center', color: '#3b82f6', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 2 }}>
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeBankModal} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(2,6,23,0.8)', }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ width: '100%', maxWidth: '500px', backgroundColor: theme.sidebar, borderRadius: '32px', border: `1px solid ${theme.border}`, padding: '40px', position: 'relative', zIndex: 20 }}>
                            <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '25px', color: theme.text }}>{editingBank ? 'Edit Bank' : 'Add Bank'}</h2>
                            <form onSubmit={handleAddBank} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <input type="text" placeholder="Bank Name" value={bankForm.name} onChange={e => setBankForm({ ...bankForm, name: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                <input type="text" placeholder="Account Holder Name" value={bankForm.accountHolderName} onChange={e => setBankForm({ ...bankForm, accountHolderName: e.target.value })} style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                <input type="text" placeholder="Account Number" value={bankForm.accountNumber} onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <input type="text" placeholder="IFSC" value={bankForm.ifsc} onChange={e => setBankForm({ ...bankForm, ifsc: e.target.value })} style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                    <input type="text" placeholder="MICR" value={bankForm.micrCode} onChange={e => setBankForm({ ...bankForm, micrCode: e.target.value })} style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <input type="text" placeholder="Branch" value={bankForm.branch} onChange={e => setBankForm({ ...bankForm, branch: e.target.value })} style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                    <input type="number" placeholder="Balance" value={bankForm.balance} onChange={e => setBankForm({ ...bankForm, balance: e.target.value })} required style={{ padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }} />
                                </div>
                                <button type="submit" style={{ padding: '18px', backgroundColor: '#10b981', color: 'white', fontWeight: '900', border: 'none', borderRadius: '16px', marginTop: '10px', cursor: 'pointer' }}>{editingBank ? 'Save Changes' : 'Add Bank'}</button>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* CARD MODAL */}
                {isCardModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCardModalOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ width: '100%', maxWidth: '500px', backgroundColor: theme.sidebar, borderRadius: '32px', border: `1px solid ${theme.border}`, padding: '40px', position: 'relative', zIndex: 20, maxHeight: '90vh', overflowY: 'auto' }}>
                            <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '25px', color: theme.text }}>
                                {cardForm.bankId === 'standalone' || (!cardForm.bankId && selectedBank === 'standalone') ? 'Add Standalone Card' : 'Add Card'}
                            </h2>
                            <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {/* Bank Association Selector */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.6px', color: theme.textSecondary, marginBottom: '6px', textTransform: 'uppercase' }}>Account Association</label>
                                    <select
                                        value={cardForm.bankId ?? ((selectedBank && selectedBank !== 'standalone') ? selectedBank.id : 'standalone')}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === 'standalone') {
                                                setCardForm({ ...cardForm, bankId: 'standalone' });
                                            } else {
                                                const selectedB = banks.find(b => b.id === val);
                                                setCardForm({ ...cardForm, bankId: val, bankName: selectedB?.name || '' });
                                            }
                                        }}
                                        style={{ width: '100%', padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }}
                                    >
                                        {banks.map(b => (
                                            <option key={b.id} value={b.id}>Linked to {b.name}</option>
                                        ))}
                                        <option value="standalone">Standalone Card (Not linked to any bank account)</option>
                                    </select>
                                </div>

                                {/* Bank / Issuer Name (required for standalone cards) */}
                                {(cardForm.bankId === 'standalone' || (!cardForm.bankId && (selectedBank === 'standalone' || banks.length === 0))) && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.6px', color: theme.textSecondary, marginBottom: '6px', textTransform: 'uppercase' }}>Bank / Card Issuer</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Canara Bank, SBI, HDFC, ICICI, Amex"
                                            value={cardForm.bankName || ''}
                                            onChange={e => setCardForm({ ...cardForm, bankName: e.target.value })}
                                            required
                                            style={{ width: '100%', padding: '15px', borderRadius: '12px', backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }}
                                        />
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="button" onClick={() => setCardForm({ ...cardForm, type: 'Debit' })} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: cardForm.type === 'Debit' ? '#3b82f6' : 'transparent', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Debit</button>
                                    <button type="button" onClick={() => setCardForm({ ...cardForm, type: 'Credit' })} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: cardForm.type === 'Credit' ? '#f59e0b' : 'transparent', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Credit</button>
                                    <button type="button" onClick={() => setCardForm({ ...cardForm, type: 'Virtual' })} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: cardForm.type === 'Virtual' ? '#8b5cf6' : 'transparent', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Virtual</button>
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDocModalOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(2,6,23,0.8)', }} />
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
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: 'rgba(0,0,0,0.95)', }} onClick={() => { setViewerDoc(null); setDocPassword(''); setShowPasswordPrompt(false); }}>
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
                                <a href={getDocumentUrl(viewerDoc.filePath, true)} download={viewerDoc.documentName} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                            src={getDocumentUrl(viewerDoc.filePath)}
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
                                    <PDFViewer fileUrl={getDocumentUrl(viewerDoc.filePath)} fileName={viewerDoc.documentName} password={docPassword} onClose={() => { setViewerDoc(null); setDocPassword(''); }} />
                                ) : viewerDoc.mimeType?.startsWith('text/') ? (
                                    <iframe
                                        src={getDocumentUrl(viewerDoc.filePath)}
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
                                            <a href={getDocumentUrl(viewerDoc.filePath, true)} download onClick={(e) => e.stopPropagation()} style={{ padding: '15px 30px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
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
