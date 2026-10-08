import { useEffect, useState, useCallback, useMemo } from 'react';
import { API_URL } from '../../config';
import {
    Shield, Smartphone, Key, AlertCircle, CheckCircle, X, RefreshCw,
    Users, Lock, Unlock, Power, Clock, Search, Filter, ShieldCheck,
    CheckCircle2, ArrowLeft, SlidersHorizontal, Info, Sparkles
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
                        Configure multi-factor authentication and standard Authenticator (TOTP) enforcement.
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
                    <Link
                        to="/mfa-setup"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all"
                    >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Pair New Device</span>
                    </Link>
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
                        <p className="text-[10px] text-slate-400">Total registered: {stats.devices?.total ?? 0}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-1">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-xs font-semibold uppercase tracking-wider">Primary Method</span>
                            <Key className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">{stats.methods?.totp ?? 0}</span>
                            <span className="text-xs text-slate-500">TOTP Authenticator</span>
                        </div>
                        <p className="text-[10px] text-slate-400">Push notification: {stats.methods?.push ?? 0}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-1">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-xs font-semibold uppercase tracking-wider">7-Day Success</span>
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">{stats.activity?.successRate ?? 100}%</span>
                            <span className="text-xs text-slate-500">verification rate</span>
                        </div>
                        <p className="text-[10px] text-slate-400">{stats.activity?.recentLogins ?? 0} successful challenges</p>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-[11px] font-bold text-slate-400">Filter:</span>
                    {['ALL', 'ENABLED', 'DISABLED'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                statusFilter === s
                                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Users Directory */}
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
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
                                                    value={u.mfaMethod || u.mfa_method || 'totp'}
                                                    onChange={(e) => handleMethodChange(u.id, e.target.value, u.username)}
                                                    disabled={isUpdating}
                                                    className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200 outline-none cursor-pointer"
                                                >
                                                    <option value="totp">Authenticator (TOTP)</option>
                                                    
                                                    
                                                </select>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <span>Device Status:</span>
                                                <span className="font-semibold text-slate-300">
                                                    {hasDevice ? 'Paired Smartphone' : (isEnabled ? 'Software TOTP' : 'No Device')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                                        <button
                                            onClick={() => handleToggleMFA(u.id, isEnabled, u.username)}
                                            disabled={isUpdating}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-all disabled:opacity-50 ${
                                                isEnabled
                                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20'
                                            }`}
                                        >
                                            {isEnabled ? <Power className="w-3.5 h-3.5 text-rose-400" /> : <Lock className="w-3.5 h-3.5" />}
                                            <span>{isEnabled ? 'Disable MFA' : 'Enable MFA'}</span>
                                        </button>

                                        {isEnabled && (
                                            <button
                                                onClick={() => setConfirmReset({ isOpen: true, userId: u.id, username: u.username })}
                                                disabled={isUpdating}
                                                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-700 transition-all"
                                                title="Reset MFA & Clear Paired Devices"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                                            </button>
                                        )}
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
