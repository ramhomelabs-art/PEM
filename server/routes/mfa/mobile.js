const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { MfaPushRequest, MfaDevice } = require('../../models');
const { Op, literal } = require('sequelize');

/**
 * GET /api/mfa/mobile/pending-requests
 * Get pending MFA push requests for the authenticated device
 * Android app will poll this endpoint to check for new MFA requests
 */
router.get('/pending-requests', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('[MobileAPI] Pending Request Poll for UserID:', userId);
        console.log('[MobileAPI] MfaDevice Defined?', !!MfaDevice);
        console.log('[MobileAPI] MfaPushRequest Defined?', !!MfaPushRequest);

        if (!userId) {
            throw new Error("User ID missing from Request!");
        }

        // Find user's active device
        const device = await MfaDevice.findOne({
            where: {
                userId,
                isActive: true
            }
        });

        if (!device) {
            return res.json({ requests: [] });
        }

        // Get pending push requests for this device
        const pendingRequests = await MfaPushRequest.findAll({
            where: {
                deviceId: device.id,
                status: 'pending',
                expiresAt: {
                    [Op.gt]: new Date()
                }
            },
            order: [[literal('"MfaPushRequest".created_at'), 'DESC']],
            limit: 10
        });

        res.json({
            requests: pendingRequests.map(req => ({
                requestId: req.requestId,
                loginAttemptId: req.loginAttemptId,
                metadata: req.metadata,
                createdAt: req.createdAt,
                expiresAt: req.expiresAt
            }))
        });

    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/mobile/respond
 * Respond to a push notification request
 */
router.post('/respond', authenticateToken, async (req, res) => {
    try {
        const { requestId, approved } = req.body;
        const userId = req.user.id;

        if (!requestId || typeof approved !== 'boolean') {
            return res.status(400).json({ error: 'requestId and approved (boolean) are required' });
        }

        // Find the request
        const pushRequest = await MfaPushRequest.findOne({
            where: { requestId },
            include: [{
                model: MfaDevice,
                as: 'device',
                where: { userId }
            }]
        });

        if (!pushRequest) {
            return res.status(404).json({ error: 'Request not found or unauthorized' });
        }

        if (pushRequest.status !== 'pending') {
            return res.status(400).json({ error: 'Request already processed' });
        }

        if (new Date() > pushRequest.expiresAt) {
            await pushRequest.update({ status: 'expired' });
            return res.status(400).json({ error: 'Request expired' });
        }

        // Update request status
        await pushRequest.update({
            status: approved ? 'approved' : 'denied',
            respondedAt: new Date()
        });

        res.json({
            success: true,
            status: approved ? 'approved' : 'denied'
        });

    } catch (error) {
        console.error('Respond to push request error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/mfa/mobile/request-status/:requestId
 * Check status of a specific MFA request (for web login polling)
 */
router.get('/request-status/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        const pushRequest = await MfaPushRequest.findOne({
            where: { requestId }
        });

        if (!pushRequest) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json({
            requestId: pushRequest.requestId,
            status: pushRequest.status,
            respondedAt: pushRequest.respondedAt,
            expiresAt: pushRequest.expiresAt
        });

    } catch (error) {
        console.error('Get request status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/mfa/mobile/register-fcm-token
 * Register or update FCM token for push notifications
 */
router.post('/register-fcm-token', authenticateToken, async (req, res) => {
    try {
        const { fcmToken } = req.body;
        const userId = req.user.id;

        if (!fcmToken) {
            return res.status(400).json({ error: 'FCM token is required' });
        }

        // Update all active devices for this user with the FCM token
        const updated = await MfaDevice.update(
            { fcmToken },
            {
                where: {
                    userId,
                    isActive: true
                }
            }
        );

        if (updated[0] === 0) {
            return res.status(404).json({ error: 'No active device found for this user' });
        }

        console.log(`✅ FCM token registered for user ${userId}`);
        res.json({
            success: true,
            message: 'FCM token registered successfully'
        });

    } catch (error) {
        console.error('Register FCM token error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
