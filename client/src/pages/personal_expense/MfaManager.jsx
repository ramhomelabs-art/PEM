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
                fetchUsers();
                fetchStats();
            } else {
                showToast('Failed to update MFA status', 'error');
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
                showToast(`MFA configuration and companion devices reset for ${confirmReset.username}`, 'info');
                fetchUsers();
                fetchStats();
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
                fetchUsers();
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
            const matchesStatus = statusFilter === 'ALL' ||
                (statusFilter === 'ENABLED' && u.mfa_enabled) ||
                (statusFilter === 'DISABLED' && !u.mfa_enabled);
            return matchesSearch && matchesStatus;
        });
    }, [users, searchTerm, statusFilter]);

    const enrolledUsers = users.filter(u => u.mfa_enabled).length;
    const adoptionRate = users.length > 0 ? Math.round((enrolledUsers / users.length) * 100) : 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-100">
            {/* TOAST ALERTS */}
            <AnimatePresence>
                {toast.show && (
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
                            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        <span>{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CONFIRM RESET DIALOG */}
            <ConfirmDialog
                isOpen={confirmReset.isOpen}
                title="Reset User MFA Credentials"
                message={`Are you sure you want to reset MFA for "${confirmReset.username}"? This will invalidate their TOTP secret key and remove all paired companion devices.`}
                onConfirm={handleResetMFA}
                onCancel={() => setConfirmReset({ isOpen: false, userId: null, username: '' })}
            />

            {/* TOP HERO HEADER WITH TELEMETRY */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-xl">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/admin"
                            className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                            title="Back to Admin Console"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                                MFA Security & Device Hub
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    RFC 6238 TOTP
                                </span>
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400">
                                Monitor two-factor enrollment, manage companion device pairings, and enforce security policies.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Status Telemetry Badges */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Adoption Rate */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/70 border border-slate-800">
                        <Shield className="w-3.5 h-3.5 text-emerald-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">MFA Adoption</span>
                            <span className="text-[11px] font-extrabold text-emerald-300">
                                {adoptionRate}% ({enrolledUsers}/{users.length} Users)
                            </span>
                        </div>
                    </div>

                    {/* Linked Companion Devices */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/70 border border-slate-800">
                        <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Companion Devices</span>
                            <span className="text-[11px] font-extrabold text-blue-300">
                                {stats?.activeDevices || enrolledUsers} Paired
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => { fetchUsers(); fetchStats(); }}
                        className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                        title="Refresh Security Status"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* SEARCH & FILTER BAR */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-xl">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by username or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500"
                    />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none cursor-pointer"
                    >
                        <option value="ALL">All Security States ({users.length})</option>
                        <option value="ENABLED">MFA Active ({enrolledUsers})</option>
                        <option value="DISABLED">MFA Disabled ({users.length - enrolledUsers})</option>
                    </select>

                    <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
                        Showing {filteredUsers.length} of {users.length}
                    </span>
                </div>
            </div>

            {/* USER MFA SECURITY DIRECTORY */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Key className="w-4 h-4 text-emerald-400" />
                        User Multi-Factor Status & Pairing
                    </h3>
                </div>

                {filteredUsers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredUsers.map((u) => {
                            const isEnabled = !!u.mfa_enabled;
                            const initials = u.username ? u.username.slice(0, 2).toUpperCase() : '??';
                            const isUpdating = updatingId === u.id;

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
                                                    value={u.mfa_method || 'totp'}
                                                    onChange={(e) => handleMethodChange(u.id, e.target.value, u.username)}
                                                    disabled={isUpdating}
                                                    className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200 outline-none"
                                                >
                                                    <option value="totp">Authenticator (TOTP)</option>
                                                    <option value="companion">Android Companion App</option>
                                                    <option value="email">Email Verification</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <span>Device Status:</span>
                                                <span className="font-semibold text-slate-300">
                                                    {u.has_device ? 'Paired Smartphone' : (isEnabled ? 'Software TOTP' : 'No Device')}
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
