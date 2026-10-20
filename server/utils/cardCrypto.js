const crypto = require('crypto');

const RAW_KEY = process.env.ENCRYPTION_KEY;
const INSECURE_KEY = 'pem-dev-only-secret-key-do-not-use-in-prod!';

const ENCRYPTION_KEY = (() => {
    const buf = Buffer.from(RAW_KEY || INSECURE_KEY, 'utf8');
    return buf.length === 32 ? buf : crypto.createHash('sha256').update(buf).digest();
})();

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

function encrypt(text) {
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return 'v2:' + Buffer.concat([iv, encrypted, tag]).toString('base64');
}

function decrypt(text) {
    if (typeof text === 'string' && text.startsWith('v2:')) {
        const combined = Buffer.from(text.slice(3), 'base64');
        if (combined.length < GCM_IV_LENGTH + GCM_TAG_LENGTH) {
            throw new Error('Invalid encrypted payload');
        }
        const iv = combined.subarray(0, GCM_IV_LENGTH);
        const tag = combined.subarray(combined.length - GCM_TAG_LENGTH);
        const ciphertext = combined.subarray(GCM_IV_LENGTH, combined.length - GCM_TAG_LENGTH);
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    }

    // Legacy AES-256-CBC format: ivHex:cipherHex
    const parts = String(text).split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

module.exports = {
    encrypt,
    decrypt
};
