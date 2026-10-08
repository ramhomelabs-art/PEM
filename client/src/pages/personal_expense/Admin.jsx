import { useState, useEffect, useMemo, useCallback } from 'react';
import { API_URL } from '../../config';
import {
    Users, ShieldCheck, UserPlus, RefreshCw, Trash2, Key, CheckCircle,
    X, Search, Filter, Lock, Unlock, Mail, Shield, AlertCircle,
    Activity, Server, ArrowUpRight, CheckSquare, Plus, ExternalLink, Edit3, Save, UserCog
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';

const Admin = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [lockSignup, setLockSignup] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creatingUser, setCreatingUser] = useState(false);
    
    // Edit User Modal State
    const [editModal, setEditModal] = useState({
        isOpen: false,
        user: null,
        loading: false
    });
    const [editForm, setEditForm] = useState({
        fullName: '',
        username: '',
        email: '',
        role: 'user',
        status: 'active',
        mfaEnabled: false,
        mfaExempt: false,
        newPassword: ''
    });

    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, userId: null, username: '' });
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const [newUser, setNewUser] = useState({
        username: '',
        email: '',
        password: '',
        role: 'user'
    });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || (Array.isArray(data) ? data : []));
            } else {
                showToast('Failed to load user accounts', 'error');
            }
        } catch {
            showToast('Network error loading users', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/auth/config`);
            if (res.ok) {
                const data = await res.json();
                setLockSignup(!!data.lockSignup);
            }
        } catch (e) {
            console.error('Settings fetch error:', e);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        fetchSettings();
    }, [fetchUsers, fetchSettings]);

    const toggleSignupLock = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/lock-signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ locked: !lockSignup })
            });
            if (res.ok) {
                setLockSignup(!lockSignup);
                showToast(`Public signup registration ${!lockSignup ? 'locked' : 'unlocked'}`);
            } else {
                showToast('Failed to update signup lock status', 'error');
            }
        } catch {
            showToast('Error toggling registration gate', 'error');
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUser.username || !newUser.email || !newUser.password) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        setCreatingUser(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(newUser)
            });

            const data = await res.json();
            if (res.ok) {
                showToast(`User "${newUser.username}" created successfully!`, 'success');
                setShowCreateModal(false);
                setNewUser({ username: '', email: '', password: '', role: 'user' });
                fetchUsers();
            } else {
                showToast(data.error || 'Failed to create user', 'error');
            }
        } catch {
            showToast('Error creating user account', 'error');
        } finally {
            setCreatingUser(false);
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (u) => {
        setEditForm({
            fullName: u.fullName || '',
            username: u.username || '',
            email: u.email || '',
            role: u.role || 'user',
            status: u.status || 'active',
            mfaEnabled: Boolean(u.mfaEnabled ?? u.mfa_enabled),
            mfaExempt: Boolean(u.mfaExempt ?? u.mfa_exempt),
            newPassword: ''
        });
        setEditModal({ isOpen: true, user: u, loading: false });
    };

    // Save Edited User
    const handleSaveUser = async (e) => {
        e.preventDefault();
        if (!editModal.user) return;
        setEditModal(prev => ({ ...prev, loading: true }));

        try {
            const token = localStorage.getItem('token');
            const payload = {
                fullName: editForm.fullName,
                username: editForm.username,
                email: editForm.email,
                role: editForm.role,
                status: editForm.status,
                mfaEnabled: editForm.mfaEnabled,
                mfaExempt: editForm.mfaExempt
            };
            if (editForm.newPassword && editForm.newPassword.trim()) {
                payload.password = editForm.newPassword.trim();
            }

            const res = await fetch(`${API_URL}/admin/users/${editModal.user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok) {
                showToast(`User "${editForm.username}" updated successfully!`, 'success');
                setEditModal({ isOpen: false, user: null, loading: false });
                await fetchUsers();
            } else {
                showToast(data.error || 'Failed to update user', 'error');
                setEditModal(prev => ({ ...prev, loading: false }));
            }
        } catch {
            showToast('Error saving user profile', 'error');
            setEditModal(prev => ({ ...prev, loading: false }));
        }
    };

    // Quick Role Switcher
    const handleQuickRoleToggle = async (userId, currentRole, username) => {
        const nextRole = currentRole === 'admin' ? 'user' : 'admin';
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ role: nextRole })
            });
            if (res.ok) {
                showToast(`Role for ${username} updated to ${nextRole.toUpperCase()}`, 'success');
                fetchUsers();
            } else {
                showToast('Failed to change user role', 'error');
            }
        } catch {
            showToast('Error updating role', 'error');
        }
    };

    const handleResetPassword = async (id, username) => {
        const newPass = prompt(`Enter temporary new password for ${username}:`);
        if (!newPass) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/reset-password/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ newPassword: newPass })
            });
            if (res.ok) {
                showToast(`Password for ${username} reset successfully!`, 'success');
            } else {
                showToast('Failed to reset password', 'error');
            }
        } catch {
            showToast('Error resetting user password', 'error');
        }
    };

    const handleDelete = async () => {
        if (!confirmDialog.userId) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/users/${confirmDialog.userId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                showToast('User account deleted', 'info');
                fetchUsers();
            } else {
                showToast('Failed to delete user', 'error');
            }
        } catch {
            showToast('Error deleting user account', 'error');
        } finally {
            setConfirmDialog({ isOpen: false, userId: null, username: '' });
        }
    };

    const handleApprove = async (id, username) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/approve/${id}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                showToast(`User ${username} approved!`, 'success');
                fetchUsers();
            } else {
                showToast('Failed to approve user', 'error');
            }
        } catch {
            showToast('Error approving user', 'error');
        }
    };

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesSearch = !searchTerm || 
                (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesRole = roleFilter === 'ALL' || u.role?.toLowerCase() === roleFilter.toLowerCase();
            return matchesSearch && matchesRole;
        });
    }, [users, searchTerm, roleFilter]);

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
                        {toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> : <CheckCircle className="w-5 h-5 text-emerald-400" />}
                        <span className="text-xs font-bold tracking-wide">{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title="Delete User Account"
                message={`Are you sure you want to permanently delete user "${confirmDialog.username}"? All their associated financial data and transactions will be removed.`}
                confirmText="Delete User"
                cancelText="Cancel"
                type="danger"
                onConfirm={handleDelete}
                onClose={() => setConfirmDialog({ isOpen: false, userId: null, username: '' })}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" /> Core Administration
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        User Management & Roles
                    </h1>
                    <p className="text-xs text-slate-400">
                        Manage system accounts, edit user roles, grant administrator privileges, and configure signup security.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={toggleSignupLock}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                            lockSignup
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                    >
                        {lockSignup ? <Lock className="w-3.5 h-3.5 text-rose-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>{lockSignup ? 'Public Registration Locked' : 'Registration Open'}</span>
                    </button>

                    <button
                        onClick={fetchUsers}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
                        <span>Refresh</span>
                    </button>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add New User</span>
                    </button>
                </div>
            </div>

            {/* Quick Links Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                    to="/mfa-manager"
                    className="group p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 hover:border-emerald-500/40 transition-all flex items-center justify-between"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                            <Key className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                                Multi-Factor Authentication (2FA)
                            </h3>
                            <p className="text-xs text-slate-400">
                                Configure TOTP authenticators, mobile push notifications, and device pairing
                            </p>
                        </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </Link>

                <Link
                    to="/server-manager"
                    className="group p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 hover:border-sky-500/40 transition-all flex items-center justify-between"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center justify-center">
                            <Server className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                                Server & Database Console
                            </h3>
                            <p className="text-xs text-slate-400">
                                Real-time system telemetry, database status, connection pools, and logs
                            </p>
                        </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
                </Link>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by username, name, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-[11px] font-bold text-slate-400">Role:</span>
                    {['ALL', 'ADMIN', 'USER'].map((r) => (
                        <button
                            key={r}
                            onClick={() => setRoleFilter(r)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                roleFilter === r
                                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {/* Users Table / Directory */}
            <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden backdrop-blur-sm">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        Registered Accounts ({filteredUsers.length})
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                <th className="p-4">User</th>
                                <th className="p-4">Email</th>
                                <th className="p-4">Role</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">MFA Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((u) => {
                                    const isMfaActive = Boolean(u.mfaEnabled || u.mfa_enabled);
                                    return (
                                        <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs uppercase">
                                                        {u.username ? u.username.slice(0, 2) : '??'}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-white block">{u.username}</span>
                                                        {u.fullName && <span className="text-[11px] text-slate-400 block">{u.fullName}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-300 font-medium">{u.email}</td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => handleQuickRoleToggle(u.id, u.role, u.username)}
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border transition-all ${
                                                        u.role === 'admin'
                                                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
                                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                                    }`}
                                                    title="Click to toggle role"
                                                >
                                                    {u.role === 'admin' ? '🛡️ Admin' : 'User'}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                                                    u.status === 'active'
                                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                }`}>
                                                    {u.status || 'active'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                                                    isMfaActive
                                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                                                }`}>
                                                    {isMfaActive ? '2FA Enabled' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Edit User Details */}
                                                    <button
                                                        onClick={() => handleOpenEdit(u)}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 text-slate-300 border border-slate-700 transition-all"
                                                        title="Edit User Details & Role"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>

                                                    {/* Approve User if Pending */}
                                                    {u.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleApprove(u.id, u.username)}
                                                            className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800 transition-all"
                                                            title="Approve User Registration"
                                                        >
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}

                                                    {/* Reset Password */}
                                                    <button
                                                        onClick={() => handleResetPassword(u.id, u.username)}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border border-slate-700 transition-all"
                                                        title="Reset Password"
                                                    >
                                                        <Key className="w-3.5 h-3.5" />
                                                    </button>

                                                    {/* Delete User */}
                                                    <button
                                                        onClick={() => setConfirmDialog({ isOpen: true, userId: u.id, username: u.username })}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-700 transition-all"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        No user accounts found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* EDIT USER MODAL */}
            <AnimatePresence>
                {editModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5"
                        >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                                        <UserCog className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-white">Edit User Account</h3>
                                        <p className="text-xs text-slate-400">Modify credentials, roles, and privileges</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditModal({ isOpen: false, user: null, loading: false })}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Username</label>
                                        <input
                                            type="text"
                                            required
                                            value={editForm.username}
                                            onChange={(e) => setEditForm(p => ({ ...p, username: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-emerald-500"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Full Name</label>
                                        <input
                                            type="text"
                                            value={editForm.fullName}
                                            onChange={(e) => setEditForm(p => ({ ...p, fullName: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={editForm.email}
                                        onChange={(e) => setEditForm(p => ({ ...p, email: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">System Role</label>
                                        <select
                                            value={editForm.role}
                                            onChange={(e) => setEditForm(p => ({ ...p, role: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none cursor-pointer"
                                        >
                                            <option value="user">Standard User</option>
                                            <option value="admin">System Administrator</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Account Status</label>
                                        <select
                                            value={editForm.status}
                                            onChange={(e) => setEditForm(p => ({ ...p, status: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none cursor-pointer"
                                        >
                                            <option value="active">Active</option>
                                            <option value="pending">Pending Approval</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-white block">Multi-Factor Authentication (2FA)</span>
                                            <span className="text-[10px] text-slate-400">Require OTP code upon sign-in</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={editForm.mfaEnabled}
                                            onChange={(e) => setEditForm(p => ({ ...p, mfaEnabled: e.target.checked }))}
                                            className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between border-t border-slate-800/60 pt-2.5">
                                        <div>
                                            <span className="font-bold text-white block">MFA Exemption</span>
                                            <span className="text-[10px] text-slate-400">Bypass 2FA checks (Break-glass)</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={editForm.mfaExempt}
                                            onChange={(e) => setEditForm(p => ({ ...p, mfaExempt: e.target.checked }))}
                                            className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Set New Password (Optional)</label>
                                    <input
                                        type="password"
                                        placeholder="Leave blank to keep existing password"
                                        value={editForm.newPassword}
                                        onChange={(e) => setEditForm(p => ({ ...p, newPassword: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setEditModal({ isOpen: false, user: null, loading: false })}
                                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={editModal.loading}
                                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>{editModal.loading ? 'Saving...' : 'Save Changes'}</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* CREATE USER MODAL */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5"
                        >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                                        <UserPlus className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-white">Create New Account</h3>
                                        <p className="text-xs text-slate-400">Add a member to the system</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                                <div className="space-y-1">
                                    <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Username</label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.username}
                                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-emerald-500"
                                        placeholder="john_doe"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-emerald-500"
                                        placeholder="john@example.com"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none focus:border-emerald-500"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Initial Role</label>
                                    <select
                                        value={newUser.role}
                                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold outline-none"
                                    >
                                        <option value="user">Standard User</option>
                                        <option value="admin">System Administrator</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creatingUser}
                                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                    >
                                        {creatingUser ? 'Creating...' : 'Create Account'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Admin;
