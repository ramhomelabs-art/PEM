const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');

// Cache for 30 minutes (1800 seconds)
const cache = new NodeCache({ stdTTL: 1800 });

// Using NewsAPI.org (Free tier: 100 requests/day)
// Alternative: Google News RSS or web scraping
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2/everything';

// GET /api/news/financial?country=in
router.get('/financial', async (req, res) => {
    try {
        if (!NEWS_API_KEY || NEWS_API_KEY === 'YOUR_API_KEY_HERE') {
            return res.status(503).json({
                articles: [],
                totalResults: 0,
                error: 'News service is not configured (missing NEWS_API_KEY)'
            });
        }

        const country = req.query.country || 'in';
        const cacheKey = `news_${country}`;

        // Check cache first
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            console.log('[News] Returning cached data');
            return res.json(cachedData);
        }

        // Fetch from NewsAPI
        console.log('[News] Fetching fresh data from NewsAPI');

        const keywords = 'finance OR stock market OR economy OR cryptocurrency OR investment';
        const url = `${NEWS_API_URL}?q=${encodeURIComponent(keywords)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`NewsAPI request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'ok') {
            throw new Error(data.message || 'API returned error');
        }

        // Transform data to our format
        const articles = data.articles.map((article, index) => ({
            id: index + 1,
            title: article.title,
            summary: article.description || article.content?.substring(0, 200) + '...' || 'No description available',
            fullContent: article.content || article.description || 'Full content not available. Click "Read Full Article" to view on the source website.',
            category: categorizeArticle(article.title + ' ' + article.description),
            score: sentimentScore(article.title),
            source: article.source.name,
            time: getRelativeTime(article.publishedAt),
            url: article.url,
            image: article.urlToImage,
            publishedAt: article.publishedAt
        }));

        const result = {
            articles: articles,
            totalResults: data.totalResults,
            timestamp: Date.now()
        };

        // Cache the result
        cache.set(cacheKey, result);

        res.json(result);
    } catch (error) {
        console.error('[News] Error:', error);

        // Never fabricate headlines. Report the failure and let the client
        // present an unavailable state instead of fake news.
        res.status(503).json({
            articles: [],
            totalResults: 0,
            error: error.message || 'News service is currently unavailable'
        });
    }
});

// Helper: Categorize article based on keywords
function categorizeArticle(text) {
    const lower = text.toLowerCase();
    if (lower.includes('stock') || lower.includes('market') || lower.includes('sensex') || lower.includes('nifty')) return 'Markets';
    if (lower.includes('economy') || lower.includes('gdp') || lower.includes('inflation') || lower.includes('rbi')) return 'Economy';
    if (lower.includes('gold') || lower.includes('silver') || lower.includes('oil') || lower.includes('commodity')) return 'Commodities';
    if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('ethereum') || lower.includes('blockchain')) return 'Crypto';
    if (lower.includes('tech') || lower.includes('startup') || lower.includes('ai') || lower.includes('fintech')) return 'Tech';
    return 'Markets';
}

// Helper: Simple sentiment analysis
function sentimentScore(text) {
    const lower = text.toLowerCase();
    const positive = ['surge', 'gain', 'rise', 'rally', 'jump', 'soar', 'high', 'record', 'growth'];
    const negative = ['fall', 'drop', 'crash', 'decline', 'loss', 'plunge', 'low', 'crisis'];

    const posCount = positive.filter(word => lower.includes(word)).length;
    const negCount = negative.filter(word => lower.includes(word)).length;

    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
}

// Helper: Convert timestamp to relative time
function getRelativeTime(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return then.toLocaleDateString();
}

module.exports = router;
