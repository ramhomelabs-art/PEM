
const express = require('express');
const router = express.Router();
const { User } = require('../../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../../middleware/auth');

const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/auth');
const crypto = require('crypto');

const { getSettings } = require('../../utils/settings');

// Public Config Route
router.get('/config', (req, res) => {
    res.json(getSettings());
});

// Signup
router.post('/signup', async (req, res) => {
    try {
        const settings = getSettings();
        if (settings.signupLocked) {
            console.log('[AUTH] Signup Blocked: System Locked');
            return res.status(403).json({ error: 'New user registration is temporarily disabled by administrator.' });
        }

        const { username, email, password, country, currency, timezone, fullName, mobile, dob } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        // SECURITY FIX: All new signups are PENDING and USER role by default.
        // No auto-activation based on email/username to prevent unauthorized access.

        const smsApiKey = crypto.randomBytes(16).toString('hex');

        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            status: 'pending', // FORCE PENDING
            role: 'user',      // FORCE USER ROLE
            country: country || 'India',
            currency: currency || 'INR',
            timezone: timezone || 'IST (UTC+5:30)',
            fullName,
            mobile,
            smsApiKey,
            mfaEnabled: true // FORCE MFA SETUP FOR NEW USERS
        });

        // Generate initial TOTP secret (Unverified) for Admin visibility
        const mfaService = require('../../services/mfaService');
        await mfaService.generateTOTPSecret(user.id);

        res.json({
            message: 'Signup successful! Your account is pending admin approval. You will be able to login once approved.',
            userId: user.id,
            status: user.status
        });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Find by username OR email (case-insensitive)
        const { Op } = require('sequelize');

        const cleanUsername = username ? username.trim().toLowerCase() : '';
        console.log(`[AUTH] Login Attempt for: '${username}'`);

        const user = await User.findOne({
            where: {
                [Op.or]: [
                    User.sequelize.where(
                        User.sequelize.fn('lower', User.sequelize.col('username')),
                        cleanUsername
                    ),
                    User.sequelize.where(
                        User.sequelize.fn('lower', User.sequelize.col('email')),
                        cleanUsername
                    )
                ]
            }
        });

        if (!user) {
            console.log(`[AUTH] User not found for: '${username}'`);
            return res.status(401).json({ error: 'User not found' });
        }

        console.log(`[AUTH] User found: ${user.username} (ID: ${user.id}). Verifying password...`);
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`[AUTH] Password mismatch for user: ${user.username}`);
            // DEBUG: Log hash comparison (careful in prod, ok here for debug)
            // console.log(`[AUTH] Input Pass: ${password}, Stored Hash: ${user.password}`);
            return res.status(401).json({ error: 'Invalid Password' });
        }

        if (user.status !== 'active') {
            console.log(`[AUTH] Account not active: ${user.status}`);
            return res.status(403).json({ error: 'Account not active' });
        }

        // --- MFA CHECK START ---
        if (user.mfaEnabled) {
            console.log(`[AUTH] MFA Enabled for user: ${user.username}`);

            if (!user.mfaConfigured) {
                console.log(`[AUTH] MFA Enabled but NOT Configured. Redirecting to setup.`);

                // Issue a short-lived token scoped ONLY to the MFA setup flow.
                // It must never grant full account access before MFA is bound.
                const token = jwt.sign(
                    { id: user.id, role: user.role, username: user.username, purpose: 'mfa_setup' },
                    JWT_SECRET,
                    { expiresIn: '30m' }
                );

                return res.json({
                    success: true,
                    needsSetup: true,
                    userId: user.id,
                    username: user.username,
                    token: token // Return scoped token for setup
                });
            }

            console.log(`[AUTH] Initiating MFA for ${user.username}`);
            const mfaService = require('../../services/mfaService');
            const mfaInit = await mfaService.initiateLogin(user.id, req.ip, req.headers['user-agent']);

            return res.json({
                success: true,
                ...mfaInit,
                userId: user.id,
                username: user.username
            });
        }
        // --- MFA CHECK END ---

        console.log(`[AUTH] Login SUCCESS for ${user.username}`);

        // Ensure keys exist using KeyManager
        const km = require('../../lib/keyManager')(User.sequelize);
        const userKeys = await km.ensureKeys(user.id);


        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({
            message: 'Login successful',
            token,
            role: user.role,
            username: user.username,
            email: user.email,
            country: user.country,
            currency: user.currency,
            timezone: user.timezone,
            profilePhoto: user.profilePhoto,
            fullName: user.fullName,
            mobile: user.mobile,
            dob: user.dob,
            smsApiKey: userKeys.smsApiKey,
            encryptionKey: userKeys.encryptionKey,
            id: user.id,
            preferences: user.preferences
        });
    } catch (error) {
        console.error('[AUTH ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});


// Verify Password (for sensitive actions)
router.post('/verify-password', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body || {};
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        // Always verify the authenticated user's own password; never trust a
        // client-supplied userId.
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid Password' });
        }

        res.json({ success: true, message: 'Verified' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update User Preferences
router.put('/preferences', authenticateToken, async (req, res) => {
    try {
        const { preferences } = req.body;
        console.log('[Preferences] Update request from user:', req.user.id, 'preferences:', preferences);

        const user = await User.findByPk(req.user.id);

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Merge existing preferences with new ones
        const currentPrefs = user.preferences || {};
        const newPrefs = { ...currentPrefs, ...preferences };

        console.log('[Preferences] Current:', currentPrefs, 'New:', newPrefs);

        await user.update({ preferences: newPrefs });

        console.log('[Preferences] Updated successfully');

        res.json({ message: 'Preferences updated', preferences: newPrefs });
    } catch (error) {
        console.error('[Preferences] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET Current User Profile (Refresh Session)
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Ensure keys exist using KeyManager
        const km = require('../../lib/keyManager')(User.sequelize);
        const userKeys = await km.ensureKeys(user.id);


        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            country: user.country,
            currency: user.currency,
            timezone: user.timezone,
            profilePhoto: user.profilePhoto,
            fullName: user.fullName,
            mobile: user.mobile,
            dob: user.dob,
            smsApiKey: userKeys.smsApiKey,
            encryptionKey: userKeys.encryptionKey,
            status: user.status,
            preferences: user.preferences
        });
    } catch (error) {
        console.error('[Auth] Error fetching user profile:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /auth/users - Get all users (for contacts)
router.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'fullName', 'email', 'role', 'profilePhoto', 'status'],
            where: {
                status: 'active' // Only return active users
            },
            order: [['fullName', 'ASC']],
            limit: 50
        });

        res.json(users);
    } catch (error) {
        console.error('[Auth] Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
