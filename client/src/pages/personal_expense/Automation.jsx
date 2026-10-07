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
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import AutomationDetailsModal from '../../components/personal_expense/AutomationDetailsModal';
import { API_URL } from '../../config';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/currency';

// Sample SMS templates for the Interactive Simulator
const SAMPLE_TEMPLATES = [
    {
        name: 'HDFC UPI Debit',
        bank: 'HDFC',
        type: 'debit',
        text: 'Rs 1,450.00 debited from HDFC Bank A/C **1234 to SWIGGY on 07-OCT-26 via UPI txn# 428190284. Bal: Rs 45,210.00',
        sender: 'HDFCBK'
    },
    {
        name: 'ICICI Credit Card',
        bank: 'ICICI',
        type: 'debit',
        text: 'INR 4,299.00 spent on your ICICI Bank Credit Card ending XX8002 at AMAZON INDIA on 07-Oct-26. Available Limit: INR 1,85,000.00',
        sender: 'ICICIB'
    },
    {
        name: 'SBI Salary Credit',
        bank: 'SBI',
        type: 'credit',
        text: 'Dear Customer, your SBI A/C ending 9876 has been CREDITED with INR 85,000.00 on 07-Oct-26 by SALARY NEFT transfer. Available Bal: INR 1,12,450.00',
        sender: 'SBIBNK'
    },
    {
        name: 'Axis Zomato UPI',
        bank: 'Axis',
        type: 'debit',
        text: 'Paid Rs. 620.00 from Axis Bank A/C XX4421 to ZOMATO on 07/10/2026. Ref UPI/429188091.',
        sender: 'AXISBK'
    },
    {
        name: 'CRED Card Bill Pay',
        bank: 'CRED',
        type: 'debit',
        text: 'Payment of Rs. 18,500.00 received towards SBI Card SimplyCLICK via CRED Pay on 07 Oct 2026.',
        sender: 'CREDPY'
    }
];

const Automation = () => {
    const { theme, isDarkMode } = useTheme();
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
    const [verifySuccess, setVerifySuccess] = useState(false);
    const [showKeys, setShowKeys] = useState(false);

    // Health & Telemetry State
    const [health, setHealth] = useState({ status: 'online', python: 'unknown' });
    const [confirmAction, setConfirmAction] = useState(null);

    // Navigation Tab
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'manual' | 'simulator' | 'connect'
    const [editingItem, setEditingItem] = useState(null);

    // Simulator State
    const [simText, setSimText] = useState(SAMPLE_TEMPLATES[0].text);
    const [simSender, setSimSender] = useState(SAMPLE_TEMPLATES[0].sender);
    const [simResult, setSimResult] = useState(null);
    const [simLoading, setSimLoading] = useState(false);
    const [pushingToQueue, setPushingToQueue] = useState(false);

    const webhookUrl = 'https://finance.ramhomelab.com/api/sms/webhook';

    // --- FETCHERS ---
    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/sms/config`, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
            const res = await axios.post(`${API_URL}/mfa/setup/generate-qr`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data && res.data.qrCodeUrl) {
                setQrCodeUrl(res.data.qrCodeUrl);
            }
        } catch (e) {
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
                type: sms.transaction_type === 'credit' ? 'income' : 'expense',
                paymentMode: sms.paymentMethod || sms.mode || 'UPI',
                status: 'Completed',
                source: sms.source === 'MANUAL_ENTRY' ? 'manual' : 'sms',
                mode: sms.mode
            });

            await axios.delete(`${API_URL}/sms/reject/${sms.id}`);
            setPendingSMS(prev => prev.filter(p => p.id !== sms.id));
            notify("Transaction Approved to Personal Ledger", 'success');
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
                type: sms.transaction_type === 'credit' ? 'credit' : 'debit',
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

    const handleRunSimulation = async (pushQueue = false) => {
        if (!simText.trim()) {
            notify("Please enter SMS text to test", 'error');
            return;
        }
        if (pushQueue) setPushingToQueue(true);
        else setSimLoading(true);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/sms/simulate`, {
                text: simText,
                sender: simSender,
                pushToQueue: pushQueue
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSimResult(res.data);
            if (pushQueue) {
                notify("Extracted transaction pushed to Pending Inbox!", 'success');
                fetchPending();
            } else {
                notify(`Parsed successfully via ${res.data.source}`, 'success');
            }
        } catch (e) {
            notify("Simulation failed: " + (e.response?.data?.error || e.message), 'error');
        } finally {
            setSimLoading(false);
            setPushingToQueue(false);
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
        <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'} p-4 sm:p-8 transition-colors duration-200`}>
            
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
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                                Automation Spot & Companion Hub
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400 font-medium">
                                Autonomous SMS Transaction Ingestion, AI NLP Entity Extraction & Android Sync
                            </p>
                        </div>
                    </div>
                </div>

                {/* Telemetry Status Bar */}
                <div className="flex flex-wrap items-center gap-2.5 p-2 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md shadow-xl">
                    {/* Node SMS Gateway */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Node Gateway</span>
                            <span className="text-[11px] font-extrabold text-emerald-400">ONLINE</span>
                        </div>
                    </div>

                    {/* Python AI Extractor Service */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <Terminal className="w-3.5 h-3.5" style={{ color: getHealthColor(health.python) }} />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Python AI Extractor</span>
                            <span className="text-[11px] font-extrabold uppercase" style={{ color: getHealthColor(health.python) }}>
                                {health.python}
                            </span>
                        </div>
                        {health.python !== 'online' && health.python !== 'restarting' && (
                            <button
                                onClick={handleRestartPython}
                                className={`ml-1 px-2 py-1 rounded-lg text-[10px] font-bold text-white transition-all ${
                                    confirmAction?.type === 'restart' ? 'bg-amber-600 animate-pulse' : 'bg-rose-600 hover:bg-rose-500'
                                }`}
                            >
                                {confirmAction?.type === 'restart' ? 'Confirm?' : 'Restart'}
                            </button>
                        )}
                    </div>

                    {/* Android Companion Sync */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Android Companion</span>
                            <span className="text-[11px] font-extrabold text-slate-200">
                                {isDeviceApproved ? (deviceStatus === 'online' ? 'SYNCED' : 'PAIRED') : 'NOT PAIRED'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Segmented Navigation Tab Bar */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
                    {/* Tab 1: SMS Inbox */}
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
                            activeTab === 'pending'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
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
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
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

                    {/* Tab 3: Interactive Sandbox */}
                    <button
                        onClick={() => setActiveTab('simulator')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            activeTab === 'simulator'
                                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`}
                    >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>SMS Parser Simulator</span>
                    </button>

                    {/* Tab 4: Android Connect & Security */}
                    <button
                        onClick={() => setActiveTab('connect')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            activeTab === 'connect'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
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
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                            <div className="relative w-full sm:w-80">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search bank, merchant or amount..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none cursor-pointer"
                                >
                                    <option value="ALL">All Categories</option>
                                    {categories.map(c => (
                                        <option key={c.id || c.name} value={c.name}>{c.name}</option>
                                    ))}
                                </select>

                                <button
                                    onClick={fetchPending}
                                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
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
                            <div className="p-16 flex flex-col items-center justify-center rounded-2xl bg-slate-900/50 border border-slate-800">
                                <Loader className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                                <span className="text-xs text-slate-400 font-medium">Scanning pending transactions...</span>
                            </div>
                        ) : smsList.length === 0 ? (
                            <div className="text-center p-16 rounded-2xl bg-slate-900/40 border border-slate-800">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                                    <CheckCheck className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-100 mb-1">Inbox Zero & Ledger Synced</h3>
                                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                                    No pending SMS transactions waiting for review. New transactions received by your Android companion will appear here in real-time.
                                </p>
                                <button
                                    onClick={() => setActiveTab('simulator')}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                                >
                                    <Sparkles className="w-4 h-4 text-amber-400" /> Test SMS with Parser Simulator
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
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                            <div>
                                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                    <Pencil className="w-4 h-4 text-purple-400" />
                                    Mobile App Companion Entries ({manualList.length})
                                </h2>
                                <p className="text-xs text-slate-400">
                                    Transactions captured manually on your mobile companion for immediate review
                                </p>
                            </div>
                            <button
                                onClick={fetchPending}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="p-16 flex flex-col items-center justify-center rounded-2xl bg-slate-900/50 border border-slate-800">
                                <Loader className="w-8 h-8 text-purple-400 animate-spin mb-3" />
                                <span className="text-xs text-slate-400 font-medium">Loading companion entries...</span>
                            </div>
                        ) : manualList.length === 0 ? (
                            <div className="text-center p-16 rounded-2xl bg-slate-900/40 border border-slate-800">
                                <div className="w-16 h-16 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                                    <Smartphone className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-100 mb-1">No Pending Mobile Entries</h3>
                                <p className="text-xs text-slate-400 max-w-sm mx-auto">
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

                {/* 3. INTERACTIVE SMS & REGEX PARSER SIMULATOR */}
                {activeTab === 'simulator' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Input & Preset Sandbox (Left Column) */}
                        <div className="lg:col-span-6 space-y-5">
                            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                                <div>
                                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-amber-400" />
                                        Interactive SMS NLP Sandbox
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Select a real-world bank template or paste raw bank SMS text to evaluate entity extraction.
                                    </p>
                                </div>

                                {/* Preset Bank Buttons */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Sample Bank Templates
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {SAMPLE_TEMPLATES.map((tmpl, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setSimText(tmpl.text);
                                                    setSimSender(tmpl.sender);
                                                    setSimResult(null);
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                    simText === tmpl.text
                                                        ? 'bg-blue-600/30 text-blue-300 border-blue-500 shadow-sm'
                                                        : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                                                }`}
                                            >
                                                {tmpl.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Raw SMS Textarea */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            Raw SMS Payload
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-500">Sender ID:</span>
                                            <input
                                                type="text"
                                                value={simSender}
                                                onChange={(e) => setSimSender(e.target.value)}
                                                className="w-24 px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 text-center uppercase"
                                                placeholder="HDFCBK"
                                            />
                                        </div>
                                    </div>
                                    <textarea
                                        rows={5}
                                        value={simText}
                                        onChange={(e) => setSimText(e.target.value)}
                                        placeholder="Paste transaction SMS message here..."
                                        className="w-full p-3.5 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-xs font-mono text-slate-200 outline-none leading-relaxed resize-none shadow-inner"
                                    />
                                </div>

                                {/* Simulation Controls */}
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleRunSimulation(false)}
                                        disabled={simLoading || pushingToQueue}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                    >
                                        {simLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                        Run AI & Regex Parser
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleRunSimulation(true)}
                                        disabled={simLoading || pushingToQueue}
                                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                    >
                                        {pushingToQueue ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        Parse & Push to Inbox
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Extraction Inspector & Diagnostics (Right Column) */}
                        <div className="lg:col-span-6 space-y-5">
                            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 min-h-[380px]">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-emerald-400" />
                                            Live Extraction Inspector
                                        </h3>
                                        <p className="text-xs text-slate-400">Structured JSON output and entity classification</p>
                                    </div>
                                    {simResult && (
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                            simResult.source.includes('python') 
                                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                        }`}>
                                            Engine: {simResult.source}
                                        </span>
                                    )}
                                </div>

                                {!simResult ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <Terminal className="w-12 h-12 text-slate-700 mb-3" />
                                        <h4 className="text-sm font-semibold text-slate-300 mb-1">Awaiting Test Execution</h4>
                                        <p className="text-xs text-slate-500 max-w-xs">
                                            Click "Run AI & Regex Parser" to observe entity recognition and structured payload mapping.
                                        </p>
                                    </div>
                                ) : simResult.extracted && simResult.extracted.length > 0 ? (
                                    <div className="space-y-4">
                                        {/* Structured Badges */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                                <span className="text-[10px] font-bold uppercase text-slate-500 block">Amount</span>
                                                <span className="text-base font-black text-emerald-400">
                                                    {formatCurrency(simResult.extracted[0].amount, user?.currency || 'INR')}
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                                <span className="text-[10px] font-bold uppercase text-slate-500 block">Direction</span>
                                                <span className={`text-xs font-extrabold uppercase ${
                                                    simResult.extracted[0].transaction_type === 'credit' ? 'text-emerald-400' : 'text-rose-400'
                                                }`}>
                                                    {simResult.extracted[0].transaction_type}
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                                <span className="text-[10px] font-bold uppercase text-slate-500 block">Merchant</span>
                                                <span className="text-xs font-bold text-slate-200 truncate block">
                                                    {simResult.extracted[0].merchant || 'Unknown'}
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                                <span className="text-[10px] font-bold uppercase text-slate-500 block">Category</span>
                                                <span className="text-xs font-bold text-purple-400 truncate block">
                                                    {simResult.extracted[0].category || 'General'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Raw JSON Code Block */}
                                        <div>
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                                Extracted JSON Node
                                            </span>
                                            <pre className="p-3.5 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto border border-slate-800 max-h-60 leading-relaxed shadow-inner">
                                                {JSON.stringify(simResult.extracted[0], null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                                        <p className="font-bold mb-1">No financial entities extracted</p>
                                        <p className="text-slate-400">The message did not match any active transaction regex rules or NLP patterns.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. ANDROID PAIRING, TOTP & HARDWARE SECURITY */}
                {activeTab === 'connect' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Device Status Hero Card */}
                        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-2xl">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                                        <Smartphone className="w-6 h-6 text-blue-400" />
                                        Android Companion Synchronization
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
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
                                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Paired Device Model</span>
                                            <span className="text-sm font-extrabold text-white mt-1 block">
                                                {deviceInfo?.manufacturer || 'Android'} {deviceInfo?.model || 'Device'}
                                            </span>
                                            <span className="text-[11px] font-mono text-slate-400 mt-0.5 block truncate">
                                                ID: {deviceInfo?.androidId || 'Encrypted Token'}
                                            </span>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Last Sync Heartbeat</span>
                                            <span className="text-sm font-extrabold text-emerald-400 mt-1 block">
                                                {lastSyncDate ? new Date(lastSyncDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Continuous'}
                                            </span>
                                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                                                {lastSyncDate ? new Date(lastSyncDate).toLocaleDateString() : 'Active Webhook'}
                                            </span>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Encryption Standard</span>
                                            <span className="text-sm font-extrabold text-indigo-300 mt-1 block flex items-center gap-1.5">
                                                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                                AES-256-GCM + HMAC
                                            </span>
                                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                                                Zero-Knowledge Payload
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                        <button
                                            onClick={() => { fetchConfig(); fetchHealth(); }}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
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
                                    <div className="md:col-span-5 flex flex-col items-center text-center p-6 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
                                        <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-emerald-500/80 mb-4">
                                            {qrLoading ? (
                                                <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-400">
                                                    <Loader className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                                                    <span className="text-xs">Generating Pairing Token...</span>
                                                </div>
                                            ) : qrCodeUrl ? (
                                                <img
                                                    src={qrCodeUrl}
                                                    alt="Pairing QR Code"
                                                    className="w-48 h-48 rounded-lg"
                                                />
                                            ) : (
                                                <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-400">
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
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                                                Open PEM Android Companion App on your mobile device
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                                                Tap "Scan Web Setup QR" and point camera at the QR code
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                                                Enter the 6-digit sync code displayed on your phone below:
                                            </div>
                                        </div>

                                        {/* 6-Digit TOTP Input Box */}
                                        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                Companion TOTP Security Code
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    placeholder="123456"
                                                    value={verifyCode}
                                                    onChange={handleCodeInputChange}
                                                    className="flex-1 px-4 py-3 bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-xl text-center text-xl font-mono font-black tracking-widest text-emerald-400 outline-none"
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
                        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <Key className="w-5 h-5 text-indigo-400" />
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-100">Manual Webhook & Encryption Credentials</h3>
                                        <p className="text-xs text-slate-400">For custom Automate, Tasker, or iOS Shortcuts integration</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowKeys(!showKeys)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                                >
                                    {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    {showKeys ? 'Hide Keys' : 'Reveal Keys'}
                                </button>
                            </div>

                            {showKeys && (
                                <div className="space-y-3 pt-2">
                                    {/* Webhook URL */}
                                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SMS Webhook URL</span>
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
                                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SMS API Secret Key</span>
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
                                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AES-256 Payload Key</span>
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
    const isCredit = sms.transaction_type === 'credit';
    const isProcessing = processingId === sms.id;
    const [showRaw, setShowRaw] = useState(false);

    return (
        <div className={`group relative p-4 sm:p-5 rounded-2xl transition-all duration-200 border ${
            isManual
                ? 'bg-slate-900/90 border-purple-500/30 hover:border-purple-500/60 shadow-lg shadow-purple-500/5'
                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-lg'
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
                            <h4 className="text-sm sm:text-base font-extrabold text-white truncate">
                                {sms.merchant || sms.provider || sms.account || 'Unknown Merchant'}
                            </h4>
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                {sms.date || (sms.received_at ? new Date(sms.received_at).toLocaleDateString() : 'Today')}
                            </span>
                            {isManual && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Mobile App
                                </span>
                            )}
                            {sms.extractor && (
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-950 text-emerald-400 border border-emerald-500/30">
                                    {sms.extractor}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 truncate max-w-xl">
                            {sms.description || sms.raw_message || 'Transaction received via automated feed'}
                        </p>
                    </div>
                </div>

                {/* Center: Amount & Category Badge */}
                <div className="text-left md:text-right shrink-0 px-2">
                    <div className={`text-lg sm:text-xl font-black ${
                        isCredit ? 'text-emerald-400' : 'text-slate-100'
                    }`}>
                        {isCredit ? '+' : '-'} {formatCurrency(sms.amount, user?.currency || 'INR')}
                    </div>
                    <div className="flex items-center md:justify-end gap-1.5 text-[11px] font-bold text-slate-400 mt-0.5">
                        <span className="text-purple-400">{sms.category || 'General'}</span>
                        <span>•</span>
                        <span className="text-slate-500 uppercase">{sms.paymentMethod || sms.mode || 'UPI'}</span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    {/* Toggle Raw Message */}
                    <button
                        type="button"
                        onClick={() => setShowRaw(!showRaw)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                        title="View Raw Message"
                    >
                        <FileText className="w-4 h-4" />
                    </button>

                    {/* Edit Details */}
                    <button
                        type="button"
                        onClick={onEdit}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
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
                        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                            <select
                                value={selectedCardMap[sms.id] || cards[0].id}
                                onChange={(e) => setSelectedCardMap(prev => ({ ...prev, [sms.id]: e.target.value }))}
                                className="px-2 py-1 bg-transparent text-xs text-slate-200 font-semibold outline-none cursor-pointer max-w-[120px] truncate"
                            >
                                {cards.map(c => (
                                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
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
                <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <p className="text-xs font-mono text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed whitespace-pre-wrap break-all">
                        {sms.raw_message || sms.description || 'No raw string available'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default Automation;
