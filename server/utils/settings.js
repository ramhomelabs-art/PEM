const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../data/system_settings.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(SETTINGS_FILE))) {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
}

// Default Settings
const DEFAULT_SETTINGS = {
    signupLocked: false,
    // Account-recovery email delivery (configured from the admin Profile UI).
    // `smtpPassEnc` is stored encrypted via utils/secretBox and never returned.
    mail: {
        enabled: false,
        host: '',
        port: 587,
        secure: false,
        user: '',
        smtpPassEnc: '',
        from: ''
    }
};

// Initialize if not exists
if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
}

const getSettings = () => {
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (err) {
        console.error('Error reading settings:', err);
        return DEFAULT_SETTINGS;
    }
};

const saveSettings = (newSettings) => {
    try {
        const current = getSettings();
        const updated = { ...current, ...newSettings };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
        return updated;
    } catch (err) {
        console.error('Error saving settings:', err);
        throw err;
    }
};

// Merge the stored mail config over the defaults so callers always get a full shape.
const getMailSettings = () => {
    const s = getSettings();
    return { ...DEFAULT_SETTINGS.mail, ...(s.mail || {}) };
};

// Persist a partial mail-config update (nested merge).
const saveMailSettings = (partial) => {
    const merged = { ...getMailSettings(), ...(partial || {}) };
    return saveSettings({ mail: merged }).mail;
};

module.exports = { getSettings, saveSettings, getMailSettings, saveMailSettings, DEFAULT_SETTINGS };

