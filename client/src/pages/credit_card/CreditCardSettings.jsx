import { useState, useEffect } from 'react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCardSession } from '../../context/credit_card/CardSessionContext';
import { motion } from 'framer-motion';
import { Lock, Bell, Shield, Eye, EyeOff, Save, AlertCircle, Check, DollarSign } from 'lucide-react';
import { Panel, PanelHeader, Button } from '../../components/ui/primitives';
import { cx } from '../../components/ui/cx';

const COUNTRY_DATA = {
    India: { currency: 'INR', timezone: 'IST (UTC+5:30)' },
    USA: { currency: 'USD', timezone: 'EST (UTC-5)' },
    UK: { currency: 'GBP', timezone: 'GMT (UTC+0)' },
    Dubai: { currency: 'AED', timezone: 'GST (UTC+4)' },
    Singapore: { currency: 'SGD', timezone: 'SGT (UTC+8)' },
    Australia: { currency: 'AUD', timezone: 'AEST (UTC+10)' },
    Germany: { currency: 'EUR', timezone: 'CET (UTC+1)' },
    Japan: { currency: 'JPY', timezone: 'JST (UTC+9)' }
};

const CreditCardSettings = () => {
    const { user } = useAuth();
    const { authFetch } = useCardSession();
    const [saved, setSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordChange, setPasswordChange] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordError, setPasswordError] = useState('');

    const [settings, setSettings] = useState({
        requirePasswordOnOpen: true,
        autoLockMinutes: 15,
        enableBiometric: false,
        paymentReminders: true,
        unusualActivityAlerts: true,
        monthlyStatements: true,
        rewardsUpdates: true,
        hideCardNumbers: true,
        country: 'India',
        defaultCurrency: user?.currency || 'INR',
        currency: COUNTRY_DATA.India.currency,
        timezone: COUNTRY_DATA.India.timezone
    });

    // Load persisted preferences on mount, then re-derive region fields.
    useEffect(() => {
        let cancelled = false;
        authFetch('/credit-cards/settings')
            .then((res) => (res.ok ? res.json() : {}))
            .then((stored) => {
                if (cancelled || !stored) return;
                setSettings((prev) => {
                    const merged = { ...prev, ...stored };
                    const country = COUNTRY_DATA[merged.country] ? merged.country : prev.country;
                    return {
                        ...merged,
                        country,
                        currency: COUNTRY_DATA[country].currency,
                        timezone: COUNTRY_DATA[country].timezone
                    };
                });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [authFetch]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await authFetch('/credit-cards/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!res.ok) throw new Error('Failed to save settings');
        } catch (e) {
            console.error('Save settings error:', e);
        } finally {
            setIsSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        }
    };

    const handleChange = (key, value) => {
        setSettings((prev) => {
            if (key === 'country' && COUNTRY_DATA[value]) {
                return { ...prev, country: value, currency: COUNTRY_DATA[value].currency, timezone: COUNTRY_DATA[value].timezone };
            }
            return { ...prev, [key]: value };
        });
    };

    const handlePasswordChange = () => {
        setPasswordError('');
        if (passwordChange.newPassword !== passwordChange.confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }
        if (passwordChange.newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }
        setSaved(true);
        setPasswordChange({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setSaved(false), 3000);
    };

    const passwordReady = passwordChange.currentPassword && passwordChange.newPassword && passwordChange.confirmPassword;

    const notifications = [
        { key: 'paymentReminders', label: 'Payment Reminders', desc: 'Get notified before payment due dates' },
        { key: 'unusualActivityAlerts', label: 'Unusual Activity Alerts', desc: 'Alert me of suspicious transactions' },
        { key: 'monthlyStatements', label: 'Monthly Statements', desc: 'Receive monthly credit card statements' },
        { key: 'rewardsUpdates', label: 'Rewards Updates', desc: 'Get updates on rewards and cashback' }
    ];

    const inputClass =
        'w-full rounded-control border border-line bg-sunken px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-line-strong';

    return (
        <div className="mx-auto max-w-[1000px] p-6 md:p-10">
            <header className="mb-8">
                <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Credit Card Settings</h1>
                <p className="mt-1 text-sm text-ink-muted">Manage your credit card preferences and security settings.</p>
            </header>

            {saved && (
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 flex items-center gap-2.5 rounded-control border border-pos bg-pos-soft px-5 py-3.5 font-bold text-pos"
                >
                    <Check size={20} aria-hidden="true" />
                    Settings saved successfully!
                </motion.div>
            )}

            <div className="flex flex-col gap-6">
                <Panel>
                    <PanelHeader title="Security" subtitle="Protect your credit card information" icon={Shield} />
                    <div className="flex flex-col gap-4">
                        <SettingRow label="Require Password on Open" desc="Always ask for password when accessing credit cards">
                            <Toggle checked={settings.requirePasswordOnOpen} onChange={(v) => handleChange('requirePasswordOnOpen', v)} />
                        </SettingRow>

                        <div className="rounded-control border border-line bg-sunken p-4">
                            <p className="mb-2.5 text-sm font-bold text-ink">Auto-Lock After Inactivity</p>
                            <select
                                value={settings.autoLockMinutes}
                                onChange={(e) => handleChange('autoLockMinutes', parseInt(e.target.value))}
                                className={inputClass}
                            >
                                <option value={5}>5 minutes</option>
                                <option value={15}>15 minutes</option>
                                <option value={30}>30 minutes</option>
                                <option value={60}>1 hour</option>
                                <option value={0}>Never</option>
                            </select>
                        </div>

                        <SettingRow label="Enable Biometric Authentication" desc="Use fingerprint or face recognition">
                            <Toggle checked={settings.enableBiometric} onChange={(v) => handleChange('enableBiometric', v)} />
                        </SettingRow>
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader title="Notifications" subtitle="Manage your alert preferences" icon={Bell} />
                    <div className="flex flex-col gap-4">
                        {notifications.map((item) => (
                            <SettingRow key={item.key} label={item.label} desc={item.desc}>
                                <Toggle checked={settings[item.key]} onChange={(v) => handleChange(item.key, v)} />
                            </SettingRow>
                        ))}
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader title="Regional Settings" subtitle="Set your country, currency, and timezone" icon={DollarSign} />
                    <div className="flex flex-col gap-4">
                        <div className="rounded-control border border-line bg-sunken p-4">
                            <p className="mb-2.5 text-sm font-bold text-ink">Country</p>
                            <select value={settings.country} onChange={(e) => handleChange('country', e.target.value)} className={inputClass}>
                                {Object.keys(COUNTRY_DATA).map((country) => (
                                    <option key={country} value={country}>{country}</option>
                                ))}
                            </select>
                        </div>

                        <Field label="Currency" value={`${settings.currency} (Auto-selected based on country)`} />
                        <Field label="Timezone" value={`${settings.timezone} (Auto-selected based on country)`} />
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader title="Change Password" subtitle="Update your credit card access password" icon={Lock} />
                    {passwordError && (
                        <div className="mb-4 flex items-center gap-2 rounded-control border border-neg bg-neg-soft p-3 text-xs font-bold text-neg">
                            <AlertCircle size={16} aria-hidden="true" />
                            {passwordError}
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <div className="rounded-control border border-line bg-sunken p-4">
                            <p className="mb-2.5 text-sm font-bold text-ink">Current Password</p>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={passwordChange.currentPassword}
                                    onChange={(e) => setPasswordChange((prev) => ({ ...prev, currentPassword: e.target.value }))}
                                    placeholder="Enter current password"
                                    className={`${inputClass} pr-12`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-control p-1.5 text-ink-faint transition hover:text-ink"
                                >
                                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                                </button>
                            </div>
                        </div>

                        <div className="rounded-control border border-line bg-sunken p-4">
                            <p className="mb-2.5 text-sm font-bold text-ink">New Password</p>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={passwordChange.newPassword}
                                onChange={(e) => setPasswordChange((prev) => ({ ...prev, newPassword: e.target.value }))}
                                placeholder="Enter new password"
                                className={inputClass}
                            />
                        </div>

                        <div className="rounded-control border border-line bg-sunken p-4">
                            <p className="mb-2.5 text-sm font-bold text-ink">Confirm New Password</p>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={passwordChange.confirmPassword}
                                onChange={(e) => setPasswordChange((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                                placeholder="Confirm new password"
                                className={inputClass}
                            />
                        </div>

                        <Button variant="primary" size="lg" icon={Lock} onClick={handlePasswordChange} disabled={!passwordReady} className="w-full">
                            Update Password
                        </Button>
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader title="Display" subtitle="Customize how information is displayed" icon={Eye} />
                    <SettingRow label="Hide Card Numbers by Default" desc="Mask card numbers for privacy">
                        <Toggle checked={settings.hideCardNumbers} onChange={(v) => handleChange('hideCardNumbers', v)} />
                    </SettingRow>
                </Panel>

                <Button
                    variant="primary"
                    size="lg"
                    icon={Save}
                    loading={isSaving}
                    onClick={handleSave}
                    className="w-full py-4 text-base"
                >
                    Save All Settings
                </Button>
            </div>
        </div>
    );
};

function SettingRow({ label, desc, children }) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-control border border-line bg-sunken p-4">
            <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{label}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{desc}</p>
            </div>
            {children}
        </div>
    );
}

function Field({ label, value }) {
    return (
        <div className="rounded-control border border-line bg-sunken p-4">
            <p className="mb-2.5 text-sm font-bold text-ink">{label}</p>
            <div className="rounded-control border border-line bg-raised px-4 py-3 text-sm font-semibold text-ink-muted">{value}</div>
        </div>
    );
}

function Toggle({ checked, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={cx(
                'relative h-6 w-11 shrink-0 rounded-pill transition-colors',
                checked ? 'bg-violet' : 'bg-line-strong'
            )}
        >
            <span
                className={cx(
                    'absolute bottom-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    checked && 'translate-x-5'
                )}
            />
        </button>
    );
}

export default CreditCardSettings;
