import { useState, useEffect, useMemo, useCallback } from 'react';
import { API_URL } from '../../config';
import {
    Users, ShieldCheck, UserPlus, RefreshCw, Trash2, Key, CheckCircle,
    X, Search, Filter, Lock, Unlock, Mail, Shield, AlertCircle,
    Activity, Server, ArrowUpRight, CheckSquare, Plus, ExternalLink
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
        } catch (err) {
            console.error(err);
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
                body: JSON.stringify({ lock: !lockSignup })
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
                (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesRole = roleFilter === 'ALL' || u.role?.toLowerCase() === roleFilter.toLowerCase();
            return matchesSearch && matchesRole;
        });
    }, [users, searchTerm, roleFilter]);

    const adminCount = users.filter(u => u.role === 'admin').length;
    const standardCount = users.length - adminCount;

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
                            <Shield className="w-5 h-5 text-cyan-400 shrink-0" />
                        ) : (
                            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        <span>{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CONFIRM DELETE DIALOG */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title="Delete User Account"
                message={`Are you sure you want to permanently delete "${confirmDialog.username}"? This action cannot be undone.`}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDialog({ isOpen: false, userId: null, username: '' })}
            />

            {/* TOP HERO HEADER WITH TELEMETRY */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-xl">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                                Enterprise Admin Console
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    ROOT
                                </span>
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400">
                                Centralized identity management, authorization controls, and system access policies.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Status Telemetry Badges */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Total Users */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/70 border border-slate-800">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Accounts</span>
                            <span className="text-[11px] font-extrabold text-indigo-300">
                                {users.length} Users ({adminCount} Admins)
                            </span>
                        </div>
                    </div>

                    {/* Registration Gate */}
                    <button
                        onClick={toggleSignupLock}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all text-left"
                        title="Click to toggle public signup access"
                    >
                        {lockSignup ? <Lock className="w-3.5 h-3.5 text-rose-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-400" />}
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Signup Gate</span>
                            <span className={`text-[11px] font-extrabold ${lockSignup ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {lockSignup ? 'LOCKED (INVITE ONLY)' : 'OPEN REGISTRATION'}
                            </span>
                        </div>
                    </button>

                    {/* Add User Action */}
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Team Member</span>
                    </button>

                    <button
                        onClick={fetchUsers}
                        className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                        title="Refresh Directory"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* QUICK NAVIGATION SHORTCUT TILES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                    to="/admin/mfa"
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 transition-all backdrop-blur-xl group flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                MFA Security & Device Hub
                                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                            </h3>
                            <p className="text-[11px] text-slate-400">TOTP policies, companion app pairing, and authentication keys</p>
                        </div>
                    </div>
                </Link>

                <Link
                    to="/admin/server-manager"
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/50 transition-all backdrop-blur-xl group flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
                            <Server className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                Server Manager & Diagnostics
                                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
                            </h3>
                            <p className="text-[11px] text-slate-400">Hardware telemetry, live logs, database health, and service controls</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* USER DIRECTORY SEARCH & FILTER BAR */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-xl">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search team by username or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500"
                    />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none cursor-pointer"
                    >
                        <option value="ALL">All Roles ({users.length})</option>
                        <option value="admin">Administrators ({adminCount})</option>
                        <option value="user">Standard Users ({standardCount})</option>
                    </select>

                    <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
                        Showing {filteredUsers.length} of {users.length}
                    </span>
                </div>
            </div>

            {/* USER CARDS DIRECTORY TABLE */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        Team & User Directory
                    </h3>
                </div>

                {filteredUsers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredUsers.map((u) => {
                            const isAdmin = u.role === 'admin';
                            const initials = u.username ? u.username.slice(0, 2).toUpperCase() : '??';

                            return (
                                <motion.div
                                    key={u.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all space-y-4 flex flex-col justify-between"
                                >
                                    <div className="space-y-3">
                                        {/* Avatar & Role Header */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border ${
                                                    isAdmin
                                                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                                }`}>
                                                    {initials}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="text-xs font-bold text-white truncate max-w-[140px]">{u.username}</h4>
                                                    <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{u.email}</p>
                                                </div>
                                            </div>

                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                                                isAdmin
                                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                            }`}>
                                                {u.role?.toUpperCase() || 'STANDARD'}
                                            </span>
                                        </div>

                                        {/* Meta details */}
                                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/80">
                                            <span>User ID: #{u.id}</span>
                                            <span>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active Member'}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                                        <button
                                            onClick={() => handleResetPassword(u.id, u.username)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 transition-all"
                                            title="Reset Password"
                                        >
                                            <Key className="w-3.5 h-3.5 text-amber-400" />
                                            <span>Reset Pass</span>
                                        </button>

                                        {u.is_approved === false && (
                                            <button
                                                onClick={() => handleApprove(u.id, u.username)}
                                                className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all"
                                                title="Approve User Registration"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setConfirmDialog({ isOpen: true, userId: u.id, username: u.username })}
                                            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-700 transition-all"
                                            title="Delete User"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-12 text-center space-y-3">
                        <Users className="w-10 h-10 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">No users found matching your search.</p>
                    </div>
                )}
            </div>

            {/* CREATE USER MODAL */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                                        <UserPlus className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Create New User</h3>
                                        <p className="text-[11px] text-slate-400">Add an account to the enterprise directory</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Username</label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.username}
                                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                        placeholder="e.g. alex_stone"
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        placeholder="alex@company.com"
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Temporary Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        placeholder="••••••••••••"
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Role & Permissions</label>
                                    <select
                                        value={newUser.role}
                                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500"
                                    >
                                        <option value="user">Standard User</option>
                                        <option value="admin">Administrator (Full Root Access)</option>
                                    </select>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creatingUser}
                                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 disabled:opacity-50"
                                    >
                                        {creatingUser ? 'Creating...' : 'Initialize User'}
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
