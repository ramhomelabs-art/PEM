const express = require('express');
const router = express.Router();
const cleanMarketService = require('../../services/cleanMarketService');
const { Investment } = require('../../models');

// GET Search Ticker
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        const results = await cleanMarketService.search(query);
        res.json(results);
    } catch (err) {
        console.error("Market Search Error:", err.message);
        res.json([]);
    }
});

// POST Sync Price for Investment
router.post('/:id/sync', async (req, res) => {
    try {
        const { id } = req.params;
        const investment = await Investment.findOne({ where: { id, userId: req.user.id } });

        if (!investment) {
            console.log(`[Market Sync] Investment ${id} not found for user ${req.user.id}`);
            return res.status(404).json({ error: 'Investment not found' });
        }

        if (!investment.ticker) {
            console.log(`[Market Sync] No ticker for investment ${id}`);
            return res.status(400).json({ error: 'No ticker symbol set for this investment' });
        }

        console.log(`[Market Sync] Fetching clean quote for ticker: ${investment.ticker}`);
        const quote = await cleanMarketService.getQuote(investment.ticker);

        if (!quote || quote.price == null) {
            return res.status(400).json({
                error: 'Could not fetch market price',
                details: `No price data available for ticker ${investment.ticker}.`
            });
        }

        const price = Number(quote.price);
        const units = Number(investment.unitsHeld) || 0;
        const newCurrentValue = units > 0 ? units * price : Number(investment.currentValue || 0);

        await investment.update({
            lastMarketPrice: price,
            lastPriceUpdate: new Date(),
            currentValue: newCurrentValue
        });

        console.log(`[Market Sync] Successfully synced ${investment.ticker}: price=${price}`);

        res.json({
            success: true,
            price: price,
            currentValue: newCurrentValue,
            lastUpdate: investment.lastPriceUpdate
        });

    } catch (err) {
        console.error("[Market Sync] Error:", err.message);
        res.status(500).json({
            error: 'Failed to sync market price',
            details: err.message
        });
    }
});

// GET Historical Chart Data
router.get('/:id/chart', async (req, res) => {
    try {
        const { id } = req.params;
        const { range = '1mo' } = req.query; // 1mo, 6mo, 1y, 5y, max

        const investment = await Investment.findOne({ where: { id, userId: req.user.id } });
        if (!investment || !investment.ticker) {
            return res.status(404).json({ error: 'Investment or Ticker not found' });
        }

        console.log(`[Market Chart] Fetching historical chart for ${investment.ticker}, range: ${range}`);
        const chartData = await cleanMarketService.getHistoricalChart(investment.ticker, range);

        // Always return array cleanly, even if empty, preventing 500 crashes
        res.json(chartData || []);
    } catch (err) {
        console.error("[Market Chart] Error:", err.message);
        // Return empty array gracefully rather than crashing the client modal
        res.json([]);
    }
});

module.exports = router;
