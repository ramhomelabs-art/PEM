const express = require('express');
const router = express.Router();

// Mock news generator with dynamic timestamps
const generateLiveNews = () => {
    const now = new Date();

    const newsTemplates = [
        {
            title: "Sensex surges 500 points as IT stocks rally",
            summary: "The benchmark BSE Sensex jumped 500 points led by strong gains in IT and banking stocks. TCS and Infosys led the rally with gains of over 3% each.",
            category: "Markets",
            score: "positive"
        },
        {
            title: "RBI maintains repo rate at 6.5% for eighth consecutive time",
            summary: "The Reserve Bank of India's Monetary Policy Committee decided to keep the key lending rate unchanged, citing balanced inflation and growth outlook.",
            category: "Economy",
            score: "neutral"
        },
        {
            title: "Gold prices hit new record high amid global uncertainty",
            summary: "Gold prices surged to an all-time high of ₹72,500 per 10 grams as investors sought safe-haven assets amid geopolitical tensions.",
            category: "Commodities",
            score: "positive"
        },
        {
            title: "Indian fintech startup raises $100M in Series C funding",
            summary: "Leading digital payments company secured fresh funding from global investors, valuing the company at over $1 billion.",
            category: "Tech",
            score: "positive"
        },
        {
            title: "Bitcoin crosses $45,000 mark after months of consolidation",
            summary: "The world's largest cryptocurrency surged past $45,000 as institutional interest picks up ahead of potential ETF approvals.",
            category: "Crypto",
            score: "positive"
        },
        {
            title: "Nifty 50 closes at record high led by banking stocks",
            summary: "The NSE Nifty 50 index touched a new all-time high, with HDFC Bank, ICICI Bank and Axis Bank contributing significantly to the rally.",
            category: "Markets",
            score: "positive"
        },
        {
            title: "Crude oil prices decline on demand concerns",
            summary: "Brent crude fell 2% to $82 per barrel as concerns over global economic slowdown weighed on energy demand outlook.",
            category: "Commodities",
            score: "negative"
        },
        {
            title: "India's GDP growth forecast revised upward to 7.3%",
            summary: "Leading economic agencies have revised India's GDP growth forecast for FY24 to 7.3% from earlier 6.8%, citing strong domestic consumption.",
            category: "Economy",
            score: "positive"
        },
        {
            title: "Tech stocks face selling pressure on valuation concerns",
            summary: "Major technology stocks witnessed profit booking as investors reassessed valuations amid rising interest rate environment.",
            category: "Tech",
            score: "negative"
        },
        {
            title: "Ethereum network completes major upgrade successfully",
            summary: "The Ethereum blockchain successfully implemented its latest upgrade, improving transaction speed and reducing gas fees significantly.",
            category: "Crypto",
            score: "positive"
        },
        {
            title: "Foreign institutional investors turn net buyers in Indian equities",
            summary: "FIIs purchased Indian stocks worth ₹5,200 crore this week, marking a reversal from previous months of selling.",
            category: "Markets",
            score: "positive"
        },
        {
            title: "Inflation rate eases to 4.8% in latest reading",
            summary: "Consumer price inflation moderated to 4.8% in the latest month from 5.2% previously, driven by lower food prices.",
            category: "Economy",
            score: "positive"
        },
        {
            title: "Silver prices rally on industrial demand expectations",
            summary: "Silver surged 4% to ₹85,000 per kg as industrial demand outlook improved with manufacturing activity picking up.",
            category: "Commodities",
            score: "positive"
        },
        {
            title: "AI-powered trading platform launches in India",
            summary: "New algorithmic trading platform using artificial intelligence promises to democratize advanced trading strategies for retail investors.",
            category: "Tech",
            score: "positive"
        },
        {
            title: "Cryptocurrency regulations framework expected soon",
            summary: "Government officials hint at comprehensive crypto regulations being finalized, bringing clarity to the digital asset ecosystem.",
            category: "Crypto",
            score: "neutral"
        }
    ];

    const sources = ["Economic Times", "Mint", "Bloomberg", "Reuters", "CNBC", "MoneyControl", "Business Standard"];

    // Shuffle and select news items
    const shuffled = newsTemplates.sort(() => 0.5 - Math.random());

    return shuffled.slice(0, 12).map((template, index) => {
        // Generate realistic timestamps (within last 24 hours)
        const hoursAgo = Math.floor(Math.random() * 24);
        const minutesAgo = Math.floor(Math.random() * 60);
        const newsDate = new Date(now - (hoursAgo * 60 * 60 * 1000) - (minutesAgo * 60 * 1000));

        let timeAgo = '';
        if (hoursAgo === 0) {
            timeAgo = minutesAgo === 0 ? 'Just now' : `${minutesAgo} min ago`;
        } else if (hoursAgo < 24) {
            timeAgo = `${hoursAgo} hours ago`;
        } else {
            timeAgo = `${Math.floor(hoursAgo / 24)} days ago`;
        }

        return {
            id: index + 1,
            title: template.title,
            summary: template.summary,
            fullContent: `${template.summary}\n\nThis is a simulated news article for demonstration purposes. In a production environment, this would contain the full article content fetched from real news sources.\n\nKey Points:\n• Market sentiment remains ${template.score}\n• Investors are closely watching developments\n• Expert analysis suggests continued monitoring of the situation\n\nFor the complete story and latest updates, please visit the source website.`,
            source: sources[Math.floor(Math.random() * sources.length)],
            time: timeAgo,
            category: template.category,
            url: `https://news.google.com/search?q=${encodeURIComponent(template.title)}`,
            score: template.score,
            pubDate: newsDate.toISOString()
        };
    });
};

// GET Live Financial News
router.get('/', async (req, res) => {
    try {
        const newsItems = generateLiveNews();
        res.json(newsItems);
    } catch (err) {
        console.error('News generation error:', err);
        res.status(500).json({
            error: 'Failed to fetch news',
            message: err.message
        });
    }
});

module.exports = router;
