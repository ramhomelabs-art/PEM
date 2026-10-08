const jwt = require('jsonwebtoken');
const { User } = require('../models');

const { JWT_SECRET } = require('../config/auth');

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
            req.user = user;
            next();
        });
    } else {
        // Treat as API Key (smsApiKey) or Device Secret Key
        try {
            let user = await User.findOne({ where: { smsApiKey: token } });
            if (!user) {
                const { MfaDevice } = require('../models');
                const device = await MfaDevice.findOne({ where: { secretKey: token, isActive: true } });
                if (device) {
                    user = await User.findByPk(device.userId);
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

