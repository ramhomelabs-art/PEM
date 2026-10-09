const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { mfaRateLimiter, setupRateLimiter, validatePushSignature } = require('../../middleware/mfaMiddleware');
const mfaService = require('../../services/mfaService');
const { User } = require('../../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/auth');

// Mount mobile API routes
const mobileRoutes = require('./mobile');
router.use('/mobile', mobileRoutes);

// Ensure the device referenced in the request belongs to the authenticated user.
const requireDeviceOwnership = async (req, res, next) => {
    try {
        const deviceId = req.params.deviceId || req.body.deviceId;
        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID is required' });
        }
        const { MfaDevice } = require('../../models');
        const device = await MfaDevice.findOne({ where: { id: deviceId, userId: req.user.id } });
        if (!device) {
            return res.status(403).json({ error: 'Device not found or not owned by user' });
        }
        req.mfaDevice = device;
        next();
    } catch (e) {
        console.error('Device ownership check error:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/mfa/auth/login
 * Initial login with username/password
 */
router.post('/auth/login', mfaRateLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user
        const user = await User.findOne({
            where: { username: username }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is active
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is not active' });
        }

        // Check MFA exemption (admin bypass)
        if (user.mfaExempt) {
            const token = jwt.sign({
                id: user.id,
                username: user.username,
                role: user.role
            }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

            await mfaService.logMFAEvent(user.id, 'login_success', null, req.ip, {
                userAgent: req.headers['user-agent'],
                mfaExempt: true
            });

            return res.json({
                success: true,
                mfaRequired: false,
                mfaExempt: true,
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            });
        }

        // Check if MFA is configured
        if (!user.mfaEnabled || !user.mfaConfigured) {
            const setupToken = jwt.sign({
                id: user.id,
                username: user.username,
                role: user.role,
                purpose: 'mfa_setup'
            }, JWT_SECRET, { expiresIn: '30m' });

            return res.json({
                success: true,
                mfaRequired: false,
                needsSetup: !user.mfaConfigured,
                userId: user.id,
                token: setupToken,
                message: 'MFA setup required. Please scan QR code to bind your device.'
            });
        }

        // MFA is enabled - determine method
        const mfaMethod = user.mfaMethod;

        if (mfaMethod === 'push' || mfaMethod === 'both') {
            // Send push notification
            try {
                const pushRequest = await mfaService.sendPushRequest(user.id, null, {
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    location: null
                });

                return res.json({
                    success: true,
                    mfaRequired: true,
                    mfaMethod: mfaMethod,
                    requestId: pushRequest.requestId,
                    expiresAt: pushRequest.expiresAt,
                    message: 'Push notification sent. Please approve on your device.'
                });
            } catch (error) {
                console.error('Failed to send push request:', error);

                // Fallback to TOTP if push fails (both or push method)
                return res.json({
                    success: true,
                    mfaRequired: true,
                    mfaMethod: 'totp',
                    userId: user.id,
                    message: 'Push notification failed. Please enter TOTP code.'
                });
            }
        } else if (mfaMethod === 'totp') {
            return res.json({
                success: true,
                mfaRequired: true,
                mfaMethod: 'totp',
                userId: user.id,
                message: 'Please enter your 6-digit TOTP code.'
            });
        }

        return res.status(500).json({ error: 'Invalid MFA configuration' });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/mfa/auth/setup
 * Generate QR code for MFA setup
 */
router.get('/auth/setup', authenticateToken, setupRateLimiter, async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        if (!userId) {
            return res.status(400).json({ error: 'User ID not found in token' });
        }

        // Generate TOTP secret and QR code
        const setup = await mfaService.setupMFA(userId);

        res.json({
            success: true,
            qrCodeUrl: setup.qrCodeUrl,
            secret: setup.secret,
            backupCodes: setup.backupCodes,
            message: 'Scan the QR code with your authenticator app or mobile device'
        });
    } catch (error) {
        console.error('MFA setup error:', error);
        res.status(500).json({ error: error.message || 'Failed to setup MFA' });
    }
});

/**
 * GET /api/mfa/auth/status/:requestId
 * Poll push request status
 */
router.get('/auth/status/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        if (!requestId || requestId === 'undefined' || requestId === 'null') {
            return res.json({ status: 'not_found' });
        }
        const status = await mfaService.getPushRequestStatus(requestId);
        res.json(status);
    } catch (error) {
        res.json({ status: 'not_found', message: error.message });
    }
});

/**
 * POST /api/mfa/auth/verify-totp
 * Verify TOTP code
 */
router.post('/auth/verify-totp', mfaRateLimiter, async (req, res) => {
    try {
        const { userId, code, backupCode } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        let result;

        if (backupCode) {
            // Verify backup code
            result = await mfaService.verifyBackupCode(userId, backupCode);
        } else if (code) {
            // Verify TOTP code
            result = await mfaService.verifyTOTP(userId, code, false);
        } else {
            return res.status(400).json({ error: 'Code or backup code is required' });
        }

        if (result.success) {
            const user = await User.findByPk(userId);

            return res.json({
                success: true,
                token: result.token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName,
                    profilePhoto: user.profilePhoto,
                    role: user.role
                }
            });
        } else {
            return res.status(401).json({ error: 'Invalid code' });
        }
    } catch (error) {
        console.error('TOTP verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/setup/generate-qr
 * Generate QR code for device binding
 */
router.post(['/setup/generate-qr', '/setup/qr'], authenticateToken, setupRateLimiter, async (req, res) => {
    try {
        const userId = req.user.id;
        const requestedUrl = req.body?.serverUrl;
        const { getPrimaryLanIp } = require('../../utils/networkUtils');
        const lanIp = getPrimaryLanIp();
        const clientHost = req.headers['x-forwarded-host'] || req.get('host') || '';
        let currentServerUrl = requestedUrl || process.env.SERVER_URL || (clientHost ? `${req.protocol}://${clientHost}` : `http://${lanIp}:5174`);
        
        // If it resolved to localhost, replace localhost with LAN IP or request host
        if (currentServerUrl.includes('localhost') || currentServerUrl.includes('127.0.0.1')) {
            if (req.headers['x-forwarded-host']) {
                currentServerUrl = `${req.protocol}://${req.headers['x-forwarded-host']}`;
            } else if (clientHost && !clientHost.includes('localhost') && !clientHost.includes('127.0.0.1')) {
                currentServerUrl = `${req.protocol}://${clientHost.split(':')[0]}:5174`;
            } else {
                currentServerUrl = `http://${lanIp}:5174`;
            }
        }
        
        console.log(`[MFA] Generating QR Code with mobile Server URL: ${currentServerUrl}`);
        const qrData = await mfaService.generateQRCodeData(userId, currentServerUrl);

        // Ensure TOTP secret exists and get standard Authenticator QR code
        let totpSecret = '';
        let totpQr = '';
        try {
            const totpData = await mfaService.generateTOTPSecret(userId);
            totpSecret = totpData.secret;
            totpQr = totpData.qrCodeUrl;
        } catch (e) {
            const { MfaTotpSecret } = require('../../models');
            const existing = await MfaTotpSecret.findOne({ where: { userId } });
            if (existing) {
                totpSecret = existing.secret;
                const user = await User.findByPk(userId);
                const speakeasy = require('speakeasy');
                const QRCode = require('qrcode');
                const otpauth = `otpauth://totp/PEM%20Pro%20(${encodeURIComponent(user ? user.email : 'User')})?secret=${totpSecret}&issuer=Personal%20Expense%20Manager`;
                totpQr = await QRCode.toDataURL(otpauth);
            }
        }

        res.json({
            success: true,
            qrCodeUrl: qrData.qrCodeUrl,
            companionQrCodeUrl: qrData.qrCodeUrl,
            totpQrCodeUrl: totpQr,
            rawEnvelope: qrData.rawEnvelope,
            isEncrypted: true,
            securityProtocol: 'PEM-AES256-GCM-V2',
            secret: totpSecret,
            bindingToken: qrData.bindingToken,
            expiresAt: qrData.expiresAt
        });
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/setup/bind-device
 * Bind device to user account
 */
router.post('/setup/bind-device', setupRateLimiter, async (req, res) => {
    try {
        const { userId, bindingToken, deviceInfo, fcmToken } = req.body;
        console.log(`[MFA Route] POST /setup/bind-device received for userId: ${userId}, tokenPrefix: ${(bindingToken || '').substring(0, 8)}, device: ${deviceInfo?.manufacturer} ${deviceInfo?.model}`);

        if (!userId || !bindingToken || !deviceInfo) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const credentials = await mfaService.bindDevice(userId, deviceInfo, bindingToken, fcmToken);

        res.json({
            success: true,
            deviceId: credentials.deviceId,
            webhookUrl: credentials.webhookUrl,
            secretKey: credentials.secretKey,
            encryptionKey: credentials.encryptionKey,
            totpSecret: credentials.totpSecret, // Fix: Explicitly pass TOTP secret to client
            message: 'Device bound successfully'
        });
    } catch (error) {
        console.error('Device binding error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/setup/totp/generate
 * Generate TOTP secret
 */
router.post('/setup/totp/generate', authenticateToken, setupRateLimiter, async (req, res) => {
    try {
        const userId = req.user.id;

        const totpData = await mfaService.generateTOTPSecret(userId);

        res.json({
            success: true,
            secret: totpData.secret,
            qrCodeUrl: totpData.qrCodeUrl,
            backupCodes: totpData.backupCodes,
            message: 'TOTP secret generated. Save your backup codes securely.'
        });
    } catch (error) {
        console.error('TOTP generation error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/setup/totp/verify (and /setup/verify)
 * Verify TOTP setup
 */
router.post(['/setup/totp/verify', '/setup/verify'], authenticateToken, setupRateLimiter, async (req, res) => {
    try {
        const userId = req.user.id;
        const code = req.body.code || req.body.token;

        if (!code) {
            return res.status(400).json({ error: 'TOTP verification code is required' });
        }

        const result = await mfaService.verifyTOTP(userId, code, true);

        if (result.success) {
            const user = await User.findByPk(userId);
            await user.update({
                mfaEnabled: true,
                mfaConfigured: true,
                mfaMethod: user.mfaMethod || 'totp'
            });
            const token = jwt.sign({
                id: user.id,
                username: user.username,
                role: user.role
            }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

            res.json({
                success: true,
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                },
                message: 'TOTP verified successfully'
            });
        } else {
            res.status(401).json({ error: 'Invalid TOTP code' });
        }
    } catch (error) {
        console.error('TOTP verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/setup/configure-method
 * Configure MFA method
 */
router.post('/setup/configure-method', authenticateToken, setupRateLimiter, async (req, res) => {
    try {
        const userId = req.user.id;
        const { method } = req.body;

        if (!method) {
            return res.status(400).json({ error: 'MFA method is required' });
        }

        await mfaService.configureMFAMethod(userId, method);

        res.json({
            success: true,
            message: `MFA configured with ${method} method`
        });
    } catch (error) {
        console.error('MFA configuration error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/mfa/devices
 * Get user's devices
 */
router.get('/devices', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const devices = await mfaService.getUserDevices(userId);

        res.json({
            success: true,
            devices: devices.map(d => ({
                id: d.id,
                deviceName: d.deviceName,
                deviceInfo: d.deviceInfo,
                isActive: d.isActive,
                lastUsed: d.lastUsed,
                createdAt: d.createdAt
            }))
        });
    } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/mfa/devices/:deviceId
 * Revoke a device
 */
router.delete('/devices/:deviceId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { deviceId } = req.params;

        // Verify device belongs to user
        const {
            User,
            MfaDevice,
            MfaPushRequest,
            MfaTotpSecret,
            MfaAuditLog
        } = require('../../models'); // Corrected path from ../ to ../../
        const device = await MfaDevice.findOne({
            where: { id: deviceId, userId: userId }
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        await mfaService.revokeDevice(deviceId, userId);

        res.json({
            success: true,
            message: 'Device revoked successfully'
        });
    } catch (error) {
        console.error('Device revocation error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/push/respond
 * Respond to push notification (called by mobile app)
 */
router.post('/push/respond', mfaRateLimiter, validatePushSignature, async (req, res) => {
    try {
        const { requestId, response, deviceId } = req.body;

        if (!requestId || !response || !deviceId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!['approved', 'denied'].includes(response)) {
            return res.status(400).json({ error: 'Invalid response. Must be "approved" or "denied"' });
        }

        const result = await mfaService.verifyPushResponse(requestId, response, deviceId, req.ip);

        if (result.success) {
            res.json({
                success: true,
                token: result.token,
                message: 'Login approved'
            });
        } else {
            res.json({
                success: false,
                message: 'Login denied'
            });
        }
    } catch (error) {
        console.error('Push response error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/push/register-token
 * Register/update FCM token for device
 */
router.post('/push/register-token', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { deviceId, fcmToken } = req.body;

        if (!deviceId || !fcmToken) {
            return res.status(400).json({ error: 'Device ID and FCM token are required' });
        }

        const { MfaDevice } = require('../../models');
        const device = await MfaDevice.findOne({
            where: { id: deviceId, userId: userId }
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        await device.update({ fcmToken: fcmToken });

        res.json({
            success: true,
            message: 'FCM token updated'
        });
    } catch (error) {
        console.error('FCM token registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/mfa/status
 * Get user's MFA status
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findByPk(userId);
        const devices = await mfaService.getUserDevices(userId);

        res.json({
            success: true,
            mfaEnabled: user.mfaEnabled,
            mfaMethod: user.mfaMethod,
            mfaConfigured: user.mfaConfigured,
            mfaExempt: user.mfaExempt,
            deviceCount: devices.filter(d => d.isActive).length,
            devices: devices.map(d => ({
                id: d.id,
                deviceName: d.deviceName,
                isActive: d.isActive,
                lastUsed: d.lastUsed
            }))
        });
    } catch (error) {
        console.error('MFA status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/mobile/login
 * Mobile app login with MFA support
 */
router.post('/mobile/login', mfaRateLimiter, async (req, res) => {
    try {
        const { username, password, deviceId, totpCode } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const result = await mfaService.mobileLogin(username, password, deviceId, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        }, totpCode);

        res.json(result);
    } catch (error) {
        console.error('Mobile login error:', error);
        res.status(401).json({ error: error.message });
    }
});

/**
 * GET /api/mfa/mobile/totp/:deviceId
 * Get current TOTP code for a bound device
 */
router.get('/mobile/totp/:deviceId', authenticateToken, requireDeviceOwnership, async (req, res) => {
    try {
        const { deviceId } = req.params;

        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID is required' });
        }

        const totpData = await mfaService.generateTOTPForDevice(deviceId);

        res.json({
            success: true,
            code: totpData.code,
            expiresIn: totpData.expiresIn
        });
    } catch (error) {
        console.error('TOTP generation error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/mobile/verify-device
 * Verify device binding is still valid
 */
router.post('/mobile/verify-device', authenticateToken, requireDeviceOwnership, async (req, res) => {
    try {
        const { deviceId, deviceFingerprint } = req.body;

        if (!deviceId || !deviceFingerprint) {
            return res.status(400).json({ error: 'Device ID and fingerprint are required' });
        }

        const result = await mfaService.validateDeviceBinding(deviceId, deviceFingerprint);

        res.json(result);
    } catch (error) {
        console.error('Device verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/mfa/mobile/status/:deviceId
 * Get MFA status for a specific device
 */
router.get('/mobile/status/:deviceId', authenticateToken, requireDeviceOwnership, async (req, res) => {
    try {
        const { deviceId } = req.params;

        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID is required' });
        }

        const status = await mfaService.getDeviceMFAStatus(deviceId);

        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        console.error('Device status error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/mobile/push/respond
 * Respond to a push notification (approve/deny)
 */
router.post('/mobile/push/respond', authenticateToken, requireDeviceOwnership, async (req, res) => {
    try {
        const { requestId, deviceId, response } = req.body;

        if (!requestId || !deviceId || !response) {
            return res.status(400).json({ error: 'Request ID, device ID, and response are required' });
        }

        if (response !== 'approved' && response !== 'denied') {
            return res.status(400).json({ error: 'Response must be "approved" or "denied"' });
        }

        await mfaService.handlePushResponse(requestId, deviceId, response);

        console.log(`Push notification response: ${response} for request ${requestId} from device ${deviceId}`);

        res.json({
            success: true,
            message: `Login ${response}`
        });
    } catch (error) {
        console.error('Push response error:', error);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
