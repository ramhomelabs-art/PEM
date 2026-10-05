const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../data/system_settings.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(SETTINGS_FILE))) {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
}

// Default Settings
const DEFAULT_SETTINGS = {
    signupLocked: false
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

module.exports = { getSettings, saveSettings };
