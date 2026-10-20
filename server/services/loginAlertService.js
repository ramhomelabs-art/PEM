// Login security alerts.
//
// Sends an email on every successful sign-in and flags sign-ins from a device /
// browser that has never been seen for the account. Known devices are stored on
// user.preferences.knownLogins (no extra table / migration needed) and capped
// to the most recent MAX_KNOWN_DEVICES fingerprints.
//
// notifyLogin() is designed to be called fire-and-forget from the auth routes:
// it never throws and never blocks the login response.

const crypto = require('crypto');
const mailer = require('../utils/mailer');

const ENABLED = process.env.LOGIN_ALERTS_ENABLED !== 'false';
const MAX_KNOWN_DEVICES = 10;

const METHOD_LABELS = {
    password: 'Password',
    totp: 'Authenticator app',
    backup_code: 'Backup code',
    push: 'Device approval',
    mobile: 'Mobile app'
};

function normalizeIp(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(/^\[|\]$/g, ''); // [::1]:1234 -> ::1
    if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(s)) s = s.split(':')[0]; // 1.2.3.4:5678
    if (/^::ffff:/i.test(s)) s = s.slice(7); // IPv4-mapped IPv6
    return s;
}

function isLoopback(s) {
    return s === '::1' || s === 'localhost' || /^127\./.test(s);
}

function clientIp(req) {
    if (!req) return '';
    const h = req.headers || {};
    const xff = h['x-forwarded-for'] ? String(h['x-forwarded-for']).split(',')[0] : '';
    const candidates = [
        xff,
        h['cf-connecting-ip'],
        h['x-real-ip'],
        req.ip,
        req.socket && req.socket.remoteAddress,
        req.connection && req.connection.remoteAddress
    ];

    let loopback = '';
    for (const candidate of candidates) {
        const ip = normalizeIp(candidate);
        if (!ip) continue;
        if (isLoopback(ip)) {
            if (!loopback) loopback = ip;
            continue;
        }
        return ip;
    }
    // No routable address (e.g. local dev) — still show the loopback clearly.
    return loopback ? `${loopback} (localhost)` : '';
}

function parseUserAgent(ua) {
    const s = String(ua || '');
    let browser = 'Unknown browser';
    if (/Edg\//.test(s)) browser = 'Microsoft Edge';
    else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
    else if (/Chrome\//.test(s)) browser = 'Chrome';
    else if (/Firefox\//.test(s)) browser = 'Firefox';
    else if (/Safari\//.test(s) && /Version\//.test(s)) browser = 'Safari';
    else if (/curl|node|axios|python|okhttp|postman/i.test(s)) browser = 'API client';

    let os = 'Unknown OS';
    if (/Windows NT 10/.test(s)) os = 'Windows 10/11';
    else if (/Windows/.test(s)) os = 'Windows';
    else if (/Android/.test(s)) os = 'Android';
    else if (/iPhone|iPad|iOS/.test(s)) os = 'iOS';
    else if (/Mac OS X/.test(s)) os = 'macOS';
    else if (/Linux/.test(s)) os = 'Linux';

    return { browser, os, device: `${browser} on ${os}` };
}

function fingerprint(ua) {
    return crypto.createHash('sha256').update(String(ua || '')).digest('hex').slice(0, 32);
}

function appUrl() {
    const base = process.env.CLIENT_URL || process.env.SERVER_URL || '';
    if (!base) return '';
    return `${base.replace(/\/$/, '')}/profile`;
}

/**
 * Send a login alert and record the device. Never throws.
 * @returns {Promise<object>} outcome descriptor.
 */
async function notifyLogin(req, user, { method = 'password' } = {}) {
    if (!ENABLED) return { sent: false, skipped: 'disabled' };
    if (!user || !user.email) return { sent: false, skipped: 'no-email' };
    if (!mailer.isConfigured()) return { sent: false, skipped: 'smtp-not-configured' };

    const ua = (req && req.headers && req.headers['user-agent']) || '';
    const ip = clientIp(req);
    const { browser, os, device } = parseUserAgent(ua);
    const fp = fingerprint(ua);

    const prefs = { ...(user.preferences || {}) };
    const known = Array.isArray(prefs.knownLogins) ? prefs.knownLogins.slice() : [];
    const idx = known.findIndex((k) => k && k.fp === fp);
    const isNewDevice = idx === -1;
    const now = new Date().toISOString();

    const entry = isNewDevice
        ? { fp, device, browser, os, ip, firstSeen: now, lastSeen: now }
        : { ...known[idx], lastSeen: now, ip };
    const nextKnown = isNewDevice ? [entry, ...known] : known.map((k, i) => (i === idx ? entry : k));

    try {
        await user.update({ preferences: { ...prefs, knownLogins: nextKnown.slice(0, MAX_KNOWN_DEVICES) } });
    } catch (e) {
        console.error('[LoginAlert] Failed to persist known devices:', e.message);
    }

    try {
        const result = await mailer.sendLoginAlert({
            to: user.email,
            user,
            ip,
            device,
            browser,
            os,
            method: METHOD_LABELS[method] || method,
            time: new Date(),
            isNewDevice,
            appUrl: appUrl()
        });
        return { sent: true, isNewDevice, delivered: result.delivered };
    } catch (e) {
        console.error('[LoginAlert] Failed to send login alert:', e.message);
        return { sent: false, error: e.message };
    }
}

module.exports = { notifyLogin, parseUserAgent, clientIp };
