import { useState, useEffect, useCallback } from 'react';
import { API_URL, BASE_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User,
    Mail,
    Phone,
    Globe,
    Clock,
    DollarSign,
    Camera,
    Save,
    Shield,
    Lock,
    Moon,
    Sun,
    ArrowLeft,
    Target,
    Check,
    ShieldCheck,
    Server,
    Send,
    KeyRound,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Panel, Button } from '../../components/ui/primitives';

// MOVE COMPONENTS OUTSIDE TO PREVENT RE-RENDERING LOOSE FOCUS
const RichInput = ({ label, icon: Icon, value, onChange, placeholder, type = "text", isSelect = false, options = [], theme }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', width: '100%' }}>
        <label style={{ fontSize: '11px', fontWeight: '900', color: theme.textSecondary, letterSpacing: '2px', marginLeft: '4px' }}>{label}</label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Icon size={20} style={{ position: 'absolute', left: '16px', color: theme.accent, zIndex: 10 }} />
            {isSelect ? (
                <select
                    value={value}
                    onChange={onChange}
                    style={{
                        width: '100%',
                        backgroundColor: theme.inputBg,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '16px',
                        padding: '16px 16px 16px 52px',
                        color: theme.text,
                        fontSize: '15px',
                        fontWeight: '700',
                        outline: 'none',
                        cursor: 'pointer',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        appearance: 'none',
                        background: `${theme.inputBg} url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E") no-repeat right 16px center`
                    }}
                >
                    {options.map(opt => (
                        <option key={opt.value || opt} value={opt.value || opt} style={{ background: theme.bg, color: theme.text }}>
                            {opt.label || opt}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    type={type}
                    value={value || ''}
                    onChange={onChange}
                    placeholder={placeholder}
                    style={{
                        width: '100%',
                        backgroundColor: theme.inputBg,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '16px',
                        padding: '16px 16px 16px 52px',
                        color: theme.text,
                        fontSize: '15px',
                        fontWeight: '700',
                        outline: 'none',
                        boxSizing: 'border-box'
                    }}
                />
            )}
        </div>
    </div>
);

const countryData = {
    'India': { currency: 'INR', timezone: 'IST (UTC+5:30)', offset: 5.5 },
    'USA': { currency: 'USD', timezone: 'EST (UTC-5)', offset: -5 },
    'UK': { currency: 'GBP', timezone: 'GMT (UTC+0)', offset: 0 },
    'Dubai': { currency: 'AED', timezone: 'GST (UTC+4)', offset: 4 },
    'Singapore': { currency: 'SGD', timezone: 'SGT (UTC+8)', offset: 8 },
    'Australia': { currency: 'AUD', timezone: 'AEST (UTC+10)', offset: 10 },
    'Germany': { currency: 'EUR', timezone: 'CET (UTC+1)', offset: 1 },
    'Japan': { currency: 'JPY', timezone: 'JST (UTC+9)', offset: 9 }
};

const Profile = () => {
    const { user, updateUser } = useAuth();
    const { toggleTheme, mode } = useTheme();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        mobile: '',
        dob: '',
        country: 'India',
        currency: 'INR',
        timezone: 'IST (UTC+5:30)',
        role: 'user',
        mfaMethod: 'none'
    });

    // Password Update State
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordStatus, setPasswordStatus] = useState({ msg: '', isError: false });
    const [changingPassword, setChangingPassword] = useState(false);

    // Recovery preference State
    const [recoveryMethod, setRecoveryMethod] = useState('email');
    const [recoveryMfaAvailable, setRecoveryMfaAvailable] = useState(false);
    const [recoveryStatus, setRecoveryStatus] = useState({ msg: '', isError: false });
    const [savingRecovery, setSavingRecovery] = useState(false);

    // Admin email (SMTP) configuration State
    const [emailCfg, setEmailCfg] = useState({
        enabled: false,
        host: '',
        port: 587,
        secure: false,
        user: '',
        from: '',
        hasPassword: false,
        configured: false,
        source: null
    });
    const [smtpPassword, setSmtpPassword] = useState('');
    const [emailStatus, setEmailStatus] = useState({ msg: '', isError: false });
    const [savingEmail, setSavingEmail] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);

    // Recovery self-test State
    const [selfTestCode, setSelfTestCode] = useState('');
    const [selfTestSent, setSelfTestSent] = useState(null);
    const [selfTestStatus, setSelfTestStatus] = useState({ msg: '', isError: false });
    const [sendingSelfTest, setSendingSelfTest] = useState(false);
    const [verifyingSelfTest, setVerifyingSelfTest] = useState(false);

    useEffect(() => {
        if (user) {
            // Initial load from context (fast)
            setFormData({
                fullName: user.fullName || '',
                email: user.email || '',
                mobile: user.mobile || '',
                dob: user.dob || '',
                country: user.country || 'India',
                currency: user.currency || 'INR',
                timezone: user.timezone || 'IST (UTC+5:30)',
                role: user.role || 'user',
                mfaMethod: user.mfaMethod || 'none'
            });
            setPreviewUrl(user.profilePhoto ? (user.profilePhoto.startsWith('http') ? user.profilePhoto : `${BASE_URL}/${user.profilePhoto.replace(/\\/g, '/')}`) : null);

            // Fetch fresh data from server (accurate)
            fetch(`${API_URL}/user/profile/${user.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        setFormData(prev => ({
                            ...prev,
                            fullName: data.fullName || '',
                            email: data.email || '',
                            mobile: data.mobile || '',
                            dob: data.dob || '',
                            country: data.country || prev.country,
                            currency: data.currency || prev.currency,
                            timezone: data.timezone || prev.timezone,
                            role: data.role || prev.role,
                            mfaMethod: data.mfaMethod || prev.mfaMethod
                        }));
                        if (data.profilePhoto) {
                            setPreviewUrl(data.profilePhoto.startsWith('http') ? data.profilePhoto : `${BASE_URL}/${data.profilePhoto.replace(/\\/g, '/')}`);
                        }
                    }
                })
                .catch(err => console.error("Failed to fetch fresh profile:", err));
        }
    }, [user]);

    // Load recovery preference + admin email configuration.
    useEffect(() => {
        if (!user) return;
        const token = localStorage.getItem('token');

        fetch(`${API_URL}/auth/recovery/preference`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    setRecoveryMethod(data.recoveryMethod || 'email');
                    setRecoveryMfaAvailable(Boolean(data.mfaAvailable));
                }
            })
            .catch(err => console.error('Failed to load recovery preference:', err));

        if (user.role === 'admin') {
            fetch(`${API_URL}/auth/recovery/email-config`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        setEmailCfg({
                            enabled: Boolean(data.enabled),
                            host: data.host || '',
                            port: data.port || 587,
                            secure: Boolean(data.secure),
                            user: data.user || '',
                            from: data.from || '',
                            hasPassword: Boolean(data.hasPassword),
                            configured: Boolean(data.configured),
                            source: data.source || null
                        });
                    }
                })
                .catch(err => console.error('Failed to load email configuration:', err));
        }
    }, [user]);

    const [photoBlob, setPhotoBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(user?.profilePhoto ? (user.profilePhoto.startsWith('http') ? user.profilePhoto : `${BASE_URL}/${user.profilePhoto.replace(/\\/g, '/')}`) : null);

    const getLocalizedTime = useCallback(() => {
        const selected = countryData[formData.country] || { offset: 0 };
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const nd = new Date(utc + (3600000 * selected.offset));
        return nd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, [formData.country]);

    const [timeStr, setTimeStr] = useState(getLocalizedTime());

    useEffect(() => {
        document.title = "PEM Pro | Account Portfolio";
        const timer = setInterval(() => setTimeStr(getLocalizedTime()), 1000);
        return () => clearInterval(timer);
    }, [getLocalizedTime]);

    const handleCountryChange = (e) => {
        const country = e.target.value;
        const localization = countryData[country] || { currency: 'USD', timezone: 'UTC' };
        setFormData(prev => ({
            ...prev,
            country,
            currency: localization.currency,
            timezone: localization.timezone
        }));
    };

    const handleMfaChange = async (e) => {
        const newMethod = e.target.value;
        if (!confirm(`Switch Two-Factor Authentication to ${newMethod === 'totp' ? 'ENABLED (Authenticator App)' : 'DISABLED'}?`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/mfa/setup/configure-method`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ method: newMethod })
            });
            const data = await res.json();

            if (res.ok) {
                setFormData(p => ({ ...p, mfaMethod: newMethod }));
                alert(data.message || "MFA settings updated successfully.");
            } else {
                if (newMethod === 'totp' && data.error && data.error.includes('TOTP not configured')) {
                    navigate('/mfa-setup', { state: { userId: user.id, token } });
                } else {
                    alert(`Error: ${data.error || 'Failed to update MFA settings'}`);
                }
            }
        } catch (err) {
            console.error(err);
            alert("Failed to update MFA settings");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (e) => {
        const newRole = e.target.value;
        if (!confirm(`Change this account's role to ${newRole.toUpperCase()}?`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/users/${user.id}/role`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ role: newRole })
            });
            const data = await res.json();

            if (res.ok) {
                setFormData(p => ({ ...p, role: newRole }));
                updateUser({ role: newRole });
                alert(data.message || 'Role updated successfully.');
            } else {
                alert(`Error: ${data.error || 'Failed to update role'}`);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to update role');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setPasswordStatus({ msg: '', isError: false });
        if (!passwordData.currentPassword || !passwordData.newPassword) {
            setPasswordStatus({ msg: 'Please enter both current and new password.', isError: true });
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordStatus({ msg: 'New passwords do not match.', isError: true });
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setPasswordStatus({ msg: 'New password must be at least 6 characters.', isError: true });
            return;
        }

        setChangingPassword(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/user/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                })
            });
            const data = await res.json();
            if (res.ok) {
                setPasswordStatus({ msg: 'Password updated successfully!', isError: false });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                setPasswordStatus({ msg: data.error || 'Failed to update password', isError: true });
            }
        } catch {
            setPasswordStatus({ msg: 'Network error updating password', isError: true });
        } finally {
            setChangingPassword(false);
        }
    };

    const handleSaveRecovery = async () => {
        setRecoveryStatus({ msg: '', isError: false });
        if (recoveryMethod === 'mfa' && !recoveryMfaAvailable) {
            setRecoveryStatus({ msg: 'Set up your authenticator app (MFA) first.', isError: true });
            return;
        }
        setSavingRecovery(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/auth/recovery/preference`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ recoveryMethod })
            });
            const data = await res.json();
            if (res.ok) {
                setRecoveryStatus({ msg: 'Recovery preference saved.', isError: false });
            } else {
                setRecoveryStatus({ msg: data.error || 'Failed to save preference.', isError: true });
            }
        } catch {
            setRecoveryStatus({ msg: 'Network error saving preference.', isError: true });
        } finally {
            setSavingRecovery(false);
        }
    };

    const handleSaveEmailConfig = async () => {
        setEmailStatus({ msg: '', isError: false });
        if (emailCfg.enabled && (!emailCfg.host || !emailCfg.user)) {
            setEmailStatus({ msg: 'Host and sender email are required to enable email recovery.', isError: true });
            return;
        }
        if (emailCfg.enabled && !emailCfg.hasPassword && !smtpPassword) {
            setEmailStatus({ msg: 'An app password is required to enable email recovery.', isError: true });
            return;
        }
        setSavingEmail(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/auth/recovery/email-config`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    enabled: emailCfg.enabled,
                    host: emailCfg.host,
                    port: emailCfg.port,
                    secure: emailCfg.secure,
                    user: emailCfg.user,
                    from: emailCfg.from,
                    password: smtpPassword
                })
            });
            const data = await res.json();
            if (res.ok) {
                setEmailCfg(prev => ({
                    ...prev,
                    hasPassword: Boolean(data.hasPassword),
                    configured: Boolean(data.configured)
                }));
                setSmtpPassword('');
                setEmailStatus({ msg: 'Email configuration saved.', isError: false });
            } else {
                setEmailStatus({ msg: data.error || 'Failed to save configuration.', isError: true });
            }
        } catch {
            setEmailStatus({ msg: 'Network error saving configuration.', isError: true });
        } finally {
            setSavingEmail(false);
        }
    };

    const handleTestEmail = async () => {
        setEmailStatus({ msg: '', isError: false });
        setTestingEmail(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/auth/recovery/email-config/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (res.ok && data.delivered) {
                setEmailStatus({ msg: data.message || 'Test email sent.', isError: false });
            } else {
                setEmailStatus({ msg: data.error || 'Test email failed.', isError: true });
            }
        } catch {
            setEmailStatus({ msg: 'Network error sending test email.', isError: true });
        } finally {
            setTestingEmail(false);
        }
    };

    const handleSendSelfTest = async () => {
        setSelfTestStatus({ msg: '', isError: false });
        setSendingSelfTest(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/auth/recovery/self-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSelfTestSent({ maskedEmail: data.maskedEmail, delivered: data.delivered, logged: data.logged });
                setSelfTestCode('');
                setSelfTestStatus({
                    msg: data.delivered
                        ? `A 6-digit code was emailed to ${data.maskedEmail}. Enter it below to confirm.`
                        : 'Email delivery is not configured, so the code was written to the server log (dev mode).',
                    isError: false
                });
            } else {
                setSelfTestStatus({ msg: data.error || 'Unable to send a recovery code.', isError: true });
            }
        } catch {
            setSelfTestStatus({ msg: 'Network error sending the recovery code.', isError: true });
        } finally {
            setSendingSelfTest(false);
        }
    };

    const handleVerifySelfTest = async () => {
        setSelfTestStatus({ msg: '', isError: false });
        if (selfTestCode.trim().length !== 6) {
            setSelfTestStatus({ msg: 'Enter the 6-digit code.', isError: true });
            return;
        }
        setVerifyingSelfTest(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/auth/recovery/self-test/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code: selfTestCode.trim() })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSelfTestStatus({ msg: data.message || 'Recovery code verified.', isError: false });
                setSelfTestSent(null);
                setSelfTestCode('');
            } else {
                setSelfTestStatus({ msg: data.error || 'Invalid or expired code.', isError: true });
            }
        } catch {
            setSelfTestStatus({ msg: 'Network error verifying the code.', isError: true });
        } finally {
            setVerifyingSelfTest(false);
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = Math.min(img.width, img.height);
                canvas.width = 512;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 512, 512);
                canvas.toBlob((blob) => {
                    setPhotoBlob(blob);
                    setPreviewUrl(URL.createObjectURL(blob));
                }, 'image/jpeg', 0.9);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let currentPhotoPath = user.profilePhoto;

            // If new photo was selected, upload it first
            if (photoBlob) {
                const photoData = new FormData();
                const fileToUpload = new File([photoBlob], "profile.jpg", { type: 'image/jpeg' });
                photoData.append('photo', fileToUpload);

                const uploadRes = await fetch(`${API_URL}/user/upload-photo/${user.id}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: photoData
                });
                const uploadData = await uploadRes.json();
                if (uploadData.photoPath) {
                    currentPhotoPath = uploadData.photoPath;
                }
            }

            // Always update profile details (even if photo didn't change, path might be the same)
            const response = await fetch(`${API_URL}/user/profile/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ ...formData, profilePhoto: currentPhotoPath })
            });

            if (response.ok) {
                updateUser({ ...formData, profilePhoto: currentPhotoPath });
                setSuccess(true);
                setTimeout(() => {
                    setSuccess(false);
                    // window.location.reload(); // Removed forced reload, relying on context update
                }, 1500);
            } else {
                alert("Failed to secure profile. Check server logs.");
            }
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto min-h-screen max-w-6xl p-6 lg:p-10">
            <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <motion.button
                        whileHover={{ x: -4 }}
                        onClick={() => navigate('/')}
                        className="grid h-10 w-10 place-items-center rounded-control border border-line bg-surface text-ink-muted transition hover:bg-raised hover:text-ink"
                    >
                        <ArrowLeft size={20} />
                    </motion.button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Account Settings</h1>
                        <p className="mt-1 text-sm text-ink-muted">Manage your profile, security, and preferences</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {user?.role === 'admin' && (
                        <Button icon={Target} onClick={() => navigate('/admin')}>
                            Admin Console
                        </Button>
                    )}
                    <Button icon={mode === 'dark' ? Sun : Moon} onClick={toggleTheme}>
                        {mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </Button>
                </div>
            </header>

            <form onSubmit={handleSave} className="flex flex-col gap-8">
                <Panel>
                    <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:gap-8 sm:text-left">
                        <div className="relative">
                            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-brand/40 bg-surface sm:h-36 sm:w-36">
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        className="h-full w-full object-cover"
                                        alt="Profile Preview"
                                        onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'Guest'}`;
                                        }}
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-ink-muted">
                                        <User size={48} />
                                    </div>
                                )}
                            </div>
                            <label className="absolute -bottom-2 -right-2 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-brand text-slate-950 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.9)] transition hover:brightness-110">
                                <Camera size={18} />
                                <input type="file" hidden onChange={handlePhotoChange} accept="image/*" />
                            </label>
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                                {formData.fullName || user?.username}
                            </h2>
                            <p className="mt-1 text-sm text-ink-muted">{user?.email}</p>
                            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                                <span className="inline-flex items-center rounded-pill bg-brand-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-brand">
                                    {formData.role?.toUpperCase() || 'USER'}
                                </span>
                                <span className="inline-flex items-center rounded-pill bg-sunken px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
                                    Secured Access
                                </span>
                            </div>
                        </div>
                    </div>
                </Panel>

                <div className="grid gap-6 md:grid-cols-2">
                    <Panel>
                        <h3 className="mb-4 text-sm font-bold text-ink">Personal Information</h3>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Full Name</label>
                                <input
                                    value={formData.fullName}
                                    onChange={(e) => setFormData(p => ({ ...p, fullName: e.target.value }))}
                                    placeholder="Full Name"
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                                    placeholder="Email Address"
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Mobile</label>
                                <input
                                    value={formData.mobile}
                                    onChange={(e) => setFormData(p => ({ ...p, mobile: e.target.value }))}
                                    placeholder="+1 (000) 000-0000"
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Date of Birth</label>
                                <input
                                    type="date"
                                    value={formData.dob}
                                    onChange={(e) => setFormData(p => ({ ...p, dob: e.target.value }))}
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                />
                            </div>
                        </div>
                    </Panel>

                    <Panel>
                        <h3 className="mb-4 text-sm font-bold text-ink">Preferences & Security</h3>
                        <div className="flex flex-col gap-4">
                            {user?.role === 'admin' && (
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">System Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={handleRoleChange}
                                        className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                    >
                                        <option value="user">Standard Operator</option>
                                        <option value="admin">System Architect</option>
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Country</label>
                                <select
                                    value={formData.country}
                                    onChange={handleCountryChange}
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                >
                                    {Object.keys(countryData).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Two-Factor Authentication (MFA)</label>
                                <select
                                    value={formData.mfaMethod === 'totp' || formData.mfaMethod === 'both' ? 'totp' : 'none'}
                                    onChange={handleMfaChange}
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                >
                                    <option value="totp">Authenticator App (TOTP Active)</option>
                                    <option value="none">Disabled</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-card border border-line bg-sunken/40 p-3">
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} className="text-brand" />
                                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">Realtime</span>
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-ink">{timeStr}</div>
                                </div>
                                <div className="rounded-card border border-line bg-sunken/40 p-3">
                                    <div className="flex items-center gap-2">
                                        <DollarSign size={14} className="text-brand" />
                                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">Currency</span>
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-ink">{formData.currency}</div>
                                </div>
                            </div>
                        </div>
                    </Panel>
                </div>

                {/* Password & Security Panel */}
                <Panel>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-ink">Change Account Password</h3>
                                <p className="text-xs text-ink-muted">Update your login password securely</p>
                            </div>
                            <Lock size={18} className="text-brand" />
                        </div>

                        {passwordStatus.msg && (
                            <div className={`p-3 rounded-control text-xs font-bold border ${
                                passwordStatus.isError 
                                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' 
                                    : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                            }`}>
                                {passwordStatus.msg}
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Current Password</label>
                                <input
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))}
                                    placeholder="••••••••"
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
                                    placeholder="••••••••"
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Confirm Password</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
                                    placeholder="••••••••"
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handlePasswordUpdate}
                                disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword}
                                className="inline-flex items-center gap-2 rounded-pill px-5 py-2 text-xs font-bold tracking-[0.12em] bg-raised border border-line text-ink hover:bg-line transition disabled:opacity-50"
                            >
                                <Lock size={14} />
                                {changingPassword ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>

                {/* Password Recovery Configuration Panel */}
                <div className="mt-6 border-t border-line pt-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-ink">Password Recovery</h3>
                                <p className="text-xs text-ink-muted">Choose how you verify your identity to reset your password or recover your username</p>
                            </div>
                            <ShieldCheck size={18} className="text-brand" />
                        </div>

                        {recoveryStatus.msg && (
                            <div className={`p-3 rounded-control text-xs font-bold border ${
                                recoveryStatus.isError
                                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                                    : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                            }`}>
                                {recoveryStatus.msg}
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Recovery Method</label>
                                <select
                                    value={recoveryMethod}
                                    onChange={(e) => setRecoveryMethod(e.target.value)}
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                >
                                    <option value="email">Email One-Time Passcode (OTP)</option>
                                    <option value="mfa" disabled={!recoveryMfaAvailable}>
                                        Authenticator App (MFA){recoveryMfaAvailable ? '' : ' — not set up'}
                                    </option>
                                </select>
                                <p className="mt-1.5 text-xs text-ink-faint">
                                    {recoveryMethod === 'email'
                                        ? 'A 6-digit code will be emailed to your registered address.'
                                        : 'You will enter a 6-digit code from your authenticator app.'}
                                </p>
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={handleSaveRecovery}
                                    disabled={savingRecovery}
                                    className="inline-flex items-center gap-2 rounded-pill px-5 py-2 text-xs font-bold tracking-[0.12em] bg-raised border border-line text-ink hover:bg-line transition disabled:opacity-50"
                                >
                                    <ShieldCheck size={14} />
                                    {savingRecovery ? 'Saving...' : 'Save Preference'}
                                </button>
                            </div>
                        </div>

                        {/* Recovery self-test */}
                        <div className="mt-2 border-t border-line pt-4">
                            <div className="mb-3 flex items-center gap-2">
                                <Send size={16} className="text-brand" />
                                <h4 className="text-sm font-bold text-ink">Test Your Recovery</h4>
                            </div>
                            <p className="mb-3 text-xs text-ink-muted">
                                Send yourself a recovery code to confirm the email channel works end to end.
                            </p>

                            {selfTestStatus.msg && (
                                <div className={`mb-3 p-3 rounded-control text-xs font-bold border ${
                                    selfTestStatus.isError
                                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                                        : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                                }`}>
                                    {selfTestStatus.msg}
                                </div>
                            )}

                            {!selfTestSent ? (
                                <button
                                    type="button"
                                    onClick={handleSendSelfTest}
                                    disabled={sendingSelfTest}
                                    className="inline-flex items-center gap-2 rounded-pill px-5 py-2 text-xs font-bold tracking-[0.12em] bg-raised border border-line text-ink hover:bg-line transition disabled:opacity-50"
                                >
                                    <Send size={14} />
                                    {sendingSelfTest ? 'Sending...' : 'Send Recovery Code'}
                                </button>
                            ) : (
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <div className="flex-1">
                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Enter the 6-digit code</label>
                                        <input
                                            value={selfTestCode}
                                            onChange={(e) => setSelfTestCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="000000"
                                            className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm font-bold tracking-[0.3em] text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleVerifySelfTest}
                                        disabled={verifyingSelfTest}
                                        className="inline-flex items-center gap-2 rounded-pill px-5 py-2 text-xs font-bold tracking-[0.12em] bg-brand text-slate-950 hover:brightness-110 transition disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={14} />
                                        {verifyingSelfTest ? 'Verifying...' : 'Verify Code'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSendSelfTest}
                                        disabled={sendingSelfTest}
                                        className="inline-flex items-center gap-2 rounded-pill px-4 py-2 text-xs font-bold tracking-[0.12em] bg-sunken border border-line text-ink hover:bg-line transition disabled:opacity-50"
                                    >
                                        {sendingSelfTest ? 'Sending...' : 'Resend'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {user?.role === 'admin' && (
                            <div className="mt-2 border-t border-line pt-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Server size={16} className="text-brand" />
                                        <h4 className="text-sm font-bold text-ink">Recovery Email Sender</h4>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                                        emailCfg.configured
                                            ? 'bg-brand-soft text-brand'
                                            : 'bg-sunken text-ink-faint'
                                    }`}>
                                        {emailCfg.configured ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                        {emailCfg.configured
                                            ? `Configured${emailCfg.source === 'env' ? ' (env)' : ''}`
                                            : 'Not configured'}
                                    </span>
                                </div>
                                <p className="mb-4 text-xs text-ink-muted">
                                    SMTP account used to deliver recovery codes. The app password is stored encrypted and never shown again.
                                </p>

                                {emailStatus.msg && (
                                    <div className={`mb-4 p-3 rounded-control text-xs font-bold border ${
                                        emailStatus.isError
                                            ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                                            : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                                    }`}>
                                        {emailStatus.msg}
                                    </div>
                                )}

                                <label className="mb-4 flex cursor-pointer items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={emailCfg.enabled}
                                        onChange={(e) => setEmailCfg(p => ({ ...p, enabled: e.target.checked }))}
                                        className="h-4 w-4 accent-emerald-500"
                                    />
                                    <span className="text-xs font-bold text-ink">Enable email delivery for recovery codes</span>
                                </label>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">SMTP Host</label>
                                        <input
                                            value={emailCfg.host}
                                            onChange={(e) => setEmailCfg(p => ({ ...p, host: e.target.value }))}
                                            placeholder="smtp.gmail.com"
                                            className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Port</label>
                                            <input
                                                type="number"
                                                value={emailCfg.port}
                                                onChange={(e) => setEmailCfg(p => ({ ...p, port: e.target.value }))}
                                                placeholder="587"
                                                className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                            />
                                        </div>
                                        <div className="flex items-end pb-2.5">
                                            <label className="flex cursor-pointer items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={emailCfg.secure}
                                                    onChange={(e) => setEmailCfg(p => ({ ...p, secure: e.target.checked }))}
                                                    className="h-4 w-4 accent-emerald-500"
                                                />
                                                <span className="text-xs font-bold text-ink">SSL/TLS</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Sender Email (SMTP User)</label>
                                        <input
                                            type="email"
                                            value={emailCfg.user}
                                            onChange={(e) => setEmailCfg(p => ({ ...p, user: e.target.value }))}
                                            placeholder="you@gmail.com"
                                            className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
                                            App Password {emailCfg.hasPassword && <span className="text-brand">(leave blank to keep)</span>}
                                        </label>
                                        <input
                                            type="password"
                                            value={smtpPassword}
                                            onChange={(e) => setSmtpPassword(e.target.value)}
                                            placeholder={emailCfg.hasPassword ? '••••••••••••' : '16-character app password'}
                                            className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">From Address (optional)</label>
                                        <input
                                            value={emailCfg.from}
                                            onChange={(e) => setEmailCfg(p => ({ ...p, from: e.target.value }))}
                                            placeholder="PEM Pro <you@gmail.com>"
                                            className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                        />
                                        <p className="mt-1.5 text-xs text-ink-faint">For Gmail, use an App Password (requires 2-Step Verification). Remove spaces from the 16-character code.</p>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={handleTestEmail}
                                        disabled={testingEmail}
                                        className="inline-flex items-center gap-2 rounded-pill px-5 py-2 text-xs font-bold tracking-[0.12em] bg-sunken border border-line text-ink hover:bg-line transition disabled:opacity-50"
                                    >
                                        <Send size={14} />
                                        {testingEmail ? 'Sending...' : 'Send Test Email'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveEmailConfig}
                                        disabled={savingEmail}
                                        className="inline-flex items-center gap-2 rounded-pill px-5 py-2 text-xs font-bold tracking-[0.12em] bg-brand text-slate-950 hover:brightness-110 transition disabled:opacity-50"
                                    >
                                        <KeyRound size={14} />
                                        {savingEmail ? 'Saving...' : 'Save Configuration'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                    </div>
                </Panel>

                <div className="flex justify-end">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading}
                        className={`inline-flex items-center gap-2 rounded-pill px-6 py-2.5 text-sm font-bold tracking-[0.12em] text-slate-950 transition ${
                            success ? 'bg-emerald-600' : 'bg-brand'
                        } ${loading ? 'opacity-70' : 'hover:brightness-110'}`}
                    >
                        {loading ? (
                            'Saving...'
                        ) : success ? (
                            <>
                                <Check size={18} /> Saved
                            </>
                        ) : (
                            <>
                                <Save size={18} /> Save Changes
                            </>
                        )}
                    </motion.button>
                </div>
            </form>
        </div>
    );
};

export default Profile;




