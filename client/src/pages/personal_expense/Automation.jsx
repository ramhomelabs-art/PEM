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
    SlidersHorizontal, Mail, Bell, Clock, TrendingDown, TrendingUp,
    ChevronRight, MoreHorizontal, CheckSquare, Square, X,
    Layers, ExternalLink, Calendar, Building2
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import axios from 'axios';
import AutomationDetailsModal from '../../components/personal_expense/AutomationDetailsModal';
import { API_URL } from '../../config';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';
import { formatCurrency } from '../../utils/currency';

export const isManualTransaction = (s) => {
    if (!s) return false;
    if (s.source === 'MANUAL_ENTRY' || s.source === 'APP' || s.source === 'MANUAL' || s.source === 'COMPANION') return true;
    if (s.type === 'MANUAL') return true;
    if (s.tag === 'direct_manual' || s.tag === 'manual' || (typeof s.tag === 'string' && s.tag.toLowerCase().includes('manual'))) return true;
    const raw = `${s.raw_message || ''} ${s.description || ''}`.toLowerCase();
    if (raw.includes('manual expense:') || raw.includes('manual entry:')) return true;
    return false;
};

export const isCardTransaction = (sms) => {
    if (!sms) return false;
    if (sms.isCreditCard === true || sms.isDebitCard === true) return true;
    const mode = String(sms.mode || '').toUpperCase();
    const pMethod = String(sms.paymentMethod || '').toUpperCase();
    const pMode = String(sms.paymentMode || '').toUpperCase();
    if (mode.includes('CARD') || pMethod.includes('CARD') || pMode.includes('CARD')) return true;
    const text = `${sms.raw_message || ''} ${sms.description || ''} ${sms.merchant || ''} ${sms.account || ''}`.toLowerCase();
    if (
        text.includes('credit card') ||
        text.includes('creditcard') ||
        text.includes('debit card') ||
        text.includes('debitcard') ||
        text.includes('spent on card') ||
        text.includes('spent on your card') ||
        text.includes('cc spent') ||
        text.includes('credit limit') ||
        text.includes('available limit') ||
        text.includes('avl lmt') ||
        /\bcard\s+(?:no\.?\s*)?(?:ending|x{2,}|\*{2,})\b/i.test(text) ||
        /\b(?:visa|mastercard|amex|diners)\b/i.test(text)
    ) {
        return true;
    }
    return false;
};

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
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [expandedGroups, setExpandedGroups] = useState({ bills: true, today: true, week: true, older: true });
    const [detailItem, setDetailItem] = useState(null);
    const [clearAllConfirm, setClearAllConfirm] = useState(false);

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

    // Email Digest State
    const [digest, setDigest] = useState(null);
    const [digestLoading, setDigestLoading] = useState(false);
    const [digestSaving, setDigestSaving] = useState(false);
    const [digestSending, setDigestSending] = useState(false);
    const [digestViewMode, setDigestViewMode] = useState('cards'); // 'cards' | 'email'
    const [digestFilter, setDigestFilter] = useState('all'); // 'all' | 'bills' | 'expenses' | 'income' | 'notifications'
    const [digestSearch, setDigestSearch] = useState('');
    const [expandedDigestRaw, setExpandedDigestRaw] = useState({});

    // Navigation Tab
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'manual' | 'connect' | 'digest'
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

    const fetchDigest = async () => {
        setDigestLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/notifications/digest/preview`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDigest(res.data);
        } catch (e) {
            console.error('Digest preview fetch failed', e);
        } finally {
            setDigestLoading(false);
        }
    };

    const toggleDigest = async () => {
        if (!digest) return;
        const nextEnabled = !digest.enabled;
        setDigestSaving(true);
        // Optimistic update
        setDigest(prev => (prev ? { ...prev, enabled: nextEnabled } : prev));
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/notifications/digest/preference`, { enabled: nextEnabled }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            notify(nextEnabled ? 'Pending email digest enabled' : 'Pending email digest disabled', 'success');
            fetchDigest();
        } catch (e) {
            setDigest(prev => (prev ? { ...prev, enabled: !nextEnabled } : prev));
            notify('Failed to update digest preference', 'error');
        } finally {
            setDigestSaving(false);
        }
    };

    const sendDigestNow = async () => {
        setDigestSending(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/notifications/digest/send`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.delivered) {
                notify('Pending digest emailed to you', 'success');
            } else if (res.data?.sent) {
                notify('Digest generated but email is not configured on the server', 'warning', 5000);
            }
            fetchDigest();
        } catch (e) {
            notify(e.response?.data?.error || 'Failed to send digest email', 'error');
        } finally {
            setDigestSending(false);
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
        fetchDigest();
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
        if (activeTab === 'digest') {
            fetchDigest();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                source: isManualTransaction(sms) ? 'app' : 'sms',
                mode: sms.mode
            });

            await axios.delete(`${API_URL}/sms/reject/${sms.id}`);
            setPendingSMS(prev => prev.filter(p => p.id !== sms.id));
            notify("Transaction Approved to Personal Ledger", 'success');
            notifyDataChanged("transactions");
            notifyDataChanged("bills");
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

    const performClearAll = async () => {
        setClearAllConfirm(false);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/sms/batch-reject-all`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPendingSMS([]);
            setSelectedIds(new Set());
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

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleBatchRejectSelected = async () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        for (const id of ids) {
            try { await handleReject(id); } catch { /* handled in handleReject */ }
        }
        setSelectedIds(new Set());
    };

    const handleBatchApproveSelected = async () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        for (const id of ids) {
            const s = pendingSMS.find(x => x.id === id);
            if (!s) continue;
            try { await handleApprove(s); } catch { /* handled in handleApprove */ }
        }
        setSelectedIds(new Set());
    };

    // Filter lists
    const smsList = useMemo(() => {
        return pendingSMS.filter(s => {
            const isManual = isManualTransaction(s);
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

    // Grouped for SMS approval inbox
    const groupedSms = useMemo(() => {
        const bills = [];
        const today = [];
        const week = [];
        const older = [];
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
        let totalPending = 0;
        let billsDueCount = 0;
        for (const s of smsList) {
            const amt = Number(s.amount || 0);
            totalPending += isFinite(amt) ? amt : 0;
            const due = s.dueDate ? new Date(s.dueDate) : null;
            if (due && !isNaN(due.getTime()) && !s.isBillPaymentReceipt && s.isBill !== false) {
                bills.push(s);
                if (due <= startOfToday && !s.isScheduledMandate) billsDueCount += 1;
                continue;
            }
            const d = s.date ? new Date(s.date) : (s.received_at ? new Date(s.received_at) : null);
            if (!d || isNaN(d.getTime())) {
                older.push(s); continue;
            }
            if (d >= startOfToday) { today.push(s); continue; }
            if (d >= startOfWeek) { week.push(s); continue; }
            older.push(s);
        }
        bills.sort((a,b) => { const da=new Date(a.dueDate||0).getTime(); const db=new Date(b.dueDate||0).getTime(); return da-db; });
        today.sort((a,b) => { const da=new Date(a.date||a.received_at||0).getTime(); const db=new Date(b.date||b.received_at||0).getTime(); return db-da; });
        week.sort((a,b) => { const da=new Date(a.date||a.received_at||0).getTime(); const db=new Date(b.date||b.received_at||0).getTime(); return db-da; });
        older.sort((a,b) => { const da=new Date(a.date||a.received_at||0).getTime(); const db=new Date(b.date||b.received_at||0).getTime(); return db-da; });
        return { bills, today, week, older, totalPending, billsDueCount };
    }, [smsList]);

    const inboxGroups = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sumOf = (arr) => arr.reduce((acc, s) => acc + (isFinite(Number(s.amount)) ? Number(s.amount) : 0), 0);
        return [
            { id: 'bills', title: 'Bills & Scheduled AutoPay', items: groupedSms.bills, total: sumOf(groupedSms.bills), overdue: groupedSms.bills.some(b => { const d = new Date(b.dueDate); return !isNaN(d.getTime()) && d <= startOfToday && !b.isScheduledMandate; }) },
            { id: 'today', title: 'Today', items: groupedSms.today, total: sumOf(groupedSms.today) },
            { id: 'week', title: 'Last 7 Days', items: groupedSms.week, total: sumOf(groupedSms.week) },
            { id: 'older', title: 'Older', items: groupedSms.older, total: sumOf(groupedSms.older) }
        ].filter(g => g.items.length > 0);
    }, [groupedSms]);

    const manualList = useMemo(() => {
        return pendingSMS.filter(s => {
            const isManual = isManualTransaction(s);
            if (!isManual) return false;
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

            {/* Side panel for inline detail review */}
            <SmsDetailPanel
                item={detailItem}
                user={user}
                cards={cards}
                selectedCardMap={selectedCardMap}
                setSelectedCardMap={setSelectedCardMap}
                processingId={processingId}
                onApprove={handleApprove}
                onApproveToCard={handleApproveToCard}
                onReject={handleReject}
                onEdit={(sms) => { setDetailItem(null); setEditingItem(sms); }}
                onClose={() => setDetailItem(null)}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-surface/90 shadow-xl backdrop-blur-md">
                    {/* Tab 1: SMS Inbox */}
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
                            activeTab === 'pending'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-[0_4px_16px_rgba(16,185,129,0.35)]'
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
                                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black shadow-[0_4px_16px_rgba(20,184,166,0.35)]'
                                : 'text-ink-muted hover:text-ink hover:bg-line'
                        }`}
                    >
                        <Pencil className="w-4 h-4" />
                        <span>Cash / manual spend</span>
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
                                ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-black shadow-[0_4px_16px_rgba(6,182,212,0.35)]'
                                : 'text-ink-muted hover:text-ink hover:bg-line'
                        }`}
                    >
                        <QrCode className="w-4 h-4" />
                        <span>Android Pairing & Keys</span>
                    </button>

                    {/* Tab 4: Email Digest */}
                    <button
                        onClick={() => setActiveTab('digest')}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
                            activeTab === 'digest'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black shadow-[0_4px_16px_rgba(16,185,129,0.35)]'
                                : 'text-ink-muted hover:text-ink hover:bg-line'
                        }`}
                    >
                        <Mail className="w-4 h-4" />
                        <span>Email Digest</span>
                        {digest && digest.counts?.total > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white shadow-sm">
                                {digest.counts.total}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="max-w-7xl mx-auto">

                {/* 1. SMS APPROVAL INBOX */}
                {activeTab === 'pending' && (
                    <div className={`space-y-4 ${selectedIds.size > 0 ? 'pb-24' : ''}`}>
                        {/* Summary Strip */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-4 rounded-2xl bg-surface/80 border border-line">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Pending</span>
                                </div>
                                <div className="mt-2 text-2xl font-black text-ink">{smsList.length}</div>
                            </div>
                            <div className="p-4 rounded-2xl bg-surface/80 border border-line">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-indigo-400" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Pending Amount</span>
                                </div>
                                <div className="mt-2 text-2xl font-black text-ink truncate">{formatCurrency(groupedSms.totalPending, user?.currency || 'INR')}</div>
                            </div>
                            <div className="p-4 rounded-2xl bg-surface/80 border border-line">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-400" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Bills Due / Overdue</span>
                                </div>
                                <div className="mt-2 text-2xl font-black text-ink">{groupedSms.billsDueCount}</div>
                            </div>
                        </div>

                        {/* Search + Filter Chips Toolbar */}
                        <div className="p-4 rounded-2xl bg-surface/80 border border-line space-y-3">
                            <div className="flex items-center gap-2.5">
                                <div className="relative flex-1 min-w-0">
                                    <Search className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search bank, merchant or amount..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-sunken/80 border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <button
                                    onClick={fetchPending}
                                    className="p-2 rounded-xl bg-raised hover:bg-line text-ink-muted transition-colors shrink-0"
                                    title="Refresh Inbox"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                                {smsList.length > 0 && (
                                    <button
                                        onClick={() => setClearAllConfirm(true)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors shrink-0"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Clear All</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                                {['ALL', ...categories.map(c => c.name)].map((name) => {
                                    const active = filterCategory === name;
                                    return (
                                        <button
                                            key={name}
                                            onClick={() => setFilterCategory(name)}
                                            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                                                active
                                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-raised text-ink-muted border-line hover:text-ink'
                                            }`}
                                        >
                                            {name === 'ALL' ? 'All' : name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Grouped List */}
                        {loading ? (
                            <div className="space-y-4">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="rounded-2xl bg-surface/60 border border-line overflow-hidden">
                                        <div className="h-11 bg-raised/60 pem-skeleton" />
                                        <div className="p-3 space-y-2">
                                            <div className="h-12 rounded-xl pem-skeleton" />
                                            <div className="h-12 rounded-xl pem-skeleton" />
                                        </div>
                                    </div>
                                ))}
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
                            <div className="space-y-4">
                                {inboxGroups.map(group => {
                                    const isOpen = expandedGroups[group.id] !== false;
                                    return (
                                        <div key={group.id} className="rounded-2xl bg-surface/70 border border-line overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedGroups(p => ({ ...p, [group.id]: !(p[group.id] !== false) }))}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-raised/40 transition-colors"
                                            >
                                                <ChevronRight className={`w-4 h-4 text-ink-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${group.overdue ? 'bg-rose-400' : 'bg-ink-faint'}`} />
                                                <span className="text-sm font-bold text-ink">{group.title}</span>
                                                {group.overdue && (
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">Overdue</span>
                                                )}
                                                <span className="ml-auto flex items-center gap-3 shrink-0">
                                                    <span className="text-[11px] font-bold text-ink-muted">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                                                    <span className="text-xs font-black text-ink-muted">{formatCurrency(group.total, user?.currency || 'INR')}</span>
                                                </span>
                                            </button>
                                            {isOpen && (
                                                <div className="px-3 pb-3 space-y-2">
                                                    {group.items.map(sms => (
                                                        <SmsInboxRow
                                                            key={sms.id}
                                                            sms={sms}
                                                            user={user}
                                                            processingId={processingId}
                                                            selected={selectedIds.has(sms.id)}
                                                            onToggleSelect={toggleSelect}
                                                            onEdit={() => setEditingItem(sms)}
                                                            onReject={handleReject}
                                                            onApprove={handleApprove}
                                                            onOpenDetail={() => setDetailItem(sms)}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Sticky Multi-Select Action Bar */}
                        {selectedIds.size > 0 && (
                            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-2xl bg-surface border border-line shadow-2xl">
                                <span className="px-2 text-xs font-bold text-ink whitespace-nowrap">{selectedIds.size} selected</span>
                                <button
                                    onClick={handleBatchApproveSelected}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
                                >
                                    <Check className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Approve</span> selected
                                </button>
                                <button
                                    onClick={handleBatchRejectSelected}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors"
                                >
                                    <XCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reject</span> selected
                                </button>
                                <button
                                    onClick={() => setSelectedIds(new Set())}
                                    className="p-2 rounded-xl hover:bg-line text-ink-muted transition-colors"
                                    title="Clear selection"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Clear All Confirmation */}
                        <ConfirmDialog
                            isOpen={clearAllConfirm}
                            onConfirm={performClearAll}
                            onCancel={() => setClearAllConfirm(false)}
                            title="Clear entire inbox?"
                            message={`This will dismiss all ${smsList.length} pending SMS records. This action cannot be undone.`}
                        />
                    </div>
                )}

                {/* 2. CASH / MANUAL SPEND */}
                {activeTab === 'manual' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-surface/80 border border-line">
                            <div>
                                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                                    <Pencil className="w-4 h-4 text-purple-400" />
                                    Cash / manual spend ({manualList.length})
                                </h2>
                                <p className="text-xs text-ink-muted">
                                    Cash and manual transactions captured on your companion app or web for immediate review
                                </p>
                            </div>
                            <button
                                onClick={fetchPending}
                                className="p-2 rounded-xl bg-raised hover:bg-line text-ink-muted transition-colors"
                                title="Refresh Cash & Manual Entries"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="p-16 flex flex-col items-center justify-center rounded-2xl bg-surface/50 border border-line">
                                <Loader className="w-8 h-8 text-purple-400 animate-spin mb-3" />
                                <span className="text-xs text-ink-muted font-medium">Loading cash / manual spend entries...</span>
                            </div>
                        ) : manualList.length === 0 ? (
                            <div className="text-center p-16 rounded-2xl bg-surface/40 border border-line">
                                <div className="w-16 h-16 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                                    <Smartphone className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-ink mb-1">No Pending Cash / Manual Entries</h3>
                                <p className="text-xs text-ink-muted max-w-sm mx-auto">
                                    You can record cash and rapid manual expenses directly on your mobile companion or web.
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
                        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-surface via-surface to-indigo-500/10 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 border border-line shadow-card md:shadow-raised">
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
                                            {webhookUrl}?apiKey={smsApiKey || 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}
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
                                            {smsApiKey || 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}
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
                                            {encryptionKey || 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}
                                        </code>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. EMAIL DIGEST */}
                {activeTab === 'digest' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Hero / Toggle Card */}
                        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-surface via-surface to-fuchsia-500/10 dark:from-slate-900 dark:via-slate-900 dark:to-fuchsia-950/40 border border-line shadow-card md:shadow-raised">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-line">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-pink-600 text-white shadow-lg shadow-fuchsia-500/20">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight">Pending Items Email Digest</h2>
                                        <p className="text-xs sm:text-sm text-ink-muted mt-1">
                                            A branded summary of your unreviewed transactions &amp; notifications, sent to {digest?.email || user?.email || 'your email'}.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold ${digest?.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted'}`}>
                                        {digest?.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={toggleDigest}
                                        disabled={digestSaving || !digest}
                                        className={`relative inline-flex items-center w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${digest?.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                        title={digest?.enabled ? 'Disable digest' : 'Enable digest'}
                                    >
                                        <span className={`inline-block w-6 h-6 transform bg-white rounded-full shadow transition-transform ${digest?.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>

                            {digest?.mailConfigured === false && (
                                <div className="mt-5 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs">
                                    <HelpCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>SMTP is not configured on the server yet. Ask an admin to configure outbound email in Settings &rarr; Profile, otherwise digests are only written to the server log.</span>
                                </div>
                            )}

                            {/* Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-6">
                                <div className="p-4 rounded-2xl bg-surface/80 dark:bg-sunken/70 border border-line shadow-sm">
                                    <div className="flex items-center gap-1.5 text-ink-faint">
                                        <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Expenses</span>
                                    </div>
                                    <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1.5">{formatCurrency(digest?.summary?.expenseTotal ?? 0, user?.currency || 'INR')}</div>
                                    <div className="text-[11px] text-ink-muted mt-0.5">{digest?.counts?.expenses ?? 0} unapproved</div>
                                </div>
                                <div className="p-4 rounded-2xl bg-surface/80 dark:bg-sunken/70 border border-line shadow-sm">
                                    <div className="flex items-center gap-1.5 text-ink-faint">
                                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Bills & AutoPay</span>
                                    </div>
                                    <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1.5">{formatCurrency(digest?.summary?.billsTotal ?? 0, user?.currency || 'INR')}</div>
                                    <div className="text-[11px] text-ink-muted mt-0.5">{digest?.counts?.bills ?? 0} scheduled</div>
                                </div>
                                <div className="p-4 rounded-2xl bg-surface/80 dark:bg-sunken/70 border border-line shadow-sm">
                                    <div className="flex items-center gap-1.5 text-ink-faint">
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Income</span>
                                    </div>
                                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">{formatCurrency(digest?.summary?.incomeTotal ?? 0, user?.currency || 'INR')}</div>
                                    <div className="text-[11px] text-ink-muted mt-0.5">{digest?.counts?.income ?? 0} credit(s)</div>
                                </div>
                                <div className="p-4 rounded-2xl bg-surface/80 dark:bg-sunken/70 border border-line shadow-sm">
                                    <div className="flex items-center gap-1.5 text-ink-faint">
                                        <Bell className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Alerts</span>
                                    </div>
                                    <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1.5">{digest?.counts?.notifications ?? 0}</div>
                                    <div className="text-[11px] text-ink-muted mt-0.5">action needed</div>
                                </div>
                                <div className="p-4 rounded-2xl bg-surface/80 dark:bg-sunken/70 border border-line shadow-sm col-span-2 md:col-span-1">
                                    <div className="flex items-center gap-1.5 text-ink-faint">
                                        <Clock className="w-3.5 h-3.5 text-fuchsia-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Schedule</span>
                                    </div>
                                    <div className="text-sm font-extrabold text-ink mt-2 truncate">
                                        {digest?.lastSentAt ? new Date(digest.lastSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never sent'}
                                    </div>
                                    <div className="text-[11px] text-ink-muted mt-0.5">
                                        Every {digest?.intervalMinutes ? Math.round(digest.intervalMinutes / 60) : 24}h
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
                                <button
                                    type="button"
                                    onClick={fetchDigest}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-raised text-ink border border-line text-xs font-bold transition-colors shadow-sm"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${digestLoading ? 'animate-spin' : ''}`} /> Refresh Preview
                                </button>

                                <button
                                    type="button"
                                    onClick={sendDigestNow}
                                    disabled={digestSending}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-fuchsia-500/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {digestSending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Email Me The Digest Now
                                </button>
                            </div>
                        </div>

                        {/* Digest Preview Card */}
                        <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-6">
                            {/* Card Header with View Mode Switcher */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-pink-600 text-white shadow-md shadow-fuchsia-500/20">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-extrabold text-ink">Digest Preview &amp; Telemetry</h3>
                                        <p className="text-xs text-ink-muted">A live sneak peek of your daily automated email digest and SMS pending ledger.</p>
                                    </div>
                                </div>

                                {/* View Switcher */}
                                <div className="flex items-center p-1 rounded-xl bg-sunken border border-line self-stretch sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => setDigestViewMode('cards')}
                                        className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            digestViewMode === 'cards'
                                                ? 'bg-surface text-ink shadow-sm'
                                                : 'text-ink-muted hover:text-ink'
                                        }`}
                                    >
                                        <Layers className="w-3.5 h-3.5" /> Detailed Cards
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDigestViewMode('email')}
                                        className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            digestViewMode === 'email'
                                                ? 'bg-surface text-ink shadow-sm'
                                                : 'text-ink-muted hover:text-ink'
                                        }`}
                                    >
                                        <Eye className="w-3.5 h-3.5" /> Live Email View
                                    </button>
                                </div>
                            </div>

                            {digestLoading && !digest ? (
                                <div className="py-16 flex flex-col items-center justify-center gap-3">
                                    <Loader className="w-7 h-7 text-fuchsia-500 animate-spin" />
                                    <span className="text-xs font-bold text-ink-muted">Building digest preview from pending ledger...</span>
                                </div>
                            ) : (digest?.counts?.total ?? 0) === 0 ? (
                                <div className="text-center py-12 rounded-2xl bg-sunken/40 border border-line">
                                    <CheckCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                                    <h4 className="text-base font-bold text-ink">Nothing pending — you&apos;re all caught up!</h4>
                                    <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1">
                                        The daily digest is only dispatched when there are pending SMS transactions or alerts requiring your review.
                                    </p>
                                </div>
                            ) : digestViewMode === 'email' ? (
                                /* Live Email HTML Preview Frame */
                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-xs">
                                        <div className="flex items-center gap-2 text-fuchsia-700 dark:text-fuchsia-300 font-bold min-w-0">
                                            <Mail className="w-4 h-4 shrink-0 text-fuchsia-500" />
                                            <span className="truncate">Subject: <span className="text-ink font-extrabold">{digest?.subject || 'Daily Pending Digest'}</span></span>
                                            <span className="hidden md:inline text-fuchsia-400/60">&bull;</span>
                                            <span className="hidden md:inline text-ink-muted">To: {digest?.email || user?.email}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const w = window.open();
                                                if (w) {
                                                    w.document.write(digest?.htmlPreview || '<h3>No preview available</h3>');
                                                    w.document.close();
                                                }
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-raised text-ink border border-line text-xs font-bold transition-colors shadow-sm shrink-0"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 text-fuchsia-500" /> Fullscreen Preview
                                        </button>
                                    </div>
                                    <div className="rounded-2xl overflow-hidden border border-line shadow-2xl bg-slate-900">
                                        <iframe
                                            title="Live Email Digest Preview"
                                            srcDoc={digest?.htmlPreview || ''}
                                            className="w-full h-[760px] bg-white border-0"
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* Detailed Cards View (Mirrors SMS Approval Inbox) */
                                <div className="space-y-5">
                                    {/* Companion Telemetry Status Ribbon */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-900 text-slate-200 border border-slate-800 text-xs shadow-inner">
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                </span>
                                                Node Gateway: ONLINE
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-blue-400">
                                                <Smartphone className="w-3 h-3" /> Android Companion: SYNCED
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-purple-300">
                                                <Terminal className="w-3 h-3" /> AI Extractor: ACTIVE
                                            </span>
                                        </div>
                                        <div className="text-[11px] font-mono text-slate-400">
                                            {((digest?.bills?.length || 0) + (digest?.expenses?.length || 0) + (digest?.income?.length || 0) + (digest?.notifications?.length || 0))} items staged
                                        </div>
                                    </div>

                                    {/* Filter Pills & Search */}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                                            <button
                                                type="button"
                                                onClick={() => setDigestFilter('all')}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                                                    digestFilter === 'all'
                                                        ? 'bg-ink text-surface dark:bg-white dark:text-slate-900 shadow-sm'
                                                        : 'bg-sunken text-ink-muted hover:text-ink hover:bg-raised'
                                                }`}
                                            >
                                                All ({((digest?.bills?.length || 0) + (digest?.expenses?.length || 0) + (digest?.income?.length || 0) + (digest?.notifications?.length || 0))})
                                            </button>
                                            {(digest?.bills?.length ?? 0) > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDigestFilter('bills')}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                                                        digestFilter === 'bills'
                                                            ? 'bg-amber-500 text-white shadow-sm'
                                                            : 'bg-sunken text-ink-muted hover:text-ink hover:bg-raised'
                                                    }`}
                                                >
                                                    ⚡ Bills ({digest.bills.length})
                                                </button>
                                            )}
                                            {(digest?.expenses?.length ?? 0) > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDigestFilter('expenses')}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                                                        digestFilter === 'expenses'
                                                            ? 'bg-rose-500 text-white shadow-sm'
                                                            : 'bg-sunken text-ink-muted hover:text-ink hover:bg-raised'
                                                    }`}
                                                >
                                                    💸 Expenses ({digest.expenses.length})
                                                </button>
                                            )}
                                            {(digest?.income?.length ?? 0) > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDigestFilter('income')}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                                                        digestFilter === 'income'
                                                            ? 'bg-emerald-500 text-white shadow-sm'
                                                            : 'bg-sunken text-ink-muted hover:text-ink hover:bg-raised'
                                                    }`}
                                                >
                                                    💰 Income ({digest.income.length})
                                                </button>
                                            )}
                                            {(digest?.notifications?.length ?? 0) > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDigestFilter('notifications')}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                                                        digestFilter === 'notifications'
                                                            ? 'bg-indigo-500 text-white shadow-sm'
                                                            : 'bg-sunken text-ink-muted hover:text-ink hover:bg-raised'
                                                    }`}
                                                >
                                                    🔔 Alerts ({digest.notifications.length})
                                                </button>
                                            )}
                                        </div>

                                        <div className="relative min-w-[200px]">
                                            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={digestSearch}
                                                onChange={e => setDigestSearch(e.target.value)}
                                                placeholder="Filter preview items..."
                                                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-sunken border border-line text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-fuchsia-500 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Render Filtered Cards */}
                                    {(() => {
                                        const q = digestSearch.toLowerCase().trim();
                                        const matchesQuery = (item) => {
                                            if (!q) return true;
                                            const haystack = [
                                                item.merchant, item.provider, item.account, item.bank,
                                                item.original_sender, item.category, item.description,
                                                item.raw_message, item.title, item.body, String(item.amount || '')
                                            ].filter(Boolean).join(' ').toLowerCase();
                                            return haystack.includes(q);
                                        };

                                        // Collect items based on active filter
                                        const showBills = digestFilter === 'all' || digestFilter === 'bills';
                                        const showExpenses = digestFilter === 'all' || digestFilter === 'expenses';
                                        const showIncome = digestFilter === 'all' || digestFilter === 'income';
                                        const showAlerts = digestFilter === 'all' || digestFilter === 'notifications';

                                        const billsList = showBills ? (digest?.bills || []).filter(matchesQuery) : [];
                                        const expensesList = showExpenses ? (digest?.expenses || []).filter(matchesQuery) : [];
                                        const incomeList = showIncome ? (digest?.income || []).filter(matchesQuery) : [];
                                        const alertsList = showAlerts ? (digest?.notifications || []).filter(matchesQuery) : [];

                                        const totalCount = billsList.length + expensesList.length + incomeList.length + alertsList.length;

                                        if (totalCount === 0) {
                                            return (
                                                <div className="text-center py-10 rounded-2xl bg-sunken/40 border border-line">
                                                    <p className="text-sm font-bold text-ink">No items match your filter criteria.</p>
                                                    <p className="text-xs text-ink-muted mt-1">Try clearing the search query or selecting &quot;All&quot;.</p>
                                                </div>
                                            );
                                        }

                                        const renderTxCard = (t, type) => {
                                            const isBill = type === 'bill' || t.isBill || t.isScheduledMandate || t.mode === 'BILL' || t.isCreditCardBill;
                                            const isCredit = type === 'income' || t.transaction_type === 'credit' || t.type === 'income';
                                            const isExpanded = !!expandedDigestRaw[t.id];
                                            const mode = (t.paymentMethod || t.mode || 'UPI').toUpperCase();

                                            return (
                                                <div key={t.id || Math.random()} className="group relative p-4 rounded-2xl bg-surface/90 border border-line hover:border-line-strong transition-all shadow-sm">
                                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                        {/* Left: Icon & Details */}
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className={`p-2.5 rounded-xl shrink-0 ${
                                                                isBill
                                                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                                    : isCredit
                                                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                                            }`}>
                                                                {isBill ? (
                                                                    <FileText className="w-5 h-5" />
                                                                ) : isCredit ? (
                                                                    <ArrowUpRight className="w-5 h-5" />
                                                                ) : (
                                                                    <ArrowDownRight className="w-5 h-5" />
                                                                )}
                                                            </div>

                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                    <h4 className="text-sm sm:text-base font-extrabold text-ink truncate">
                                                                        {t.merchant || t.provider || t.account || 'Unknown Merchant'}
                                                                    </h4>
                                                                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-raised text-ink-muted">
                                                                        {t.date || (t.received_at ? new Date(t.received_at).toLocaleDateString() : 'Today')}
                                                                    </span>
                                                                    {t.bank && (
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                                                            🏦 {t.bank}
                                                                        </span>
                                                                    )}
                                                                    {t.cardLast4 && (
                                                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-raised text-ink-muted">
                                                                            Card: {t.cardLast4}
                                                                        </span>
                                                                    )}
                                                                    {t.dueDate && (
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                                            📅 Due {t.dueDate}
                                                                        </span>
                                                                    )}
                                                                    {t.isScheduledMandate && (
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                                                            ⚡ AutoPay
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <p className="text-xs text-ink-muted truncate max-w-xl">
                                                                    {t.description || t.raw_message || 'Transaction queued in pending inbox'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Center: Amount & Badges */}
                                                        <div className="text-left md:text-right shrink-0">
                                                            <div className={`text-base sm:text-lg font-black ${
                                                                isBill
                                                                    ? 'text-amber-500 dark:text-amber-400'
                                                                    : isCredit
                                                                        ? 'text-emerald-500 dark:text-emerald-400'
                                                                        : 'text-rose-500 dark:text-rose-400'
                                                            }`}>
                                                                {isBill ? '' : isCredit ? '+ ' : '- '}{formatCurrency(t.amount, user?.currency || 'INR')}
                                                            </div>
                                                            <div className="flex items-center md:justify-end gap-1.5 text-[10px] font-bold text-ink-muted mt-1 flex-wrap">
                                                                <span className="px-2 py-0.5 rounded border border-purple-500/20 bg-purple-500/10 text-purple-400">
                                                                    {t.category || 'General'}
                                                                </span>
                                                                <span className="px-2 py-0.5 rounded bg-raised text-ink-muted">
                                                                    {mode === 'BILL' ? '🧾 Bill' : mode === 'UPI' ? '⚡ UPI' : mode.includes('CARD') ? '💳 Card' : mode}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Right: Actions */}
                                                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedDigestRaw(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-raised hover:bg-line text-ink-muted hover:text-ink text-[11px] font-bold transition-colors"
                                                                title="Inspect Raw Telemetry"
                                                            >
                                                                <Terminal className="w-3.5 h-3.5 text-amber-500" />
                                                                <span className="hidden sm:inline">{isExpanded ? 'Hide SMS' : 'Raw SMS'}</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveTab('pending')}
                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-500 dark:text-fuchsia-300 border border-fuchsia-500/30 text-[11px] font-bold transition-colors"
                                                            >
                                                                Inbox &rarr;
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Expandable Raw SMS Telemetry */}
                                                    {isExpanded && (
                                                        <div className="mt-3 p-3.5 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 font-mono text-xs space-y-1.5 shadow-inner">
                                                            <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                                                                <span>Original SMS Telemetry Box</span>
                                                                <span>{t.raw_message?.length || 0} characters</span>
                                                            </div>
                                                            <div className="text-slate-300 break-words leading-relaxed select-all">
                                                                &ldquo;{t.raw_message || t.description || 'No raw SMS logged.'}&rdquo;
                                                            </div>
                                                            <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1 border-t border-slate-900 flex-wrap">
                                                                <span>Sender: {t.original_sender || t.bank || 'SMS'}</span>
                                                                <span>&bull;</span>
                                                                <span>Received: {t.received_at ? new Date(t.received_at).toLocaleString() : t.date}</span>
                                                                <span>&bull;</span>
                                                                <span>Confidence: {t.confidence || 100}%</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        };

                                        return (
                                            <div className="space-y-6">
                                                {/* Bills & Scheduled AutoPay */}
                                                {billsList.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2.5">
                                                            <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                                                                <Zap className="w-3.5 h-3.5" /> Bills &amp; Scheduled AutoPay ({billsList.length})
                                                            </h4>
                                                            <span className="text-xs font-black text-amber-500">
                                                                {formatCurrency(billsList.reduce((s, b) => s + (Number(b.amount) || 0), 0), user?.currency || 'INR')}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {billsList.map(b => renderTxCard(b, 'bill'))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Expenses */}
                                                {expensesList.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2.5">
                                                            <h4 className="text-[11px] font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                                                                <TrendingDown className="w-3.5 h-3.5" /> Pending Expenses ({expensesList.length})
                                                            </h4>
                                                            <span className="text-xs font-black text-rose-500">
                                                                - {formatCurrency(expensesList.reduce((s, e) => s + (Number(e.amount) || 0), 0), user?.currency || 'INR')}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {expensesList.map(e => renderTxCard(e, 'expense'))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Income */}
                                                {incomeList.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2.5">
                                                            <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                                                                <TrendingUp className="w-3.5 h-3.5" /> Pending Income ({incomeList.length})
                                                            </h4>
                                                            <span className="text-xs font-black text-emerald-500">
                                                                + {formatCurrency(incomeList.reduce((s, i) => s + (Number(i.amount) || 0), 0), user?.currency || 'INR')}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {incomeList.map(i => renderTxCard(i, 'income'))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Alerts */}
                                                {alertsList.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2.5">
                                                            <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                                                <Bell className="w-3.5 h-3.5" /> System Alerts &amp; Due Reminders ({alertsList.length})
                                                            </h4>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {alertsList.map((n, idx) => (
                                                                <div key={idx} className="p-4 rounded-2xl bg-surface/90 border border-line shadow-sm">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                                                            n.severity === 'critical' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                                                            : n.severity === 'warning' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                                                            : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                                                        }`}>{n.severity || 'info'}</span>
                                                                        <span className="text-sm font-bold text-ink">{n.title}</span>
                                                                    </div>
                                                                    {n.body && <div className="text-xs text-ink-muted mt-1.5">{n.body}</div>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
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
    const txType = String(sms.transaction_type || sms.type || sms.category_type || '').toLowerCase();
    const isCredit = txType === 'credit' || txType === 'income' || sms.isCredit === true;
    const isProcessing = processingId === sms.id;
    const isManualEntry = isManual || isManualTransaction(sms);
    const isCardTx = isCardTransaction(sms);
    const [showRaw, setShowRaw] = useState(false);

    return (
        <div className={`group relative p-4 sm:p-5 rounded-2xl transition-all duration-200 border ${
            isManualEntry
                ? 'bg-surface/90 border-purple-500/30 hover:border-purple-500/60 shadow-lg shadow-purple-500/5'
                : 'bg-surface/90 border-line hover:border-line shadow-lg'
        }`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                {/* Left: Icon & Merchant & Details */}
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className={`p-3 rounded-xl shrink-0 ${
                        isManualEntry
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : isCredit
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                        {isManualEntry ? (
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
                            {isManualEntry && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Cash / Manual
                                </span>
                            )}
                            {sms.isBill && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                                    ðŸ§¾ Bill {sms.dueDate ? `â€¢ Due ${sms.dueDate}` : ''}
                                </span>
                            )}
                            {(sms.isSubscription || sms.category === 'Subscription') && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    ðŸ” Subscription
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
                        isCredit ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                        {isCredit ? '+' : '-'} {formatCurrency(sms.amount, user?.currency || 'INR')}
                    </div>
                    <div className="flex items-center md:justify-end gap-1.5 text-[11px] font-bold text-ink-muted mt-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded border ${
                            sms.category === 'Utility' 
                                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                                : 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                        }`}>{sms.category || 'General'}</span>
                        {(() => {
                            const mode = (sms.paymentMethod || sms.mode || 'UPI').toUpperCase();
                            if (mode === 'BILL' || sms.isBill) return <span className="text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded border border-teal-500/25">ðŸ§¾ Bill</span>;
                            if (mode === 'UPI') return <span className="text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/25">âš¡ UPI</span>;
                            if (mode === 'NETBANKING') return <span className="text-sky-300 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/25">ðŸ¦ Netbanking</span>;
                            if (mode === 'BANK_TRANSFER' || mode === 'BANK') return <span className="text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded border border-teal-500/25">ðŸ›ï¸ Bank Transfer</span>;
                            if (mode === 'DEBIT_CARD') return <span className="text-orange-300 bg-orange-500/15 px-2 py-0.5 rounded border border-orange-500/25">ðŸ’³ Debit Card</span>;
                            if (mode === 'CREDIT_CARD' || mode === 'CREDIT CARD' || sms.isCreditCard) return <span className="text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/25">ðŸ’³ Credit Card</span>;
                            if (mode === 'BNPL' || mode.includes('LAZYPAY') || mode.includes('WALLET')) return <span className="text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/25">ðŸ›ï¸ BNPL</span>;
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

                    {/* Credit Card Selector and Approve to Card - Only show if it's a card transaction */}
                    {cards && cards.length > 0 && isCardTx && (
                        <div className="flex items-center gap-1.5 bg-sunken p-1 rounded-xl border border-line">
                            <select
                                value={selectedCardMap[sms.id] || (sms.creditCardId && cards.some(c => String(c.id) === String(sms.creditCardId)) ? sms.creditCardId : cards[0].id)}
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

const SmsInboxRow = ({ sms, user, processingId, selected, onToggleSelect, onEdit, onReject, onApprove, onOpenDetail }) => {
    const isProcessing = processingId === sms.id;
    const txType = String(sms.transaction_type || sms.type || sms.category_type || '').toLowerCase();
    const isCredit = txType === 'credit' || txType === 'income' || sms.isCredit === true;
    const [menuOpen, setMenuOpen] = useState(false);
    const dateLabel = sms.date || (sms.received_at ? new Date(sms.received_at).toLocaleDateString() : '');

    return (
        <div
            onClick={onOpenDetail}
            className={`group relative flex items-center gap-3 px-3.5 py-3 rounded-2xl border cursor-pointer transition-colors ${
                selected ? 'bg-emerald-500/5 border-emerald-500/40' : 'bg-surface/90 border-line hover:bg-raised/40'
            }`}
        >
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleSelect(sms.id); }}
                className="shrink-0 text-ink-faint hover:text-emerald-400 transition-colors"
                title={selected ? 'Deselect' : 'Select'}
            >
                {selected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
            </button>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-ink truncate flex-1">
                        {sms.merchant || sms.provider || sms.account || 'Unknown Merchant'}
                    </h4>
                    <span className={`text-sm font-black shrink-0 ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isCredit ? '+' : '-'} {formatCurrency(sms.amount, user?.currency || 'INR')}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] text-ink-muted truncate flex-1">
                        {sms.description || sms.raw_message || 'Transaction received via automated feed'}
                    </p>
                    {dateLabel && <span className="shrink-0 text-[10px] font-mono text-ink-faint">{dateLabel}</span>}
                    <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {sms.category || 'General'}
                    </span>
                </div>
            </div>

            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onApprove(sms); }}
                disabled={isProcessing}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[11px] font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition-transform disabled:opacity-50"
            >
                {isProcessing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Approve</span>
            </button>

            <div className="relative shrink-0">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                    className="p-1.5 rounded-lg hover:bg-line text-ink-muted transition-colors"
                    title="More actions"
                >
                    <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                        <div className="absolute right-0 top-full mt-1 z-20 w-40 py-1 rounded-xl bg-surface border border-line shadow-xl">
                            <button
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpenDetail(); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-raised text-left transition-colors"
                            >
                                <Eye className="w-3.5 h-3.5" /> View details
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-raised text-left transition-colors"
                            >
                                <Edit3 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onReject(sms.id); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 text-left transition-colors"
                            >
                                <XCircle className="w-3.5 h-3.5" /> Dismiss
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const SmsDetailPanel = ({ item, user, cards, selectedCardMap, setSelectedCardMap, processingId, onApprove, onApproveToCard, onReject, onEdit, onClose }) => {
    if (!item) return null;
    const isProcessing = processingId === item.id;
    const txType = String(item.transaction_type || item.type || item.category_type || '').toLowerCase();
    const isCredit = txType === 'credit' || txType === 'income' || item.isCredit === true;
    const isCardTx = isCardTransaction(item);
    const reference = item.reference || item.referenceNumber || item.ref || item.utr || item.transactionId || item.txnId || '';
    const dateLabel = item.date || (item.received_at ? new Date(item.received_at).toLocaleString() : '—');

    const fields = [
        { label: 'Merchant', value: item.merchant || item.provider || '—' },
        { label: 'Account', value: item.account || item.bankName || '—' },
        { label: 'Reference', value: reference || '—' },
        { label: 'Date', value: dateLabel },
        { label: 'Category', value: item.category || 'General' },
        { label: 'Mode', value: item.paymentMethod || item.mode || 'UPI' }
    ];

    return (
        <div className="fixed inset-0 z-[100]" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-950/70" />
            <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-0 h-full w-full max-w-md bg-surface border-l border-line shadow-2xl flex flex-col"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
                    <div className="min-w-0">
                        <h3 className="text-base font-black text-ink truncate">{item.merchant || item.provider || 'Transaction details'}</h3>
                        <p className="text-[11px] text-ink-muted">Review parsed fields and approve</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-raised text-ink-muted transition-colors shrink-0" title="Close">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    <div className={`p-4 rounded-2xl border ${isCredit ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Amount</span>
                        <div className={`text-2xl font-black mt-1 ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isCredit ? '+' : '-'} {formatCurrency(item.amount, user?.currency || 'INR')}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {fields.map(f => (
                            <div key={f.label} className="p-3 rounded-xl bg-raised/50 border border-line">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{f.label}</div>
                                <div className="text-xs font-semibold text-ink mt-1 break-words">{f.value}</div>
                            </div>
                        ))}
                    </div>

                    {isCardTx && cards && cards.length > 0 && (
                        <div className="p-3 rounded-xl bg-raised/50 border border-line space-y-2">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Approve to credit card</div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedCardMap[item.id] || (item.creditCardId && cards.some(c => String(c.id) === String(item.creditCardId)) ? item.creditCardId : cards[0].id)}
                                    onChange={(e) => setSelectedCardMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    className="flex-1 px-3 py-2 bg-surface border border-line rounded-xl text-xs text-ink outline-none cursor-pointer truncate"
                                >
                                    {cards.map(c => (
                                        <option key={c.id} value={c.id} className="bg-surface text-ink">
                                            {c.cardName || c.bankName}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => onApproveToCard(item, selectedCardMap[item.id] || cards[0].id)}
                                    disabled={isProcessing}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 active:scale-95 transition-transform disabled:opacity-50"
                                >
                                    <CreditCard className="w-3.5 h-3.5" /> Card
                                </button>
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">Original SMS</div>
                        <p className="text-[11px] font-mono text-ink-muted bg-sunken p-3 rounded-xl border border-line leading-relaxed whitespace-pre-wrap break-all">
                            {item.raw_message || item.description || 'No raw string available'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-5 py-4 border-t border-line shrink-0">
                    <button
                        onClick={() => onApprove(item)}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform disabled:opacity-50"
                    >
                        {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                    </button>
                    <button
                        onClick={() => onEdit(item)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-raised hover:bg-line text-ink text-xs font-bold border border-line transition-colors"
                    >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                        onClick={() => onReject(item.id)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/30 transition-colors"
                    >
                        <XCircle className="w-3.5 h-3.5" /> Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Automation;


