const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/mfaMiddleware');
const mfaService = require('../../services/mfaService');
const { User, MfaDevice, MfaTotpSecret, MfaAuditLog } = require('../../models');
const { Op } = require('sequelize');

/**
 * GET /api/admin/mfa/users
 * List all users with their MFA status and paired devices
 */
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { search, mfaEnabled, page = 1, limit = 50 } = req.query;

        const where = {};

        if (search) {
            where[Op.or] = [
                { username: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { fullName: { [Op.like]: `%${search}%` } }
            ];
        }

        if (mfaEnabled !== undefined) {
            where.mfaEnabled = mfaEnabled === 'true';
        }

        const offset = (page - 1) * limit;

        const { count, rows: users } = await User.findAndCountAll({
            where: where,
            attributes: ['id', 'username', 'email', 'fullName', 'role', 'status', 'mfaEnabled', 'mfaMethod', 'mfaConfigured', 'mfaExempt', 'createdAt'],
            include: [
                {
                    model: MfaDevice,
                    as: 'mfaDevices',
                    attributes: ['id', 'deviceName', 'isActive', 'lastUsed'],
                    required: false
                }
            ],
            limit: parseInt(limit),
            offset: offset,
            order: [['createdAt', 'DESC']]
        });

        const usersWithStats = users.map(user => {
            const activeDevices = user.mfaDevices ? user.mfaDevices.filter(d => d.isActive) : [];
            const hasDevice = activeDevices.length > 0;
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                status: user.status,
                mfaEnabled: !!user.mfaEnabled,
                mfa_enabled: !!user.mfaEnabled,
                mfaMethod: user.mfaMethod || 'both',
                mfa_method: user.mfaMethod || 'both',
                mfaConfigured: !!user.mfaConfigured,
                mfaExempt: !!user.mfaExempt,
                hasDevice: hasDevice,
                has_device: hasDevice,
                deviceCount: activeDevices.length,
                totalDevices: user.mfaDevices ? user.mfaDevices.length : 0,
                lastDeviceUsed: user.mfaDevices && user.mfaDevices.length > 0
                    ? user.mfaDevices.reduce((latest, device) => {
                        return !latest || (device.lastUsed && device.lastUsed > latest) ? device.lastUsed : latest;
                    }, null)
                    : null,
                createdAt: user.createdAt
            };
        });

        res.json({
            success: true,
            users: usersWithStats,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/mfa/users/:userId
 * Get detailed MFA info for a user
 */
router.get('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findByPk(userId, {
            attributes: ['id', 'username', 'email', 'fullName', 'role', 'status', 'mfaEnabled', 'mfaMethod', 'mfaConfigured', 'mfaExempt', 'createdAt'],
            include: [
                {
                    model: MfaDevice,
                    as: 'mfaDevices',
                    required: false
                }
            ]
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const totpSecret = await MfaTotpSecret.findOne({
            where: { userId: userId },
            attributes: ['id', 'isVerified', 'createdAt', 'lastUsed']
        });

        const recentLogs = await MfaAuditLog.findAll({
            where: { userId: userId },
            limit: 10,
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            user: {
                ...user.toJSON(),
                mfaEnabled: !!user.mfaEnabled,
                mfa_enabled: !!user.mfaEnabled,
                mfaMethod: user.mfaMethod || 'both',
                mfa_method: user.mfaMethod || 'both',
                hasTotp: !!totpSecret,
                totpVerified: totpSecret ? totpSecret.isVerified : false,
                devices: user.mfaDevices || [],
                recentLogs: recentLogs
            }
        });
    } catch (error) {
        console.error('Get user MFA error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/mfa/enable/:userId
 * Toggle MFA enabled status for a user
 */
router.post('/enable/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { enabled } = req.body;

        if (enabled === undefined) {
            return res.status(400).json({ error: 'Enabled status is required' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isEnable = enabled === true || enabled === 'true' || enabled === 1;
        
        let isConfigured = false;
        if (isEnable) {
            if (!user.mfaMethod) user.mfaMethod = 'both';
            const verifiedSecret = await MfaTotpSecret.findOne({ where: { userId, isVerified: true } });
            const activeDevice = await MfaDevice.findOne({ where: { userId, isActive: true } });
            isConfigured = !!(verifiedSecret || activeDevice);

            let secret = await MfaTotpSecret.findOne({ where: { userId } });
            if (!secret) {
                await mfaService.generateTOTPSecret(userId);
            }
        }

        const updates = {
            mfaEnabled: isEnable,
            mfaMethod: isEnable ? (user.mfaMethod || 'both') : null,
            mfaConfigured: isConfigured
        };

        await user.update(updates);

        await mfaService.logMFAEvent(userId, isEnable ? 'mfa_enabled' : 'mfa_disabled', null, null, {
            setBy: req.user.id
        });

        res.json({
            success: true,
            message: `MFA ${isEnable ? 'enabled' : 'disabled'} for ${user.username}`,
            user: {
                id: user.id,
                username: user.username,
                mfaEnabled: user.mfaEnabled,
                mfa_enabled: user.mfaEnabled,
                mfaMethod: user.mfaMethod,
                mfa_method: user.mfaMethod,
                mfaConfigured: user.mfaConfigured
            }
        });
    } catch (error) {
        console.error('MFA toggle error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/mfa/reset/:userId
 * Reset MFA configuration and clear all paired devices/secrets
 */
router.post('/reset/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const adminUserId = req.user.id;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await mfaService.resetUserMFA(userId, adminUserId);

        res.json({
            success: true,
            message: `MFA reset and cleared for ${user.username}`,
            user: {
                id: user.id,
                username: user.username,
                mfaEnabled: false,
                mfa_enabled: false,
                mfaConfigured: false
            }
        });
    } catch (error) {
        console.error('MFA reset error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/mfa/method/:userId
 * Change user MFA method
 */
router.post('/method/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { method } = req.body;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const validMethods = ['push', 'totp', 'both', 'none', 'companion', 'email'];
        if (!validMethods.includes(method)) {
            return res.status(400).json({ error: 'Invalid MFA method' });
        }

        const normalizedMethod = method === 'companion' ? 'push' : (method === 'none' ? null : method);

        if (!normalizedMethod) {
            await user.update({
                mfaMethod: null,
                mfaEnabled: false,
                mfaConfigured: false
            });
        } else {
            let secret = await MfaTotpSecret.findOne({ where: { userId } });
            if (!secret && (normalizedMethod === 'totp' || normalizedMethod === 'both')) {
                await mfaService.generateTOTPSecret(userId);
            }

            await user.update({
                mfaMethod: normalizedMethod,
                mfaEnabled: true,
                mfaConfigured: true
            });
        }

        await mfaService.logMFAEvent(userId, 'mfa_method_changed', null, null, {
            newMethod: method,
            setBy: req.user.id
        });

        res.json({
            success: true,
            message: `MFA method updated to ${method.toUpperCase()}`
        });

    } catch (error) {
        console.error('MFA method change error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/mfa/generate-qr/:userId
 * Admin endpoint to generate Companion Binding QR code & TOTP QR code for any user
 */
router.post('/generate-qr/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const requestedUrl = req.body?.serverUrl;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const clientHost = req.headers['x-forwarded-host'] || req.get('host') || '';
        let currentServerUrl = requestedUrl || process.env.SERVER_URL || (clientHost ? req.protocol + '://' + clientHost : 'http://10.10.20.4:5005');
        if (currentServerUrl.includes(':5174')) {
            currentServerUrl = currentServerUrl.replace(':5174', ':5005');
        }
        if (currentServerUrl.includes('localhost') || currentServerUrl.includes('127.0.0.1')) {
            if (req.headers['x-forwarded-host']) {
                currentServerUrl = req.protocol + '://' + req.headers['x-forwarded-host'];
            } else if (clientHost && !clientHost.includes('localhost')) {
                currentServerUrl = req.protocol + '://' + clientHost.split(':')[0] + ':5005';
            } else {
                currentServerUrl = 'http://10.10.20.4:5005';
            }
        }

        console.log(`[Admin MFA] Generating pairing QR for user ${user.username} (ID: ${userId}) with URL: ${currentServerUrl}`);
        const companionData = await mfaService.generateQRCodeData(userId, currentServerUrl);

        // Generate TOTP Secret & QR
        let totpSecret = '';
        let totpQr = '';
        try {
            const totpData = await mfaService.generateTOTPSecret(userId);
            totpSecret = totpData.secret;
            totpQr = totpData.qrCodeUrl;
        } catch (e) {
            const existing = await MfaTotpSecret.findOne({ where: { userId } });
            if (existing) {
                totpSecret = existing.secret;
                const speakeasy = require('speakeasy');
                const QRCode = require('qrcode');
                const otpauth = `otpauth://totp/PEM%20Pro%20(${encodeURIComponent(user.email || user.username)})?secret=${totpSecret}&issuer=Personal%20Expense%20Manager`;
                totpQr = await QRCode.toDataURL(otpauth);
            }
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                mfaMethod: user.mfaMethod || 'both'
            },
            companionQrCodeUrl: companionData.qrCodeUrl,
            totpQrCodeUrl: totpQr || companionData.qrCodeUrl,
            bindingToken: companionData.bindingToken,
            serverUrl: currentServerUrl,
            expiresAt: companionData.expiresAt
        });
    } catch (error) {
        console.error('Admin generate-qr error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/mfa/stats
 * Get MFA statistics
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const totalUsers = await User.count();
        const mfaEnabledUsers = await User.count({ where: { mfaEnabled: true } });
        const mfaConfiguredUsers = await User.count({ where: { mfaConfigured: true } });
        const mfaExemptUsers = await User.count({ where: { mfaExempt: true } });

        const pushUsers = await User.count({ where: { mfaMethod: 'push' } });
        const totpUsers = await User.count({ where: { mfaMethod: 'totp' } });
        const bothUsers = await User.count({ where: { mfaMethod: 'both' } });

        const activeDevices = await MfaDevice.count({ where: { isActive: true } });
        const totalDevices = await MfaDevice.count();

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentLogins = await MfaAuditLog.count({
            where: {
                eventType: 'login_success',
                createdAt: { [Op.gte]: sevenDaysAgo }
            }
        });

        const recentFailures = await MfaAuditLog.count({
            where: {
                eventType: { [Op.in]: ['login_failure', 'totp_failure', 'push_denied'] },
                createdAt: { [Op.gte]: sevenDaysAgo }
            }
        });

        res.json({
            success: true,
            stats: {
                users: {
                    total: totalUsers,
                    mfaEnabled: mfaEnabledUsers,
                    mfaConfigured: mfaConfiguredUsers,
                    mfaExempt: mfaExemptUsers,
                    mfaEnabledPercentage: totalUsers > 0 ? ((mfaEnabledUsers / totalUsers) * 100).toFixed(2) : 0
                },
                methods: {
                    push: pushUsers,
                    totp: totpUsers,
                    both: bothUsers
                },
                devices: {
                    active: activeDevices,
                    total: totalDevices
                },
                activity: {
                    recentLogins: recentLogins,
                    recentFailures: recentFailures,
                    successRate: (recentLogins + recentFailures) > 0
                        ? ((recentLogins / (recentLogins + recentFailures)) * 100).toFixed(2)
                        : 0
                }
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
