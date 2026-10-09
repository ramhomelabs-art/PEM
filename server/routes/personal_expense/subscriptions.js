const express = require('express');
const { Op } = require('sequelize');
const { authenticateToken } = require('../../middleware/auth');
const { Transaction } = require('../../models');
const subscriptionService = require('../../services/subscriptionService');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        const windowDays = Math.min(Math.max(parseInt(req.query.days, 10) || 400, 30), 400);
        const since = new Date(Date.now() - windowDays * 86400000);

        const txns = await Transaction.findAll({
            where: { type: 'expense', date: { [Op.gte]: since }, userId: req.user.id },
            order: [['date', 'ASC']]
        });

        const subscriptions = subscriptionService.detect(txns.map((t) => t.get({ plain: true })));
        const annualTotal = subscriptions.reduce((sum, s) => sum + s.annualCost, 0);

        res.json({
            subscriptions,
            count: subscriptions.length,
            annualCost: Math.round(annualTotal * 100) / 100
        });
    } catch (err) {
        console.error('subscription detect failed:', err.message);
        res.status(500).json({ error: 'Failed to detect subscriptions' });
    }
});

module.exports = router;
