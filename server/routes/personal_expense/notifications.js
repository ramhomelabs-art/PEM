const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { Alert, User } = require('../../models');
const alertService = require('../../services/alertService');
const pendingDigestService = require('../../services/pendingDigestService');

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

/**
 * GET /api/notifications/digest/preview
 * Returns the current user's digest settings and a preview of what the next
 * pending-items email would contain.
 */
router.get('/digest/preview', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const pref = pendingDigestService.getDigestPreference(user);
        const { transactions, bills, expenses, income, notifications, summary } = await pendingDigestService.buildDigest(user);

        const emailTemplates = require('../../utils/emailTemplates');
        const emailContent = emailTemplates.pendingDigestEmail({
            user,
            transactions,
            notifications,
            summary,
            appUrl: pendingDigestService.appUrl(),
            unsubscribeTo: pendingDigestService.unsubscribeAddress()
        });

        res.json({
            enabled: pref.enabled,
            lastSentAt: pref.lastSentAt,
            intervalMinutes: pendingDigestService.INTERVAL_MINUTES,
            mailConfigured: require('../../utils/mailer').isConfigured(),
            email: user.email,
            counts: {
                transactions: transactions.length,
                bills: (bills || []).length,
                expenses: expenses.length,
                income: income.length,
                notifications: notifications.length,
                total: transactions.length + notifications.length
            },
            summary,
            bills: bills || [],
            expenses,
            income,
            transactions,
            notifications,
            htmlPreview: emailContent.html,
            subject: emailContent.subject
        });
    } catch (err) {
        console.error('[notifications] digest preview error:', err.message);
        res.status(500).json({ error: 'Failed to build digest preview' });
    }
});

/**
 * POST /api/notifications/digest/send
 * Send the pending-items digest to the current user immediately.
 */
router.post('/digest/send', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const result = await pendingDigestService.sendDigestForUser(user, { force: true });
        if (!result.sent) {
            return res.status(400).json({ success: false, error: result.skipped || 'Could not send digest', ...result });
        }
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[notifications] digest send error:', err.message);
        res.status(500).json({ error: 'Failed to send digest' });
    }
});

/**
 * PUT /api/notifications/digest/preference
 * Enable/disable the pending-items email digest for the current user.
 */
router.put('/digest/preference', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const enabled = !(req.body && req.body.enabled === false);
        const prefs = { ...(user.preferences || {}) };
        prefs.emailDigest = { ...(prefs.emailDigest || {}), enabled };
        await user.update({ preferences: prefs });

        res.json({ success: true, emailDigest: prefs.emailDigest });
    } catch (err) {
        console.error('[notifications] digest preference error:', err.message);
        res.status(500).json({ error: 'Failed to update digest preference' });
    }
});

module.exports = router;
