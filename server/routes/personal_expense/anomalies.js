const express = require('express');
const { Op } = require('sequelize');
const { authenticateToken } = require('../../middleware/auth');
const { Alert } = require('../../models');
const anomalyService = require('../../services/anomalyService');
const alertService = require('../../services/alertService');

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/anomalies?days=120
 * Returns detected anomalies for the authenticated user without notifying.
 */
router.get('/', async (req, res) => {
    try {
        const days = Math.min(Math.max(parseInt(req.query.days, 10) || 120, 7), 365);
        const anomalies = await anomalyService.detect(req.user.id, days);
        res.json({ windowDays: days, count: anomalies.length, anomalies });
    } catch (err) {
        console.error('[anomalies] detect error:', err.message);
        res.status(500).json({ error: 'Failed to detect anomalies' });
    }
});

/**
 * POST /api/anomalies/scan
 * Detects anomalies and raises interactive alerts (push + polling). Existing
 * alerts (matched by referenceId) are not duplicated.
 */
router.post('/scan', async (req, res) => {
    try {
        const days = Math.min(Math.max(parseInt(req.body?.days, 10) || 120, 7), 365);
        const anomalies = await anomalyService.detect(req.user.id, days);
        const referenceIds = anomalies.map((a) => a.referenceId).filter(Boolean);

        let existing = new Set();
        if (referenceIds.length > 0) {
            const rows = await Alert.findAll({
                where: { userId: req.user.id, referenceId: { [Op.in]: referenceIds } },
                attributes: ['referenceId']
            });
            existing = new Set(rows.map((r) => r.referenceId));
        }

        let created = 0;
        for (const anomaly of anomalies) {
            if (anomaly.referenceId && existing.has(anomaly.referenceId)) continue;
            await alertService.createAndPush({
                userId: req.user.id,
                type: 'ANOMALY',
                severity: anomaly.severity || 'warning',
                title: anomaly.title,
                body: anomaly.body,
                category: anomaly.category || null,
                amount: anomaly.amount || null,
                referenceId: anomaly.referenceId || null,
                actions: ['acknowledge', 'dismiss'],
                metadata: { kind: anomaly.type, transactionId: anomaly.transactionId, date: anomaly.date }
            });
            created += 1;
        }

        res.json({ windowDays: days, detected: anomalies.length, created, anomalies });
    } catch (err) {
        console.error('[anomalies] scan error:', err.message);
        res.status(500).json({ error: 'Failed to scan anomalies' });
    }
});

module.exports = router;
