const axios = require('axios');

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'MYO6YI5V4E6OT5BF';
const BASE_URL = 'https://www.alphavantage.co/query';

// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get cached data or return null if expired/not found
 */
function getCached(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[AlphaVantage] Cache HIT: ${key}`);
        return cached.data;
    }
    if (cached) {
        cache.delete(key); // Remove expired entry
    }
    return null;
}

/**
 * Set cache data
 */
function setCache(key, data) {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
    console.log(`[AlphaVantage] Cache SET: ${key}`);
}

/**
 * Convert Yahoo Finance symbol to Alpha Vantage format
 * Example: RELIANCE.NS → RELIANCE.BSE
 */
function convertSymbol(yahooSymbol) {
    if (!yahooSymbol) return null;

    // Remove .NS or .BO suffix and add .BSE for Indian stocks
    if (yahooSymbol.endsWith('.NS') || yahooSymbol.endsWith('.BO')) {
        return yahooSymbol.replace(/\.(NS|BO)$/, '.BSE');
    }

    // For US stocks, return as-is
    return yahooSymbol;
}

/**
 * Make API request with caching
 */
async function makeRequest(params, cacheKey) {
    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                ...params,
                apikey: API_KEY
            },
            timeout: 10000
        });

        // Check for API errors
        if (response.data['Error Message']) {
            throw new Error(response.data['Error Message']);
        }

        if (response.data['Note']) {
            // Rate limit hit
            throw new Error('API rate limit reached. Please try again later.');
        }

        // Cache the response
        setCache(cacheKey, response.data);

        return response.data;
    } catch (error) {
        console.error('[AlphaVantage] API Error:', error.message);
        throw error;
    }
}

/**
 * Get real-time quote for a symbol
 */
async function getQuote(symbol) {
    const alphaSymbol = convertSymbol(symbol);
    const cacheKey = `quote:${alphaSymbol}`;

    const data = await makeRequest({
        function: 'GLOBAL_QUOTE',
        symbol: alphaSymbol
    }, cacheKey);

    const quote = data['Global Quote'];
    if (!quote || Object.keys(quote).length === 0) {
        throw new Error('No quote data available for this symbol');
    }

    return {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: quote['10. change percent'],
        volume: parseInt(quote['06. volume']),
        latestTradingDay: quote['07. latest trading day'],
        previousClose: parseFloat(quote['08. previous close']),
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low'])
    };
}

/**
 * Get company overview (fundamentals)
 */
async function getCompanyOverview(symbol) {
    const alphaSymbol = convertSymbol(symbol);
    const cacheKey = `overview:${alphaSymbol}`;

    const data = await makeRequest({
        function: 'OVERVIEW',
        symbol: alphaSymbol
    }, cacheKey);

    if (!data.Symbol) {
        throw new Error('No company data available for this symbol');
    }

    return {
        symbol: data.Symbol,
        name: data.Name,
        description: data.Description,
        sector: data.Sector,
        industry: data.Industry,
        marketCap: data.MarketCapitalization,
        peRatio: parseFloat(data.PERatio) || null,
        eps: parseFloat(data.EPS) || null,
        dividendYield: parseFloat(data.DividendYield) || null,
        beta: parseFloat(data.Beta) || null,
        week52High: parseFloat(data['52WeekHigh']) || null,
        week52Low: parseFloat(data['52WeekLow']) || null,
        profitMargin: parseFloat(data.ProfitMargin) || null,
        operatingMargin: parseFloat(data.OperatingMarginTTM) || null,
        returnOnAssets: parseFloat(data.ReturnOnAssetsTTM) || null,
        returnOnEquity: parseFloat(data.ReturnOnEquityTTM) || null,
        revenue: data.RevenueTTM,
        grossProfit: data.GrossProfitTTM,
        bookValue: parseFloat(data.BookValue) || null,
        priceToBook: parseFloat(data.PriceToBookRatio) || null
    };
}

/**
 * Get technical indicator (RSI, MACD, SMA, EMA)
 */
async function getTechnicalIndicator(symbol, indicator = 'RSI', interval = 'daily', timePeriod = 14) {
    const alphaSymbol = convertSymbol(symbol);
    const cacheKey = `technical:${alphaSymbol}:${indicator}:${interval}:${timePeriod}`;

    const functionMap = {
        'RSI': 'RSI',
        'MACD': 'MACD',
        'SMA': 'SMA',
        'EMA': 'EMA'
    };

    const data = await makeRequest({
        function: functionMap[indicator],
        symbol: alphaSymbol,
        interval: interval,
        time_period: timePeriod,
        series_type: 'close'
    }, cacheKey);

    // Parse the response based on indicator type
    const technicalKey = `Technical Analysis: ${indicator}`;
    const technicalData = data[technicalKey];

    if (!technicalData) {
        throw new Error(`No ${indicator} data available`);
    }

    // Get the latest value
    const dates = Object.keys(technicalData);
    if (dates.length === 0) {
        throw new Error(`No ${indicator} data points available`);
    }

    const latestDate = dates[0];
    const latestValue = technicalData[latestDate];

    return {
        indicator,
        date: latestDate,
        value: latestValue,
        allData: technicalData // Return all data for charting if needed
    };
}

/**
 * Get company news and sentiment
 */
async function getCompanyNews(symbol, limit = 5) {
    const alphaSymbol = convertSymbol(symbol);
    const cacheKey = `news:${alphaSymbol}:${limit}`;

    const data = await makeRequest({
        function: 'NEWS_SENTIMENT',
        tickers: alphaSymbol,
        limit: limit
    }, cacheKey);

    if (!data.feed || data.feed.length === 0) {
        return [];
    }

    return data.feed.map(article => ({
        title: article.title,
        url: article.url,
        timePublished: article.time_published,
        authors: article.authors,
        summary: article.summary,
        source: article.source,
        sentiment: {
            label: article.overall_sentiment_label,
            score: parseFloat(article.overall_sentiment_score)
        },
        relevanceScore: parseFloat(article.relevance_score)
    }));
}

/**
 * Get daily time series data for charts
 * @param {string} symbol - Stock symbol
 * @param {string} outputSize - 'compact' (100 days) or 'full' (20+ years)
 */
async function getTimeSeriesDaily(symbol, outputSize = 'compact') {
    const alphaSymbol = convertSymbol(symbol);
    const cacheKey = `timeseries:daily:${alphaSymbol}:${outputSize}`;

    const data = await makeRequest({
        function: 'TIME_SERIES_DAILY',
        symbol: alphaSymbol,
        outputsize: outputSize
    }, cacheKey);

    // Parse and transform the data
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
        throw new Error('No time series data available');
    }

    // Convert to array format sorted by date (oldest first)
    const dates = Object.keys(timeSeries).sort();
    const chartData = dates.map(date => ({
        date,
        open: parseFloat(timeSeries[date]['1. open']),
        high: parseFloat(timeSeries[date]['2. high']),
        low: parseFloat(timeSeries[date]['3. low']),
        close: parseFloat(timeSeries[date]['4. close']),
        volume: parseInt(timeSeries[date]['5. volume'])
    }));

    return {
        symbol: data['Meta Data']['2. Symbol'],
        lastRefreshed: data['Meta Data']['3. Last Refreshed'],
        data: chartData
    };
}

/**
 * Get intraday time series data for charts
 * @param {string} symbol - Stock symbol
 * @param {string} interval - '1min', '5min', '15min', '30min', '60min'
 */
async function getTimeSeriesIntraday(symbol, interval = '5min') {
    const alphaSymbol = convertSymbol(symbol);
    const cacheKey = `timeseries:intraday:${alphaSymbol}:${interval}`;

    const data = await makeRequest({
        function: 'TIME_SERIES_INTRADAY',
        symbol: alphaSymbol,
        interval: interval,
        outputsize: 'compact' // Last 100 data points
    }, cacheKey);

    // Parse and transform the data
    const timeSeriesKey = `Time Series (${interval})`;
    const timeSeries = data[timeSeriesKey];

    if (!timeSeries) {
        throw new Error('No intraday time series data available');
    }

    // Convert to array format sorted by time (oldest first)
    const timestamps = Object.keys(timeSeries).sort();
    const chartData = timestamps.map(timestamp => ({
        timestamp,
        open: parseFloat(timeSeries[timestamp]['1. open']),
        high: parseFloat(timeSeries[timestamp]['2. high']),
        low: parseFloat(timeSeries[timestamp]['3. low']),
        close: parseFloat(timeSeries[timestamp]['4. close']),
        volume: parseInt(timeSeries[timestamp]['5. volume'])
    }));

    return {
        symbol: data['Meta Data']['2. Symbol'],
        lastRefreshed: data['Meta Data']['3. Last Refreshed'],
        interval: data['Meta Data']['4. Interval'],
        data: chartData
    };
}

/**
 * Clear cache (for testing or manual refresh)
 */
function clearCache() {
    cache.clear();
    console.log('[AlphaVantage] Cache cleared');
}

module.exports = {
    getQuote,
    getCompanyOverview,
    getTechnicalIndicator,
    getCompanyNews,
    getTimeSeriesDaily,
    getTimeSeriesIntraday,
    clearCache,
    convertSymbol
};
