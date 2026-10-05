import { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import {
    CheckCircle, Trash2, RefreshCw, Mail, User, Shield, Server, X
} from 'lucide-react';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';
import { Panel, Button, IconBadge } from '../../components/ui/primitives';

// --- PREMIUM UI COMPONENTS ---

const ContactModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: '450px', padding: '40px',
                background: 'linear-gradient(145deg, #0f172a, #1e293b)',
                borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                position: 'relative', textAlign: 'center'
            }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <X size={24} />
                </button>

                <div style={{ width: '80px', height: '80px', margin: '0 auto 20px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(59,130,246,0.5)' }}>
                    <Shield size={40} color="white" />
                </div>

                <h2 style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 10px 0', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    PEM CORE
                </h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '30px' }}>Personal Expense Manager - Enterprise Edition</p>

                <div style={{ textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                        <div style={{ padding: '10px', background: 'rgba(16,185,129,0.1)', borderRadius: '10px' }}><User size={20} color="#10b981" /></div>
                        <div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>DEVELOPED BY</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>RAM NAGARAJ</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ padding: '10px', background: 'rgba(59,130,246,0.1)', borderRadius: '10px' }}><Mail size={20} color="#3b82f6" /></div>
                        <div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>CONTACT SUPPORT</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>Ramhomelabs@gmail.com</div>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '30px', fontSize: '12px', color: '#475569' }}>
                    Thank you for choosing PEM. Your feedback drives our innovation.
                </div>
            </div>
        </div>
    );
};

const UserAvatar = ({ name }) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const color = colors[name ? name.length % colors.length : 0];

    return (
        <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            backgroundColor: `${color}20`, color: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: '14px', border: `1px solid ${color}40`
        }}>
            {initials}
        </div>
    );
};

const Admin = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showContact, setShowContact] = useState(false);
    const [signupLocked, setSignupLocked] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, userId: null });
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${API_URL}/auth/config`);
            const data = await res.json();
            setSignupLocked(data.signupLocked);
        } catch (err) { console.error('Failed to fetch settings', err); }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/admin/users`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) setUsers(await response.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchUsers();
        fetchSettings(); // NEW
    }, []);

    const toggleSignupLock = async () => {
        try {
            const newVal = !signupLocked;
            await fetch(`${API_URL}/admin/lock-signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ locked: newVal })
            });
            setSignupLocked(newVal);
        } catch { setToast({ show: true, message: 'Failed to update lock status', type: 'error' }); }
    };

    const handleApprove = async (id, role = 'user') => {
        await fetch(`${API_URL}/admin/approve/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ role })
        });
        fetchUsers();
    };

    const handleDelete = async (id) => {
        await fetch(`${API_URL}/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        fetchUsers();
        setConfirmDialog({ isOpen: false, userId: null });
    };

    const handleResetPassword = async (id) => {
        const newPass = prompt("Enter new password:");
        if (newPass) {
            await fetch(`${API_URL}/admin/reset-password/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ newPassword: newPass })
            });
            setToast({ show: true, message: 'Password reset successfully!', type: 'success' });
        }
    };

    return (
        <div className="min-h-screen p-10 text-ink">
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onConfirm={() => handleDelete(confirmDialog.userId)}
                onCancel={() => setConfirmDialog({ isOpen: false, userId: null })}
                title="Delete User"
                message="Are you sure? This effectively bans the user."
            />

            <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />

            <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-ink">User Intelligence</h2>
                    <p className="mt-1 text-sm text-ink-muted">Manage access, roles, and ecosystem security</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant={signupLocked ? 'danger' : 'primary'}
                        icon={signupLocked ? Shield : CheckCircle}
                        onClick={toggleSignupLock}
                    >
                        {signupLocked ? 'Signup Locked' : 'Signup Open'}
                    </Button>
                    <Button icon={Mail} onClick={() => setShowContact(true)}>
                        Contact Support
                    </Button>
                    <Button icon={Shield} onClick={() => window.location.href = '/admin/mfa'}>
                        MFA Manager
                    </Button>
                    <Button variant="primary" icon={Server} onClick={() => window.location.href = '/admin/server-manager'}>
                        Manage Server
                    </Button>
                </div>
            </header>

            {/* PENDING APPROVALS */}
            {users.filter(u => u.status === 'pending').length > 0 && (
                <Panel className="mb-8 border-warn/30 bg-warn-soft/20">
                    <h3 className="mb-5 flex items-center gap-2 text-sm font-bold text-warn">
                        <IconBadge icon={CheckCircle} tone="warn" size="sm" />
                        PENDING APPROVALS ({users.filter(u => u.status === 'pending').length})
                    </h3>
                    <div className="space-y-3">
                        {users.filter(u => u.status === 'pending').map(user => (
                            <div key={user.id} className="flex items-center justify-between rounded-control border border-line bg-surface p-4">
                                <div className="flex items-center gap-3">
                                    <UserAvatar name={user.username} />
                                    <div>
                                        <div className="text-sm font-bold text-ink">{user.username}</div>
                                        <div className="text-xs text-ink-muted">{user.email}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="primary" size="sm" onClick={() => handleApprove(user.id, 'user')}>
                                        Approve
                                    </Button>
                                    <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(user.id)} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px' }}>
                {/* USER LIST */}
                <Panel className="overflow-hidden p-0">
                    <div className="flex items-center justify-between border-b border-line p-5">
                        <h3 className="text-sm font-bold text-ink">Active Users</h3>
                        <Button variant="ghost" size="sm" icon={RefreshCw} loading={loading} onClick={fetchUsers}>
                            Refresh
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-sunken/50">
                                <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">USER</th>
                                <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">STATUS</th>
                                <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">ROLE</th>
                                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id} className="border-b border-line transition hover:bg-sunken/40">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <UserAvatar name={u.username} />
                                            <div>
                                                <div className="text-sm font-bold text-ink">{u.username}</div>
                                                <div className="text-xs text-ink-muted">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '20px' }}>
                                        <span style={{
                                            padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: '900',
                                            backgroundColor: u.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                            color: u.status === 'active' ? '#10b981' : '#f59e0b',
                                            border: u.status === 'active' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(245,158,11,0.2)'
                                        }}>
                                            {u.status?.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '20px' }}>
                                        <span style={{ fontWeight: 'bold', color: '#cbd5e1', fontSize: '13px' }}>{u.role?.toUpperCase()}</span>
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => handleResetPassword(u.id)} title="Reset Password" />
                                            <Button variant="danger" size="sm" icon={Trash2} onClick={() => setConfirmDialog({ isOpen: true, userId: u.id })} title="Delete" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </Panel>

                {/* CREATE FORM */}
                <Panel className="h-fit">
                    <h3 className="mb-5 flex items-center gap-2 text-sm font-bold text-ink">
                        <span className="h-2 w-2 rounded-full bg-brand" />
                        CREATE USER
                    </h3>
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target;
                        await fetch(`${API_URL}/admin/users`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify({
                                username: form.username.value,
                                email: form.email.value,
                                password: form.password.value,
                                role: form.role.value
                            })
                        });
                        form.reset();
                        fetchUsers();
                        setToast({ show: true, message: 'User created successfully!', type: 'success' });
                    }} className="flex flex-col gap-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Username</label>
                            <input name="username" required className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Email</label>
                            <input name="email" type="email" required className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Password</label>
                            <input name="password" type="password" required className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Role</label>
                            <select name="role" className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30">
                                <option value="user">Standard</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <Button type="submit" variant="primary" className="mt-2">
                            Initialize User
                        </Button>
                    </form>
                </Panel>
            </div>

            {/* Toast Notification */}
            {toast.show && (
                <div
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        zIndex: 2000,
                        animation: 'slideIn 0.3s ease-out'
                    }}
                >
                    <div
                        style={{
                            background: toast.type === 'success'
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            padding: '16px 24px',
                            borderRadius: '12px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            minWidth: '300px',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}
                    >
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {toast.type === 'success' ? (
                                <CheckCircle size={24} />
                            ) : (
                                <X size={24} />
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                {toast.type === 'success' ? 'Success!' : 'Error'}
                            </div>
                            <div style={{ fontSize: '13px', opacity: 0.9 }}>
                                {toast.message}
                            </div>
                        </div>
                        <button
                            onClick={() => setToast({ ...toast, show: false })}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px',
                                cursor: 'pointer',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};

export default Admin;



