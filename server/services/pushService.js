const _adminState = { admin: null, initialised: false };

/**
 * Lazily initialise Firebase Admin SDK from FIREBASE_* env vars.
 * Returns the firebase-admin module, or null when unavailable/unconfigured
 * so callers can gracefully fall back to the DB polling transport.
 */
function getAdmin() {
    if (_adminState.initialised) return _adminState.admin;
    _adminState.initialised = true;

    const configured = process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY;

    if (!configured) {
        console.log('[pushService] FCM not configured; push delivery disabled (polling fallback active).');
        return null;
    }

    try {
        const adminSdk = require('firebase-admin');
        if (!adminSdk.apps || adminSdk.apps.length === 0) {
            adminSdk.initializeApp({
                credential: adminSdk.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
                })
            });
        }
        _adminState.admin = adminSdk;
        console.log('✓ [pushService] Firebase Admin initialised — push enabled');
    } catch (err) {
        console.error('[pushService] Firebase init failed:', err.message);
        _adminState.admin = null;
    }
    return _adminState.admin;
}

function stringifyData(data) {
    const out = {};
    Object.keys(data || {}).forEach((k) => {
        if (data[k] === null || data[k] === undefined) return;
        out[k] = typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]);
    });
    return out;
}

/**
 * Send a data (+ optional visible notification) message to every active device
 * of a user.
 * @returns {Promise<{sent:number, failed:number, reason?:string}>}
 */
async function sendToUser(userId, { title, body, data } = {}) {
    const { MfaDevice } = require('../models');

    let tokens = [];
    try {
        const devices = await MfaDevice.findAll({
            where: { userId, isActive: true },
            attributes: ['id', 'fcmToken']
        });
        tokens = devices.map((d) => d.fcmToken).filter(Boolean);
    } catch (err) {
        return { sent: 0, failed: 0, reason: `device-lookup-failed: ${err.message}` };
    }

    if (tokens.length === 0) {
        return { sent: 0, failed: 0, reason: 'no-tokens' };
    }

    const admin = getAdmin();
    if (!admin) {
        return { sent: 0, failed: 0, reason: 'fcm-not-configured', tokens: tokens.length };
    }

    const message = { tokens, data: stringifyData(data) };
    if (title) {
        message.notification = { title, body: body || '' };
    }

    try {
        const messaging = admin.messaging();
        const response = typeof messaging.sendEachForMulticast === 'function'
            ? await messaging.sendEachForMulticast(message)
            : await messaging.sendMulticast(message);
        return { sent: response.successCount, failed: response.failureCount };
    } catch (err) {
        console.error('[pushService] send failed:', err.message);
        return { sent: 0, failed: tokens.length, reason: err.message };
    }
}

module.exports = { sendToUser, isConfigured: () => !!getAdmin() };
