import { useEffect, useState, useCallback } from 'react';
import { API_URL } from '../../config';
import {
    Shield, Smartphone, Key, AlertCircle, CheckCircle, X, RefreshCw,
    Users, Lock, Unlock, Power, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Panel, Button, IconBadge, StatTile } from '../../components/ui/primitives';

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

const MfaManager = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [searchTerm, setSearchTerm] = useState('');

    const showToast = useCallback((message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/admin/mfa/users`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
            showToast('Failed to load users', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/admin/mfa/stats`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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

    const handleResetMFA = async (userId, username) => {
        if (!confirm(`Reset MFA for ${username}? This will remove all devices and TOTP configuration.`)) return;

        try {
            const response = await fetch(`${API_URL}/admin/mfa/reset/${userId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.ok) {
                showToast(`MFA reset successfully for ${username}`, 'success');
                fetchUsers();
                fetchStats();
            } else {
                showToast('Failed to reset MFA', 'error');
            }
        } catch {
            showToast('Error resetting MFA', 'error');
        }
    };

    const handleToggleMFA = async (userId, username, currentEnabled) => {
        try {
            const response = await fetch(`${API_URL}/admin/mfa/enable/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled: !currentEnabled })
            });

            if (response.ok) {
                showToast(`MFA ${!currentEnabled ? 'enabled' : 'disabled'} for ${username}`, 'success');
                fetchUsers();
                fetchStats();
            } else {
                showToast('Failed to update MFA status', 'error');
            }
        } catch {
            showToast('Error updating MFA status', 'error');
        }
    };

    const handleMethodChange = async (userId, username, newMethod) => {
        if (!confirm(`Change MFA method for ${username} to ${newMethod.toUpperCase()}?`)) {
            // Revert UI change by forcing re-render via state update or just fetching
            // A simple fetchUsers() below will reset it if api call fails or is cancelled
            return;
        }

        try {
            const response = await fetch(`${API_URL}/admin/mfa/method/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ method: newMethod })
            });

            if (response.ok) {
                showToast(`Method updated to ${newMethod.toUpperCase()} for ${username}`, 'success');
                fetchUsers();
                fetchStats();
            } else {
                showToast('Failed to update method', 'error');
                fetchUsers(); // Revert
            }
        } catch {
            showToast('Error updating method', 'error');
            fetchUsers(); // Revert
        }
    };

    const MethodSelect = ({ user }) => {
        const currentCheck = user.mfaMethod || 'none';

        const styles = {
            push: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
            totp: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
            both: { bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
            none: { bg: 'rgba(100,116,139,0.1)', color: '#64748b', border: 'rgba(100,116,139,0.3)' }
        };
        const style = styles[currentCheck] || styles.none;

        return (
            <select
                value={currentCheck}
                onChange={(e) => handleMethodChange(user.id, user.username, e.target.value)}
                style={{
                    padding: '4px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '900',
                    backgroundColor: style.bg, color: style.color, border: `1px solid ${style.border}`,
                    cursor: 'pointer', outline: 'none'
                }}
            >
                <option value="push">PUSH</option>
                <option value="totp">TOTP</option>
                <option value="both">BOTH</option>
                <option value="none">NONE</option>
            </select>
        );
    };

    const filteredUsers = users.filter(user =>
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen p-10 text-ink">
            {/* Header */}
            <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="flex items-center gap-3 text-3xl font-black tracking-tight text-ink">
                        <IconBadge icon={Shield} tone="brand" size="lg" />
                        MFA Security Center
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">Multi-Factor Authentication Management</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button onClick={() => navigate('/admin')}>
                        ← Back to Admin
                    </Button>
                    <Button variant="primary" icon={RefreshCw} loading={loading} onClick={() => { fetchUsers(); fetchStats(); }}>
                        Refresh
                    </Button>
                </div>
            </header>

            {/* Statistics Cards */}
            {stats && (
                <div className="mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile label="Total Users" value={stats.users?.total ?? stats.totalUsers ?? 0} tone="brand" icon={Users} />
                    <StatTile label="MFA Enabled" value={stats.users?.mfaEnabled ?? stats.enabled ?? 0} tone="pos" icon={Shield} hint={`${stats.users?.mfaEnabledPercentage ?? 0}%`} />
                    <StatTile label="Active Devices" value={stats.devices?.active ?? 0} tone="violet" icon={Smartphone} />
                    <StatTile label="Recent Logins (24H)" value={stats.activity?.recentLogins ?? 0} tone="warn" icon={AlertCircle} />
                </div>
            )}

            {/* Search Bar */}
            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-control border border-line bg-sunken px-5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
            </div>

            {/* Users Table */}
            <Panel className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-line p-5">
                    <h3 className="text-sm font-bold text-ink">User MFA Status ({filteredUsers.length})</h3>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-sunken/50">
                            <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">USER</th>
                            <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">MFA STATUS</th>
                            <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">METHOD</th>
                            <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">DEVICES</th>
                            <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">LAST USED</th>
                            <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user) => (
                            <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                <td style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <UserAvatar name={user.username} />
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {user.username}
                                                {user.mfaExempt && (
                                                    <span style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', borderRadius: '10px', fontWeight: '900' }}>
                                                        EXEMPT
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '20px' }}>
                                    {user.mfaEnabled ? (
                                        <span style={{
                                            padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: '900',
                                            backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981',
                                            border: '1px solid rgba(16,185,129,0.2)', display: 'inline-flex', alignItems: 'center', gap: '6px'
                                        }}>
                                            <CheckCircle size={12} /> ENABLED
                                        </span>
                                    ) : (
                                        <span style={{
                                            padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: '900',
                                            backgroundColor: 'rgba(100,116,139,0.1)', color: '#64748b',
                                            border: '1px solid rgba(100,116,139,0.2)', display: 'inline-flex', alignItems: 'center', gap: '6px'
                                        }}>
                                            <AlertCircle size={12} /> DISABLED
                                        </span>
                                    )}
                                </td>
                                <td style={{ padding: '20px' }}>
                                    <MethodSelect user={user} />
                                </td>
                                <td style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Smartphone size={16} color={user.deviceCount > 0 ? '#3b82f6' : '#64748b'} />
                                        <span style={{ fontWeight: 'bold', color: user.deviceCount > 0 ? 'white' : '#64748b' }}>
                                            {user.deviceCount || 0}
                                        </span>
                                    </div>
                                </td>
                                <td style={{ padding: '20px' }}>
                                    {user.lastDeviceUsed ? (
                                        <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Clock size={14} />
                                            {new Date(user.lastDeviceUsed).toLocaleDateString()}
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>Never</span>
                                    )}
                                </td>
                                <td style={{ padding: '20px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handleToggleMFA(user.id, user.username, user.mfaEnabled)}
                                            title={user.mfaEnabled ? "Disable MFA" : "Enable MFA"}
                                            style={{
                                                padding: '8px', borderRadius: '8px',
                                                background: user.mfaEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.05)',
                                                color: user.mfaEnabled ? '#10b981' : '#64748b',
                                                border: 'none', cursor: 'pointer'
                                            }}
                                        >
                                            <Power size={16} />
                                        </button>

                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(`${API_URL}/admin/mfa/user/${user.id}/secret`, {
                                                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                                                    });
                                                    const data = await res.json();
                                                    if (data.code) {
                                                        alert(`VERIFICATION CODE for ${user.username}:\n\n${data.code}\n\nExpires in: ${data.expiresIn} seconds\nStatus: ${data.isVerified ? 'Verified' : 'Pending Verification'}\n\nUser should enter this code in their app to verify.`);
                                                    } else {
                                                        alert(data.message || 'No verification code available for this user.');
                                                    }
                                                } catch {
                                                    alert('Failed to fetch verification code');
                                                }
                                            }}
                                            title="View Verification Code"
                                            style={{
                                                padding: '8px', borderRadius: '8px',
                                                background: 'rgba(234, 179, 8, 0.1)',
                                                color: '#eab308',
                                                border: 'none', cursor: 'pointer'
                                            }}
                                        >
                                            <Key size={16} />
                                        </button>

                                        <button
                                            onClick={() => handleResetMFA(user.id, user.username)}
                                            title="Reset MFA"
                                            // Disabled logic removed as per request to fix unresponsive button
                                            // Previously disabled={!user.mfaEnabled}
                                            style={{
                                                padding: '8px', borderRadius: '8px',
                                                background: 'rgba(239,68,68,0.1)', // Always show active style
                                                color: '#ef4444',
                                                border: 'none', cursor: 'pointer',
                                                opacity: 1
                                            }}
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </Panel>

            {/* Toast Notification */}
            {
                toast.show && (
                    <div style={{
                        position: 'fixed', top: '20px', right: '20px', zIndex: 2000,
                        animation: 'slideIn 0.3s ease-out'
                    }}>
                        <div style={{
                            background: toast.type === 'success'
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white', padding: '16px 24px', borderRadius: '12px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.3)', display: 'flex',
                            alignItems: 'center', gap: '12px', minWidth: '300px',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                {toast.type === 'success' ? <CheckCircle size={24} /> : <X size={24} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                    {toast.type === 'success' ? 'Success!' : 'Error'}
                                </div>
                                <div style={{ fontSize: '13px', opacity: 0.9 }}>{toast.message}</div>
                            </div>
                            <button
                                onClick={() => setToast({ ...toast, show: false })}
                                style={{
                                    background: 'rgba(255,255,255,0.2)', border: 'none',
                                    borderRadius: '6px', padding: '6px', cursor: 'pointer',
                                    color: 'white', display: 'flex', alignItems: 'center'
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )
            }

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

export default MfaManager;
