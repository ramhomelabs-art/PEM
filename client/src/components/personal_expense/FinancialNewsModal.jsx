import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, TrendingUp, Zap, Newspaper, ExternalLink, Clock, ChevronLeft, RefreshCw } from 'lucide-react';
import { API_URL } from '../../config';

const FALLBACK_NEWS = [
    {
        id: 1,
        title: "Sensex surges 500 points as IT stocks rally",
        summary: "The benchmark BSE Sensex jumped 500 points led by strong gains in IT and banking stocks. TCS and Infosys led the rally with gains of over 3% each.",
        fullContent: "The benchmark BSE Sensex jumped 500 points led by strong gains in IT and banking stocks. TCS and Infosys led the rally with gains of over 3% each. Market analysts attribute this surge to positive quarterly results and strong global cues.",
        category: "Markets",
        score: "positive",
        source: "Economic Times",
        time: "2 hours ago",
        url: "https://economictimes.indiatimes.com/markets/stocks/news/sensex-surges-500-points-it-stocks-rally/articleshow/12345678.cms"
    },
    {
        id: 2,
        title: "RBI maintains repo rate at 6.5%",
        summary: "The Reserve Bank of India's Monetary Policy Committee decided to keep the key lending rate unchanged, citing balanced inflation and growth outlook.",
        fullContent: "The Reserve Bank of India's Monetary Policy Committee decided to keep the key lending rate unchanged at 6.5%, citing balanced inflation and growth outlook. This marks the eighth consecutive time the central bank has maintained status quo on policy rates.",
        category: "Economy",
        score: "neutral",
        source: "Mint",
        time: "3 hours ago",
        url: "https://www.livemint.com/economy/rbi-maintains-repo-rate-at-6-5-percent-monetary-policy-11234567890123.html"
    },
    {
        id: 3,
        title: "Gold prices hit new record high",
        summary: "Gold prices surged to an all-time high of ₹72,500 per 10 grams as investors sought safe-haven assets amid geopolitical tensions.",
        fullContent: "Gold prices surged to an all-time high of ₹72,500 per 10 grams as investors sought safe-haven assets amid geopolitical tensions. Silver also rallied, gaining 4% to reach ₹85,000 per kg.",
        category: "Commodities",
        score: "positive",
        source: "Reuters",
        time: "4 hours ago",
        url: "https://www.reuters.com/markets/commodities/gold-prices-hit-record-high-safe-haven-demand-2024-01-01/"
    },
    {
        id: 4,
        title: "Indian fintech startup raises $100M",
        summary: "Leading digital payments company secured fresh funding from global investors, valuing the company at over $1 billion.",
        fullContent: "Leading digital payments company secured fresh funding of $100 million from global investors, valuing the company at over $1 billion. The funds will be used to expand operations and develop new AI-powered features.",
        category: "Tech",
        score: "positive",
        source: "TechCrunch",
        time: "5 hours ago",
        url: "https://techcrunch.com/2024/01/01/indian-fintech-startup-raises-100m-series-c/"
    },
    {
        id: 5,
        title: "Bitcoin crosses $45,000 mark",
        summary: "The world's largest cryptocurrency surged past $45,000 as institutional interest picks up ahead of potential ETF approvals.",
        fullContent: "Bitcoin crossed the $45,000 mark as institutional interest picks up ahead of potential ETF approvals. Ethereum also gained 5%, trading above $2,400. Analysts predict continued volatility in the crypto markets.",
        category: "Crypto",
        score: "positive",
        source: "CoinDesk",
        time: "6 hours ago",
        url: "https://www.coindesk.com/markets/2024/01/01/bitcoin-crosses-45000-institutional-interest-grows/"
    }
];

const FinancialNewsModal = ({ isOpen, onClose }) => {
    const [activeCategory, setActiveCategory] = useState('All');
    const [newsItems, setNewsItems] = useState(FALLBACK_NEWS);
    const [loading, setLoading] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState(null);

    const categories = ['All', 'Markets', 'Economy', 'Commodities', 'Tech', 'Crypto'];

    useEffect(() => {
        if (isOpen) {
            fetchNews();
        }
    }, [isOpen]);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/news/financial`);
            if (res.ok) {
                const data = await res.json();
                if (data.articles && data.articles.length > 0) {
                    setNewsItems(data.articles);
                } else {
                    setNewsItems(FALLBACK_NEWS);
                }
            } else {
                setNewsItems(FALLBACK_NEWS);
            }
        } catch (err) {
            console.error('Failed to fetch news:', err);
            setNewsItems(FALLBACK_NEWS);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredNews = activeCategory === 'All'
        ? newsItems
        : newsItems.filter(n => n.category === activeCategory);

    // Article Detail View
    if (selectedArticle) {
        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
            }}>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{
                        backgroundColor: '#0f172a',
                        width: '90%', maxWidth: '800px', height: '85vh',
                        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                    }}
                >
                    <div style={{
                        padding: '25px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'linear-gradient(to right, #1e293b, #0f172a)'
                    }}>
                        <button
                            onClick={() => setSelectedArticle(null)}
                            style={{
                                background: 'none', border: 'none', color: '#60a5fa',
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                gap: '8px', fontSize: '14px', fontWeight: 'bold'
                            }}
                        >
                            <ChevronLeft size={20} /> Back to News
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none', border: 'none', color: '#64748b',
                                cursor: 'pointer', padding: '8px'
                            }}
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <span style={{
                                fontSize: '12px', fontWeight: 'bold', color: '#3b82f6',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                padding: '4px 10px', borderRadius: '6px'
                            }}>
                                {selectedArticle.category}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} /> {selectedArticle.time}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>• {selectedArticle.source}</span>
                        </div>

                        <h1 style={{
                            fontSize: '32px', fontWeight: '900', color: 'white',
                            margin: '0 0 20px 0', lineHeight: '1.3'
                        }}>
                            {selectedArticle.title}
                        </h1>

                        {/* Article Image */}
                        {selectedArticle.image && (
                            <img
                                src={selectedArticle.image}
                                alt={selectedArticle.title}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    borderRadius: '16px',
                                    marginBottom: '20px',
                                    maxHeight: '400px',
                                    objectFit: 'cover'
                                }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        )}

                        <div style={{
                            fontSize: '16px', color: '#cbd5e1', lineHeight: '1.8',
                            marginBottom: '30px'
                        }}>
                            {selectedArticle.fullContent || selectedArticle.summary}
                        </div>

                        <a
                            href={selectedArticle.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                backgroundColor: '#3b82f6', color: 'white',
                                padding: '12px 24px', borderRadius: '12px',
                                textDecoration: 'none', fontWeight: 'bold',
                                fontSize: '14px'
                            }}
                        >
                            Read Full Article <ExternalLink size={16} />
                        </a>
                    </div>
                </motion.div>
            </div>
        );
    }

    // News List View
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={{
                    backgroundColor: '#0f172a',
                    width: '90%', maxWidth: '900px', height: '85vh',
                    borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                }}
            >
                <div style={{
                    padding: '25px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'linear-gradient(to right, #1e293b, #0f172a)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: 'rgba(59, 130, 246, 0.2)', borderRadius: '12px', color: '#60a5fa' }}>
                            <Newspaper size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', margin: 0 }}>Market Pulse</h2>
                            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>Live financial insights and breaking news</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={fetchNews}
                            disabled={loading}
                            style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                color: '#60a5fa', cursor: 'pointer',
                                padding: '8px 12px', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '12px', fontWeight: 'bold'
                            }}
                        >
                            <RefreshCw size={14} /> Refresh
                        </button>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: '20px 25px', display: 'flex', gap: '10px', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            style={{
                                backgroundColor: activeCategory === cat ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                                color: activeCategory === cat ? 'white' : '#94a3b8',
                                border: 'none', padding: '8px 16px', borderRadius: '20px',
                                fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                transition: 'all 0.2s', whiteSpace: 'nowrap'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '25px', display: 'grid', gap: '20px' }}>
                    {filteredNews.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            No news available in this category
                        </div>
                    ) : (
                        filteredNews.map((news, index) => (
                            <motion.div
                                key={news.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => setSelectedArticle(news)}
                                style={{
                                    backgroundColor: 'rgba(30, 41, 59, 0.4)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '16px', padding: '20px',
                                    display: 'flex', gap: '20px', cursor: 'pointer'
                                }}
                                whileHover={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', scale: 1.01 }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                                            {news.category}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} /> {news.time}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>• {news.source}</span>
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                                        {news.title}
                                    </h3>
                                    <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, lineHeight: '1.5' }}>
                                        {news.summary}
                                    </p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        backgroundColor: news.score === 'positive' ? '#10b981' : news.score === 'negative' ? '#ef4444' : '#f59e0b',
                                        boxShadow: `0 0 10px ${news.score === 'positive' ? '#10b981' : news.score === 'negative' ? '#ef4444' : '#f59e0b'}`
                                    }}></div>
                                    <ExternalLink size={18} color="#64748b" />
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>

            </motion.div>
        </div>
    );
};

export default FinancialNewsModal;
