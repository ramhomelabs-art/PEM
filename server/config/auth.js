const crypto = require('crypto');

let JWT_SECRET = process.env.JWT_SECRET;

// Known placeholder / insecure secrets that must never be trusted.
const INSECURE_DEFAULTS = new Set([
    'super_secret_key_CHANGE_IN_PRODUCTION',
    'your-super-secret-jwt-key-change-this-in-production',
    'replace_with_strong_256bit_random_hex_key',
]);

const isInsecure = !JWT_SECRET || INSECURE_DEFAULTS.has(JWT_SECRET) || JWT_SECRET.length < 32;

if (isInsecure) {
    if (process.env.NODE_ENV === 'production') {
        // Fail fast: never silently generate or accept a guessable key in production.
        throw new Error(
            '[SECURITY] JWT_SECRET is missing, shorter than 32 chars, or set to a known default. ' +
            'Set a strong 256-bit (>=32 char) secret before starting in production.'
        );
    }
    console.warn('⚠️ [SECURITY] Insecure development JWT_SECRET in use. Set a strong JWT_SECRET before deploying.');
    JWT_SECRET = 'pem_dev_insecure_key_' + crypto.randomBytes(16).toString('hex');
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

module.exports = {
    JWT_SECRET,
    JWT_EXPIRES_IN
};
