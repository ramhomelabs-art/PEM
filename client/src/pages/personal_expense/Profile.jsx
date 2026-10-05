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
    Check
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
        country: 'USA',
        currency: 'USD',
        timezone: 'EST (UTC-5)',
        role: 'user',
        mfaMethod: 'none'
    });

    useEffect(() => {
        if (user) {
            // Initial load from context (fast)
            setFormData({
                fullName: user.fullName || '',
                email: user.email || '',
                mobile: user.mobile || '',
                dob: user.dob || '',
                country: user.country || 'USA',
                currency: user.currency || 'USD',
                timezone: user.timezone || 'EST (UTC-5)',
                role: user.role || 'user',
                mfaMethod: user.mfaMethod || 'none'
            });
            setPreviewUrl(user.profilePhoto ? (user.profilePhoto.startsWith('http') ? user.profilePhoto : `${BASE_URL}/${user.profilePhoto.replace(/\\/g, '/')}`) : null);

            // Fetch fresh data from server (accurate)
            fetch(`${API_URL}/user/profile/${user.id}`)
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
        if (!confirm(`Switch MFA method to ${newMethod.toUpperCase()}? Ensure you have the necessary app/device configured.`)) return;

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
                alert(`Success: ${data.message}`);
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to update MFA method");
        } finally {
            setLoading(false);
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
                headers: { 'Content-Type': 'application/json' },
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
                                        onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))}
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
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">MFA Preference</label>
                                <select
                                    value={formData.mfaMethod}
                                    onChange={handleMfaChange}
                                    className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                >
                                    <option value="push">Push Notifications (Best)</option>
                                    <option value="totp">Authenticator App (TOTP)</option>
                                    <option value="both">Both (Recommended)</option>
                                    <option value="none">Disabled (Not Safe)</option>
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




