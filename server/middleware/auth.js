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
        // Treat as API Key (smsApiKey)
        try {
            const user = await User.findOne({ where: { smsApiKey: token } });
            if (!user) {
                console.error('[Auth Middleware] Invalid API Key provided as Bearer token');
                return res.status(403).json({ error: 'Invalid API Key' });
            }
            req.user = { id: user.id, username: user.username, role: user.role };
            next();
        } catch (error) {
            console.error('[Auth Middleware] API Key Verify Error:', error.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

module.exports = { authenticateToken };

