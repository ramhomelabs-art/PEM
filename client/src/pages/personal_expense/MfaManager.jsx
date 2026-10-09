import { useEffect, useState, useCallback, useMemo } from 'react';
import { API_URL } from '../../config';
import {
    Shield, Smartphone, Key, AlertCircle, CheckCircle, X, RefreshCw,
    Users, Lock, Unlock, Power, Clock, Search, Filter, ShieldCheck,
    CheckCircle2, ArrowLeft, SlidersHorizontal, Info, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';

const MfaManager = () => {
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
                showToast(`MFA reset for ${confirmReset.username}. Next login will require QR setup.`, 'info');
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
        <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto min-h-screen text-ink">
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
                title="Reset MFA — User Will Re-Register"
                message={`This will remove all paired devices and TOTP secrets for "${confirmReset.username}". On their next login, they will be required to scan the QR code and register again.`}
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
                        <Link to="/admin" className="p-2 rounded-xl bg-surface/80 hover:bg-line text-ink-muted hover:text-ink transition-all">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" /> Security & 2FA Engine
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight">
                        MFA Security Management
                    </h1>
                    <p className="text-xs text-ink-muted">
                        Enable MFA for users. They will be asked to register their Android companion app on next login.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { fetchUsers(); fetchStats(); }}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-line text-ink text-xs font-bold transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
                        <span>Refresh Directory</span>
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-surface/70 backdrop-blur-sm space-y-1 shadow-sm">
                        <div className="flex items-center justify-between text-ink-muted">
                            <span className="text-xs font-semibold uppercase tracking-wider">MFA Adoption</span>
                            <Shield className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-ink">{stats.users?.mfaEnabled ?? 0}</span>
                            <span className="text-xs text-ink-faint">/ {stats.users?.total ?? 0} users</span>
                        </div>
                        <div className="w-full bg-raised h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${stats.users?.mfaEnabledPercentage ?? 0}%` }}
                            />
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface/70 backdrop-blur-sm space-y-1 shadow-sm">
                        <div className="flex items-center justify-between text-ink-muted">
                            <span className="text-xs font-semibold uppercase tracking-wider">Paired Devices</span>
                            <Smartphone className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-ink">{stats.devices?.active ?? 0}</span>
                            <span className="text-xs text-ink-faint">active smartphones</span>
                        </div>
                        <p className="text-[10px] text-ink-faint">Total registered: {stats.devices?.total ?? 0}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface/70 backdrop-blur-sm space-y-1 shadow-sm">
                        <div className="flex items-center justify-between text-ink-muted">
                            <span className="text-xs font-semibold uppercase tracking-wider">Auth Method</span>
                            <Key className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-ink">{stats.methods?.both ?? 0}</span>
                            <span className="text-xs text-ink-faint">Dual (Push+TOTP)</span>
                        </div>
                        <p className="text-[10px] text-ink-faint">TOTP only: {stats.methods?.totp ?? 0} | Push only: {stats.methods?.push ?? 0}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface/70 backdrop-blur-sm space-y-1 shadow-sm">
                        <div className="flex items-center justify-between text-ink-muted">
                            <span className="text-xs font-semibold uppercase tracking-wider">7-Day Success</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-ink">{stats.activity?.successRate ?? '100.00'}%</span>
                            <span className="text-xs text-ink-faint">verification rate</span>
                        </div>
                        <p className="text-[10px] text-ink-faint">{stats.activity?.recentLogins ?? 0} successful challenges</p>
                    </div>
                </div>
            )}

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface/60 text-xs text-ink placeholder:text-ink-faint focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    />
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto bg-surface/60 p-1 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-ink-faint px-2">Filter:</span>
                    {['ALL', 'ENABLED', 'DISABLED'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                                statusFilter === f
                                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* How it Works Banner */}
            <div className="p-4 rounded-2xl bg-surface/50 flex items-start gap-3 shadow-sm">
                <Info className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs text-ink-muted leading-relaxed space-y-0.5">
                    <p className="text-ink font-bold text-xs">How MFA works in this system:</p>
                    <p>1. <strong>Enable MFA</strong> for a user below. 2. When they next log in, they will be <strong>required to scan the QR code</strong> using the <strong>PEM Android Companion App</strong>. 3. The app will receive the server URL, webhook endpoint, encryption keys, and TOTP secret automatically. 4. <strong>Reset MFA</strong> to clear their device — they must re-register on next login.</p>
                </div>
            </div>

            {/* User Directory Cards */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                        <Key className="w-4 h-4 text-emerald-400" />
                        User Multi-Factor Status ({filteredUsers.length})
                    </h3>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="p-4 rounded-2xl bg-surface/40 space-y-3 animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-raised" />
                                    <div className="space-y-1.5 flex-1">
                                        <div className="h-3 bg-raised rounded-lg w-28" />
                                        <div className="h-2.5 bg-raised rounded-lg w-36" />
                                    </div>
                                </div>
                                <div className="h-16 bg-raised rounded-xl" />
                                <div className="h-9 bg-raised rounded-xl" />
                            </div>
                        ))}
                    </div>
                ) : filteredUsers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredUsers.map((u) => {
                            const isEnabled = Boolean(u.mfaEnabled || u.mfa_enabled);
                            const isConfigured = Boolean(u.mfaConfigured);
                            const initials = u.username ? u.username.slice(0, 2).toUpperCase() : '??';
                            const isUpdating = updatingId === u.id;
                            const hasDevice = Boolean(u.hasDevice || u.has_device || u.deviceCount > 0);

                            return (
                                <motion.div
                                    key={u.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-2xl bg-surface/70 transition-all space-y-4 flex flex-col justify-between shadow-md"
                                >
                                    <div className="space-y-3">
                                        {/* User Header */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                                                    isEnabled && isConfigured
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                        : isEnabled && !isConfigured
                                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                        : 'bg-raised text-ink-muted'
                                                }`}>
                                                    {initials}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="text-xs font-bold text-ink truncate max-w-[140px]">{u.username}</h4>
                                                    <p className="text-[10px] text-ink-muted truncate max-w-[140px]">{u.email}</p>
                                                </div>
                                            </div>

                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                                isEnabled && isConfigured
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                    : isEnabled && !isConfigured
                                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                    : 'bg-raised text-ink-muted'
                                            }`}>
                                                {isEnabled && isConfigured ? 'PROTECTED' : isEnabled && !isConfigured ? 'PENDING SETUP' : 'DISABLED'}
                                            </span>
                                        </div>

                                        {/* Method & Device info */}
                                        <div className="space-y-2 p-3 rounded-xl bg-sunken/60">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-ink-muted font-medium">Method:</span>
                                                <select
                                                    value={u.mfaMethod || u.mfa_method || 'both'}
                                                    onChange={(e) => handleMethodChange(u.id, e.target.value, u.username)}
                                                    disabled={isUpdating || !isEnabled}
                                                    className="px-2.5 py-1 rounded-lg bg-sunken text-xs font-semibold text-emerald-400 outline-none cursor-pointer transition-colors disabled:opacity-50"
                                                >
                                                    <option value="both">Both (Push + TOTP)</option>
                                                    <option value="push">Android Push Only</option>
                                                    <option value="totp">TOTP Only</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-ink-muted">
                                                <span>Device:</span>
                                                <span className={`font-semibold flex items-center gap-1 ${
                                                    hasDevice ? 'text-emerald-400' : isEnabled ? 'text-amber-400' : 'text-ink-faint'
                                                }`}>
                                                    {hasDevice ? (
                                                        <><Smartphone className="w-3 h-3" /> Android App Paired</>
                                                    ) : isEnabled && !isConfigured ? (
                                                        <><Clock className="w-3 h-3" /> Awaiting QR Scan</>
                                                    ) : isEnabled ? (
                                                        'Software TOTP'
                                                    ) : (
                                                        'No Device'
                                                    )}
                                                </span>
                                            </div>

                                            {isEnabled && !isConfigured && (
                                                <div className="mt-1 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 text-center">
                                                    User will register QR on next login
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 pt-2">
                                        <button
                                            onClick={() => handleToggleMFA(u.id, isEnabled, u.username)}
                                            disabled={isUpdating}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer ${
                                                isEnabled
                                                    ? 'bg-raised hover:bg-line text-ink'
                                                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20'
                                            }`}
                                        >
                                            {isUpdating ? (
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            ) : isEnabled ? (
                                                <Power className="w-3.5 h-3.5 text-rose-400" />
                                            ) : (
                                                <Lock className="w-3.5 h-3.5" />
                                            )}
                                            <span>{isEnabled ? 'Disable MFA' : 'Enable MFA'}</span>
                                        </button>

                                        {isEnabled && (
                                            <button
                                                onClick={() => setConfirmReset({ isOpen: true, userId: u.id, username: u.username })}
                                                disabled={isUpdating}
                                                className="p-2 rounded-xl bg-raised hover:bg-rose-950 hover:text-rose-400 text-ink-muted transition-all cursor-pointer"
                                                title="Reset MFA — Clears device & requires re-registration"
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
                        <Shield className="w-10 h-10 text-ink-faint mx-auto" />
                        <p className="text-xs text-ink-muted">No users found matching your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MfaManager;
