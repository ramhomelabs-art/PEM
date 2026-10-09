import { notifyDataChanged } from '../../utils/realtimeSync';
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { useCategories } from '../../context/CategoryContext';
import {
    CheckCircle, XCircle, RefreshCw, MessageSquare, CreditCard,
    ArrowRight, Loader, Pencil, Plus, Check, Edit3, Smartphone,
    Activity, Server, Shield, Zap, Terminal, FileText, Send,
    QrCode, Key, Copy, ChevronDown, ChevronUp, ShieldCheck,
    Play, ArrowDownRight, ArrowUpRight, Cpu, Sparkles, Filter,
    Search, CheckCheck, Trash2, Eye, EyeOff, Radio, HelpCircle,
    SlidersHorizontal, CheckSquare
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import axios from 'axios';
import AutomationDetailsModal from '../../components/personal_expense/AutomationDetailsModal';
import { API_URL } from '../../config';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/currency';

const Automation = () => {
    const { isDarkMode } = useTheme();
    const { user } = useAuth();
    const { cards = [], addTransaction } = useCreditCards();
    const { categories = [] } = useCategories();
    const { addToast: notify } = useToast();

    // Data State
    const [pendingSMS, setPendingSMS] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [selectedCardMap, setSelectedCardMap] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');

    // Config & Device State
    const [smsApiKey, setSmsApiKey] = useState(null);
    const [encryptionKey, setEncryptionKey] = useState(null);
    const [deviceStatus, setDeviceStatus] = useState('offline');
    const [isDeviceApproved, setIsDeviceApproved] = useState(false);
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [lastSyncDate, setLastSyncDate] = useState(null);

    // QR & Pairing State
    const [qrCodeUrl, setQrCodeUrl] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [verifyCode, setVerifyCode] = useState('');
    const [verifyingCode, setVerifyingCode] = useState(false);
    const [, setVerifySuccess] = useState(false);
    const [showKeys, setShowKeys] = useState(false);

    // Health & Telemetry State
    const [health, setHealth] = useState({ status: 'online', python: 'unknown' });
    const [confirmAction, setConfirmAction] = useState(null);

    // Navigation Tab
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'manual' | 'connect'
    const [editingItem, setEditingItem] = useState(null);

    const [serverLanIp, setServerLanIp] = useState(null);

    const effectiveHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? (serverLanIp || window.location.hostname)
        : window.location.hostname;
    const lanPort = window.location.port || '5174';
    const webhookUrl = `${window.location.protocol}//${effectiveHost}:${lanPort}/api/sms/webhook`;

    // --- FETCHERS ---
    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/sms/config`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.lanIp) setServerLanIp(res.data.lanIp);
            setSmsApiKey(res.data.smsApiKey);
            setEncryptionKey(res.data.encryptionKey);
            setIsDeviceApproved(!!res.data.isDeviceApproved);
            setDeviceInfo(res.data.deviceInfo);
            setLastSyncDate(res.data.lastDeviceSync);

            if (res.data.lastDeviceSync) {
                const diff = (new Date() - new Date(res.data.lastDeviceSync)) / 1000 / 60;
                setDeviceStatus(diff < 10 ? 'online' : 'offline');
            }
        } catch (e) {
            console.error('Config fetch failed', e);
        }
    };

    const fetchPending = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/sms/pending`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPendingSMS(res.data || []);
        } catch (e) {
            console.error('Pending fetch failed', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchHealth = async () => {
        try {
            const res = await axios.get(`${API_URL}/sms/health`);
            setHealth({ status: res.data.status, python: res.data.python_service });
        } catch {
            setHealth({ status: 'offline', python: 'offline' });
        }
    };

    const fetchQrCode = async () => {
        setQrLoading(true);
        setVerifySuccess(false);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                notify('Please log in again to generate pairing code', 'error');
                return;
            }
            const mobileServerUrl = `${window.location.protocol}//${effectiveHost}:${lanPort}`;
            const res = await axios.post(`${API_URL}/mfa/setup/generate-qr`, {
                serverUrl: (effectiveHost === 'localhost' || effectiveHost === '127.0.0.1') ? undefined : mobileServerUrl
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data && (res.data.companionQrCodeUrl || res.data.qrCodeUrl)) {
                setQrCodeUrl(res.data.companionQrCodeUrl || res.data.qrCodeUrl);
            }
        } catch (e) {
            console.error('Failed to generate pairing QR code', e);
            notify('Failed to generate pairing QR code', 'error');
        } finally {
            setQrLoading(false);
        }
    };

    const handleVerifyCodeDirect = async (codeToVerify) => {
        const cleanCode = (codeToVerify || verifyCode).trim();
        if (cleanCode.length !== 6) {
            notify('Please enter a valid 6-digit TOTP code', 'error');
            return;
        }
        setVerifyingCode(true);
        try {
            const res = await axios.post(`${API_URL}/mfa/auth/totp/verify`, {
                userId: user.id,
                code: cleanCode
            });
            if (res.data && res.data.success) {
                setVerifySuccess(true);
                setIsDeviceApproved(true);
                setDeviceStatus('online');
                notify('Companion device successfully verified and linked!', 'success');
                fetchConfig();
            } else {
                notify('Invalid code. Please check your mobile screen.', 'error');
            }
        } catch (err) {
            notify(err.response?.data?.error || 'Verification failed. Try the latest TOTP on your phone.', 'error');
        } finally {
            setVerifyingCode(false);
        }
    };

    const handleCodeInputChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
        setVerifyCode(val);
        if (val.length === 6 && !verifyingCode) {
            setTimeout(() => {
                handleVerifyCodeDirect(val);
            }, 100);
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchPending();
        fetchHealth();
        const interval = setInterval(fetchHealth, 25000);
        return () => clearInterval(interval);
    }, []);

    // Active polling and QR generation when on connect tab
    useEffect(() => {
        if (activeTab === 'connect') {
            fetchConfig();
            fetchQrCode();
            // Poll for device binding if not yet approved
            const connectPoll = setInterval(() => {
                fetchConfig();
            }, 4000);
            return () => clearInterval(connectPoll);
        }
    }, [activeTab]);

    // --- ACTIONS ---
    const handleRestartPython = async () => {
        if (confirmAction?.type !== 'restart') {
            setConfirmAction({ type: 'restart' });
            setTimeout(() => setConfirmAction(null), 3500);
            return;
        }
        setConfirmAction(null);
        try {
            setHealth(prev => ({ ...prev, python: 'restarting' }));
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/server/restart/python`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            notify("Restart signal dispatched. Re-connecting in 8s...", 'warning', 4000);
            setTimeout(fetchHealth, 8000);
        } catch (e) {
            notify("Restart failed: " + (e.response?.data?.error || e.message), 'error');
            fetchHealth();
        }
    };

    const handleResetDevice = async () => {
        if (confirmAction?.type !== 'reset') {
            setConfirmAction({ type: 'reset' });
            setTimeout(() => setConfirmAction(null), 3500);
            return;
        }
        setConfirmAction(null);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/sms/device/disconnect`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchConfig();
            notify("Companion device unpaired. Scan QR on mobile to re-link.", 'success');
        } catch {
            notify("Unpair request failed", 'error');
        }
    };

    const handleApprove = async (sms) => {
        setProcessingId(sms.id);
        try {
            let transactionDate = sms.received_at || sms.date || new Date().toISOString();
            await axios.post(`${API_URL}/transactions/manual`, {
                userId: user.id,
                date: transactionDate,
                amount: sms.amount,
                description: sms.merchant || sms.provider || 'SMS Expense',
                category: sms.category || 'General',
                type: (sms.transaction_type === 'credit' || sms.type === 'income' || sms.category_type === 'income') ? 'income' : 'expense',
                paymentMode: sms.paymentMethod || sms.mode || 'UPI',
                status: 'Completed',
                source: (sms.source === 'APP' || sms.source === 'MANUAL_ENTRY' || sms.tag === 'direct_manual') ? 'app' : 'sms',
                mode: sms.mode
            });

            await axios.delete(`${API_URL}/sms/reject/${sms.id}`);
            setPendingSMS(prev => prev.filter(p => p.id !== sms.id));
            notify("Transaction Approved to Personal Ledger", 'success'); notifyDataChanged("transactions");
        } catch (e) {
            notify("Approval Failed", 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleApproveToCard = async (sms, cardId) => {
        const targetCardId = cardId || (cards.length > 0 ? cards[0].id : null);
        if (!targetCardId) {
            notify("Please select a credit card first", 'error');
            return;
        }

        setProcessingId(sms.id);
        try {
            let transactionDate = sms.received_at || sms.date || new Date().toISOString();
            await addTransaction(targetCardId, {
                id: Date.now(),
                date: transactionDate,
                amount: sms.amount,
                description: sms.merchant || sms.provider || 'Card Transaction',
                merchant: sms.merchant || sms.provider || 'Card Transaction',
                category: sms.category || 'General',
                type: (sms.transaction_type === 'credit' || sms.type === 'income' || sms.category_type === 'income') ? 'credit' : 'debit',
                status: 'Completed',
                paymentMethod: 'Credit Card'
            });

            await axios.delete(`${API_URL}/sms/reject/${sms.id}`);
            setPendingSMS(prev => prev.filter(p => p.id !== sms.id));
            notify("Routed directly to Credit Card ledger", 'success');
        } catch (e) {
            console.error(e);
            notify("Card Approval Failed", 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id) => {
        try {
            await axios.delete(`${API_URL}/sms/reject/${id}`);
            setPendingSMS(prev => prev.filter(p => p.id !== id));
            notify("Record dismissed", 'info');
        } catch {
            notify("Dismiss Failed", 'error');
        }
    };

    const handleBatchRejectAll = async () => {
        if (!window.confirm("Are you sure you want to dismiss all pending SMS records?")) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/sms/batch-reject-all`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPendingSMS([]);
            notify("Inbox cleared successfully", 'success');
        } catch {
            notify("Failed to clear queue", 'error');
        }
    };

    const handleEditSave = async (updatedData) => {
        try {
            await axios.put(`${API_URL}/sms/update/${updatedData.id}`, updatedData);
            setEditingItem(null);
            fetchPending();
            notify("Record details updated", 'success');
        } catch {
            notify("Update failed", 'error');
        }
    };

    
    const copyToClipboard = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        notify(`${label} copied to clipboard`, 'success');
    };

    // Filter lists
    const smsList = useMemo(() => {
        return pendingSMS.filter(s => {
            const isManual = s.source === 'MANUAL_ENTRY' || s.type === 'MANUAL';
            if (isManual) return false;
            // Credit card transactions belong strictly to Credit Card module
            const isCC = s.isCreditCard === true || s.mode === 'CREDIT_CARD' || s.paymentMethod === 'CREDIT_CARD';
            if (isCC) return false;
            if (filterCategory !== 'ALL' && s.category !== filterCategory) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const m = (s.merchant || s.provider || '').toLowerCase();
                const d = (s.description || '').toLowerCase();
                const raw = (s.raw_message || '').toLowerCase();
                return m.includes(q) || d.includes(q) || raw.includes(q);
            }
            return true;
        });
    }, [pendingSMS, filterCategory, searchQuery]);

    const manualList = useMemo(() => {
        return pendingSMS.filter(s => {
            const isManual = s.source === 'MANUAL_ENTRY' || s.type === 'MANUAL';
            if (!isManual) return false;
            const isCC = s.isCreditCard === true || s.mode === 'CREDIT_CARD' || s.paymentMethod === 'CREDIT_CARD';
            if (isCC) return false;
            if (filterCategory !== 'ALL' && s.category !== filterCategory) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const m = (s.merchant || s.provider || '').toLowerCase();
                const d = (s.description || '').toLowerCase();
                return m.includes(q) || d.includes(q);
            }
            return true;
        });
    }, [pendingSMS, filterCategory, searchQuery]);

    const getHealthColor = (status) => {
        if (status === 'online') return '#10b981';
        if (status === 'restarting') return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-sunken text-ink' : 'bg-slate-50 text-slate-800'} p-4 sm:p-8 transition-colors duration-200`}>
            
            {/* Modal for detail review */}
            <AutomationDetailsModal
                isOpen={!!editingItem}
                data={editingItem}
                onClose={() => setEditingItem(null)}
                onSave={handleEditSave}
                categories={categories}
                user={user}
            />

            {/* Top Bar Header & Health Telemetry Widget */}
            <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                            <Cpu className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent">
                                Automation Spot & Companion Hub
                            </h1>
                            <p className="text-xs sm:text-sm text-ink-muted font-medium">
                                Autonomous SMS Transaction Ingestion, AI NLP Entity Extraction & Android Sync
                            </p>
                        </div>
                    </div>
                </div>

                {/* Telemetry Status Bar */}
                <div className="flex flex-wrap items-center gap-2.5 p-2 rounded-2xl bg-surface/80 backdrop-blur-md shadow-xl">
                    {/* Node SMS Gateway */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sunken/60">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600 dark:bg-emerald-500"></span>
                        </span>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Node Gateway</span>
                            <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">ONLINE</span>
                        </div>
                    </div>

                    {/* Python AI Extractor Service */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sunken/60">
                        <Terminal className="w-3.5 h-3.5" style={{ color: getHealthColor(health.python) }} />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Python AI Extractor</span>
                            <span className="text-[11px] font-extrabold uppercase" style={{ color: getHealthColor(health.python) }}>
                                {health.python}
                            </span>
                        </div>
                        {health.python !== 'online' && health.python !== 'restarting' && (
                            <button
                                onClick={handleRestartPython}
                                className={`ml-1 px-2 py-1 rounded-lg text-[10px] font-bold text-ink transition-all ${
                                    confirmAction?.type === 'restart' ? 'bg-amber-600 animate-pulse' : 'bg-rose-600 hover:bg-rose-500'
                                }`}
                            >
                                {confirmAction?.type === 'restart' ? 'Confirm?' : 'Restart'}
                            </button>
                        )}
                    </div>

                    {/* Android Companion Sync */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sunken/60">
                        <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Android Companion</span>
                            <span className="text-[11px] font-extrabold text-ink">
                                {isDeviceApproved ? (deviceStatus === 'online' ? 'SYNCED' : 'PAIRED') : 'NOT PAIRED'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Segmented Navigation Tab Bar */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-surface/90 shadow-xl backdrop-blur-md">
                    {/* Tab 1: SMS Inbox */}
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
                            activeTab === 'pending'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                                : 'text-ink-muted hover:text-ink hover:bg-line'
                        }`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span>SMS Approval Inbox</span>
                        {smsList.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white shadow-sm animate-pulse">
                                {smsList.length}
                            </span>
                        )}
                    </button>

                    {/* Tab 2: Manual Entries */}
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
                            activeTab === 'manual'
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                                : 'text-ink-muted hover:text-ink hover:bg-line'
                        }`}
                    >
                        <Pencil className="w-4 h-4" />
                        <span>Companion Logs</span>
                        {manualList.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-400 text-slate-950 shadow-sm">
                                {manualList.length}
                            </span>
                        )}
                    </button>

                    {/* Tab 3: Android Connect & Security */}
                    <button
                        onClick={() => setActiveTab('connect')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            activeTab === 'connect'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                                : 'text-ink-muted hover:text-ink hover:bg-line'
                        }`}
                    >
                        <QrCode className="w-4 h-4" />
                        <span>Android Pairing & Keys</span>
                    </button>
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="max-w-7xl mx-auto">

                {/* 1. SMS APPROVAL INBOX */}
                {activeTab === 'pending' && (
                    <div className="space-y-4">
                        {/* Search & Filter Header Bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-surface/80 border border-line">
                            <div className="relative w-full sm:w-80">
                                <Search className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search bank, merchant or amount..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-sunken/80 border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="px-3 py-2 bg-sunken/80 border border-line rounded-xl text-xs text-ink-muted outline-none cursor-pointer"
                                >
                                    <option value="ALL">All Categories</option>
                                    {categories.map(c => (
                                        <option key={c.id || c.name} value={c.name}>{c.name}</option>
                                    ))}
                                </select>

                                <button
                                    onClick={fetchPending}
                                    className="p-2 rounded-xl bg-raised hover:bg-line text-ink-muted transition-colors"
                                    title="Refresh Inbox"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>

                                {smsList.length > 0 && (
                                    <button
                                        onClick={handleBatchRejectAll}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Clear All
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* List Items */}
                        {loading ? (
                            <div className="p-16 flex flex-col items-center justify-center rounded-2xl bg-surface/50 border border-line">
                                <Loader className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                                <span className="text-xs text-ink-muted font-medium">Scanning pending transactions...</span>
                            </div>
                        ) : smsList.length === 0 ? (
                            <div className="text-center p-16 rounded-2xl bg-surface/40 border border-line">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                                    <CheckCheck className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-ink mb-1">Inbox Zero & Ledger Synced</h3>
                                <p className="text-xs text-ink-muted max-w-sm mx-auto mb-6">
                                    No pending SMS transactions waiting for review. New transactions received by your Android companion will appear here in real-time.
                                </p>
                                <button
                                    onClick={() => setActiveTab('connect')}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-raised hover:bg-line text-xs font-semibold text-ink border border-line transition-colors"
                                >
                                    <Smartphone className="w-4 h-4 text-blue-400" /> Open Android Pairing
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3.5">
                                {smsList.map(sms => (
                                    <TransactionCard
                                        key={sms.id}
                                        sms={sms}
                                        user={user}
                                        isDarkMode={isDarkMode}
                                        processingId={processingId}
                                        onEdit={() => setEditingItem(sms)}
                                        onReject={handleReject}
                                        onApprove={handleApprove}
                                        cards={cards}
                                        selectedCardMap={selectedCardMap}
                                        setSelectedCardMap={setSelectedCardMap}
                                        onApproveToCard={handleApproveToCard}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. COMPANION LOGS / MANUAL ENTRIES */}
                {activeTab === 'manual' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-surface/80 border border-line">
                            <div>
                                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                                    <Pencil className="w-4 h-4 text-purple-400" />
                                    Mobile App Companion Entries ({manualList.length})
                                </h2>
                                <p className="text-xs text-ink-muted">
                                    Transactions captured manually on your mobile companion for immediate review
                                </p>
                            </div>
                            <button
                                onClick={fetchPending}
                                className="p-2 rounded-xl bg-raised hover:bg-line text-ink-muted transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="p-16 flex flex-col items-center justify-center rounded-2xl bg-surface/50 border border-line">
                                <Loader className="w-8 h-8 text-purple-400 animate-spin mb-3" />
                                <span className="text-xs text-ink-muted font-medium">Loading companion entries...</span>
                            </div>
                        ) : manualList.length === 0 ? (
                            <div className="text-center p-16 rounded-2xl bg-surface/40 border border-line">
                                <div className="w-16 h-16 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                                    <Smartphone className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-ink mb-1">No Pending Mobile Entries</h3>
                                <p className="text-xs text-ink-muted max-w-sm mx-auto">
                                    You can record rapid expenses directly on your Android phone using the PEM Companion quick-widget.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3.5">
                                {manualList.map(sms => (
                                    <TransactionCard
                                        key={sms.id}
                                        sms={sms}
                                        user={user}
                                        isDarkMode={isDarkMode}
                                        isManual={true}
                                        processingId={processingId}
                                        onEdit={() => setEditingItem(sms)}
                                        onReject={handleReject}
                                        onApprove={handleApprove}
                                        cards={cards}
                                        selectedCardMap={selectedCardMap}
                                        setSelectedCardMap={setSelectedCardMap}
                                        onApproveToCard={handleApproveToCard}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. ANDROID PAIRING, TOTP & HARDWARE SECURITY */}
                {/* 4. ANDROID PAIRING, TOTP & HARDWARE SECURITY */}
                {activeTab === 'connect' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Device Status Hero Card */}
                        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-line shadow-2xl">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-line">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight flex items-center gap-2.5">
                                        <Smartphone className="w-6 h-6 text-blue-400" />
                                        Android Companion Synchronization
                                    </h2>
                                    <p className="text-xs sm:text-sm text-ink-muted mt-1">
                                        Zero-touch encrypted SMS telemetry bridge running continuously in the background
                                    </p>
                                </div>
                                <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold ${
                                    isDeviceApproved
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                }`}>
                                    <span className="relative flex h-2 w-2">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDeviceApproved ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isDeviceApproved ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                    </span>
                                    {isDeviceApproved ? (deviceStatus === 'online' ? 'Active & Synced' : 'Paired (Standby)') : 'Pending Approval'}
                                </div>
                            </div>

                            {/* Active Paired State vs Setup State */}
                            {isDeviceApproved ? (
                                <div className="pt-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-2xl bg-sunken/70 border border-line">
                                            <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider block">Paired Device Model</span>
                                            <span className="text-sm font-extrabold text-ink mt-1 block">
                                                {deviceInfo?.manufacturer || 'Android'} {deviceInfo?.model || 'Device'}
                                            </span>
                                            <span className="text-[11px] font-mono text-ink-muted mt-0.5 block truncate">
                                                ID: {deviceInfo?.androidId || 'Encrypted Token'}
                                            </span>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-sunken/70 border border-line">
                                            <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider block">Last Sync Heartbeat</span>
                                            <span className="text-sm font-extrabold text-emerald-400 mt-1 block">
                                                {lastSyncDate ? new Date(lastSyncDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Continuous'}
                                            </span>
                                            <span className="text-[11px] text-ink-muted mt-0.5 block">
                                                {lastSyncDate ? new Date(lastSyncDate).toLocaleDateString() : 'Active Webhook'}
                                            </span>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-sunken/70 border border-line">
                                            <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider block">Encryption Standard</span>
                                            <span className="text-sm font-extrabold text-indigo-300 mt-1 block flex items-center gap-1.5">
                                                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                                AES-256-GCM + HMAC
                                            </span>
                                            <span className="text-[11px] text-ink-muted mt-0.5 block">
                                                Zero-Knowledge Payload
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                        <button
                                            onClick={() => { fetchConfig(); fetchHealth(); }}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-raised hover:bg-line text-ink text-xs font-bold transition-colors"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" /> Re-check Companion Pulse
                                        </button>

                                        <button
                                            onClick={handleResetDevice}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                confirmAction?.type === 'reset'
                                                    ? 'bg-rose-600 text-white animate-pulse'
                                                    : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                            }`}
                                        >
                                            <XCircle className="w-4 h-4" />
                                            {confirmAction?.type === 'reset' ? 'Confirm Unpair Device?' : 'Unpair Companion App'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="pt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                    {/* QR Code Scanner Card */}
                                    <div className="md:col-span-5 flex flex-col items-center text-center p-6 rounded-2xl bg-sunken border border-line shadow-inner">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wide mb-3">
                                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                            <span>AES-256-GCM Zero-Knowledge QR</span>
                                        </div>

                                        <div className="relative p-3 bg-white rounded-2xl shadow-xl border-2 border-emerald-500/80 mb-4 overflow-hidden group">
                                            {/* Cyber Corner HUD Brackets */}
                                            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-600 pointer-events-none" />
                                            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-600 pointer-events-none" />
                                            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-600 pointer-events-none" />
                                            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-600 pointer-events-none" />

                                            {qrLoading ? (
                                                <div className="w-48 h-48 flex flex-col items-center justify-center text-ink-muted">
                                                    <Loader className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                                                    <span className="text-xs">Generating Pairing Token...</span>
                                                </div>
                                            ) : qrCodeUrl ? (
                                                <div className="relative">
                                                    <img
                                                        src={qrCodeUrl}
                                                        alt="Pairing QR Code"
                                                        className="w-48 h-48 rounded-lg block"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-48 h-48 flex flex-col items-center justify-center text-ink-muted">
                                                    <QrCode className="w-12 h-12 opacity-40 mb-2" />
                                                    <span className="text-xs">Click refresh to load QR</span>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={fetchQrCode}
                                            disabled={qrLoading}
                                            className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-colors"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${qrLoading ? 'animate-spin' : ''}`} /> Refresh Pairing QR
                                        </button>
                                    </div>

                                    {/* Step-by-Step Instructions & TOTP Verification */}
                                    <div className="md:col-span-7 space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs font-bold text-ink-muted">
                                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                                                Open PEM Android Companion App on your mobile device
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-ink-muted">
                                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                                                Tap &quot;Scan Web Setup QR&quot; and point camera at the QR code
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-ink-muted">
                                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                                                Enter the 6-digit sync code displayed on your phone below:
                                            </div>
                                        </div>

                                        {/* 6-Digit TOTP Input Box */}
                                        <div className="p-4 rounded-2xl bg-sunken/80 border border-line space-y-3">
                                            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                                                Companion TOTP Security Code
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    placeholder="123456"
                                                    value={verifyCode}
                                                    onChange={handleCodeInputChange}
                                                    className="flex-1 px-4 py-3 bg-surface border-2 border-line focus:border-emerald-500 rounded-xl text-center text-xl font-mono font-black tracking-widest text-emerald-400 outline-none"
                                                />
                                                <button
                                                    onClick={() => handleVerifyCodeDirect()}
                                                    disabled={verifyingCode || verifyCode.trim().length !== 6}
                                                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                                >
                                                    {verifyingCode ? <Loader className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                                    Link Device
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Direct API Webhook & Encryption Keys Card (Collapsible) */}
                        <div className="p-6 rounded-3xl bg-surface/90 border border-line shadow-xl space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <Key className="w-5 h-5 text-indigo-400" />
                                    <div>
                                        <h3 className="text-sm font-bold text-ink">Manual Webhook & Encryption Credentials</h3>
                                        <p className="text-xs text-ink-muted">For custom Automate, Tasker, or iOS Shortcuts integration</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowKeys(!showKeys)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-raised hover:bg-line text-xs font-semibold text-ink-muted transition-colors"
                                >
                                    {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    {showKeys ? 'Hide Keys' : 'Reveal Keys'}
                                </button>
                            </div>

                            {showKeys && (
                                <div className="space-y-3 pt-2">
                                    {/* Webhook URL */}
                                    <div className="p-3.5 rounded-xl bg-sunken border border-line">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">SMS Webhook URL</span>
                                            <button
                                                onClick={() => copyToClipboard(`${webhookUrl}?apiKey=${smsApiKey}`, 'Webhook URL')}
                                                className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 font-semibold"
                                            >
                                                <Copy className="w-3 h-3" /> Copy
                                            </button>
                                        </div>
                                        <code className="text-xs font-mono text-emerald-400 break-all select-all">
                                            {webhookUrl}?apiKey={smsApiKey || '••••••••'}
                                        </code>
                                    </div>

                                    {/* SMS API Key */}
                                    <div className="p-3.5 rounded-xl bg-sunken border border-line">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">SMS API Secret Key</span>
                                            <button
                                                onClick={() => copyToClipboard(smsApiKey, 'SMS API Key')}
                                                className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 font-semibold"
                                            >
                                                <Copy className="w-3 h-3" /> Copy
                                            </button>
                                        </div>
                                        <code className="text-xs font-mono text-indigo-300 break-all select-all">
                                            {smsApiKey || '••••••••••••••••'}
                                        </code>
                                    </div>

                                    {/* Encryption Key */}
                                    <div className="p-3.5 rounded-xl bg-sunken border border-line">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">AES-256 Payload Key</span>
                                            <button
                                                onClick={() => copyToClipboard(encryptionKey, 'Encryption Key')}
                                                className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 font-semibold"
                                            >
                                                <Copy className="w-3 h-3" /> Copy
                                            </button>
                                        </div>
                                        <code className="text-xs font-mono text-purple-300 break-all select-all">
                                            {encryptionKey || '••••••••••••••••••••••••••••••••'}
                                        </code>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-Component: Transaction Card for SMS and App Entries
const TransactionCard = ({
    sms,
    user,
    isDarkMode,
    isManual,
    processingId,
    onEdit,
    onReject,
    onApprove,
    cards = [],
    selectedCardMap,
    setSelectedCardMap,
    onApproveToCard
}) => {
    const isCredit = sms.transaction_type === 'credit' || sms.type === 'income' || sms.category_type === 'income';
    const isProcessing = processingId === sms.id;
    const [showRaw, setShowRaw] = useState(false);

    return (
        <div className={`group relative p-4 sm:p-5 rounded-2xl transition-all duration-200 border ${
            isManual
                ? 'bg-surface/90 border-purple-500/30 hover:border-purple-500/60 shadow-lg shadow-purple-500/5'
                : 'bg-surface/90 border-line hover:border-line shadow-lg'
        }`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                {/* Left: Icon & Merchant & Details */}
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className={`p-3 rounded-xl shrink-0 ${
                        isManual
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : isCredit
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                        {isManual ? (
                            <Pencil className="w-5 h-5" />
                        ) : isCredit ? (
                            <ArrowUpRight className="w-5 h-5" />
                        ) : (
                            <ArrowDownRight className="w-5 h-5" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="text-sm sm:text-base font-extrabold text-ink truncate">
                                {sms.merchant || sms.provider || sms.account || 'Unknown Merchant'}
                            </h4>
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-raised text-ink-muted">
                                {sms.date || (sms.received_at ? new Date(sms.received_at).toLocaleDateString() : 'Today')}
                            </span>
                            {isManual && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Mobile App
                                </span>
                            )}
                            {(sms.isSubscription || sms.category === 'Subscription') && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    🔁 Subscription
                                </span>
                            )}
                            {sms.extractor && (
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sunken text-emerald-400 border border-emerald-500/30">
                                    {sms.extractor}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-ink-muted truncate max-w-xl">
                            {sms.description || sms.raw_message || 'Transaction received via automated feed'}
                        </p>
                    </div>
                </div>

                {/* Center: Amount & Category Badge */}
                <div className="text-left md:text-right shrink-0 px-2">
                    <div className={`text-lg sm:text-xl font-black ${
                        isCredit ? 'text-emerald-400' : 'text-ink'
                    }`}>
                        {isCredit ? '+' : '-'} {formatCurrency(sms.amount, user?.currency || 'INR')}
                    </div>
                    <div className="flex items-center md:justify-end gap-1.5 text-[11px] font-bold text-ink-muted mt-1 flex-wrap">
                        <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">{sms.category || 'General'}</span>
                        {(() => {
                            const mode = (sms.paymentMethod || sms.mode || 'UPI').toUpperCase();
                            if (mode === 'UPI') return <span className="text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/25">⚡ UPI</span>;
                            if (mode === 'NETBANKING') return <span className="text-sky-300 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/25">🏦 Netbanking</span>;
                            if (mode === 'BANK_TRANSFER' || mode === 'BANK') return <span className="text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded border border-teal-500/25">🏛️ Bank Transfer</span>;
                            if (mode === 'DEBIT_CARD') return <span className="text-orange-300 bg-orange-500/15 px-2 py-0.5 rounded border border-orange-500/25">💳 Debit Card</span>;
                            return <span className="text-ink-muted bg-raised px-2 py-0.5 rounded">{mode}</span>;
                        })()}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-line">
                    {/* Toggle Raw Message */}
                    <button
                        type="button"
                        onClick={() => setShowRaw(!showRaw)}
                        className="p-2 rounded-xl bg-raised hover:bg-line text-ink-muted hover:text-ink transition-colors"
                        title="View Raw Message"
                    >
                        <FileText className="w-4 h-4" />
                    </button>

                    {/* Edit Details */}
                    <button
                        type="button"
                        onClick={onEdit}
                        className="p-2 rounded-xl bg-raised hover:bg-line text-ink-muted hover:text-ink transition-colors"
                        title="Edit Details"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Dismiss / Reject */}
                    <button
                        type="button"
                        onClick={() => onReject(sms.id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                        title="Dismiss / Delete"
                    >
                        <XCircle className="w-4 h-4" />
                    </button>

                    {/* Credit Card Selector and Approve to Card */}
                    {cards && cards.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-sunken p-1 rounded-xl border border-line">
                            <select
                                value={selectedCardMap[sms.id] || cards[0].id}
                                onChange={(e) => setSelectedCardMap(prev => ({ ...prev, [sms.id]: e.target.value }))}
                                className="px-2 py-1 bg-transparent text-xs text-ink font-semibold outline-none cursor-pointer max-w-[120px] truncate"
                            >
                                {cards.map(c => (
                                    <option key={c.id} value={c.id} className="bg-surface text-ink">
                                        {c.cardName || c.bankName}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={() => onApproveToCard(sms, selectedCardMap[sms.id] || cards[0].id)}
                                disabled={isProcessing}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all active:scale-95 disabled:opacity-50"
                                title="Approve directly to selected Credit Card"
                            >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Card</span>
                            </button>
                        </div>
                    )}

                    {/* Standard Approve Button */}
                    <button
                        type="button"
                        onClick={() => onApprove(sms)}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>Approve</span>
                    </button>
                </div>
            </div>

            {/* Accordion Raw SMS payload */}
            {showRaw && (
                <div className="mt-3 pt-3 border-t border-line">
                    <p className="text-xs font-mono text-ink-muted bg-sunken p-2.5 rounded-xl border border-line leading-relaxed whitespace-pre-wrap break-all">
                        {sms.raw_message || sms.description || 'No raw string available'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default Automation;
