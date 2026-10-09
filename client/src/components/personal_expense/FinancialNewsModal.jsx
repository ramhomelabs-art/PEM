import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, TrendingUp, Zap, Newspaper, ExternalLink, Clock, ChevronLeft, RefreshCw } from 'lucide-react';
import { API_URL } from '../../config';

const FinancialNewsModal = ({ isOpen, onClose }) => {
    const [activeCategory, setActiveCategory] = useState('All');
    const [newsItems, setNewsItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [selectedArticle, setSelectedArticle] = useState(null);

    const categories = ['All', 'Markets', 'Economy', 'Commodities', 'Tech', 'Crypto'];

    useEffect(() => {
        if (isOpen) {
            fetchNews();
        }
    }, [isOpen]);

    const fetchNews = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetch(`${API_URL}/news/financial`);
            const data = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray(data.articles) && data.articles.length > 0) {
                setNewsItems(data.articles);
            } else {
                setNewsItems([]);
                setLoadError(data.error || 'News is currently unavailable');
            }
        } catch (err) {
            console.error('Failed to fetch news:', err);
            setNewsItems([]);
            setLoadError('News is currently unavailable');
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
                        backgroundColor: 'var(--pem-surface)',
                        width: '90%', maxWidth: '800px', height: '85vh',
                        borderRadius: '24px', border: '1px solid var(--pem-border)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                    }}
                >
                    <div style={{
                        padding: '25px', borderBottom: '1px solid var(--pem-border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'linear-gradient(to right, var(--pem-surface-raised), var(--pem-surface))'
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
                                background: 'none', border: 'none', color: 'var(--pem-text-secondary)',
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
                            <span style={{ fontSize: '12px', color: 'var(--pem-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} /> {selectedArticle.time}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--pem-text-secondary)' }}>• {selectedArticle.source}</span>
                        </div>

                        <h1 style={{
                            fontSize: '32px', fontWeight: '900', color: 'var(--pem-text)',
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
                            fontSize: '16px', color: 'var(--pem-text-secondary)', lineHeight: '1.8',
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
                    backgroundColor: 'var(--pem-surface)',
                    width: '90%', maxWidth: '900px', height: '85vh',
                    borderRadius: '24px', border: '1px solid var(--pem-border)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                }}
            >
                <div style={{
                    padding: '25px', borderBottom: '1px solid var(--pem-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'linear-gradient(to right, var(--pem-surface-raised), var(--pem-surface))'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: 'rgba(59, 130, 246, 0.2)', borderRadius: '12px', color: '#60a5fa' }}>
                            <Newspaper size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--pem-text)', margin: 0 }}>Market Pulse</h2>
                            <p style={{ margin: '4px 0 0 0', color: 'var(--pem-text-secondary)', fontSize: '13px' }}>Live financial insights and breaking news</p>
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
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--pem-text-secondary)', cursor: 'pointer', padding: '8px' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: '20px 25px', display: 'flex', gap: '10px', overflowX: 'auto', borderBottom: '1px solid var(--pem-border)' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            style={{
                                backgroundColor: activeCategory === cat ? '#3b82f6' : 'var(--pem-surface-raised)',
                                color: activeCategory === cat ? 'white' : 'var(--pem-text-secondary)',
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
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--pem-text-secondary)' }}>
                            {newsItems.length === 0 && loadError
                                ? loadError
                                : 'No news available in this category'}
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
                                    backgroundColor: 'var(--pem-surface-raised)',
                                    border: '1px solid var(--pem-border)',
                                    borderRadius: '16px', padding: '20px',
                                    display: 'flex', gap: '20px', cursor: 'pointer'
                                }}
                                whileHover={{ backgroundColor: 'var(--pem-line)', scale: 1.01 }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                                            {news.category}
                                        </span>
                                        <span style={{ fontSize: '12px', color: 'var(--pem-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} /> {news.time}
                                        </span>
                                        <span style={{ fontSize: '12px', color: 'var(--pem-text-secondary)' }}>• {news.source}</span>
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--pem-text)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                                        {news.title}
                                    </h3>
                                    <p style={{ fontSize: '14px', color: 'var(--pem-text-secondary)', margin: 0, lineHeight: '1.5' }}>
                                        {news.summary}
                                    </p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        backgroundColor: news.score === 'positive' ? '#10b981' : news.score === 'negative' ? '#ef4444' : '#f59e0b',
                                        boxShadow: `0 0 10px ${news.score === 'positive' ? '#10b981' : news.score === 'negative' ? '#ef4444' : '#f59e0b'}`
                                    }}></div>
                                    <ExternalLink size={18} color="var(--pem-text-secondary)" />
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
