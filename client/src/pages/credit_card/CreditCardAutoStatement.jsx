import { notifyDataChanged } from '../../utils/realtimeSync';
import { useState, useEffect, useMemo } from 'react';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, Lock, Check, X, AlertCircle, MessageSquare,
    Plus, CheckCircle2, Eye, EyeOff, Pencil, Save, Trash2, DollarSign,
    Mail, RefreshCw, Key, ExternalLink, Sparkles, CheckCheck, HelpCircle,
    Shield, ShieldCheck, Zap, Server, ChevronDown, ChevronUp, Copy,
    CheckSquare, Calendar, CreditCard, ArrowRight, ArrowDownRight,
    SlidersHorizontal, Search, Filter, Info, Smartphone, Unlock
} from 'lucide-react';
import { Badge } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import ActionModal from '../../components/credit_card/ActionModal';
import { formatCurrency } from '../../utils/currency';
import { API_URL } from '../../config';

const CATEGORY_TONES = {
    Shopping: 'violet',
    'Food & Dining': 'warn',
    Fuel: 'neg',
    Entertainment: 'violet',
    Bills: 'info',
    Travel: 'pos',
    Healthcare: 'pos',
    Groceries: 'warn'
};

const categoryTone = (category) => CATEGORY_TONES[category] || 'muted';

const maskEmail = (email) => {
    if (!email || typeof email !== 'string') return '';
    const parts = email.split('@');
    if (parts.length !== 2) return '••••••••';
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return `${name[0]}•••@${domain}`;
    return `${name.slice(0, 2)}••••${name.slice(-1)}@${domain}`;
};

const getLocalISOString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localTime = new Date(now.getTime() - offset * 60 * 1000);
    return localTime.toISOString().slice(0, 16);
};

const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';

    if (typeof dateString === 'string' && dateString.length === 10 && dateString.includes('-')) {
        const [year, month, day] = dateString.split('-');
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const formatFullDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const SUPPORTED_BANKS = [
    { name: 'HDFC Bank', color: 'from-blue-600 to-indigo-700', badge: 'HDFC' },
    { name: 'State Bank of India', color: 'from-sky-600 to-blue-700', badge: 'SBI' },
    { name: 'ICICI Bank', color: 'from-orange-600 to-amber-700', badge: 'ICICI' },
    { name: 'Axis Bank', color: 'from-rose-600 to-pink-700', badge: 'AXIS' },
    { name: 'OneCard (FPL)', color: 'from-amber-500 to-orange-600', badge: 'ONECARD' },
    { name: 'American Express', color: 'from-cyan-600 to-blue-700', badge: 'AMEX' },
    { name: 'Kotak Mahindra', color: 'from-red-600 to-rose-700', badge: 'KOTAK' },
    { name: 'RBL Bank', color: 'from-teal-600 to-emerald-700', badge: 'RBL' }
];

const CreditCardAutoStatement = () => {
    const { cards = [], addTransaction } = useCreditCards();
    
    // Top-Level Active Navigation Tab ('gmail' | 'pdf' | 'sms' | 'config' | 'transactions')
    const [activeTab, setActiveTab] = useState('gmail');

    // Gmail Smart Sync State
    const [gmailStatus, setGmailStatus] = useState({ connected: false, email: null, lastSync: null, isConfigured: false });
    const [gmailLoading, setGmailLoading] = useState(false);
    const [gmailSyncing, setGmailSyncing] = useState(false);
    const [gmailStatements, setGmailStatements] = useState([]);
    const [selectedCardForStmt, setSelectedCardForStmt] = useState({});
    const [expandedSnippets, setExpandedSnippets] = useState({});
    const [applyingStmtId, setApplyingStmtId] = useState(null);
    const [gmailSearchQuery, setGmailSearchQuery] = useState('');

    // Gmail Config & Privacy Protection State
    const [gmailConfig, setGmailConfig] = useState({
        clientId: '',
        clientSecret: '',
        redirectUri: window.location.origin + '/credit-cards/auto-statement'
    });
    const [showSensitiveKeys, setShowSensitiveKeys] = useState(false);
    const [showClientId, setShowClientId] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [copiedUri, setCopiedUri] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);

    // PDF & OCR State
    const [selectedCard, setSelectedCard] = useState('');
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfPassword, setPdfPassword] = useState('');
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const [, setIsUnlocked] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [, setCardMatchStatus] = useState(null);
    const [statementData, setStatementData] = useState(null);
    const [, setParseError] = useState(null);
    const [, setRawExtractedText] = useState('');
    const [statementCardEnding, setStatementCardEnding] = useState('');
    const [, setFileUrl] = useState(null);

    // SMS Parser State
    const [smsText, setSmsText] = useState('');

    // Extracted Transactions Staging State
    const [extractedTransactions, setExtractedTransactions] = useState([]);
    const [txSearchQuery, setTxSearchQuery] = useState('');
    const [txFilterCategory, setTxFilterCategory] = useState('ALL');
    const [selectedTxIds, setSelectedTxIds] = useState(new Set());
    const [showManualEntry, setShowManualEntry] = useState(false);

    // UI Feedback State
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'confirm', onConfirm: null });

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));

    const updateExtractedTransactions = (updater) => {
        setExtractedTransactions((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            localStorage.setItem('pendingTransactions', JSON.stringify(next));
            return next;
        });
    };

    const [manualTransaction, setManualTransaction] = useState({
        date: getLocalISOString(),
        merchant: '',
        amount: '',
        category: ''
    });

    // ----------------------------------------------------
    // FETCHERS & GMAIL SYNC LOGIC
    // ----------------------------------------------------
    const fetchGmailStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await fetch(`${API_URL}/credit-cards/gmail/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setGmailStatus(data);
                if (data.customConfig?.clientId) {
                    setGmailConfig(prev => ({
                        ...prev,
                        clientId: data.customConfig.clientId,
                        redirectUri: data.customConfig.redirectUri || prev.redirectUri
                    }));
                }
            }
        } catch (e) {
            console.error('Failed to fetch Gmail status:', e);
        }
    };

    const handleGoogleConnect = async () => {
        if (!gmailStatus.isConfigured && !gmailConfig.clientId) {
            setActiveTab('config');
            showToast('Please enter your Google OAuth Client ID & Secret below first', 'error');
            return;
        }

        setGmailLoading(true);
        try {
            const token = localStorage.getItem('token');
            const redirectUri = window.location.origin + '/credit-cards/auto-statement';
            const res = await fetch(`${API_URL}/credit-cards/gmail/auth-url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    redirectUri,
                    clientId: gmailConfig.clientId || undefined,
                    clientSecret: gmailConfig.clientSecret || undefined
                })
            });
            const data = await res.json();
            if (data.authUrl) {
                const width = 560;
                const height = 680;
                const left = window.screen.width / 2 - width / 2;
                const top = window.screen.height / 2 - height / 2;
                const popup = window.open(
                    data.authUrl,
                    'GoogleOAuthLogin',
                    `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
                );
                if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                    window.location.href = data.authUrl;
                }
            } else {
                showToast(data.error || 'Failed to generate Google Auth URL', 'error');
            }
        } catch (e) {
            showToast('Error connecting to Google OAuth', 'error');
        } finally {
            setGmailLoading(false);
        }
    };

    const handleSaveGmailConfig = async () => {
        if (!gmailConfig.clientId || !gmailConfig.clientSecret) {
            showToast('Please fill in both Client ID and Client Secret', 'error');
            return;
        }
        setSavingConfig(true);
        try {
            const token = localStorage.getItem('token');
            const saveRes = await fetch(`${API_URL}/credit-cards/gmail/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(gmailConfig)
            });
            if (!saveRes.ok) throw new Error('Failed to save configuration');
            showToast('Google OAuth Credentials Saved Successfully!', 'success');
            await fetchGmailStatus();
        } catch (e) {
            showToast(e.message || 'Failed to save config', 'error');
        } finally {
            setSavingConfig(false);
        }
    };

    const handleGoogleCallback = async (code) => {
        setGmailLoading(true);
        try {
            const token = localStorage.getItem('token');
            const redirectUri = window.location.origin + '/credit-cards/auto-statement';
            const res = await fetch(`${API_URL}/credit-cards/gmail/callback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    code,
                    redirectUri,
                    clientId: gmailConfig.clientId || undefined,
                    clientSecret: gmailConfig.clientSecret || undefined
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(`Connected successfully to ${maskEmail(data.email)}!`, 'success');
                await fetchGmailStatus();
                handleSyncGmailStatements();
            } else {
                showToast(data.error || 'Authentication failed', 'error');
            }
        } catch (e) {
            showToast('Failed to complete Google OAuth handshake', 'error');
        } finally {
            setGmailLoading(false);
        }
    };

    const handleSyncGmailStatements = async () => {
        setGmailSyncing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/credit-cards/gmail/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (res.ok && data.statements) {
                setGmailStatements(data.statements);
                showToast(
                    data.statements.length > 0 
                        ? `Discovered ${data.statements.length} credit card statement${data.statements.length > 1 ? 's' : ''}!`
                        : 'No new credit card statement emails found in the last 45 days.',
                    data.statements.length > 0 ? 'success' : 'info'
                );
                await fetchGmailStatus();
            } else {
                showToast(data.error || 'Failed to sync statements', 'error');
            }
        } catch (e) {
            showToast('Failed to communicate with Gmail Sync engine', 'error');
        } finally {
            setGmailSyncing(false);
        }
    };

    const handleDisconnectGmail = async () => {
        setModal({
            isOpen: true,
            title: 'Disconnect Google Account',
            message: 'Are you sure you want to disconnect your Gmail sync? You will need to re-authorize to scan statements.',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    const token = localStorage.getItem('token');
                    await fetch(`${API_URL}/credit-cards/gmail/disconnect`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setGmailStatus({ connected: false, email: null, lastSync: null, isConfigured: true });
                    setGmailStatements([]);
                    showToast('Gmail account disconnected', 'info');
                } catch {
                    showToast('Failed to disconnect Gmail', 'error');
                } finally {
                    closeModal();
                }
            }
        });
    };

    const handleApplyGmailStatement = async (statement) => {
        const matchedCardId = selectedCardForStmt[statement.messageId] || statement.matchedCardId;
        if (!matchedCardId) {
            showToast('Please select which card to link this statement to', 'error');
            return;
        }

        setApplyingStmtId(statement.messageId);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/credit-cards/gmail/apply-statement`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    statement,
                    cardId: matchedCardId
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || 'Statement bill applied to card successfully!', 'success');
                setGmailStatements(prev => prev.filter(s => s.messageId !== statement.messageId));
            } else {
                showToast(data.error || 'Failed to apply statement', 'error');
            }
        } catch (e) {
            showToast('Error applying statement to card ledger', 'error');
        } finally {
            setApplyingStmtId(null);
        }
    };

    const handleDismissGmailStatement = (messageId) => {
        setGmailStatements(prev => prev.filter(s => s.messageId !== messageId));
        showToast('Statement dismissed from inbox', 'info');
    };

    const toggleSnippet = (id) => {
        setExpandedSnippets(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const copyRedirectUri = () => {
        navigator.clipboard.writeText(gmailConfig.redirectUri);
        setCopiedUri(true);
        showToast('Redirect URI copied to clipboard!', 'success');
        setTimeout(() => setCopiedUri(false), 2500);
    };

    // ----------------------------------------------------
    // INITIALIZATION & URL / POPUP LISTENER
    // ----------------------------------------------------
    useEffect(() => {
        fetchGmailStatus();
        const saved = localStorage.getItem('pendingTransactions');
        if (saved) {
            try {
                setExtractedTransactions(JSON.parse(saved));
            } catch (e) {
                console.error('Error loading pending transactions:', e);
            }
        }

        const handleOAuthMessage = (event) => {
            if (event.data?.type === 'GMAIL_OAUTH_CODE' && event.data.code) {
                handleGoogleCallback(event.data.code);
            }
        };
        window.addEventListener('message', handleOAuthMessage);

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            if (window.opener) {
                window.opener.postMessage({ type: 'GMAIL_OAUTH_CODE', code }, '*');
                window.close();
                return;
            }
            window.history.replaceState({}, document.title, window.location.pathname);
            handleGoogleCallback(code);
        }

        return () => window.removeEventListener('message', handleOAuthMessage);
    }, []);

    // ----------------------------------------------------
    // PDF & OCR HANDLERS
    // ----------------------------------------------------
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            setPdfFile(file);
            setFileUrl(URL.createObjectURL(file));
            setPdfPassword('');
            setShowPasswordInput(false);
            setIsUnlocked(false);
            setPasswordError('');
            setParseError(null);
            setStatementData(null);
            setExtractedTransactions([]);
            setRawExtractedText('');
            showToast('PDF statement loaded. Click Process Statement to extract transactions.');
        } else {
            showToast('Please upload a valid PDF statement file', 'error');
        }
    };

    const handleProcessStatement = async () => {
        if (!pdfFile) {
            showToast('Please select a PDF file first', 'error');
            return;
        }

        setIsProcessing(true);
        setPasswordError('');
        setParseError(null);

        const formData = new FormData();
        formData.append('pdf', pdfFile);
        if (selectedCard) formData.append('cardId', selectedCard);
        if (pdfPassword) formData.append('password', pdfPassword);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/credit-cards/parse-statement`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();

            if (res.status === 401 || data.isPasswordProtected) {
                setShowPasswordInput(true);
                setIsUnlocked(false);
                setIsProcessing(false);
                if (data.error) setPasswordError(data.error);
                return;
            }

            if (!res.ok) {
                throw new Error(data.error || 'Failed to process statement');
            }

            handleParseSuccess(data);
            showToast('PDF statement processed successfully!');
        } catch (err) {
            setParseError(err.message);
            showToast(err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUnlockPDF = async () => {
        if (!pdfPassword) {
            setPasswordError('Please enter password');
            return;
        }

        setIsProcessing(true);
        setPasswordError('');

        const formData = new FormData();
        formData.append('pdf', pdfFile);
        formData.append('password', pdfPassword);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/credit-cards/unlock-pdf`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Invalid password');
            }

            setIsUnlocked(true);
            setShowPasswordInput(false);
            showToast('PDF unlocked! Processing transactions...');
            handleProcessStatement();
        } catch (err) {
            setPasswordError(err.message);
            showToast(err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleProcessText = async () => {
        if (!smsText.trim()) {
            showToast('Please paste statement or SMS text to parse', 'error');
            return;
        }

        setIsProcessing(true);
        setParseError(null);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/credit-cards/parse-text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ text: smsText, cardId: selectedCard })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to parse text');
            }

            handleParseSuccess(data);
            showToast('Text parsed successfully!');
        } catch (err) {
            setParseError(err.message);
            showToast(err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleParseSuccess = (data) => {
        setStatementData(data.summary || null);
        setRawExtractedText(data.rawText || '');

        if (data.cardEnding) {
            setStatementCardEnding(data.cardEnding);
            const matched = cards.find(c => c.last4 === data.cardEnding || c.cardNumber?.endsWith(data.cardEnding));
            if (matched) {
                setSelectedCard(matched.id);
                setCardMatchStatus('matched');
            } else {
                setCardMatchStatus('not-matched');
            }
        }

        if (data.transactions && data.transactions.length > 0) {
            const newTxs = data.transactions.map((tx, index) => ({
                id: `extracted-${Date.now()}-${index}`,
                date: tx.date || new Date().toISOString().slice(0, 10),
                description: tx.description || 'Unknown Merchant',
                merchant: tx.merchant || tx.description || 'Unknown Merchant',
                amount: parseFloat(tx.amount) || 0,
                category: tx.category || 'Shopping',
                type: tx.type || 'expense',
                cardId: selectedCard || (cards[0]?.id || '')
            }));
            updateExtractedTransactions((prev) => [...newTxs, ...prev]);
            setActiveTab('transactions');
        }
    };

    // ----------------------------------------------------
    // TRANSACTIONS APPROVAL & STAGING HANDLERS
    // ----------------------------------------------------
    const handleApprove = (id) => {
        const tx = extractedTransactions.find(t => t.id === id);
        if (!tx) return;

        const targetCard = cards.find(c => c.id === (tx.cardId || selectedCard)) || cards[0];
        if (!targetCard) {
            showToast('Please link a valid credit card first', 'error');
            return;
        }

        addTransaction(targetCard.id, {
            date: tx.date,
            description: tx.merchant || tx.description,
            amount: parseFloat(tx.amount),
            category: tx.category || 'Shopping',
            type: tx.type || 'expense'
        });

        updateExtractedTransactions(prev => prev.filter(t => t.id !== id));
        setSelectedTxIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        showToast('Transaction approved to credit card ledger!', 'success'); notifyDataChanged("transactions");
    };

    const handleReject = (id) => {
        updateExtractedTransactions(prev => prev.filter(t => t.id !== id));
        setSelectedTxIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        showToast('Transaction removed', 'info');
    };

    const handleBulkApprove = () => {
        if (selectedTxIds.size === 0) {
            showToast('Select at least one transaction to approve', 'error');
            return;
        }

        let approvedCount = 0;
        extractedTransactions.forEach(tx => {
            if (selectedTxIds.has(tx.id)) {
                const targetCard = cards.find(c => c.id === (tx.cardId || selectedCard)) || cards[0];
                if (targetCard) {
                    addTransaction(targetCard.id, {
                        date: tx.date,
                        description: tx.merchant || tx.description,
                        amount: parseFloat(tx.amount),
                        category: tx.category || 'Shopping',
                        type: tx.type || 'expense'
                    });
                    approvedCount++;
                }
            }
        });

        updateExtractedTransactions(prev => prev.filter(t => !selectedTxIds.has(t.id)));
        setSelectedTxIds(new Set());
        showToast(`Approved ${approvedCount} transaction${approvedCount > 1 ? 's' : ''} to card ledger!`, 'success');
    };

    const handleBulkReject = () => {
        if (selectedTxIds.size === 0) return;
        updateExtractedTransactions(prev => prev.filter(t => !selectedTxIds.has(t.id)));
        setSelectedTxIds(new Set());
        showToast('Selected transactions discarded', 'info');
    };

    const handleClearAllExtracted = () => {
        setModal({
            isOpen: true,
            title: 'Clear Extracted Transactions',
            message: 'Are you sure you want to clear all pending extracted transactions?',
            type: 'confirm',
            onConfirm: () => {
                updateExtractedTransactions([]);
                setSelectedTxIds(new Set());
                closeModal();
                showToast('Staging ledger cleared', 'info');
            }
        });
    };

    const toggleSelectAll = () => {
        if (selectedTxIds.size === filteredTransactions.length) {
            setSelectedTxIds(new Set());
        } else {
            setSelectedTxIds(new Set(filteredTransactions.map(t => t.id)));
        }
    };

    const toggleSelectTx = (id) => {
        setSelectedTxIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleAddManualTransaction = () => {
        if (!manualTransaction.merchant || !manualTransaction.amount) {
            showToast('Merchant name and amount are required', 'error');
            return;
        }

        const newTx = {
            id: `manual-${Date.now()}`,
            date: manualTransaction.date || getLocalISOString().slice(0, 10),
            description: manualTransaction.merchant,
            merchant: manualTransaction.merchant,
            amount: parseFloat(manualTransaction.amount),
            category: manualTransaction.category || 'Shopping',
            type: 'expense',
            cardId: selectedCard || (cards[0]?.id || '')
        };

        updateExtractedTransactions(prev => [newTx, ...prev]);
        setShowManualEntry(false);
        setManualTransaction({
            date: getLocalISOString(),
            merchant: '',
            amount: '',
            category: ''
        });
        setActiveTab('transactions');
        showToast('Manual transaction added to staging ledger!');
    };

    // ----------------------------------------------------
    // FILTERED LISTS
    // ----------------------------------------------------
    const filteredGmailStatements = useMemo(() => {
        if (!gmailSearchQuery.trim()) return gmailStatements;
        const q = gmailSearchQuery.toLowerCase();
        return gmailStatements.filter(s => 
            (s.bankName && s.bankName.toLowerCase().includes(q)) ||
            (s.subject && s.subject.toLowerCase().includes(q)) ||
            (s.last4 && s.last4.includes(q)) ||
            (s.totalDue && s.totalDue.toString().includes(q))
        );
    }, [gmailStatements, gmailSearchQuery]);

    const filteredTransactions = useMemo(() => {
        return extractedTransactions.filter(tx => {
            const matchSearch = !txSearchQuery || 
                (tx.merchant && tx.merchant.toLowerCase().includes(txSearchQuery.toLowerCase())) ||
                (tx.description && tx.description.toLowerCase().includes(txSearchQuery.toLowerCase())) ||
                (tx.amount && tx.amount.toString().includes(txSearchQuery));
            const matchCategory = txFilterCategory === 'ALL' || tx.category === txFilterCategory;
            return matchSearch && matchCategory;
        });
    }, [extractedTransactions, txSearchQuery, txFilterCategory]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-ink">
            {/* TOAST ALERTS */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-xs sm:text-sm font-semibold ${
                            toast.type === 'error'
                                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-950/50'
                                : toast.type === 'info'
                                ? 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200 shadow-cyan-950/50'
                                : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-950/50'
                        }`}
                    >
                        {toast.type === 'error' ? (
                            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        ) : toast.type === 'info' ? (
                            <Info className="w-5 h-5 text-cyan-400 shrink-0" />
                        ) : (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        <span>{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CONFIRMATION / ACTION MODAL */}
            <ActionModal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                onConfirm={modal.onConfirm}
                onCancel={closeModal}
            />

            {/* TOP HERO HEADER WITH TELEMETRY BADGES */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-surface/60 border border-line shadow-2xl backdrop-blur-xl">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-ink flex items-center gap-2">
                                Auto Statement Engine
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    CRED SYNC
                                </span>
                            </h1>
                            <p className="text-xs sm:text-sm text-ink-muted">
                                Auto-discover e-statements via Gmail, decrypt protected PDFs, and approve bills in 1 click.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Status Telemetry Badges */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Gmail Connection Status */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-sunken/70 border border-line">
                        <div className={`w-2.5 h-2.5 rounded-full ${gmailStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Gmail Sync</span>
                            <span className={`text-[11px] font-extrabold ${gmailStatus.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {gmailStatus.connected ? (maskEmail(gmailStatus.email) || 'CONNECTED') : 'READY TO LINK'}
                            </span>
                        </div>
                    </div>

                    {/* Discovered Statements Counter */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-sunken/70 border border-line">
                        <Mail className="w-3.5 h-3.5 text-teal-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Statements</span>
                            <span className="text-[11px] font-extrabold text-teal-300">
                                {gmailStatements.length} Found
                            </span>
                        </div>
                    </div>

                    {/* Pending Staging Ledger */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-sunken/70 border border-line">
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Staging TXs</span>
                            <span className="text-[11px] font-extrabold text-indigo-300">
                                {extractedTransactions.length} Pending
                            </span>
                        </div>
                    </div>

                    {/* Quick Action Buttons */}
                    {gmailStatus.connected && (
                        <button
                            onClick={handleSyncGmailStatements}
                            disabled={gmailSyncing}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${gmailSyncing ? 'animate-spin' : ''}`} />
                            <span>{gmailSyncing ? 'Scanning...' : 'Sync Now'}</span>
                        </button>
                    )}

                    <button
                        onClick={() => setShowManualEntry(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-raised hover:bg-line text-ink font-bold text-xs transition-all border border-line"
                    >
                        <Plus className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Manual TX</span>
                    </button>
                </div>
            </div>

            {/* SEGMENTED NAVIGATION TAB BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-surface/90 border border-line shadow-xl backdrop-blur-md">
                {/* Tab 1: Gmail Statements */}
                <button
                    onClick={() => setActiveTab('gmail')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
                        activeTab === 'gmail'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <Mail className="w-4 h-4" />
                    <span>Gmail Smart Sync</span>
                    {gmailStatements.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white shadow-sm animate-pulse">
                            {gmailStatements.length}
                        </span>
                    )}
                </button>

                {/* Tab 2: PDF Statement Upload */}
                <button
                    onClick={() => setActiveTab('pdf')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
                        activeTab === 'pdf'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    <span>PDF Decrypt & OCR</span>
                </button>

                {/* Tab 3: SMS & Raw Text Parser */}
                <button
                    onClick={() => setActiveTab('sms')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
                        activeTab === 'sms'
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <MessageSquare className="w-4 h-4" />
                    <span>SMS / Text Parser</span>
                </button>

                {/* Tab 4: Email & Google Cloud Config */}
                <button
                    onClick={() => setActiveTab('config')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
                        activeTab === 'config'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Email & API Config</span>
                    {gmailStatus.connected && (
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                </button>
            </div>

            {/* TAB 1: GMAIL SMART STATEMENTS VIEW (CRED STYLE) */}
            {activeTab === 'gmail' && (
                <div className="space-y-6">
                    {!gmailStatus.connected ? (
                        <div className="p-8 rounded-3xl bg-surface/60 border border-line text-center space-y-6 backdrop-blur-xl">
                            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
                                <Mail className="w-8 h-8" />
                            </div>
                            <div className="max-w-xl mx-auto space-y-2">
                                <h2 className="text-xl sm:text-2xl font-black text-ink">
                                    Connect Gmail for Automated Statement Discovery
                                </h2>
                                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                                    Our intelligent parser reads official credit card bill alerts from HDFC, SBI, ICICI, Axis, OneCard, Amex, Kotak, and RBL—just like CRED. Secure read-only access.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                <button
                                    onClick={handleGoogleConnect}
                                    disabled={gmailLoading}
                                    className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>{gmailLoading ? 'Connecting to Google...' : 'Connect Google Account (Gmail)'}</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('config')}
                                    className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-raised hover:bg-line text-ink-muted font-bold text-sm border border-line transition-all"
                                >
                                    <Key className="w-4 h-4 text-amber-400" />
                                    <span>Configure OAuth Keys</span>
                                </button>
                            </div>

                            {/* Supported Banks Badges */}
                            <div className="pt-4 border-t border-line/80">
                                <p className="text-[11px] font-bold text-ink-faint uppercase tracking-wider mb-3">
                                    Supported Banks & E-Statements
                                </p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {SUPPORTED_BANKS.map((b) => (
                                        <span key={b.name} className="px-3 py-1 rounded-xl bg-sunken/70 border border-line text-[11px] font-semibold text-ink-muted">
                                            {b.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Connected Status Bar & Search Filter */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-surface/60 border border-line backdrop-blur-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-ink">{maskEmail(gmailStatus.email)}</span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                ACTIVE
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-ink-muted">
                                            Last Synced: {gmailStatus.lastSync ? formatFullDate(gmailStatus.lastSync) : 'Just Now'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                                    {/* Search */}
                                    <div className="relative flex-1 sm:w-64">
                                        <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={gmailSearchQuery}
                                            onChange={(e) => setGmailSearchQuery(e.target.value)}
                                            placeholder="Filter bank, card or amount..."
                                            className="w-full pl-9 pr-3 py-2 bg-sunken/80 border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint outline-none focus:border-emerald-500"
                                        />
                                    </div>

                                    <button
                                        onClick={handleSyncGmailStatements}
                                        disabled={gmailSyncing}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${gmailSyncing ? 'animate-spin' : ''}`} />
                                        <span>{gmailSyncing ? 'Scanning...' : 'Sync Gmail'}</span>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('config')}
                                        className="p-2 rounded-xl bg-raised hover:bg-line text-ink-muted border border-line transition-all"
                                        title="Email Settings & Keys"
                                    >
                                        <SlidersHorizontal className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Discovered Statements Cards */}
                            {filteredGmailStatements.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                                            Discovered Statements ({filteredGmailStatements.length})
                                        </span>
                                        <span className="text-xs text-emerald-400 font-semibold">
                                            CRED Smart Auto-Match
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filteredGmailStatements.map((stmt) => {
                                            const matchedCard = cards.find(c => 
                                                c.id === (selectedCardForStmt[stmt.messageId] || stmt.matchedCardId) ||
                                                (stmt.last4 && (c.last4 === stmt.last4 || c.cardNumber?.endsWith(stmt.last4)))
                                            );
                                            const currentSelectedId = selectedCardForStmt[stmt.messageId] || matchedCard?.id || '';
                                            const isExpanded = !!expandedSnippets[stmt.messageId];

                                            return (
                                                <motion.div
                                                    key={stmt.messageId}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="p-5 rounded-3xl bg-surface/70 border border-line shadow-xl backdrop-blur-xl hover:border-line transition-all space-y-4 flex flex-col justify-between"
                                                >
                                                    <div className="space-y-3">
                                                        {/* Header: Bank & Card Pill */}
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                                                                <span className="text-sm font-extrabold text-ink">
                                                                    {stmt.bankName || 'Bank Statement'}
                                                                </span>
                                                                {stmt.last4 && (
                                                                    <span className="px-2 py-0.5 rounded-lg bg-sunken/80 border border-line text-[10px] font-mono font-bold text-purple-300">
                                                                        •••• {stmt.last4}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-ink-muted bg-sunken/60 px-2 py-1 rounded-lg border border-line">
                                                                {stmt.receivedDate ? formatDate(stmt.receivedDate) : 'Recent'}
                                                            </span>
                                                        </div>

                                                        {/* Financial Metrics Grid */}
                                                        <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-sunken/70 border border-line/80">
                                                            <div>
                                                                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                                                                    Total Due
                                                                </span>
                                                                <span className="text-lg font-black text-ink tracking-tight">
                                                                    {stmt.totalDue ? formatCurrency(stmt.totalDue) : 'N/A'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                                                                    Due Date
                                                                </span>
                                                                <span className="text-sm font-extrabold text-amber-400 flex items-center gap-1 mt-0.5">
                                                                    <Calendar className="w-3.5 h-3.5" />
                                                                    {stmt.dueDate ? formatDate(stmt.dueDate) : 'N/A'}
                                                                </span>
                                                            </div>

                                                            {stmt.minDue && (
                                                                <div className="pt-2 border-t border-line/60">
                                                                    <span className="text-[9px] font-bold text-ink-faint uppercase tracking-wider block">
                                                                        Minimum Due
                                                                    </span>
                                                                    <span className="text-xs font-bold text-ink-muted">
                                                                        {formatCurrency(stmt.minDue)}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {stmt.statementPeriod && (
                                                                <div className="pt-2 border-t border-line/60">
                                                                    <span className="text-[9px] font-bold text-ink-faint uppercase tracking-wider block">
                                                                        Statement Cycle
                                                                    </span>
                                                                    <span className="text-[11px] font-semibold text-ink-muted truncate block">
                                                                        {stmt.statementPeriod}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Card Link Selector */}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1">
                                                                <CreditCard className="w-3 h-3 text-purple-400" />
                                                                Target Credit Card
                                                            </label>
                                                            <select
                                                                value={currentSelectedId}
                                                                onChange={(e) => setSelectedCardForStmt(prev => ({ ...prev, [stmt.messageId]: e.target.value }))}
                                                                className="w-full px-3 py-2 bg-sunken/80 border border-line rounded-xl text-xs text-ink outline-none focus:border-purple-500"
                                                            >
                                                                <option value="">-- Select Linked Card --</option>
                                                                {cards.map(c => (
                                                                    <option key={c.id} value={c.id}>
                                                                        {c.cardName || c.bankName} (•••• {c.last4 || c.cardNumber?.slice(-4) || '----'})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {/* Expandable Email Snippet */}
                                                        {stmt.snippet && (
                                                            <div className="pt-1">
                                                                <button
                                                                    onClick={() => toggleSnippet(stmt.messageId)}
                                                                    className="text-[11px] font-semibold text-ink-muted hover:text-ink flex items-center gap-1"
                                                                >
                                                                    <span>{isExpanded ? 'Hide Email Details' : 'View Raw Email Snippet'}</span>
                                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                </button>
                                                                {isExpanded && (
                                                                    <div className="mt-2 p-3 rounded-xl bg-sunken border border-line text-[11px] text-ink-muted leading-relaxed font-mono whitespace-pre-wrap">
                                                                        <div className="text-[10px] text-ink-faint font-bold mb-1">
                                                                            SUBJECT: {stmt.subject}
                                                                        </div>
                                                                        {stmt.snippet}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 pt-2 border-t border-line">
                                                        <button
                                                            onClick={() => handleApplyGmailStatement(stmt)}
                                                            disabled={applyingStmtId === stmt.messageId}
                                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                            <span>{applyingStmtId === stmt.messageId ? 'Applying Bill...' : 'Approve & Apply to Card'}</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDismissGmailStatement(stmt.messageId)}
                                                            className="p-2.5 rounded-xl bg-raised hover:bg-rose-950 hover:text-rose-400 text-ink-muted border border-line transition-all"
                                                            title="Dismiss Statement"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 rounded-3xl bg-surface/40 border border-line text-center space-y-4 backdrop-blur-xl">
                                    <div className="w-14 h-14 mx-auto rounded-2xl bg-raised/60 border border-line flex items-center justify-center text-ink-muted">
                                        <Mail className="w-7 h-7" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-bold text-ink">No Pending Statements</h3>
                                        <p className="text-xs text-ink-muted max-w-sm mx-auto">
                                            Your Gmail inbox is all caught up! Click below to scan for the latest bank statements.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleSyncGmailStatements}
                                        disabled={gmailSyncing}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${gmailSyncing ? 'animate-spin' : ''}`} />
                                        <span>{gmailSyncing ? 'Scanning Gmail...' : 'Scan Statements Now'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: PDF STATEMENT DECRYPT & OCR */}
            {activeTab === 'pdf' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-5 space-y-5">
                            <div className="p-6 rounded-3xl bg-surface/60 border border-line space-y-5 backdrop-blur-xl">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-purple-400" />
                                    <h2 className="text-base font-bold text-ink">Upload E-Statement PDF</h2>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                                        Assign to Credit Card (Optional)
                                    </label>
                                    <select
                                        value={selectedCard}
                                        onChange={(e) => setSelectedCard(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-sunken/80 border border-line rounded-xl text-xs text-ink outline-none focus:border-purple-500"
                                    >
                                        <option value="">Auto-Detect from Statement</option>
                                        {cards.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.cardName || c.bankName} (•••• {c.last4 || c.cardNumber?.slice(-4)})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="relative border-2 border-dashed border-line hover:border-purple-500/80 rounded-2xl p-6 text-center transition-all bg-sunken/40 hover:bg-sunken/70 group">
                                    <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="space-y-3">
                                        <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-ink">
                                                {pdfFile ? pdfFile.name : 'Drag & drop bank PDF or browse'}
                                            </p>
                                            <p className="text-[10px] text-ink-faint mt-1">
                                                Supports HDFC, ICICI, SBI, Axis, OneCard, Amex
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {showPasswordInput && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-3"
                                    >
                                        <div className="flex items-center gap-2 text-amber-400">
                                            <Lock className="w-4 h-4" />
                                            <span className="text-xs font-bold">Password Protected Statement</span>
                                        </div>
                                        <p className="text-[11px] text-amber-200/80">
                                            Standard format: 4 letters of name in CAPS + DOB (DDMM) e.g., RAMA0810
                                        </p>
                                        <div className="flex gap-2">
                                            <input
                                                type="password"
                                                value={pdfPassword}
                                                onChange={(e) => setPdfPassword(e.target.value)}
                                                placeholder="Enter PDF password..."
                                                className="flex-1 px-3 py-2 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-amber-500"
                                            />
                                            <button
                                                onClick={handleUnlockPDF}
                                                disabled={isProcessing}
                                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all"
                                            >
                                                Unlock
                                            </button>
                                        </div>
                                        {passwordError && (
                                            <p className="text-[10px] text-rose-400 font-semibold">{passwordError}</p>
                                        )}
                                    </motion.div>
                                )}

                                <button
                                    onClick={handleProcessStatement}
                                    disabled={!pdfFile || isProcessing}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>{isProcessing ? 'Decrypting & Extracting...' : 'Process Statement'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="lg:col-span-7 space-y-5">
                            {statementData ? (
                                <div className="p-6 rounded-3xl bg-surface/60 border border-line space-y-5 backdrop-blur-xl">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-base font-bold text-ink flex items-center gap-2">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            Parsed Statement Summary
                                        </h3>
                                        {statementCardEnding && (
                                            <span className="px-2.5 py-1 rounded-lg bg-sunken border border-line text-xs font-mono font-bold text-purple-300">
                                                Card Ending: •••• {statementCardEnding}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div className="p-3.5 rounded-2xl bg-sunken/80 border border-line">
                                            <span className="text-[10px] font-bold text-ink-muted uppercase block">Total Due</span>
                                            <span className="text-base font-black text-ink">{statementData.totalDue ? formatCurrency(statementData.totalDue) : 'N/A'}</span>
                                        </div>
                                        <div className="p-3.5 rounded-2xl bg-sunken/80 border border-line">
                                            <span className="text-[10px] font-bold text-ink-muted uppercase block">Due Date</span>
                                            <span className="text-sm font-extrabold text-amber-400">{statementData.dueDate ? formatDate(statementData.dueDate) : 'N/A'}</span>
                                        </div>
                                        <div className="p-3.5 rounded-2xl bg-sunken/80 border border-line">
                                            <span className="text-[10px] font-bold text-ink-muted uppercase block">Min Due</span>
                                            <span className="text-sm font-bold text-ink-muted">{statementData.minDue ? formatCurrency(statementData.minDue) : 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-sunken/50 border border-line text-xs text-ink-muted">
                                        Transactions have been placed into the <span className="text-indigo-300 font-bold">Staging Ledger</span>. Switch to the tab or review below.
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 rounded-3xl bg-surface/30 border border-line text-center space-y-3 backdrop-blur-xl">
                                    <FileText className="w-10 h-10 text-ink-faint mx-auto" />
                                    <p className="text-xs text-ink-muted">
                                        Upload a statement PDF to view parsed summary, card billing cycle, and extracted transactions.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: SMS & RAW TEXT PARSER */}
            {activeTab === 'sms' && (
                <div className="max-w-3xl mx-auto space-y-5">
                    <div className="p-6 sm:p-8 rounded-3xl bg-surface/60 border border-line space-y-5 backdrop-blur-xl">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-400" />
                            <h2 className="text-base font-bold text-ink">Paste Bank Statement or SMS Alerts</h2>
                        </div>
                        <p className="text-xs text-ink-muted">
                            Paste raw transaction SMS or text copied from your bank portal to extract amount, merchant, and dates using regex NLP.
                        </p>

                        <textarea
                            rows={6}
                            value={smsText}
                            onChange={(e) => setSmsText(e.target.value)}
                            placeholder="e.g., Alert: Rs 3,420.00 spent on HDFC Card ending 4821 at AMAZON INDIA on 08-Oct-2026. Avl Lmt: Rs 1,45,000..."
                            className="w-full p-4 bg-sunken/90 border border-line rounded-2xl text-xs text-ink font-mono placeholder:text-ink-faint outline-none focus:border-blue-500"
                        />

                        <button
                            onClick={handleProcessText}
                            disabled={!smsText.trim() || isProcessing}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
                        >
                            <Sparkles className="w-4 h-4" />
                            <span>{isProcessing ? 'Parsing Text...' : 'Parse Transactions & Sync'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* TAB 4: EMAIL & GOOGLE CLOUD CONFIGURATION (CRITICAL INFO MASKED & PROTECTED) */}
            {activeTab === 'config' && (
                <div className="space-y-6">
                    {/* Security & Masking Banner */}
                    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-surface/80 border border-line backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                <Shield className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-ink">OAuth Privacy & Credential Masking</p>
                                <p className="text-[11px] text-ink-muted">Sensitive client keys, tokens, and email addresses are masked by default.</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowSensitiveKeys(!showSensitiveKeys)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-raised hover:bg-line text-ink font-bold text-xs border border-line transition-all"
                        >
                            {showSensitiveKeys ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
                            <span>{showSensitiveKeys ? 'Hide Critical Info' : 'Reveal Info'}</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Connection & OAuth Setup Form (7 cols) */}
                        <div className="lg:col-span-7 space-y-5">
                            {/* Google Account Status Card */}
                            <div className="p-6 rounded-3xl bg-surface/60 border border-line space-y-5 backdrop-blur-xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-ink">Google Cloud OAuth Integration</h3>
                                            <p className="text-[11px] text-ink-muted">Gmail Read-Only API Configuration</p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                                        gmailStatus.connected 
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    }`}>
                                        {gmailStatus.connected ? 'CONNECTED' : 'NOT LINKED'}
                                    </span>
                                </div>

                                {gmailStatus.connected && (
                                    <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active Google Mailbox</span>
                                            <p className="text-xs font-extrabold text-ink">
                                                {showSensitiveKeys ? gmailStatus.email : maskEmail(gmailStatus.email)}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleDisconnectGmail}
                                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                )}

                                {/* OAuth Credentials Form */}
                                <div className="space-y-4 pt-2">
                                    {/* Google Client ID with Masking */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                                                <Key className="w-3.5 h-3.5 text-amber-400" />
                                                Google Client ID
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowClientId(!showClientId)}
                                                className="text-[10px] text-ink-muted hover:text-ink flex items-center gap-1"
                                            >
                                                {showClientId || showSensitiveKeys ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                <span>{showClientId || showSensitiveKeys ? 'Mask' : 'View'}</span>
                                            </button>
                                        </div>
                                        <input
                                            type={showClientId || showSensitiveKeys ? 'text' : 'password'}
                                            value={gmailConfig.clientId}
                                            onChange={(e) => setGmailConfig(prev => ({ ...prev, clientId: e.target.value.trim() }))}
                                            placeholder="434689533284-••••••••.apps.googleusercontent.com"
                                            className="w-full px-3.5 py-2.5 bg-sunken/90 border border-line rounded-xl text-xs text-ink font-mono placeholder:text-ink-faint outline-none focus:border-amber-500"
                                        />
                                    </div>

                                    {/* Google Client Secret with Masking */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                                                <Shield className="w-3.5 h-3.5 text-amber-400" />
                                                Google Client Secret
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowSecret(!showSecret)}
                                                className="text-[10px] text-ink-muted hover:text-ink flex items-center gap-1"
                                            >
                                                {showSecret || showSensitiveKeys ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                <span>{showSecret || showSensitiveKeys ? 'Mask' : 'View'}</span>
                                            </button>
                                        </div>
                                        <input
                                            type={showSecret || showSensitiveKeys ? 'text' : 'password'}
                                            value={gmailConfig.clientSecret}
                                            onChange={(e) => setGmailConfig(prev => ({ ...prev, clientSecret: e.target.value.trim() }))}
                                            placeholder="GOCSPX-••••••••••••••••"
                                            className="w-full px-3.5 py-2.5 bg-sunken/90 border border-line rounded-xl text-xs text-ink font-mono placeholder:text-ink-faint outline-none focus:border-amber-500"
                                        />
                                    </div>

                                    {/* Authorized Redirect URI with Copy Button */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center justify-between">
                                            <span>Authorized Redirect URI (Google Console)</span>
                                            <span className="text-[10px] text-emerald-400 font-semibold">Exact Match Required</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={gmailConfig.redirectUri}
                                                className="flex-1 px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink-muted font-mono outline-none select-all"
                                            />
                                            <button
                                                onClick={copyRedirectUri}
                                                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-raised hover:bg-line text-ink font-bold text-xs border border-line transition-all shrink-0"
                                            >
                                                {copiedUri ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                <span>{copiedUri ? 'Copied' : 'Copy'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap items-center gap-3 pt-3">
                                        <button
                                            onClick={handleSaveGmailConfig}
                                            disabled={savingConfig}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-raised hover:bg-line text-ink font-bold text-xs border border-line transition-all disabled:opacity-50"
                                        >
                                            <Save className="w-4 h-4 text-amber-400" />
                                            <span>{savingConfig ? 'Saving...' : 'Save Configuration'}</span>
                                        </button>

                                        <button
                                            onClick={handleGoogleConnect}
                                            disabled={gmailLoading}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            <span>{gmailLoading ? 'Authorizing...' : (gmailStatus.connected ? 'Re-Authorize Gmail' : 'Connect & Authorize')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Setup Guide & Troubleshooting (5 cols) */}
                        <div className="lg:col-span-5 space-y-5">
                            <div className="p-6 rounded-3xl bg-surface/60 border border-line space-y-4 backdrop-blur-xl">
                                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                                    <HelpCircle className="w-4 h-4 text-teal-400" />
                                    Google Cloud Setup Checklist
                                </h3>

                                <div className="space-y-3 text-xs text-ink-muted">
                                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sunken/60 border border-line/80">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                                        <div>
                                            <p className="font-bold text-ink">Enable Gmail API</p>
                                            <p className="text-[11px] text-ink-muted mt-0.5">In Google Cloud Console ➔ APIs & Services ➔ Enable <b>Gmail API</b>.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sunken/60 border border-line/80">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                                        <div>
                                            <p className="font-bold text-ink">Create OAuth Web Client ID</p>
                                            <p className="text-[11px] text-ink-muted mt-0.5">Application type: <b>Web Application</b>. Add the Authorized redirect URI shown on the left.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sunken/60 border border-line/80">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                                        <div>
                                            <p className="font-bold text-ink">OAuth Consent Screen: Add Test User</p>
                                            <p className="text-[11px] text-ink-muted mt-0.5">Under Test Users, add your Google account email address to allow login without full app verification.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
                                        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                        <div className="text-[11px] text-amber-200/90 leading-relaxed">
                                            <b>Google hasn&apos;t verified this app screen?</b> Click <b>&quot;Advanced&quot;</b> and select <b>&quot;Go to Nexa-Stream (unsafe)&quot;</b>. This is normal for private self-hosted apps.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STAGING LEDGER / EXTRACTED TRANSACTIONS SECTION */}
            {extractedTransactions.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-line/80">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface/80 border border-line backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                                <CheckSquare className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                                    Staging Transactions Ledger
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                        {extractedTransactions.length} Pending
                                    </span>
                                </h3>
                                <p className="text-[11px] text-ink-muted">Review, edit, and approve extracted charges to your credit card inventory.</p>
                            </div>
                        </div>

                        {/* Batch Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            <button
                                onClick={toggleSelectAll}
                                className="px-3 py-1.5 rounded-xl bg-raised hover:bg-line text-ink-muted text-xs font-bold border border-line"
                            >
                                {selectedTxIds.size === filteredTransactions.length ? 'Deselect All' : 'Select All'}
                            </button>

                            {selectedTxIds.size > 0 && (
                                <>
                                    <button
                                        onClick={handleBulkApprove}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Approve ({selectedTxIds.size})</span>
                                    </button>
                                    <button
                                        onClick={handleBulkReject}
                                        className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold"
                                    >
                                        Reject
                                    </button>
                                </>
                            )}

                            <button
                                onClick={handleClearAllExtracted}
                                className="p-2 rounded-xl bg-raised hover:bg-rose-950 hover:text-rose-400 text-ink-muted border border-line"
                                title="Clear All Staging Transactions"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-sunken/60 border border-line">
                        <div className="relative w-full sm:w-72">
                            <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={txSearchQuery}
                                onChange={(e) => setTxSearchQuery(e.target.value)}
                                placeholder="Search merchant or amount..."
                                className="w-full pl-9 pr-3 py-1.5 bg-surface border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint outline-none focus:border-indigo-500"
                            />
                        </div>

                        <select
                            value={txFilterCategory}
                            onChange={(e) => setTxFilterCategory(e.target.value)}
                            className="w-full sm:w-auto px-3 py-1.5 bg-surface border border-line rounded-xl text-xs text-ink-muted outline-none"
                        >
                            <option value="ALL">All Categories</option>
                            {Object.keys(CATEGORY_TONES).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Transaction Items Grid */}
                    <div className="space-y-2.5">
                        {filteredTransactions.map((tx) => {
                            const isSelected = selectedTxIds.has(tx.id);
                            return (
                                <div
                                    key={tx.id}
                                    className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                                        isSelected 
                                            ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md shadow-indigo-950/30' 
                                            : 'bg-surface/60 border-line hover:border-line'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectTx(tx.id)}
                                            className="w-4 h-4 rounded-md border-line text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                                        />
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-extrabold text-ink">{tx.merchant || tx.description}</span>
                                                <Badge tone={categoryTone(tx.category)} className="text-[10px] px-2 py-0.5">
                                                    {tx.category || 'General'}
                                                </Badge>
                                            </div>
                                            <p className="text-[10px] text-ink-muted">{formatDate(tx.date)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-ink">{formatCurrency(tx.amount)}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleApprove(tx.id)}
                                                className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                                                title="Approve to Ledger"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleReject(tx.id)}
                                                className="p-1.5 rounded-xl bg-raised hover:bg-rose-950 hover:text-rose-400 text-ink-muted transition-colors"
                                                title="Discard"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MANUAL TRANSACTION MODAL */}
            <Modal
                isOpen={showManualEntry}
                onClose={() => setShowManualEntry(false)}
                title="Add Manual Credit Card Charge"
            >
                <div className="space-y-4 p-2">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-ink-muted">Merchant / Title</label>
                        <input
                            type="text"
                            value={manualTransaction.merchant}
                            onChange={(e) => setManualTransaction(prev => ({ ...prev, merchant: e.target.value }))}
                            placeholder="e.g. Apple Subscription, Shell Petrol"
                            className="w-full px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-emerald-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-ink-muted">Amount (₹)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={manualTransaction.amount}
                                onChange={(e) => setManualTransaction(prev => ({ ...prev, amount: e.target.value }))}
                                placeholder="0.00"
                                className="w-full px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-ink-muted">Category</label>
                            <select
                                value={manualTransaction.category}
                                onChange={(e) => setManualTransaction(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-emerald-500"
                            >
                                <option value="">Select Category</option>
                                {Object.keys(CATEGORY_TONES).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-ink-muted">Date & Time</label>
                        <input
                            type="datetime-local"
                            value={manualTransaction.date}
                            onChange={(e) => setManualTransaction(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-emerald-500"
                        />
                    </div>

                    <div className="flex gap-2 pt-3">
                        <button
                            onClick={() => setShowManualEntry(false)}
                            className="flex-1 py-2.5 rounded-xl bg-raised hover:bg-line text-ink-muted font-bold text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddManualTransaction}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25"
                        >
                            Add to Staging
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CreditCardAutoStatement;
