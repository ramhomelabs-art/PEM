const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');

// Cache for 5 minutes (300 seconds)
const cache = new NodeCache({ stdTTL: 300 });

const GOLD_API_URL = 'https://api.gold-api.com/price/XAU';

// Approximate FX rates from USD. Used only to present the live USD gold price
// in the requested currency; not a trading rate.
const FX_FROM_USD = {
    INR: 83,
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
    AUD: 1.52
};

const TROY_OUNCE_IN_GRAMS = 31.1035;

// GET /api/metals/prices?currency=INR
router.get('/prices', async (req, res) => {
    try {
        const currency = (req.query.currency || 'INR').toUpperCase();
        const cacheKey = `metals_${currency}`;

        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            console.log('[Metals] Returning cached data');
            return res.json(cachedData);
        }

        console.log('[Metals] Fetching fresh data from live API');

        let goldPriceUsd = null;
        try {
            const goldResponse = await fetch(GOLD_API_URL);
            if (goldResponse.ok) {
                const goldData = await goldResponse.json();
                if (typeof goldData.price === 'number' && goldData.price > 0) {
                    goldPriceUsd = goldData.price;
                }
            }
        } catch (err) {
            console.log('[Metals] Gold API failed:', err.message);
        }

        // Never fabricate prices: if the live source is unavailable, say so.
        if (goldPriceUsd == null) {
            return res.status(503).json({
                currency,
                timestamp: Date.now(),
                date: new Date().toISOString().split('T')[0],
                _source: 'unavailable',
                error: 'Live precious metal prices are currently unavailable',
                prices: null
            });
        }

        const fx = FX_FROM_USD[currency] || 1;
        const goldPricePerOunce = goldPriceUsd * fx;

        // Silver / platinum / palladium are derived from typical price ratios
        // against gold because the free tier exposes gold only.
        const ratios = { silver: 1 / 80, platinum: 0.55, palladium: 0.6 };

        const buildMetal = (name, symbol, ratio) => {
            const perOunce = goldPricePerOunce * ratio;
            return {
                name,
                pricePerOunce: perOunce.toFixed(0),
                pricePerGram: (perOunce / TROY_OUNCE_IN_GRAMS).toFixed(2),
                change: null,
                symbol
            };
        };

        const result = {
            currency,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
            prices: {
                gold: {
                    name: 'Gold (XAU)',
                    pricePerOunce: goldPricePerOunce.toFixed(0),
                    pricePerGram: (goldPricePerOunce / TROY_OUNCE_IN_GRAMS).toFixed(2),
                    change: null,
                    symbol: '🥇'
                },
                silver: buildMetal('Silver (XAG)', '🥈', ratios.silver),
                platinum: buildMetal('Platinum (XPT)', '💎', ratios.platinum),
                palladium: buildMetal('Palladium (XPD)', '⚪', ratios.palladium)
            },
            _source: 'derived',
            _approximate: true,
            _fxRate: fx
        };

        cache.set(cacheKey, result);

        res.json(result);
    } catch (error) {
        console.error('[Metals] Error:', error);
        res.status(503).json({
            currency: (req.query.currency || 'INR').toUpperCase(),
            timestamp: Date.now(),
            _source: 'unavailable',
            error: 'Live precious metal prices are currently unavailable',
            prices: null
        });
    }
});

module.exports = router;
