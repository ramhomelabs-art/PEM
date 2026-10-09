import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Globe, DollarSign, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { API_URL } from '../../config';

const LiveMarketTicker = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isExpanded, setIsExpanded] = useState(true);
    const [marketData, setMarketData] = useState(null);
    const [currencyData, setCurrencyData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch market data
    const fetchMarketData = useCallback(() => {
        const token = localStorage.getItem('token');

        Promise.all([
            fetch(`${API_URL}/market/indices`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_URL}/market/currencies`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ])
            .then(([indicesRes, currenciesRes]) => {
                const jobs = [];

                if (indicesRes.ok) {
                    jobs.push(indicesRes.json().then(indicesData => { setMarketData(indicesData.indices); }));
                }

                if (currenciesRes.ok) {
                    jobs.push(currenciesRes.json().then(currData => { setCurrencyData(currData.currencies); }));
                }

                return Promise.all(jobs);
            })
            .catch(error => {
                console.error('[LiveMarketTicker] Error:', error);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        fetchMarketData();

        // Auto-refresh every 5 minutes
        const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchMarketData]);

    const slides = [
        {
            id: 'indian',
            title: 'Indian Indices',
            icon: TrendingUp,
            color: '#3b82f6',
            content: marketData?.indian && (
                <div style={{ display: 'flex', gap: '40px', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: 'var(--pem-text-secondary)', fontWeight: 'bold', marginBottom: '5px' }}>
                            {marketData.indian.nifty.flag} NIFTY 50
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--pem-text)' }}>
                            {marketData.indian.nifty.price.toFixed(2)}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: marketData.indian.nifty.change >= 0 ? '#10b981' : '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                        }}>
                            {marketData.indian.nifty.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {marketData.indian.nifty.change >= 0 ? '+' : ''}{marketData.indian.nifty.change.toFixed(2)} ({marketData.indian.nifty.percentChange}%)
                        </div>
                    </div>
                    <div style={{ width: '1px', height: '50px', backgroundColor: 'var(--pem-border)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: 'var(--pem-text-secondary)', fontWeight: 'bold', marginBottom: '5px' }}>
                            {marketData.indian.sensex.flag} SENSEX
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--pem-text)' }}>
                            {marketData.indian.sensex.price.toFixed(2)}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: marketData.indian.sensex.change >= 0 ? '#10b981' : '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                        }}>
                            {marketData.indian.sensex.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {marketData.indian.sensex.change >= 0 ? '+' : ''}{marketData.indian.sensex.change.toFixed(2)} ({marketData.indian.sensex.percentChange}%)
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'us',
            title: 'US Markets',
            icon: Globe,
            color: '#10b981',
            content: marketData?.us && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' }}>
                    {Object.values(marketData.us).map((index, idx) => (
                        <div key={idx} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--pem-text-secondary)', fontWeight: 'bold', marginBottom: '5px' }}>
                                {index.flag} {index.name}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--pem-text)' }}>
                                {index.price.toFixed(2)}
                            </div>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: index.change >= 0 ? '#10b981' : '#ef4444'
                            }}>
                                {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.percentChange}%)
                            </div>
                        </div>
                    ))}
                </div>
            )
        },
        {
            id: 'global',
            title: 'Global Markets',
            icon: Globe,
            color: '#f59e0b',
            content: marketData?.global && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' }}>
                    {Object.values(marketData.global).map((index, idx) => (
                        <div key={idx} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--pem-text-secondary)', fontWeight: 'bold', marginBottom: '5px' }}>
                                {index.flag} {index.name}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--pem-text)' }}>
                                {index.price.toFixed(2)}
                            </div>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: index.change >= 0 ? '#10b981' : '#ef4444'
                            }}>
                                {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.percentChange}%)
                            </div>
                        </div>
                    ))}
                </div>
            )
        },
        {
            id: 'currency',
            title: 'Currency Exchange (vs INR)',
            icon: DollarSign,
            color: '#8b5cf6',
            content: currencyData && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '25px' }}>
                    {Object.values(currencyData).map((curr, idx) => (
                        <div key={idx} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--pem-text-secondary)', fontWeight: 'bold', marginBottom: '5px' }}>
                                {curr.flag} 1 {curr.code}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--pem-text)' }}>
                                ₹{curr.rate}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#10b981' }}>
                                {curr.change} ({curr.percentChange}%)
                            </div>
                        </div>
                    ))}
                </div>
            )
        }
    ];

    const CurrentSlide = slides[currentIndex % slides.length];

    // Slideshow Rotation
    useEffect(() => {
        const slideTimer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % slides.length);
        }, 10000); // 10 seconds per slide
        return () => clearInterval(slideTimer);
    }, [slides.length]);

    if (loading) {
        return (
            <div style={{
                marginBottom: '40px',
                backgroundColor: 'var(--pem-surface-raised)',
                border: '1px solid var(--pem-border)',
                borderRadius: '20px',
                padding: '40px',
                textAlign: 'center',
                color: 'var(--pem-text-secondary)'
            }}>
                Loading market data...
            </div>
        );
    }

    return (
        <motion.div style={{
            marginBottom: '40px',
            backgroundColor: 'var(--pem-surface-raised)',
            border: '1px solid var(--pem-border)',
            borderRadius: '20px',
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Header */}
            <div style={{
                padding: '15px 25px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(90deg, var(--pem-surface-raised) 0%, var(--pem-surface) 100%)'
            }}>
                <div
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                >
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        boxShadow: '0 0 10px #ef4444',
                        animation: 'pulse 2s infinite'
                    }}></div>
                    <span style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'var(--pem-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        Live Market
                    </span>
                    {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                </div>
                <button
                    onClick={fetchMarketData}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--pem-text-secondary)',
                        cursor: 'pointer',
                        padding: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            <AnimatePresence>
                {isExpanded && CurrentSlide && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <div style={{ padding: '30px', position: 'relative' }}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={CurrentSlide.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: CurrentSlide.color }}>
                                            <CurrentSlide.icon size={18} />
                                            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{CurrentSlide.title}</span>
                                        </div>
                                        {CurrentSlide.content}
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Progress Indicators */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '25px' }}>
                                {slides.map((_, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            height: '4px',
                                            width: idx === (currentIndex % slides.length) ? '20px' : '6px',
                                            backgroundColor: idx === (currentIndex % slides.length) ? CurrentSlide.color : 'var(--pem-border)',
                                            borderRadius: '2px',
                                            transition: 'all 0.3s',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setCurrentIndex(idx)}
                                    />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </motion.div>
    );
};

export default LiveMarketTicker;
