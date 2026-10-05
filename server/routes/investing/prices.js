const express = require('express');
const router = express.Router();
const { sequelize } = require('../../models');
const {
    runPriceSync,
    latestPrices,
    priceHistory,
    manualInsert
} = require('../../utils/investing/prices');

// GET /api/investing/prices - latest NAV for every asset of the user
router.get('/', async (req, res) => {
    try {
        const prices = await latestPrices(sequelize, req.user.id);
        res.json({ prices });
    } catch (err) {
        console.error('[Investing Prices] latest failed:', err.message);
        res.status(500).json({ error: 'Failed to load prices', detail: err.message });
    }
});

// GET /api/investing/prices/history/:assetId?from=&to=
router.get('/history/:assetId', async (req, res) => {
    try {
        const { from, to } = req.query;
        const history = await priceHistory(sequelize, req.user.id, req.params.assetId, { from, to });
        res.json({ assetId: Number(req.params.assetId), history });
    } catch (err) {
        console.error('[Investing Prices] history failed:', err.message);
        res.status(500).json({ error: 'Failed to load price history', detail: err.message });
    }
});

// POST /api/investing/prices/sync - run a live NAV sync for the user now
router.post('/sync', async (req, res) => {
    try {
        const report = await runPriceSync(sequelize, { userId: req.user.id });
        res.json(report);
    } catch (err) {
        console.error('[Investing Prices] sync failed:', err.message);
        res.status(500).json({ error: 'Price sync failed', detail: err.message });
    }
});

// POST /api/investing/prices/manual - insert an immutable manual price
// Body: { assetId, navDate (YYYY-MM-DD), nav > 0 }
router.post('/manual', async (req, res) => {
    const { assetId, navDate, nav } = req.body || {};
    if (!assetId || !navDate || !(Number(nav) > 0)) {
        return res.status(400).json({ error: 'assetId, navDate (YYYY-MM-DD) and nav > 0 are required' });
    }
    try {
        const result = await manualInsert(sequelize, req.user.id, assetId, navDate, nav);
        res.status(result.inserted > 0 ? 201 : 200).json(result);
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: status === 404 ? 'Asset not found' : 'Manual price failed', detail: err.message });
    }
});

module.exports = router;