const crypto = require('crypto');

let JWT_SECRET = process.env.JWT_SECRET;

// Insecure default detection & automatic cryptographic key generation if missing
const INSECURE_DEFAULT = 'super_secret_key_CHANGE_IN_PRODUCTION';

if (!JWT_SECRET || JWT_SECRET === INSECURE_DEFAULT || JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
    if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ [SECURITY WARNING] Insecure or missing JWT_SECRET in production! Generating secure runtime key.');
        JWT_SECRET = crypto.randomBytes(32).toString('hex');
    } else {
        // In development, generate a stable or fallback secret
        JWT_SECRET = process.env.JWT_SECRET || 'pem_dev_secure_key_' + crypto.randomBytes(16).toString('hex');
    }
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

module.exports = {
    JWT_SECRET,
    JWT_EXPIRES_IN
};
