const YahooFinance = require('yahoo-finance2').default;
const https = require('https');
const http = require('http');

// Instantiate Yahoo Finance with notice suppressions
const yf = new YahooFinance({
    suppressNotices: ['yahooSurvey', 'ripHistorical']
});

/**
 * Normalise Indian ticker formats (e.g. TCS.BSE -> TCS.BO)
 */
function normalizeTicker(ticker) {
    if (!ticker) return '';
    let t = String(ticker).trim().toUpperCase();
    if (t.endsWith('.BSE')) t = t.replace(/\.BSE$/, '.BO');
    return t;
}

/**
 * Try querying Yahoo with fallback suffixes for Indian stocks (.NS then .BO)
 */
async function resolveYahooSymbol(ticker) {
    const clean = normalizeTicker(ticker);
    if (!clean) return null;

    // If ticker already has an exchange suffix, use it directly
    if (clean.includes('.')) return clean;

    // For plain symbols like "TCS", check .NS first
    try {
        await yf.quote(`${clean}.NS`);
        return `${clean}.NS`;
    } catch {
        try {
            await yf.quote(`${clean}.BO`);
            return `${clean}.BO`;
        } catch {
            return clean;
        }
    }
}

/**
 * Fetch real-time stock quote
 */
async function getQuote(ticker) {
    const symbol = await resolveYahooSymbol(ticker);
    if (!symbol) throw new Error('Invalid symbol');

    const q = await yf.quote(symbol);
    if (!q || typeof q.regularMarketPrice !== 'number') {
        throw new Error(`No quote data found for ${symbol}`);
    }

    return {
        symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange || 0,
        changePercent: q.regularMarketChangePercent || 0,
        currency: q.currency || 'INR',
        name: q.longName || q.shortName || symbol,
        dayHigh: q.regularMarketDayHigh || q.regularMarketPrice,
        dayLow: q.regularMarketDayLow || q.regularMarketPrice,
        volume: q.regularMarketVolume || 0,
        marketCap: q.marketCap || 0
    };
}

/**
 * Fetch historical chart data
 * Supported ranges: 1mo, 6mo, 1y, 5y, max
 */
async function getHistoricalChart(ticker, range = '1mo') {
    const symbol = await resolveYahooSymbol(ticker);
    if (!symbol) return [];

    const now = new Date();
    let period1;
    let interval = '1d';

    switch (range) {
        case '6mo':
            period1 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            interval = '1d';
            break;
        case '1y':
            period1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            interval = '1d';
            break;
        case '5y':
            period1 = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
            interval = '1wk';
            break;
        case 'max':
            period1 = new Date('2000-01-01');
            interval = '1mo';
            break;
        case '1mo':
        default:
            period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            interval = '1d';
            break;
    }

    try {
        const res = await yf.chart(symbol, { period1, interval });
        const quotes = res?.quotes || [];

        return quotes
            .filter(q => q && q.date && q.close != null && !isNaN(q.close))
            .map(q => {
                const d = q.date instanceof Date ? q.date : new Date(q.date);
                return {
                    date: d.toISOString().slice(0, 10),
                    value: Number(Number(q.close).toFixed(2)),
                    open: Number((q.open ?? q.close).toFixed(2)),
                    high: Number((q.high ?? q.close).toFixed(2)),
                    low: Number((q.low ?? q.close).toFixed(2)),
                    close: Number(Number(q.close).toFixed(2)),
                    volume: Number(q.volume) || 0
                };
            });
    } catch (e) {
        console.warn(`[CleanMarket] Historical chart fallback for ${symbol}:`, e.message);
        return [];
    }
}

/**
 * Fetch company fundamentals (P/E, Market Cap, 52W High/Low, EPS, Sector, Industry)
 */
async function getFundamentals(ticker, fallbackName = '') {
    const symbol = await resolveYahooSymbol(ticker);
    if (!symbol) return null;

    let summary = {};
    let quote = {};

    try {
        summary = await yf.quoteSummary(symbol, {
            modules: ['summaryDetail', 'assetProfile', 'defaultKeyStatistics', 'financialData']
        });
    } catch (e) {
        console.warn(`[CleanMarket] quoteSummary soft failure for ${symbol}:`, e.message);
    }

    try {
        quote = await yf.quote(symbol);
    } catch (e) {
        console.warn(`[CleanMarket] quote soft failure for ${symbol}:`, e.message);
    }

    const sDetail = summary?.summaryDetail || {};
    const profile = summary?.assetProfile || {};
    const stats = summary?.defaultKeyStatistics || {};
    const fin = summary?.financialData || {};
    const q = quote || {};

    return {
        name: q.longName || q.shortName || fallbackName || symbol,
        sector: profile.sector || 'Equities',
        industry: profile.industry || 'Market Investment',
        marketCap: sDetail.marketCap || q.marketCap || 0,
        peRatio: sDetail.trailingPE || sDetail.forwardPE || 0,
        eps: stats.trailingEps || q.epsTrailingTwelveMonths || 0,
        dividendYield: sDetail.dividendYield || 0,
        week52High: sDetail.fiftyTwoWeekHigh || q.fiftyTwoWeekHigh || 0,
        week52Low: sDetail.fiftyTwoWeekLow || q.fiftyTwoWeekLow || 0,
        beta: stats.beta || 1,
        profitMargin: fin.profitMargins || 0
    };
}

/**
 * Compute Relative Strength Index (RSI 14) from historical daily closes
 */
async function getTechnicalIndicators(ticker) {
    const symbol = await resolveYahooSymbol(ticker);
    if (!symbol) return { value: 50 };

    try {
        const period1 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const res = await yf.chart(symbol, { period1, interval: '1d' });
        const closes = (res?.quotes || [])
            .map(q => q.close)
            .filter(c => c != null && !isNaN(c));

        if (closes.length < 15) {
            return { value: 50 };
        }

        const period = 14;
        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period + 1; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            const gain = diff > 0 ? diff : 0;
            const loss = diff < 0 ? -diff : 0;
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
        }

        if (avgLoss === 0) return { value: 100 };
        const rs = avgGain / avgLoss;
        const rsi = parseFloat((100 - (100 / (1 + rs))).toFixed(2));

        return { value: rsi };
    } catch (e) {
        console.warn(`[CleanMarket] RSI calculation fallback for ${symbol}:`, e.message);
        return { value: 50 };
    }
}

/**
 * Fetch company news via Google News RSS feed
 */
async function getCompanyNews(ticker, companyName = '', limit = 5) {
    const symbol = normalizeTicker(ticker).replace(/\.(NS|BO|BSE)$/, '');
    const searchTerms = [companyName, symbol].filter(Boolean).join(' ') + ' stock';

    return new Promise((resolve) => {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerms)}&hl=en-IN&gl=IN&ceid=IN:en`;
        const client = url.startsWith('https') ? https : http;

        const req = client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const itemMatches = data.match(/<item>[\s\S]*?<\/item>/g) || [];
                    const articles = itemMatches.slice(0, limit).map((raw) => {
                        const titleMatch = raw.match(/<title>(.*?)<\/title>/);
                        const linkMatch = raw.match(/<link>(.*?)<\/link>/);
                        const pubMatch = raw.match(/<pubDate>(.*?)<\/pubDate>/);
                        const srcMatch = raw.match(/<source[^>]*>(.*?)<\/source>/);

                        const rawTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : 'Market News';
                        const link = linkMatch ? linkMatch[1] : '#';
                        const source = srcMatch ? srcMatch[1] : 'Google News';

                        let timeStr = '';
                        if (pubMatch) {
                            const date = new Date(pubMatch[1]);
                            if (!isNaN(date.getTime())) {
                                const y = date.getFullYear();
                                const m = String(date.getMonth() + 1).padStart(2, '0');
                                const d = String(date.getDate()).padStart(2, '0');
                                const h = String(date.getHours()).padStart(2, '0');
                                const min = String(date.getMinutes()).padStart(2, '0');
                                const sec = String(date.getSeconds()).padStart(2, '0');
                                timeStr = `${y}${m}${d}T${h}${min}${sec}`;
                            }
                        }

                        // Determine sentiment from headline keywords
                        const titleLower = rawTitle.toLowerCase();
                        let sentiment = 'Neutral';
                        if (/surge|jump|gain|profit|rise|high|buy|bull|record|growth/.test(titleLower)) {
                            sentiment = 'Bullish';
                        } else if (/fall|drop|loss|decline|down|sell|bear|plunge|crash/.test(titleLower)) {
                            sentiment = 'Bearish';
                        }

                        return {
                            title: rawTitle,
                            summary: rawTitle,
                            url: link,
                            source: source,
                            time_published: timeStr,
                            overall_sentiment_label: sentiment
                        };
                    });

                    resolve(articles);
                } catch {
                    resolve([]);
                }
            });
        });

        req.on('error', () => resolve([]));
        req.setTimeout(5000, () => {
            req.destroy();
            resolve([]);
        });
    });
}

/**
 * Search ticker symbols
 */
async function search(query) {
    if (!query) return [];
    try {
        const results = await yf.search(query);
        return (results?.quotes || []).filter(q => q.isYahooFinance);
    } catch (e) {
        console.warn('[CleanMarket] Search error:', e.message);
        return [];
    }
}

module.exports = {
    normalizeTicker,
    resolveYahooSymbol,
    getQuote,
    getHistoricalChart,
    getFundamentals,
    getTechnicalIndicators,
    getCompanyNews,
    search
};

