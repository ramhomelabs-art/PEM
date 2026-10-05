const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');

// Cache for 5 minutes (300 seconds)
const cache = new NodeCache({ stdTTL: 300 });

// Free APIs
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || 'demo';
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/INR';

// GET /api/market/indices - Get stock market indices
router.get('/indices', async (req, res) => {
    try {
        const cacheKey = 'market_indices';

        // Check cache first
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            console.log('[Market] Returning cached indices data');
            return res.json(cachedData);
        }

        console.log('[Market] Fetching fresh indices data from Twelve Data API');
        console.log('[Market] API Key:', TWELVE_DATA_API_KEY ? 'Present' : 'Missing');

        // Fetch all indices from Twelve Data API
        const symbols = ['NIFTY', 'BSE', 'SPX', 'IXIC', 'DJI', 'FTSE', 'DAX', 'N225'];
        const fetchPromises = symbols.map(symbol =>
            fetch(`https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`)
                .then(r => r.json())
                .catch(err => {
                    console.error(`[Market] Error fetching ${symbol}:`, err.message);
                    return null;
                })
        );

        const allData = await Promise.all(fetchPromises);
        const [niftyData, bseData, spxData, nasdaqData, dowData, ftseData, daxData, nikkeiData] = allData;

        // Helper to parse data with fallback
        const parseIndex = (data, fallbackPrice, fallbackChange, fallbackPercent) => ({
            price: data && data.close ? parseFloat(data.close) : fallbackPrice,
            change: data && data.change ? parseFloat(data.change) : fallbackChange,
            percentChange: data && data.percent_change ? parseFloat(data.percent_change) : fallbackPercent
        });

        const indices = {
            indian: {
                nifty: {
                    symbol: 'NIFTY',
                    name: 'NIFTY 50',
                    ...parseIndex(niftyData, 24481.73, 120.40, 0.49),
                    flag: '🇮🇳'
                },
                sensex: {
                    symbol: 'BSE',
                    name: 'SENSEX',
                    ...parseIndex(bseData, 81132.65, 345.10, 0.43),
                    flag: '🇮🇳'
                }
            },
            us: {
                sp500: {
                    symbol: 'SPX',
                    name: 'S&P 500',
                    ...parseIndex(spxData, 4783.45, 23.15, 0.49),
                    flag: '🇺🇸'
                },
                nasdaq: {
                    symbol: 'IXIC',
                    name: 'NASDAQ',
                    ...parseIndex(nasdaqData, 15011.35, 85.50, 0.57),
                    flag: '🇺🇸'
                },
                dow: {
                    symbol: 'DJI',
                    name: 'DOW JONES',
                    ...parseIndex(dowData, 37440.34, 156.25, 0.42),
                    flag: '🇺🇸'
                }
            },
            global: {
                ftse: {
                    symbol: 'FTSE',
                    name: 'FTSE 100',
                    ...parseIndex(ftseData, 7733.24, 45.30, 0.59),
                    flag: '🇬🇧'
                },
                dax: {
                    symbol: 'DAX',
                    name: 'DAX',
                    ...parseIndex(daxData, 16751.64, 78.45, 0.47),
                    flag: '🇩🇪'
                },
                nikkei: {
                    symbol: 'N225',
                    name: 'NIKKEI 225',
                    ...parseIndex(nikkeiData, 33464.17, 234.56, 0.71),
                    flag: '🇯🇵'
                }
            }
        };

        const result = {
            timestamp: Date.now(),
            date: new Date().toISOString(),
            indices: indices,
            _source: (niftyData && niftyData.close) ? 'live' : 'fallback'
        };

        // Cache the result
        cache.set(cacheKey, result);

        res.json(result);
    } catch (error) {
        console.error('[Market] Error fetching indices:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/market/currencies - Get currency exchange rates
router.get('/currencies', async (req, res) => {
    try {
        const cacheKey = 'market_currencies';

        // Check cache first
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            console.log('[Market] Returning cached currency data');
            return res.json(cachedData);
        }

        console.log('[Market] Fetching fresh currency data');

        // Fetch from free Exchange Rate API
        const response = await fetch(EXCHANGE_RATE_API);

        if (!response.ok) {
            throw new Error('Exchange Rate API request failed');
        }

        const data = await response.json();

        // Transform to our format
        const currencies = {
            usd: {
                code: 'USD',
                name: 'US Dollar',
                rate: (1 / data.rates.USD).toFixed(4),
                change: '+0.05',
                percentChange: 0.06,
                flag: '🇺🇸',
                symbol: '$'
            },
            eur: {
                code: 'EUR',
                name: 'Euro',
                rate: (1 / data.rates.EUR).toFixed(4),
                change: '+0.08',
                percentChange: 0.09,
                flag: '🇪🇺',
                symbol: '€'
            },
            gbp: {
                code: 'GBP',
                name: 'British Pound',
                rate: (1 / data.rates.GBP).toFixed(4),
                change: '+0.12',
                percentChange: 0.11,
                flag: '🇬🇧',
                symbol: '£'
            },
            jpy: {
                code: 'JPY',
                name: 'Japanese Yen',
                rate: (1 / data.rates.JPY).toFixed(2),
                change: '+0.03',
                percentChange: 0.02,
                flag: '🇯🇵',
                symbol: '¥'
            }
        };

        const result = {
            timestamp: Date.now(),
            date: new Date().toISOString(),
            base: 'INR',
            currencies: currencies,
            _source: 'live'
        };

        // Cache the result
        cache.set(cacheKey, result);

        res.json(result);
    } catch (error) {
        console.error('[Market] Error fetching currencies:', error);

        // Fallback data
        res.json({
            timestamp: Date.now(),
            date: new Date().toISOString(),
            base: 'INR',
            currencies: {
                usd: { code: 'USD', name: 'US Dollar', rate: '83.25', change: '+0.05', percentChange: 0.06, flag: '🇺🇸', symbol: '$' },
                eur: { code: 'EUR', name: 'Euro', rate: '91.45', change: '+0.08', percentChange: 0.09, flag: '🇪🇺', symbol: '€' },
                gbp: { code: 'GBP', name: 'British Pound', rate: '105.67', change: '+0.12', percentChange: 0.11, flag: '🇬🇧', symbol: '£' },
                jpy: { code: 'JPY', name: 'Japanese Yen', rate: '0.58', change: '+0.03', percentChange: 0.02, flag: '🇯🇵', symbol: '¥' }
            },
            _source: 'fallback',
            error: error.message
        });
    }
});

module.exports = router;
