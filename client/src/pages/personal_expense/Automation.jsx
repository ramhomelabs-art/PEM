import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { useCategories } from '../../context/CategoryContext';
import {
    CheckCircle, XCircle, RefreshCw, MessageSquare, CreditCard,
    ArrowRight, Loader, Pencil, Plus, Check, Edit3, Smartphone,
    Activity, Server, Shield, Zap, Terminal, FileText, Send,
    QrCode, Key, Copy, ChevronDown, ChevronUp, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import AutomationDetailsModal from '../../components/personal_expense/AutomationDetailsModal';
import { API_URL } from '../../config';
import { useToast } from '../../context/ToastContext';

const Automation = () => {
    const { theme, isDarkMode } = useTheme();
    const { user } = useAuth();
    const { cards, addTransaction } = useCreditCards();
    const { categories } = useCategories();

    // Data State
    const [pendingSMS, setPendingSMS] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [selectedCardMap, setSelectedCardMap] = useState({});

    // Config State
    const [smsApiKey, setSmsApiKey] = useState(null);
    const [encryptionKey, setEncryptionKey] = useState(null);
    const [deviceStatus, setDeviceStatus] = useState('offline');
    const [isDeviceApproved, setIsDeviceApproved] = useState(false);
    const [deviceInfo, setDeviceInfo] = useState(null);

    // QR & Pairing State
    const [qrCodeUrl, setQrCodeUrl] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [verifyCode, setVerifyCode] = useState('');
    const [verifyingCode, setVerifyingCode] = useState(false);
    const [verifySuccess, setVerifySuccess] = useState(false);
    const [showManualDetails, setShowManualDetails] = useState(false);

    // Health State
    const [health, setHealth] = useState({ status: 'unknown', python: 'unknown' });

    // UI State
    const [activeTab, setActiveTab] = useState('pending'); // pending, manual, connect
    const [editingItem, setEditingItem] = useState(null);
    const [showConnectModal, setShowConnectModal] = useState(false);

    const webhookUrl = 'https://finance.ramhomelab.com/api/sms/webhook';

    // --- FETCHERS ---
    const fetchConfig = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/sms/config`, { headers: { Authorization: `Bearer ${token}` } });
            setSmsApiKey(res.data.smsApiKey);
            setEncryptionKey(res.data.encryptionKey);
            setIsDeviceApproved(!!res.data.isDeviceApproved);
            setDeviceInfo(res.data.deviceInfo);

            if (res.data.lastDeviceSync) {
                const diff = (new Date() - new Date(res.data.lastDeviceSync)) / 1000 / 60;
                setDeviceStatus(diff < 5 ? 'online' : 'offline');
            }
        } catch (e) { console.error(e); }
    };

    const fetchPending = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/sms/pending`, { headers: { Authorization: `Bearer ${token}` } });
            setPendingSMS(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchHealth = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/sms/health`, { headers: { Authorization: `Bearer ${token}` } });
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
            console.error('Failed to generate pairing QR:', e);
            notify('Failed to generate pairing QR code', 'error');
        } finally {
            setQrLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        const cleanCode = verifyCode.trim();
        if (cleanCode.length !== 6) {
            notify('Please enter a valid 6-digit code', 'error');
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
                notify('Device successfully verified and linked!', 'success');
                fetchConfig();
            } else {
                notify('Invalid code. Please check your mobile app.', 'error');
            }
        } catch (err) {
            notify(err.response?.data?.error || 'Verification failed. Try the current code on your screen.', 'error');
        } finally {
            setVerifyingCode(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchPending();
        fetchHealth();
        // Auto-refresh health every 30s
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (activeTab === 'connect') {
            fetchConfig();
            fetchQrCode();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // --- ACTIONS ---
    const [confirmAction, setConfirmAction] = useState(null); // { type: 'restart'|'reset', step: 1 }

    const { addToast: notify } = useToast(); // Alias for easier usage

    const handleRestartPython = async () => {
        // Confirmation Logic (Inline Double Click)
        if (confirmAction?.type !== 'restart') {
            setConfirmAction({ type: 'restart' });
            setTimeout(() => setConfirmAction(null), 3000); // Reset after 3s
            return;
        }

        setConfirmAction(null);
        try {
            // Optimistic update
            setHealth(prev => ({ ...prev, python: 'restarting' }));

            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/server/restart/python`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            notify("Restart command sent. Waiting for service...", 'warning', 5000);
            setTimeout(fetchHealth, 10000);
        } catch (e) {
            notify("Restart failed: " + (e.response?.data?.error || e.message), 'error');
            fetchHealth();
        }
    };

    const handleApproveDevice = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/sms/device/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchConfig();
            notify("Device Approved Successfully", 'success');
        } catch { notify("Approval failed", 'error'); }
    };

    const handleResetDevice = async () => {
        if (confirmAction?.type !== 'reset') {
            setConfirmAction({ type: 'reset' });
            setTimeout(() => setConfirmAction(null), 3000);
            return;
        }

        setConfirmAction(null);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/sms/device/disconnect`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchConfig();
            notify("Device unpaired. Re-setup the app on your phone.", 'success');
        } catch { notify("Reset failed", 'error'); }
    };

    const handleApprove = async (sms) => {
        setProcessingId(sms.id);
        try {
            if (sms.type === 'BILL_SUGGESTION') {
                await axios.post(`${API_URL}/bills`, {
                    userId: user.id,
                    name: `${sms.provider} Bill`,
                    category: sms.category,
                    provider: sms.provider,
                    amount: sms.amount,
                    dueDate: sms.dueDate,
                    status: 'unpaid',
                    identifiers: sms.identifiers ? { value: sms.identifiers.value || sms.identifiers.account } : null,
                    isRecurring: true, frequency: 'monthly'
                });
            } else {
                let transactionDate = sms.received_at || sms.date || new Date().toISOString();

                await axios.post(`${API_URL}/transactions/manual`, {
                    userId: user.id,
                    date: transactionDate,
                    amount: sms.amount,
                    description: sms.merchant || sms.provider,
                    category: sms.category,
                    type: sms.transaction_type === 'credit' ? 'income' : 'expense',
                    paymentMode: sms.paymentMethod || 'Cash',
                    status: 'Completed',
                    source: sms.source === 'MANUAL_ENTRY' ? 'manual' : 'sms',
                    mode: sms.mode
                });
            }
            await axios.delete(`${API_URL}/sms/reject/${sms.id}`);
            setPendingSMS(prev => prev.filter(p => p.id !== sms.id));
            notify("Item Approved to Expenses", 'success');
        } catch { notify("Action Failed", 'error'); }
        finally { setProcessingId(null); }
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
                description: sms.merchant || sms.provider || 'Credit Card Payment',
                merchant: sms.merchant || sms.provider || 'Credit Card Payment',
                category: sms.category || 'Other',
                type: sms.transaction_type === 'credit' ? 'credit' : 'debit',
                status: 'Completed',
                paymentMethod: 'Credit Card'
            });

            await axios.delete(`${API_URL}/sms/reject/${sms.id}`);
            setPendingSMS(prev => prev.filter(p => p.id !== sms.id));
            notify("Approved to Credit Card", 'success');
        } catch (e) { 
            console.error(e);
            notify("Action Failed", 'error'); 
        } finally { 
            setProcessingId(null); 
        }
    };

    const handleReject = async (id) => {
        try {
            await axios.delete(`${API_URL}/sms/reject/${id}`);
            setPendingSMS(prev => prev.filter(p => p.id !== id));
            notify("Item Rejected", 'info');
        } catch { notify("Reject Failed", 'error'); }
    };

    const handleEditSave = async (updatedData) => {
        try {
            await axios.put(`${API_URL}/sms/update/${updatedData.id}`, updatedData);
            setEditingItem(null);
            fetchPending();
            notify("Transaction Updated", 'success');
        } catch { notify("Update failed", 'error'); }
    };

    // --- UI HELPERS ---
    const TabButton = ({ id, label, icon: Icon, count }) => (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                backgroundColor: activeTab === id ?
                    (id === 'pending' ? '#10b981' :
                        id === 'manual' ? '#8b5cf6' :
                            '#3b82f6') : (isDarkMode ? '#334155' : '#e2e8f0'),
                color: activeTab === id ? 'white' : theme.textSecondary,
                cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: activeTab === id ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s', position: 'relative'
            }}
        >
            <Icon size={18} /> {label}
            {count > 0 && <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', backgroundColor: '#ef4444', color: 'white', position: 'absolute', top: '5px', right: '10px' }}>{count}</span>}
        </button>
    );

    const getHealthColor = (status) => {
        if (status === 'online') return '#10b981';
        if (status === 'restarting') return '#f59e0b';
        return '#ef4444';
    };

    // Filter Lists
    const smsList = pendingSMS.filter(s => s.source !== 'MANUAL_ENTRY' && s.type !== 'MANUAL');
    const manualList = pendingSMS.filter(s => s.source === 'MANUAL_ENTRY' || s.type === 'MANUAL');


    return (
        <div style={{ padding: '30px', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', minHeight: '100vh', color: theme.text }}>

            <AutomationDetailsModal
                isOpen={!!editingItem}
                data={editingItem}
                onClose={() => setEditingItem(null)}
                onSave={handleEditSave}
                categories={categories} user={user}
            />

            <AnimatePresence>
                {showConnectModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div onClick={() => setShowConnectModal(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            style={{ width: '100%', maxWidth: '500px', backgroundColor: isDarkMode ? '#1e293b' : 'white', borderRadius: '24px', padding: '30px', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px' }}>Device Connection</h2>
                            {/* Connection Details Logic Reused */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: theme.textSecondary, display: 'block', marginBottom: '8px' }}>WEBHOOK URL</label><code style={{ display: 'block', padding: '15px', backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9', borderRadius: '12px', color: '#10b981', wordBreak: 'break-all', fontSize: '12px' }}>{webhookUrl}?apiKey={smsApiKey}</code></div>
                                <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: theme.textSecondary, display: 'block', marginBottom: '8px' }}>API KEY</label><code style={{ display: 'block', padding: '15px', backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9', borderRadius: '12px', color: '#10b981', wordBreak: 'break-all', fontSize: '12px' }}>{smsApiKey}</code></div>
                                <div style={{ display: 'flex', gap: '10px' }}><button onClick={() => setShowConnectModal(false)} style={{ flex: 1, padding: '15px', borderRadius: '12px', backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>CLOSE</button></div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* HEADER & HEALTH BAR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: '900', background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '5px' }}>
                        Automation Hub
                    </h1>
                    <p style={{ color: theme.textSecondary }}>Central Intelligence for your Finances</p>
                </div>

                {/* PERSISTENT HEALTH WIDGET */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 15px', backgroundColor: theme.cardBg, borderRadius: '12px', border: `1px solid ${theme.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Terminal size={16} color={getHealthColor(health.python)} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: theme.textSecondary, lineHeight: '1' }}>PYTHON ENGINE</span>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: getHealthColor(health.python) }}>{health.python.toUpperCase()}</span>
                        </div>
                    </div>
                    {health.python !== 'online' && health.python !== 'restarting' && (
                        <button onClick={handleRestartPython} style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', backgroundColor: confirmAction?.type === 'restart' ? '#f59e0b' : '#ef4444', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                            <RefreshCw size={12} /> {confirmAction?.type === 'restart' ? 'CONFIRM?' : 'RESTART'}
                        </button>
                    )}
                </div>
            </div>

            {/* TAB BAR */}
            <div style={{ display: 'flex', gap: '5px', padding: '5px', backgroundColor: theme.cardBg, borderRadius: '16px', marginBottom: '30px' }}>
                <TabButton id="pending" label="SMS Inbox" count={smsList.length} icon={MessageSquare} />
                <TabButton id="manual" label="App Entries" count={manualList.length} icon={Pencil} />
                <TabButton id="connect" label="Connectivity" icon={Smartphone} />
            </div>

            {/* CONTENT AREA */}
            <div style={{ minHeight: '400px' }}>

                {/* 1. SMS INBOX */}
                {activeTab === 'pending' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Incoming Messages ({smsList.length})</h2>
                            <button onClick={fetchPending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary }}>
                                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                            </button>
                        </div>
                        {loading ? <div style={{ padding: '50px', display: 'flex', justifyContent: 'center' }}><Loader className="animate-spin" size={32} color="#3b82f6" /></div> :
                            smsList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px', backgroundColor: theme.cardBg, borderRadius: '24px', border: `1px solid ${theme.border}` }}>
                                    <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 20px', opacity: 0.5 }} />
                                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>Inbox Cleared</h3>
                                    <p style={{ color: theme.textSecondary }}>No pending SMS transactions.</p>
                                </div>
                            ) : (
                                smsList.map(sms => (
                                    <ItemCard key={sms.id} sms={sms} theme={theme} isDarkMode={isDarkMode} user={user}
                                        onEdit={() => setEditingItem(sms)}
                                        onReject={handleReject}
                                        onApprove={handleApprove}
                                        processingId={processingId}
                                        cards={cards}
                                        selectedCardMap={selectedCardMap}
                                        setSelectedCardMap={setSelectedCardMap}
                                        onApproveToCard={handleApproveToCard}
                                    />
                                ))
                            )}
                    </div>
                )}

                {/* 2. APP MANUAL ENTRIES */}
                {activeTab === 'manual' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Manual Entries from App ({manualList.length})</h2>
                            <button onClick={fetchPending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary }}>
                                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                            </button>
                        </div>
                        {loading ? <div style={{ padding: '50px', display: 'flex', justifyContent: 'center' }}><Loader className="animate-spin" size={32} color="#3b82f6" /></div> :
                            manualList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px', backgroundColor: theme.cardBg, borderRadius: '24px', border: `1px solid ${theme.border}` }}>
                                    <Pencil size={48} color="#8b5cf6" style={{ margin: '0 auto 20px', opacity: 0.5 }} />
                                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>No Manual Entries</h3>
                                    <p style={{ color: theme.textSecondary }}>Use your Android app to manually add transactions.</p>
                                </div>
                            ) : (
                                manualList.map(sms => (
                                    <ItemCard key={sms.id} sms={sms} theme={theme} isDarkMode={isDarkMode} user={user}
                                        onEdit={() => setEditingItem(sms)}
                                        onReject={handleReject}
                                        onApprove={handleApprove}
                                        processingId={processingId}
                                        isManualEntry={true} // Highlight styling
                                        cards={cards}
                                        selectedCardMap={selectedCardMap}
                                        setSelectedCardMap={setSelectedCardMap}
                                        onApproveToCard={handleApproveToCard}
                                    />
                                ))
                            )}
                    </div>
                )}

                {/* 3. CONNECT TAB */}
                {activeTab === 'connect' && (
                    <div style={{ maxWidth: '640px', margin: '0 auto', backgroundColor: theme.cardBg, padding: '32px', borderRadius: '24px', border: `1px solid ${theme.border}`, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>Device Pairing</h2>
                                <p style={{ fontSize: '13px', color: theme.textSecondary, marginTop: '4px', margin: 0 }}>
                                    Pair your Android SMS Forwarder app via QR code.
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', backgroundColor: deviceStatus === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: `1px solid ${deviceStatus === 'online' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}` }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: deviceStatus === 'online' ? '#10b981' : '#f59e0b', boxShadow: deviceStatus === 'online' ? '0 0 8px #10b981' : 'none' }} />
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: deviceStatus === 'online' ? '#10b981' : '#f59e0b' }}>
                                    {deviceStatus === 'online' ? (isDeviceApproved ? 'Connected' : 'Pending Approval') : 'Waiting for App'}
                                </span>
                            </div>
                        </div>

                        {/* CONDITIONALLY RENDER: IF PAIRED -> SHOW ACTIVE PAIRED CARD, IF NOT PAIRED -> SHOW QR CODE & VERIFY */}
                        {isDeviceApproved ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '36px 28px',
                                backgroundColor: isDarkMode ? '#061325' : '#f0fdf4',
                                borderRadius: '20px',
                                border: `2px solid ${isDarkMode ? '#065f46' : '#86efac'}`,
                                textAlign: 'center',
                                marginBottom: '24px'
                            }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    backgroundColor: '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    marginBottom: '16px',
                                    boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
                                }}>
                                    <ShieldCheck size={36} />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: '800', color: isDarkMode ? '#f8fafc' : '#0f172a', margin: '0 0 6px 0' }}>
                                    Mobile App Paired & Active
                                </h3>
                                <p style={{ fontSize: '13px', color: theme.textSecondary, maxWidth: '420px', margin: '0 0 24px 0' }}>
                                    Your Android SMS Forwarder is successfully paired and actively syncing financial SMS transactions in real-time.
                                </p>

                                {deviceInfo && (
                                    <div style={{
                                        width: '100%',
                                        maxWidth: '460px',
                                        padding: '16px 20px',
                                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                                        borderRadius: '16px',
                                        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                                        textAlign: 'left',
                                        marginBottom: '20px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Smartphone size={18} color="#10b981" />
                                                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                    {deviceInfo.manufacturer || 'Android'} {deviceInfo.model || 'Device'}
                                                </span>
                                            </div>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                color: '#10b981',
                                                fontWeight: 'bold'
                                            }}>
                                                PAIRED
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div>Hardware ID: <code style={{ color: '#38bdf8' }}>{deviceInfo.androidId || 'Registered'}</code></div>
                                            <div>Sync Status: <span style={{ color: deviceStatus === 'online' ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>{deviceStatus === 'online' ? 'Online & Listening' : 'Waiting for Next Push'}</span></div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => { fetchConfig(); fetchHealth(); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '10px 18px',
                                            borderRadius: '12px',
                                            backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                                            color: theme.text,
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <RefreshCw size={13} /> Refresh Status
                                    </button>
                                    <button
                                        onClick={handleResetDevice}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '10px 18px',
                                            borderRadius: '12px',
                                            backgroundColor: confirmAction?.type === 'reset' ? '#ef4444' : 'rgba(239, 68, 68, 0.1)',
                                            color: confirmAction?.type === 'reset' ? '#ffffff' : '#ef4444',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {confirmAction?.type === 'reset' ? 'Confirm Unpair?' : 'Unpair Device'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Connected Device Info if pending approval */}
                                {deviceInfo && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9', borderRadius: '14px', marginBottom: '24px', border: `1px solid ${theme.border}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Smartphone size={20} color="#3b82f6" />
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{deviceInfo.manufacturer} {deviceInfo.model}</div>
                                                <div style={{ fontSize: '11px', color: theme.textSecondary }}>Hardware ID: {deviceInfo.androidId ? deviceInfo.androidId.substring(0, 10) + '...' : 'Registered'}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => { fetchConfig(); fetchHealth(); }} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <RefreshCw size={12} /> Sync Status
                                        </button>
                                    </div>
                                )}

                                {/* CENTERPIECE: PAIRING QR CODE */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px', backgroundColor: isDarkMode ? '#020617' : '#ffffff', borderRadius: '20px', border: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}`, textAlign: 'center', marginBottom: '24px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>Scan with Mobile App</div>
                                    <p style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '20px', maxWidth: '380px' }}>
                                        Open the Android SMS Forwarder app. Point your camera at this QR code to auto-configure all keys and webhooks.
                                    </p>

                                    <div style={{ position: 'relative', padding: '16px', backgroundColor: 'white', borderRadius: '18px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)', border: '2px solid #10b981' }}>
                                        {qrLoading ? (
                                            <div style={{ width: '220px', height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                <Loader className="animate-spin" size={32} color="#10b981" />
                                                <span style={{ fontSize: '12px', marginTop: '12px' }}>Generating QR...</span>
                                            </div>
                                        ) : qrCodeUrl ? (
                                            <img
                                                src={qrCodeUrl}
                                                alt="Pairing QR Code"
                                                style={{ width: '220px', height: '220px', display: 'block', borderRadius: '10px' }}
                                            />
                                        ) : (
                                            <div style={{ width: '220px', height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                <QrCode size={48} color="#64748b" style={{ opacity: 0.5, marginBottom: '8px' }} />
                                                <span style={{ fontSize: '12px' }}>Click Refresh to load QR</span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={fetchQrCode}
                                        disabled={qrLoading}
                                        style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#10b981', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        <RefreshCw size={14} className={qrLoading ? 'animate-spin' : ''} /> Refresh QR Code
                                    </button>
                                </div>

                                {/* STEP 2: 6-DIGIT TOTP CODE VERIFICATION */}
                                <div style={{ padding: '20px', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderRadius: '18px', border: `1px solid ${verifySuccess ? '#10b981' : theme.border}`, marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <ShieldCheck size={18} color={verifySuccess ? '#10b981' : '#3b82f6'} />
                                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                            {verifySuccess ? 'Device Verified & Synced' : 'Verify 6-Digit Code'}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '14px' }}>
                                        Once scanned, enter the 6-digit code currently showing on your phone screen to confirm synchronization.
                                    </p>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="text"
                                            maxLength={6}
                                            placeholder="123456"
                                            value={verifyCode}
                                            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                                            style={{ flex: 1, padding: '12px 16px', fontSize: '20px', letterSpacing: '6px', textAlign: 'center', fontWeight: 'bold', borderRadius: '12px', border: `2px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`, backgroundColor: isDarkMode ? '#020617' : '#ffffff', color: theme.text, outline: 'none' }}
                                        />
                                        <button
                                            onClick={handleVerifyCode}
                                            disabled={verifyingCode || verifyCode.trim().length !== 6}
                                            style={{ padding: '12px 24px', borderRadius: '12px', backgroundColor: verifySuccess ? '#10b981' : '#3b82f6', color: 'white', fontWeight: 'bold', border: 'none', cursor: (verifyingCode || verifyCode.trim().length !== 6) ? 'not-allowed' : 'pointer', opacity: (verifyCode.trim().length !== 6 && !verifySuccess) ? 0.6 : 1, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            {verifyingCode ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                            {verifySuccess ? 'Verified' : 'Verify'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* COLLAPSIBLE MANUAL DETAILS (FOR ADVANCED / FALLBACK DEBUGGING) */}
                        <div style={{ marginBottom: '20px', borderTop: `1px solid ${theme.border}`, paddingTop: '16px' }}>
                            <button
                                onClick={() => setShowManualDetails(!showManualDetails)}
                                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', color: theme.textSecondary, fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: '6px 0' }}
                            >
                                <span>Manual Connection Credentials (Advanced)</span>
                                {showManualDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {showManualDetails && (
                                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', color: theme.textSecondary, fontSize: '11px', fontWeight: 'bold' }}>WEBHOOK URL</label>
                                        <code style={{ display: 'block', padding: '10px 14px', backgroundColor: isDarkMode ? '#020617' : '#f1f5f9', borderRadius: '10px', color: '#10b981', wordBreak: 'break-all', fontSize: '11px' }}>
                                            {webhookUrl}?apiKey={smsApiKey}
                                        </code>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', color: theme.textSecondary, fontSize: '11px', fontWeight: 'bold' }}>API SECRET KEY</label>
                                        <code style={{ display: 'block', padding: '10px 14px', backgroundColor: isDarkMode ? '#020617' : '#f1f5f9', borderRadius: '10px', color: '#10b981', wordBreak: 'break-all', fontSize: '11px' }}>
                                            {smsApiKey}
                                        </code>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', color: theme.textSecondary, fontSize: '11px', fontWeight: 'bold' }}>ENCRYPTION KEY</label>
                                        <code style={{ display: 'block', padding: '10px 14px', backgroundColor: isDarkMode ? '#020617' : '#f1f5f9', borderRadius: '10px', color: '#10b981', wordBreak: 'break-all', fontSize: '11px' }}>
                                            {encryptionKey}
                                        </code>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* UNPAIR / RESET ACTION */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            {deviceStatus === 'online' && !isDeviceApproved && (
                                <button onClick={handleApproveDevice} style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: '#f59e0b', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>APPROVE DEVICE</button>
                            )}
                            <button
                                onClick={handleResetDevice}
                                style={{ padding: '12px 20px', borderRadius: '12px', backgroundColor: confirmAction?.type === 'reset' ? '#ef4444' : 'rgba(239, 68, 68, 0.1)', color: confirmAction?.type === 'reset' ? 'white' : '#ef4444', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                            >
                                {confirmAction?.type === 'reset' ? 'CONFIRM UNPAIR?' : 'Reset Device Pairing'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-Component for list items (DRY)
const ItemCard = ({ sms, theme, isDarkMode, user, onEdit, onReject, onApprove, processingId, isManualEntry, cards, selectedCardMap, setSelectedCardMap, onApproveToCard }) => (
    <div onClick={() => onEdit(sms)} style={{ display: 'flex', padding: '20px', backgroundColor: theme.cardBg, borderRadius: '20px', border: `1px solid ${isManualEntry ? '#8b5cf6' : theme.border}`, alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'transform 0.2s' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9', color: isManualEntry ? '#8b5cf6' : '#3b82f6', flexShrink: 0 }}>
                {isManualEntry ? <Pencil size={24} /> : <MessageSquare size={24} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{sms.merchant || sms.provider}</h3>
                    <span style={{ fontSize: '11px', color: theme.textSecondary, fontWeight: 'bold' }}>{sms.date}</span>
                    {isManualEntry && <span style={{ fontSize: '10px', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '2px 8px', borderRadius: '10px', fontWeight: '900' }}>APP ENTRY</span>}
                </div>
                <p style={{ fontSize: '13px', color: theme.textSecondary, margin: '5px 0 0 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{sms.description}</p>
            </div>
        </div>
        <div style={{ padding: '0 20px', textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: sms.transaction_type === 'credit' ? '#10b981' : theme.text }}>
                {sms.transaction_type === 'credit' ? '+' : '-'} {user?.currency === 'INR' ? '₹' : '$'}{sms.amount}
            </div>
            <span style={{ fontSize: '11px', color: theme.textSecondary, fontWeight: 'bold', textTransform: 'uppercase' }}>{sms.category} • {sms.paymentMethod || 'CASH'}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(sms); }} style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#64748b20', color: '#64748b', border: 'none', cursor: 'pointer' }} title="Edit Details"><Pencil size={18} /></button>
            <button onClick={(e) => { e.stopPropagation(); onReject(sms.id); }} style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#ef444420', color: '#ef4444', border: 'none', cursor: 'pointer' }} title="Reject/Delete"><XCircle size={18} /></button>
            
            {/* Inline Card Selector */}
            {cards && cards.length > 0 && (
                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', padding: '6px 12px', borderRadius: '10px', border: `1px solid ${theme.border}` }}>
                    <CreditCard size={14} color={theme.textSecondary} />
                    <select 
                        value={selectedCardMap[sms.id] || ''}
                        onChange={(e) => setSelectedCardMap(prev => ({ ...prev, [sms.id]: e.target.value }))}
                        style={{ background: 'transparent', border: 'none', color: theme.text, fontSize: '11px', outline: 'none', cursor: 'pointer', maxWidth: '100px' }}
                    >
                        <option value="" style={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', color: theme.text }}>Select Card...</option>
                        {cards.map(card => (
                            <option key={card.id} value={card.id} style={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', color: theme.text }}>
                                {card.cardName || card.bankName}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Dedicated Approve to Card Button */}
            {cards && cards.length > 0 && (
                <button 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        const selectedId = selectedCardMap[sms.id] || cards[0].id;
                        onApproveToCard(sms, selectedId); 
                    }} 
                    disabled={processingId === sms.id} 
                    style={{ padding: '10px 15px', borderRadius: '10px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    {processingId === sms.id ? <Loader size={18} className="animate-spin" /> : <CreditCard size={18} />} Approve to Card
                </button>
            )}

            {/* Standard Approve Button */}
            <button onClick={(e) => { e.stopPropagation(); onApprove(sms); }} disabled={processingId === sms.id} style={{ padding: '10px 20px', borderRadius: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {processingId === sms.id ? <Loader size={18} className="animate-spin" /> : <CheckCircle size={18} />} Approve
            </button>
        </div>
    </div>
);

export default Automation;
