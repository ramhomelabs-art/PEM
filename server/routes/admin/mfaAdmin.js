const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const mfaService = require('../../services/mfaService');
const { User, MfaDevice, MfaTotpSecret } = require('../../models');

/**
 * Middleware to check admin role
 */
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

/**
 * GET /api/admin/mfa/users
 * List all users with MFA status
 */
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { search, mfaEnabled, page = 1, limit = 50 } = req.query;

        const where = {};

        if (search) {
            const { Op } = require('sequelize');
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
            attributes: ['id', 'username', 'email', 'fullName', 'role', 'mfaEnabled', 'mfaMethod', 'mfaConfigured', 'mfaExempt', 'createdAt'],
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

        const usersWithStats = users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            mfaEnabled: user.mfaEnabled,
            mfaMethod: user.mfaMethod,
            mfaConfigured: user.mfaConfigured,
            mfaExempt: user.mfaExempt,
            deviceCount: user.mfaDevices ? user.mfaDevices.filter(d => d.isActive).length : 0,
            totalDevices: user.mfaDevices ? user.mfaDevices.length : 0,
            lastDeviceUsed: user.mfaDevices && user.mfaDevices.length > 0
                ? user.mfaDevices.reduce((latest, device) => {
                    return !latest || (device.lastUsed && device.lastUsed > latest) ? device.lastUsed : latest;
                }, null)
                : null,
            createdAt: user.createdAt
        }));

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
            attributes: ['id', 'username', 'email', 'fullName', 'role', 'mfaEnabled', 'mfaMethod', 'mfaConfigured', 'mfaExempt', 'createdAt'],
            include: [
                {
                    model: MfaDevice,
                    as: 'mfaDevices',
                    attributes: ['id', 'deviceName', 'deviceInfo', 'deviceFingerprint', 'isActive', 'lastUsed', 'createdAt']
                },
                {
                    model: MfaTotpSecret,
                    as: 'totpSecret',
                    attributes: ['id', 'isVerified', 'createdAt', 'updatedAt']
                }
            ]
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get recent audit logs
        const auditLogs = await mfaService.getAuditLogs(userId, 20, 0);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                mfaEnabled: user.mfaEnabled,
                mfaMethod: user.mfaMethod,
                mfaConfigured: user.mfaConfigured,
                mfaExempt: user.mfaExempt,
                createdAt: user.createdAt
            },
            devices: user.mfaDevices || [],
            totpConfigured: user.totpSecret ? user.totpSecret.isVerified : false,
            totpCreatedAt: user.totpSecret ? user.totpSecret.createdAt : null,
            recentActivity: auditLogs.rows
        });
    } catch (error) {
        console.error('Get user detail error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/mfa/reset/:userId
 * Reset user's MFA configuration
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
            message: `MFA reset for user ${user.username}`
        });
    } catch (error) {
        console.error('MFA reset error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/admin/mfa/devices/:deviceId
 * Revoke a specific device
 */
router.delete('/devices/:deviceId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const adminUserId = req.user.id;

        const device = await MfaDevice.findByPk(deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        await mfaService.revokeDevice(deviceId, adminUserId);

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
 * GET /api/admin/mfa/audit-log
 * Get MFA audit logs
 */
router.get('/audit-log', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId, eventType, page = 1, limit = 100 } = req.query;

        const offset = (page - 1) * limit;

        const auditLogs = await mfaService.getAuditLogs(
            userId || null,
            parseInt(limit),
            offset
        );

        // Filter by event type if provided
        let filteredRows = auditLogs.rows;
        if (eventType) {
            filteredRows = auditLogs.rows.filter(log => log.eventType === eventType);
        }

        res.json({
            success: true,
            logs: filteredRows,
            pagination: {
                total: auditLogs.count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(auditLogs.count / limit)
            }
        });
    } catch (error) {
        console.error('Audit log error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/mfa/exempt/:userId
 * Set/unset MFA exemption for a user
 */
router.post('/exempt/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { exempt } = req.body;

        if (exempt === undefined) {
            return res.status(400).json({ error: 'Exempt status is required' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await user.update({ mfaExempt: exempt });

        await mfaService.logMFAEvent(userId, exempt ? 'mfa_exempt_enabled' : 'mfa_exempt_disabled', null, null, {
            setBy: req.user.id
        });

        res.json({
            success: true,
            message: `MFA exemption ${exempt ? 'enabled' : 'disabled'} for ${user.username}`
        });
    } catch (error) {
        console.error('MFA exemption error:', error);
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

        await user.update({ mfaEnabled: enabled });

        // Check if we need to reset configured status if disabling
        if (!enabled) {
            // Optional: checking if we should clear configuration. 
            // For now, we just disable it but keep config in case they re-enable.
            // But user requirement implies "if mfa enabled then... ask to verify".
        }

        await mfaService.logMFAEvent(userId, enabled ? 'mfa_enabled' : 'mfa_disabled', null, null, {
            setBy: req.user.id
        });

        res.json({
            success: true,
            message: 'MFA ' + (enabled ? 'enabled' : 'disabled') + ' for ' + user.username
        });
    } catch (error) {
        console.error('MFA toggle error:', error);
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

        console.log(`[Admin] Changing MFA method for user ${userId} to ${method}`);

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate method
        if (!['push', 'totp', 'both', 'none'].includes(method)) {
            return res.status(400).json({ error: 'Invalid MFA method' });
        }

        if (method === 'none') {
            await user.update({
                mfaMethod: null,
                mfaEnabled: false,
                mfaConfigured: false
            });
        } else {
            // Forcing a method implies enabling MFA
            await user.update({
                mfaMethod: method,
                mfaEnabled: true
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
 * GET /api/admin/mfa/user/:userId/secret
 * Get user's TOTP secret (for manual setup assistance)
 */
router.get('/user/:userId/secret', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { MfaTotpSecret } = require('../../models');

        let secret = await MfaTotpSecret.findOne({
            where: { userId: userId }
        });

        if (!secret) {
            console.log(`[Admin] No TOTP secret found for user ${userId}. Generating one now.`);
            try {
                const mfaService = require('../../services/mfaService');
                const result = await mfaService.generateTOTPSecret(userId);
                console.log(`[Admin] Generated secret result:`, result ? 'Success' : 'Null');
                // Ensure we handle the object structure correctly
                if (result && result.secret) {
                    secret = { secret: result.secret, isVerified: false };
                }
            } catch (genError) {
                console.error('[Admin] Failed to generate secret:', genError);
                return res.status(500).json({ error: 'Failed to generate secret' });
            }
        } else {
            console.log(`[Admin] Found existing secret for user ${userId}. Verified: ${secret.isVerified}`);
        }

        if (!secret || !secret.secret) {
            console.log('[Admin] Secret object is legally missing after all attempts.');
            return res.json({ code: null, message: 'No TOTP configured for this user' });
        }

        // Generate current 6-digit TOTP code from the secret
        const speakeasy = require('speakeasy');
        const currentCode = speakeasy.totp({
            secret: secret.secret,
            encoding: 'base32'
        });

        // Calculate time remaining for this code
        const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

        res.json({
            code: currentCode,
            expiresIn: timeRemaining,
            isVerified: secret.isVerified
        });

    } catch (error) {
        console.error('Get TOTP Secret Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/mfa/stats
 * Get MFA statistics
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { Op } = require('sequelize');

        const totalUsers = await User.count();
        const mfaEnabledUsers = await User.count({ where: { mfaEnabled: true } });
        const mfaConfiguredUsers = await User.count({ where: { mfaConfigured: true } });
        const mfaExemptUsers = await User.count({ where: { mfaExempt: true } });

        const pushUsers = await User.count({ where: { mfaMethod: 'push' } });
        const totpUsers = await User.count({ where: { mfaMethod: 'totp' } });
        const bothUsers = await User.count({ where: { mfaMethod: 'both' } });

        const activeDevices = await MfaDevice.count({ where: { isActive: true } });
        const totalDevices = await MfaDevice.count();

        // Get recent activity (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const { MfaAuditLog } = require('../../models');
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
