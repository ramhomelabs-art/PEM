
const express = require('express');
const router = express.Router();
const { User, RecoveryToken } = require('../../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/auth');
const crypto = require('crypto');

const { getSettings, getMailSettings, saveMailSettings } = require('../../utils/settings');
const mailer = require('../../utils/mailer');
const secretBox = require('../../utils/secretBox');
const loginGuard = require('../../utils/loginGuard');
const { sendOtpEmail } = mailer;

// --- Account recovery helpers ---------------------------------------------

const RECOVERY_PURPOSES = ['password_reset', 'username_recovery'];
const RECOVERY_CHECK_PURPOSE = 'recovery_check';
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS_BEFORE_PROMPT = 3;

// Throttle the pre-auth recovery endpoints to blunt enumeration/brute-force.
const recoveryRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { status: 'error', error: 'Too many recovery attempts, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Separate budget for the authenticated Profile self-test so it never eats into
// the pre-auth forgot-flow allowance (and vice versa).
const selfTestRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { status: 'error', error: 'Too many self-test requests, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

function generateOtp() {
    return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function maskEmail(email) {
    if (!email || !email.includes('@')) return '***';
    const [local, domain] = email.split('@');
    const shown = local.slice(0, 1);
    return `${shown}***@${domain}`;
}

function maskUsername(username) {
    if (!username) return '***';
    if (username.length <= 2) return `${username[0]}*`;
    return `${username[0]}***${username[username.length - 1]}`;
}

// Locate a user by username, email, or mobile (case-insensitive).
async function findUserByIdentifier(identifier) {
    const { Op } = require('sequelize');
    const raw = String(identifier || '').trim();
    if (!raw) return null;
    const clean = raw.toLowerCase();
    const cleanMobile = raw.replace(/[\s\-()]/g, '');
    return User.findOne({
        where: {
            [Op.or]: [
                User.sequelize.where(User.sequelize.fn('lower', User.sequelize.col('username')), clean),
                User.sequelize.where(User.sequelize.fn('lower', User.sequelize.col('email')), clean),
                ...(cleanMobile ? [{ mobile: cleanMobile }, { phoneNumber: cleanMobile }] : [])
            ]
        }
    });
}

// Public Config Route
router.get('/config', (req, res) => {
    const settings = getSettings();
    const isLocked = Boolean(settings.signupLocked || settings.lockSignup);
    res.json({
        ...settings,
        signupLocked: isLocked,
        lockSignup: isLocked
    });
});

// Logout — invalidate the current session server-side so the token cannot be
// reused even before its JWT expiry (covers both manual and idle-timeout logout).
router.post('/logout', (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            // Blacklist until the token's own JWT expiry so it cannot be resurrected.
            let expiresAtMs;
            try {
                const decoded = jwt.decode(token);
                if (decoded && decoded.exp) expiresAtMs = decoded.exp * 1000;
            } catch { /* ignore decode failure */ }
            require('../../utils/sessionTracker').forget(token, expiresAtMs);
        }
    } catch (error) {
        console.error('[AUTH] Logout error:', error.message);
    }
    res.json({ success: true });
});

// Heartbeat — refreshes the idle-session timer for an actively-used session.
router.get('/heartbeat', authenticateToken, (req, res) => {
    res.json({ ok: true, t: Date.now() });
});

// Signup
router.post('/signup', async (req, res) => {
    try {
        const settings = getSettings();
        if (settings.signupLocked || settings.lockSignup) {
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

        const cleanUsername = username ? String(username).trim().toLowerCase() : '';
        const cleanMobile = username ? String(username).trim().replace(/[\s\-\(\)]/g, '') : '';
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
                    ),
                    ...(cleanMobile ? [
                        { mobile: cleanMobile },
                        { phoneNumber: cleanMobile }
                    ] : [])
                ]
            }
        });

        if (!user) {
            console.log(`[AUTH] Authentication failed (user not found) for: '${username}'`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Temporary lockout after repeated failed attempts (shared guard).
        if (loginGuard.isLocked(user)) {
            console.log(`[AUTH] Account locked for user: ${user.username}`);
            return res.status(429).json({
                error: 'Account temporarily locked after repeated failed attempts. Try again later or reset your password.',
                locked: true,
                showForgotPassword: true
            });
        }

        console.log(`[AUTH] User found: ${user.username} (ID: ${user.id}). Verifying password...`);
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            const { attempts, locked } = await loginGuard.registerFailure(user);
            console.log(`[AUTH] Password mismatch for user: ${user.username} (attempt ${attempts})`);
            return res.status(401).json({
                error: 'Invalid username or password',
                attempts,
                showForgotPassword: attempts >= MAX_LOGIN_ATTEMPTS_BEFORE_PROMPT,
                locked
            });
        }

        // Successful credential check — clear any failed-attempt / lockout state.
        await loginGuard.clearFailures(user);

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

            // Short-lived ticket proving the password factor already passed. The
            // TOTP/backup-code endpoint requires this so a bare 6-digit code can't
            // be used as a passwordless login. Must match routes/mfa/index.js.
            const mfaChallenge = jwt.sign(
                { id: user.id, username: user.username, role: user.role, purpose: 'mfa_challenge' },
                JWT_SECRET,
                { expiresIn: '10m' }
            );

            return res.json({
                success: true,
                ...mfaInit,
                mfaChallenge,
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

        // Fire-and-forget security alert: never blocks sign-in if SMTP is down.
        require('../../services/loginAlertService')
            .notifyLogin(req, user, { method: 'password' })
            .catch(() => {});

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


// --- Account Recovery (unauthenticated) -----------------------------------
//
// Flow:
//   forgot/request  -> email a 6-digit OTP to the account's registered email
//   forgot/verify   -> verify the OTP (method=email) OR authenticator code
//                      (method=mfa). For password_reset it returns a
//                      short-lived resetTicket; for username_recovery it
//                      returns the masked username.
//   forgot/reset    -> set a new password using the resetTicket.

// Request a recovery OTP.
router.post('/forgot/request', recoveryRateLimiter, async (req, res) => {
    try {
        const { identifier } = req.body || {};
        const purpose = RECOVERY_PURPOSES.includes(req.body?.purpose) ? req.body.purpose : 'password_reset';

        if (!identifier) {
            return res.status(400).json({ error: 'Username, email, or mobile number is required' });
        }

        const user = await findUserByIdentifier(identifier);

        // Generic response to prevent account enumeration.
        const genericResponse = {
            success: true,
            channel: 'email',
            message: 'If the details match an account, a verification code has been sent to the registered email.'
        };

        if (!user || !user.email) {
            console.log(`[AUTH] Recovery requested for unknown identifier: '${identifier}'`);
            return res.json(genericResponse);
        }

        // Invalidate any earlier unconsumed tokens for this purpose.
        await RecoveryToken.update(
            { consumed: true },
            { where: { userId: user.id, purpose, consumed: false } }
        );

        const code = generateOtp();
        const codeHash = await bcrypt.hash(code, 10);
        await RecoveryToken.create({
            userId: user.id,
            email: user.email,
            codeHash,
            purpose,
            expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)
        });

        await sendOtpEmail(user.email, code, purpose, OTP_TTL_MINUTES);

        console.log(`[AUTH] Recovery OTP issued for user ${user.username} (purpose: ${purpose})`);
        // Return the SAME body whether or not the account exists (prevents enumeration).
        return res.json(genericResponse);
    } catch (error) {
        console.error('[AUTH] forgot/request error:', error);
        return res.status(500).json({ error: 'Unable to process recovery request' });
    }
});

// Verify the recovery OTP / MFA code.
router.post('/forgot/verify', recoveryRateLimiter, async (req, res) => {
    try {
        const { identifier, code } = req.body || {};
        const method = req.body?.method === 'mfa' ? 'mfa' : 'email';
        const purpose = RECOVERY_PURPOSES.includes(req.body?.purpose) ? req.body.purpose : 'password_reset';

        if (!identifier || !code) {
            return res.status(400).json({ error: 'Identifier and code are required' });
        }

        const user = await findUserByIdentifier(identifier);
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        let verified = false;

        if (method === 'mfa') {
            if (!user.mfaConfigured) {
                // Generic message: must not reveal whether the account exists / has MFA.
                return res.status(400).json({ error: 'Invalid or expired code' });
            }
            try {
                const mfaService = require('../../services/mfaService');
                const result = await mfaService.verifyTOTP(user.id, String(code));
                verified = Boolean(result && result.success);
            } catch (e) {
                console.log(`[AUTH] MFA recovery verify failed for ${user.username}: ${e.message}`);
                verified = false;
            }
        } else {
            const token = await RecoveryToken.findOne({
                where: { userId: user.id, purpose, consumed: false },
                order: [['created_at', 'DESC']]
            });
            if (token && new Date(token.expiresAt).getTime() > Date.now() && token.attempts < OTP_MAX_ATTEMPTS) {
                const match = await bcrypt.compare(String(code), token.codeHash);
                if (match) {
                    verified = true;
                    await token.update({ consumed: true });
                } else {
                    await token.update({ attempts: token.attempts + 1 });
                }
            }
        }

        if (!verified) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        if (purpose === 'username_recovery') {
            console.log(`[AUTH] Username recovery verified for ${user.username}`);
            return res.json({
                success: true,
                purpose,
                username: maskUsername(user.username),
                maskedEmail: maskEmail(user.email)
            });
        }

        // Password reset: issue a short-lived, single-purpose, single-USE ticket.
        const ticketStore = require('../../utils/ticketStore');
        const resetTicket = jwt.sign(
            { id: user.id, purpose: 'password_reset', jti: ticketStore.newTicketId() },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        console.log(`[AUTH] Password reset ticket issued for ${user.username}`);
        return res.json({ success: true, purpose, resetTicket });
    } catch (error) {
        console.error('[AUTH] forgot/verify error:', error);
        return res.status(500).json({ error: 'Unable to verify code' });
    }
});

// Set a new password using a reset ticket.
router.post('/forgot/reset', recoveryRateLimiter, async (req, res) => {
    try {
        const { resetTicket, newPassword } = req.body || {};
        if (!resetTicket || !newPassword) {
            return res.status(400).json({ error: 'Reset ticket and new password are required' });
        }
        if (String(newPassword).length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        let payload;
        try {
            payload = jwt.verify(resetTicket, JWT_SECRET);
        } catch (e) {
            return res.status(400).json({ error: 'Reset session expired. Please start the process again.' });
        }
        if (!payload || payload.purpose !== 'password_reset') {
            return res.status(400).json({ error: 'Invalid reset ticket' });
        }

        // Single-use enforcement: a ticket may be redeemed only once.
        const ticketStore = require('../../utils/ticketStore');
        if (ticketStore.isConsumed(payload.jti)) {
            return res.status(400).json({ error: 'This reset link has already been used. Please start again.' });
        }

        const user = await User.findByPk(payload.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hashedPassword = await bcrypt.hash(String(newPassword), 10);
        await user.update({ password: hashedPassword, failedLoginAttempts: 0, lockoutUntil: null });
        await RecoveryToken.update({ consumed: true }, { where: { userId: user.id, consumed: false } });

        // Burn the ticket so it cannot be replayed within its 15-minute window.
        ticketStore.consume(payload.jti, payload.exp ? payload.exp * 1000 : undefined);

        console.log(`[AUTH] Password reset completed for ${user.username}`);
        return res.json({ success: true, message: 'Password updated. You can now sign in with your new password.' });
    } catch (error) {
        console.error('[AUTH] forgot/reset error:', error);
        return res.status(500).json({ error: 'Unable to reset password' });
    }
});


// --- Recovery preference (per user, authenticated) ------------------------

// Get the current user's preferred recovery method.
router.get('/recovery/preference', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({
            recoveryMethod: user.recoveryMethod || 'email',
            mfaAvailable: Boolean(user.mfaConfigured)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update the current user's preferred recovery method.
router.put('/recovery/preference', authenticateToken, async (req, res) => {
    try {
        const method = req.body?.recoveryMethod;
        if (!['email', 'mfa'].includes(method)) {
            return res.status(400).json({ error: "recoveryMethod must be 'email' or 'mfa'" });
        }
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (method === 'mfa' && !user.mfaConfigured) {
            return res.status(400).json({ error: 'Set up your authenticator app (MFA) before choosing it for recovery.' });
        }
        await user.update({ recoveryMethod: method });
        res.json({ success: true, recoveryMethod: method });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- Recovery email (SMTP) configuration (admin only) ---------------------
//
// The SMTP password is stored encrypted and never returned to the client.

// Read the current email-sender configuration (password omitted).
router.get('/recovery/email-config', authenticateToken, requireAdmin, (req, res) => {
    try {
        const mail = getMailSettings();
        const status = mailer.getStatus();
        res.json({
            enabled: Boolean(mail.enabled),
            host: mail.host || '',
            port: mail.port || 587,
            secure: Boolean(mail.secure),
            user: mail.user || '',
            from: mail.from || '',
            hasPassword: Boolean(mail.smtpPassEnc),
            needsPassword: !mail.smtpPassEnc,
            configured: status.configured,
            source: status.source,
            effectiveUser: status.user || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update the email-sender configuration.
router.put('/recovery/email-config', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { enabled, host, port, secure, user, password, from } = req.body || {};
        const patch = {};
        if (enabled !== undefined) patch.enabled = Boolean(enabled);
        if (host !== undefined) patch.host = String(host).trim();
        if (port !== undefined) patch.port = parseInt(port, 10) || 587;
        if (secure !== undefined) patch.secure = Boolean(secure);
        if (user !== undefined) patch.user = String(user).trim();
        if (from !== undefined) patch.from = String(from).trim();
        // Only overwrite the stored password when a new non-empty value is supplied.
        if (typeof password === 'string' && password.trim() !== '') {
            patch.smtpPassEnc = secretBox.encrypt(password.trim());
        }
        const saved = saveMailSettings(patch);
        mailer.invalidate();
        res.json({
            success: true,
            enabled: Boolean(saved.enabled),
            configured: mailer.isConfigured(),
            hasPassword: Boolean(saved.smtpPassEnc)
        });
    } catch (error) {
        console.error('[AUTH] email-config save error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send a test email to confirm delivery works.
router.post('/recovery/email-config/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        const to = (req.body?.to || user?.email || '').trim();
        if (!to) return res.status(400).json({ error: 'No recipient address available' });

        const result = await mailer.sendTestEmail(to);

        if (result.delivered) {
            return res.json({ success: true, delivered: true, message: `Test email sent to ${to}.` });
        }
        return res.status(502).json({
            success: false,
            delivered: false,
            error: result.reason === 'smtp-not-configured'
                ? 'SMTP is not configured yet. Fill in the sender details and save first.'
                : `Could not deliver: ${result.reason}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- Recovery self-test ("send me a code now", authenticated) -------------
//
// Lets the signed-in user exercise the email-OTP channel straight from their
// Profile without logging out. Uses a dedicated token purpose that the public
// forgot/verify endpoint deliberately does not accept, so a self-test code can
// never be turned into a password-reset ticket.

// Email a fresh recovery code to the signed-in user's own address.
router.post('/recovery/self-test', authenticateToken, selfTestRateLimiter, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user || !user.email) {
            return res.status(400).json({ error: 'No email address is set on this account.' });
        }

        // Only keep one live self-test code at a time.
        await RecoveryToken.update(
            { consumed: true },
            { where: { userId: user.id, purpose: RECOVERY_CHECK_PURPOSE, consumed: false } }
        );

        const code = generateOtp();
        const codeHash = await bcrypt.hash(code, 10);
        await RecoveryToken.create({
            userId: user.id,
            email: user.email,
            codeHash,
            purpose: RECOVERY_CHECK_PURPOSE,
            expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)
        });

        const result = await sendOtpEmail(user.email, code, RECOVERY_CHECK_PURPOSE, OTP_TTL_MINUTES);

        console.log(`[AUTH] Recovery self-test OTP issued for ${user.username} (delivered=${result.delivered})`);
        res.json({
            success: true,
            delivered: Boolean(result.delivered),
            logged: Boolean(result.logged),
            maskedEmail: maskEmail(user.email),
            expiresMinutes: OTP_TTL_MINUTES
        });
    } catch (error) {
        console.error('[AUTH] recovery/self-test error:', error);
        res.status(500).json({ error: 'Unable to send a recovery code' });
    }
});

// Check the code the user received (verification only — no reset ticket).
router.post('/recovery/self-test/verify', authenticateToken, selfTestRateLimiter, async (req, res) => {
    try {
        const code = String(req.body?.code || '').trim();
        if (!code) return res.status(400).json({ error: 'Enter the 6-digit code.' });

        const token = await RecoveryToken.findOne({
            where: { userId: req.user.id, purpose: RECOVERY_CHECK_PURPOSE, consumed: false },
            order: [['created_at', 'DESC']]
        });

        if (!token || new Date(token.expiresAt).getTime() <= Date.now() || token.attempts >= OTP_MAX_ATTEMPTS) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }

        const match = await bcrypt.compare(code, token.codeHash);
        if (!match) {
            await token.update({ attempts: token.attempts + 1 });
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }

        await token.update({ consumed: true });
        console.log(`[AUTH] Recovery self-test verified for ${req.user.username || req.user.id}`);
        res.json({ success: true, message: 'Recovery code verified — your email recovery channel is working.' });
    } catch (error) {
        console.error('[AUTH] recovery/self-test/verify error:', error);
        res.status(500).json({ error: 'Unable to verify the code' });
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
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });
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
router.get('/users', authenticateToken, async (req, res) => {
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
