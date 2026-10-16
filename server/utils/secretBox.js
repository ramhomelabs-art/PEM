// Small authenticated-encryption helper for storing secrets at rest
// (e.g. the SMTP app password configured from the admin UI).
//
// Uses AES-256-GCM. The key is derived from ENCRYPTION_KEY, namespaced so it is
// distinct from the credit-card encryption key. If ENCRYPTION_KEY is unset we
// fall back to a clearly-insecure development key and warn — matching the rest
// of the codebase — but refuse to silently use it in production.

const crypto = require('crypto');

const INSECURE_KEY = 'insecure-dev-secretbox-key-do-not-use';
const RAW_KEY = process.env.ENCRYPTION_KEY;

if (!RAW_KEY) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('[SECURITY] ENCRYPTION_KEY must be set in production (SMTP credential encryption).');
    }
    console.warn('[SECURITY] ENCRYPTION_KEY not set — using insecure development key for stored secrets.');
}

const KEY = crypto
    .createHash('sha256')
    .update('pem-secretbox-v1:' + (RAW_KEY || INSECURE_KEY))
    .digest();

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'v1:';

function encrypt(plaintext) {
    if (plaintext === undefined || plaintext === null) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, enc, tag]).toString('base64');
}

function decrypt(payload) {
    if (!payload) return null;
    if (typeof payload !== 'string' || !payload.startsWith(PREFIX)) {
        throw new Error('Invalid encrypted payload');
    }
    const combined = Buffer.from(payload.slice(PREFIX.length), 'base64');
    if (combined.length < IV_LENGTH + TAG_LENGTH) {
        throw new Error('Invalid encrypted payload');
    }
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(combined.length - TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
