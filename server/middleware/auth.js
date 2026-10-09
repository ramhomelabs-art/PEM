const jwt = require('jsonwebtoken');
const { User } = require('../models');

const { JWT_SECRET } = require('../config/auth');

// A `purpose: 'mfa_setup'` token proves the password was correct but must NOT grant
// full account access until MFA is bound. Only these prefixes may use such a token.
const MFA_SETUP_ALLOWED = ['/api/auth/me', '/api/auth/logout', '/api/mfa/setup', '/api/mfa/auth', '/api/mfa/'];

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ error: 'Access Denied: No Token Provided' });

    // Check if the token looks like a JWT (contains dots)
    if (token.includes('.')) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.error('[Auth Middleware] JWT Verify Error:', err.message);
                return res.status(403).json({ error: 'Invalid Token', details: err.message });
            }
            if (user && user.purpose === 'mfa_setup') {
                const url = (req.originalUrl || '').split('?')[0];
                const allowed = MFA_SETUP_ALLOWED.some((p) => url === p || url.startsWith(p));
                if (!allowed) {
                    return res.status(403).json({ error: 'MFA setup incomplete', code: 'MFA_SETUP_REQUIRED' });
                }
            }
            req.user = user;
            next();
        });
    } else {
        // Treat as API Key (smsApiKey) or Device Secret Key
        try {
            let user = await User.findOne({ where: { smsApiKey: token } });
            if (!user) {
                const { MfaDevice } = require('../models');
                const device = await MfaDevice.findOne({ where: { secretKey: token } });
                if (device) {
                    user = await User.findByPk(device.userId);
                    if (!device.isActive) {
                        device.isActive = true;
                        await device.save().catch(() => {});
                    }
                }
            }
            if (!user) {
                console.error('[Auth Middleware] Invalid API Key / Device Key provided as Bearer token');
                return res.status(403).json({ error: 'Invalid API Key or Device Key' });
            }
            req.user = { id: user.id, username: user.username, role: user.role };
            next();
        } catch (error) {
            console.error('[Auth Middleware] API Key Verify Error:', error.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'administrator')) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

module.exports = { authenticateToken, requireAdmin };

