import { useEffect, useState, useCallback, useMemo } from 'react';
import { API_URL } from '../../config';
import {
    Shield, Smartphone, Key, AlertCircle, CheckCircle, X, RefreshCw,
    Users, Lock, Unlock, Power, Clock, Search, Filter, ShieldCheck,
    CheckCircle2, ArrowLeft, SlidersHorizontal, Info, Sparkles, QrCode,
    SmartphoneNfc, Copy, ExternalLink, Cpu, Check
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';

const MfaManager = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [confirmReset, setConfirmReset] = useState({ isOpen: false, userId: null, username: '' });
    const [updatingId, setUpdatingId] = useState(null);

    // Pairing Modal State
    const [pairingModal, setPairingModal] = useState({
        isOpen: false,
        userId: null,
        username: '',
        tab: 'companion', // 'companion' | 'totp'
        qrData: null,
        loading: false,
        error: '',
        serverUrl: 'http://10.10.20.4:5005',
        copied: false,
        pairedSuccess: false
    });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/admin/mfa/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            } else {
                showToast('Failed to load MFA user directory', 'error');
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
            showToast('Network error loading users', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const fetchStats = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/admin/mfa/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        fetchStats();
    }, [fetchUsers, fetchStats]);

    const handleToggleMFA = async (userId, currentStatus, username) => {
        const nextStatus = !currentStatus;
        setUpdatingId(userId);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/admin/mfa/enable/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ enabled: nextStatus })
            });

            if (response.ok) {
                showToast(`MFA ${nextStatus ? 'enabled' : 'disabled'} for ${username}`, 'success');
                await fetchUsers();
                await fetchStats();
            } else {
                const errData = await response.json().catch(() => ({}));
                showToast(errData.error || 'Failed to update MFA status', 'error');
            }
        } catch {
            showToast('Error updating MFA status', 'error');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleResetMFA = async () => {
        if (!confirmReset.userId) return;
        setUpdatingId(confirmReset.userId);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/admin/mfa/reset/${confirmReset.userId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                showToast(`MFA configuration & devices removed for ${confirmReset.username}`, 'info');
                await fetchUsers();
                await fetchStats();
            } else {
                showToast('Failed to reset MFA', 'error');
            }
        } catch {
            showToast('Error resetting user MFA', 'error');
        } finally {
            setUpdatingId(null);
            setConfirmReset({ isOpen: false, userId: null, username: '' });
        }
    };

    const handleMethodChange = async (userId, method, username) => {
        setUpdatingId(userId);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/admin/mfa/method/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ method })
            });

            if (response.ok) {
                showToast(`Authentication method updated to ${method.toUpperCase()} for ${username}`, 'success');
                await fetchUsers();
            } else {
                showToast('Failed to update MFA method', 'error');
            }
        } catch {
            showToast('Error updating authentication method', 'error');
        } finally {
            setUpdatingId(null);
        }
    };

    // Open Pairing Modal
    const openPairingModal = async (user) => {
        const uId = user ? user.id : (users[0]?.id || 1);
        const uName = user ? user.username : (users[0]?.username || 'User');
        setPairingModal({
            isOpen: true,
            userId: uId,
            username: uName,
            tab: 'companion',
            qrData: null,
            loading: true,
            error: '',
            serverUrl: 'http://10.10.20.4:5005',
            copied: false,
            pairedSuccess: false
        });
        await fetchPairingQR(uId, 'http://10.10.20.4:5005');
    };

    const fetchPairingQR = async (userId, customServerUrl) => {
        setPairingModal(prev => ({ ...prev, loading: true, error: '', pairedSuccess: false }));
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/mfa/generate-qr/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ serverUrl: customServerUrl })
            });
            if (res.ok) {
                const data = await res.json();
                setPairingModal(prev => ({
                    ...prev,
                    qrData: data,
                    loading: false
                }));
            } else {
                const err = await res.json().catch(() => ({}));
                setPairingModal(prev => ({
                    ...prev,
                    error: err.error || 'Failed to generate pairing QR',
                    loading: false
                }));
            }
        } catch (e) {
            setPairingModal(prev => ({
                ...prev,
                error: 'Network error generating pairing QR',
                loading: false
            }));
        }
    };

    // Live binding poller while Pairing Modal is open
    useEffect(() => {
        if (!pairingModal.isOpen || !pairingModal.userId || pairingModal.pairedSuccess) return;

        const interval = setInterval(async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/admin/mfa/users/${pairingModal.userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.user?.devices && data.user.devices.length > 0) {
                        const activeDev = data.user.devices.find(d => d.isActive);
                        if (activeDev) {
                            setPairingModal(prev => ({ ...prev, pairedSuccess: true }));
                            fetchUsers();
                            fetchStats();
                            showToast(`Device "${activeDev.deviceName}" paired successfully!`, 'success');
                        }
                    }
                }
            } catch (e) {
                // Ignore polling errors
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [pairingModal.isOpen, pairingModal.userId, pairingModal.pairedSuccess, fetchUsers, fetchStats, showToast]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesSearch = !searchTerm ||
                (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const isEnabled = Boolean(u.mfaEnabled || u.mfa_enabled);
            const matchesStatus = statusFilter === 'ALL' ||
                (statusFilter === 'ENABLED' && isEnabled) ||
                (statusFilter === 'DISABLED' && !isEnabled);

            return matchesSearch && matchesStatus;
        });
    }, [users, searchTerm, statusFilter]);

    return (
        <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto min-h-screen text-slate-100">
            {/* Toast Notification */}
            <AnimatePresence>
                {toast.show && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl ${
                            toast.type === 'error'
                                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                                : toast.type === 'info'
                                ? 'bg-sky-950/90 border-sky-500/40 text-sky-200'
                                : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                        }`}
                    >
                        {toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                        <span className="text-xs font-bold tracking-wide">{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirm Reset Dialog */}
            <ConfirmDialog
                isOpen={confirmReset.isOpen}
                title="Reset MFA Credentials"
                message={`Are you sure you want to completely remove MFA protection and reset two-factor authentication for "${confirmReset.username}"? They will be able to log in with standard password.`}
                confirmText="Reset MFA"
                cancelText="Keep MFA"
                type="danger"
                onConfirm={handleResetMFA}
                onClose={() => setConfirmReset({ isOpen: false, userId: null, username: '' })}
            />

            {/* Device Pairing Modal */}
            <AnimatePresence>
                {pairingModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.94, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.94, opacity: 0, y: 20 }}
                            className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                                        <SmartphoneNfc className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-white">Pair Mobile Device</h3>
                                        <p className="text-xs text-slate-400">
                                            Linking for <span className="text-emerald-400 font-bold">{pairingModal.username}</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPairingModal(prev => ({ ...prev, isOpen: false }))}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
                                {/* Tab selector */}
                                <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-bold">
                                    <button
                                        onClick={() => setPairingModal(prev => ({ ...prev, tab: 'companion' }))}
                                        className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                                            pairingModal.tab === 'companion'
                                                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <Smartphone className="w-4 h-4" />
                                        <span>Android App</span>
                                    </button>
                                    <button
                                        onClick={() => setPairingModal(prev => ({ ...prev, tab: 'totp' }))}
                                        className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                                            pairingModal.tab === 'totp'
                                                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <Key className="w-4 h-4" />
                                        <span>Authenticator</span>
                                    </button>
                                </div>

                                {/* User switch if needed */}
                                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                                    <span className="text-slate-400 font-medium">Target User:</span>
                                    <select
                                        value={pairingModal.userId}
                                        onChange={(e) => {
                                            const id = Number(e.target.value);
                                            const u = users.find(x => x.id === id);
                                            setPairingModal(prev => ({ ...prev, userId: id, username: u?.username || 'User' }));
                                            fetchPairingQR(id, pairingModal.serverUrl);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white outline-none cursor-pointer"
                                    >
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.username} ({u.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Server URL setting for LAN */}
                                {pairingModal.tab === 'companion' && (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                                            <span>LAN Server Endpoint:</span>
                                            <button
                                                onClick={() => {
                                                    const def = 'http://10.10.20.4:5005';
                                                    setPairingModal(prev => ({ ...prev, serverUrl: def }));
                                                    fetchPairingQR(pairingModal.userId, def);
                                                }}
                                                className="text-emerald-400 hover:underline font-semibold"
                                            >
                                                Use LAN IP (10.10.20.4)
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={pairingModal.serverUrl}
                                                onChange={(e) => setPairingModal(prev => ({ ...prev, serverUrl: e.target.value }))}
                                                placeholder="http://10.10.20.4:5005"
                                                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 outline-none focus:border-emerald-500 transition-colors"
                                            />
                                            <button
                                                onClick={() => fetchPairingQR(pairingModal.userId, pairingModal.serverUrl)}
                                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 transition-colors"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* QR Display Area */}
                                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950 border border-slate-800/80 min-h-[260px] relative">
                                    {pairingModal.loading ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                                            <p className="text-xs text-slate-400 font-semibold">Generating dynamic security QR...</p>
                                        </div>
                                    ) : pairingModal.error ? (
                                        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center space-y-2">
                                            <AlertCircle className="w-6 h-6 mx-auto text-rose-400" />
                                            <p>{pairingModal.error}</p>
                                            <button
                                                onClick={() => fetchPairingQR(pairingModal.userId, pairingModal.serverUrl)}
                                                className="px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-white text-xs font-bold"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    ) : pairingModal.pairedSuccess ? (
                                        <motion.div
                                            initial={{ scale: 0.85, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-center space-y-3 py-4"
                                        >
                                            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                                <CheckCircle className="w-8 h-8" />
                                            </div>
                                            <h4 className="text-sm font-black text-white">Smartphone Paired Successfully!</h4>
                                            <p className="text-xs text-slate-300 max-w-xs">
                                                Your companion app is linked for push notifications, SMS sync, and TOTP.
                                            </p>
                                        </motion.div>
                                    ) : (
                                        <div className="space-y-4 text-center">
                                            <div className="p-3 bg-white rounded-2xl inline-block shadow-2xl border-4 border-emerald-500/30">
                                                <img
                                                    src={pairingModal.tab === 'companion' ? pairingModal.qrData?.companionQrCodeUrl : pairingModal.qrData?.totpQrCodeUrl}
                                                    alt="Pairing QR Code"
                                                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                                                />
                                            </div>

                                            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-300">
                                                <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                                                <span>Waiting for mobile app to scan...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Instructions */}
                                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 space-y-1.5 leading-relaxed">
                                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Quick Instructions:</span>
                                    </div>
                                    {pairingModal.tab === 'companion' ? (
                                        <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                                            <li>Open the <strong>PEM Companion App</strong> on your Android phone.</li>
                                            <li>Tap <strong>Scan Web Portal QR</strong> or <strong>Pair Device</strong>.</li>
                                            <li>Scan this QR code. Keys, URL, and TOTP will configure in 1 second!</li>
                                        </ol>
                                    ) : (
                                        <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                                            <li>Open Google Authenticator, Microsoft Authenticator, or 1Password.</li>
                                            <li>Tap <strong>Scan QR Code</strong> and point at the QR above.</li>
                                        </ol>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setPairingModal(prev => ({ ...prev, isOpen: false }))}
                                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link to="/admin" className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" /> Security & 2FA Engine
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        MFA Security Management
                    </h1>
                    <p className="text-xs text-slate-400">
                        Configure multi-factor authentication, device pairing, and push notification enforcement.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { fetchUsers(); fetchStats(); }}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
                        <span>Refresh Directory</span>
                    </button>
                    <button
                        onClick={() => openPairingModal(null)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Pair New Device</span>
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-1">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-xs font-semibold uppercase tracking-wider">MFA Adoption</span>
                            <Shield className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">{stats.users?.mfaEnabledUsers ?? stats.users?.mfaEnabled ?? 0}</span>
                            <span className="text-xs text-slate-500">/ {stats.users?.total ?? 0} users</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${stats.users?.mfaEnabledPercentage ?? 0}%` }}
                            />
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-1">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-xs font-semibold uppercase tracking-wider">Paired Devices</span>
                            <Smartphone className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">{stats.devices?.active ?? 0}</span>
                            <span className="text-xs text-slate-500">active smartphones</span>
                        </div>
                        <p className="text-[10px] text-slate-500">Total registered: {stats.devices?.total ?? 0}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-1">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-xs font-semibold uppercase tracking-wider">Primary Method</span>
                            <Key className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">{stats.methods?.both ?? (stats.methods?.totp ?? 0)}</span>
                            <span className="text-xs text-slate-500">
                                {stats.methods?.both > 0 ? 'Dual (Push+TOTP)' : 'TOTP Authenticator'}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500">Push notification: {stats.methods?.push ?? 0}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-1">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-xs font-semibold uppercase tracking-wider">7-Day Success</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">{stats.activity?.successRate ?? '100.00'}%</span>
                            <span className="text-xs text-slate-500">verification rate</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{stats.activity?.recentLogins ?? 0} successful challenges</p>
                    </div>
                </div>
            )}

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    />
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-900/60 p-1 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 px-2">Filter:</span>
                    {['ALL', 'ENABLED', 'DISABLED'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                                statusFilter === f
                                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* User Directory Cards */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Key className="w-4 h-4 text-emerald-400" />
                        User Multi-Factor Status & Pairing ({filteredUsers.length})
                    </h3>
                </div>

                {filteredUsers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredUsers.map((u) => {
                            const isEnabled = Boolean(u.mfaEnabled || u.mfa_enabled);
                            const initials = u.username ? u.username.slice(0, 2).toUpperCase() : '??';
                            const isUpdating = updatingId === u.id;
                            const hasDevice = Boolean(u.hasDevice || u.has_device || u.deviceCount > 0);

                            return (
                                <motion.div
                                    key={u.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all space-y-4 flex flex-col justify-between"
                                >
                                    <div className="space-y-3">
                                        {/* User Header */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border ${
                                                    isEnabled
                                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                }`}>
                                                    {initials}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="text-xs font-bold text-white truncate max-w-[140px]">{u.username}</h4>
                                                    <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{u.email}</p>
                                                </div>
                                            </div>

                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                                                isEnabled
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                            }`}>
                                                {isEnabled ? 'MFA ACTIVE' : 'DISABLED'}
                                            </span>
                                        </div>

                                        {/* Method & Device info */}
                                        <div className="space-y-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-slate-400 font-medium">Method:</span>
                                                <select
                                                    value={u.mfaMethod || u.mfa_method || 'both'}
                                                    onChange={(e) => handleMethodChange(u.id, e.target.value, u.username)}
                                                    disabled={isUpdating}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold text-emerald-400 outline-none cursor-pointer hover:border-slate-700 transition-colors"
                                                >
                                                    <option value="both">Both (Push + TOTP)</option>
                                                    <option value="push">Android Push Only</option>
                                                    <option value="totp">Authenticator (TOTP)</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <span>Device Status:</span>
                                                <span className={`font-semibold flex items-center gap-1 ${hasDevice ? 'text-emerald-400' : isEnabled ? 'text-cyan-400' : 'text-slate-500'}`}>
                                                    {hasDevice ? (
                                                        <>
                                                            <Smartphone className="w-3 h-3 text-emerald-400" />
                                                            <span>Paired Smartphone ({u.deviceCount || 1})</span>
                                                        </>
                                                    ) : isEnabled ? (
                                                        'Software TOTP'
                                                    ) : (
                                                        'No Device'
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleMFA(u.id, isEnabled, u.username)}
                                                disabled={isUpdating}
                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer ${
                                                    isEnabled
                                                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20'
                                                }`}
                                            >
                                                {isEnabled ? <Power className="w-3.5 h-3.5 text-rose-400" /> : <Lock className="w-3.5 h-3.5" />}
                                                <span>{isEnabled ? 'Disable MFA' : 'Enable MFA'}</span>
                                            </button>

                                            <button
                                                onClick={() => openPairingModal(u)}
                                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-950/60 hover:text-emerald-400 text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                                                title="Pair Mobile App / View QR Code"
                                            >
                                                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                                                <span>Pair App</span>
                                            </button>

                                            {isEnabled && (
                                                <button
                                                    onClick={() => setConfirmReset({ isOpen: true, userId: u.id, username: u.username })}
                                                    disabled={isUpdating}
                                                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-700 transition-all cursor-pointer"
                                                    title="Reset MFA & Clear Paired Devices"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-12 text-center space-y-3">
                        <Shield className="w-10 h-10 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">No users found matching your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MfaManager;
