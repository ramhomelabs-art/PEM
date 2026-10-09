const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { Alert } = require('../../models');
const alertService = require('../../services/alertService');

const router = express.Router();

/**
 * GET /api/notifications
 * Query alerts for the authenticated user. Optional filters: status, type, limit.
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const where = { userId: req.user.id };
        if (req.query.status) where.status = req.query.status;
        if (req.query.type) where.type = req.query.type;

        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const alerts = await Alert.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit
        });
        res.json({ alerts });
    } catch (err) {
        console.error('[notifications] list error:', err.message);
        res.status(500).json({ error: 'Failed to load alerts' });
    }
});

/**
 * GET /api/notifications/pending
 * Polling endpoint for the mobile app. Returns undelivered alerts and flips
 * them to "notified" so they are not surfaced redundantly on the next poll.
 */
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const alerts = await Alert.findAll({
            where: { userId: req.user.id, status: 'pending' },
            order: [['createdAt', 'ASC']],
            limit: 25
        });

        if (alerts.length > 0) {
            await Alert.update(
                { status: 'notified' },
                { where: { id: alerts.map((a) => a.id) } }
            );
        }
        res.json({ alerts });
    } catch (err) {
        console.error('[notifications] pending error:', err.message);
        res.status(500).json({ error: 'Failed to load pending alerts' });
    }
});

/**
 * POST /api/notifications/:id/action
 * Record an interactive action (acknowledge | dismiss) taken from the
 * notification shade.
 */
router.post('/:id/action', authenticateToken, async (req, res) => {
    try {
        const { action } = req.body || {};
        const alert = await alertService.takeAction(req.user.id, req.params.id, action);
        if (!alert) return res.status(404).json({ error: 'Alert not found' });
        res.json({ success: true, alert });
    } catch (err) {
        console.error('[notifications] action error:', err.message);
        res.status(500).json({ error: 'Failed to record action' });
    }
});

/**
 * POST /api/notifications/test
 * Dev helper: create a sample interactive alert and attempt delivery.
 */
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const { alert, delivery } = await alertService.createAndPush({
            userId: req.user.id,
            type: 'TRANSACTION',
            severity: 'info',
            title: (req.body && req.body.title) || 'Test alert',
            body: (req.body && req.body.body) || 'Test interactive notification from PEM Parser.',
            category: (req.body && req.body.category) || 'General',
            amount: req.body && req.body.amount != null ? req.body.amount : 0,
            actions: ['acknowledge', 'dismiss']
        });
        res.json({ success: true, alert, delivery });
    } catch (err) {
        console.error('[notifications] test error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
