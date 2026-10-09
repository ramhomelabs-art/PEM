import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Loader2, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { API_URL } from '../../config';

const LOCATIONS = [
    { code: 'INR', name: 'India', flag: '🇮🇳', symbol: '₹' },
    { code: 'USD', name: 'United States', flag: '🇺🇸', symbol: '$' },
    { code: 'EUR', name: 'Europe', flag: '🇪🇺', symbol: '€' },
    { code: 'GBP', name: 'United Kingdom', flag: '🇬🇧', symbol: '£' },
    { code: 'AED', name: 'UAE', flag: '🇦🇪', symbol: 'د.إ' },
    { code: 'AUD', name: 'Australia', flag: '🇦🇺', symbol: 'A$' }
];

const LiveMetalPrices = () => {
    const { theme } = useTheme();
    const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0]); // Default to India
    const [prices, setPrices] = useState(null);
    const [loading, setLoading] = useState(true);
    const [, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [showLocationDropdown, setShowLocationDropdown] = useState(false);

    const fetchPrices = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/metals/prices?currency=${selectedLocation.code}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch prices');

            const data = await res.json();
            setPrices(data);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('[LiveMetalPrices] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedLocation.code]);

    useEffect(() => {
        fetchPrices();

        // Auto-refresh every 5 minutes
        const interval = setInterval(fetchPrices, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [selectedLocation, fetchPrices]);

    if (loading && !prices) {
        return (
            <div style={{
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '24px',
                padding: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '150px'
            }}>
                <Loader2 className="animate-spin" size={32} color={theme.accent} />
            </div>
        );
    }

    const metals = prices?.prices ? Object.values(prices.prices) : [];

    return (
        <div style={{
            backgroundColor: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: '24px',
            padding: '30px',
            marginBottom: '30px'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: theme.text, margin: '0 0 5px 0' }}>
                        💎 Precious Metals
                    </h3>
                    <p style={{ fontSize: '12px', color: theme.textSecondary, margin: 0 }}>
                        Live prices • {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading...'}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Location Selector */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                            style={{
                                padding: '10px 15px',
                                backgroundColor: theme.inputBg,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '12px',
                                cursor: 'pointer',
                                color: theme.text,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '14px',
                                fontWeight: 'bold'
                            }}
                        >
                            <MapPin size={16} />
                            {selectedLocation.flag} {selectedLocation.code}
                        </button>

                        {/* Dropdown */}
                        {showLocationDropdown && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '5px',
                                backgroundColor: theme.card,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                                zIndex: 1000,
                                minWidth: '200px',
                                overflow: 'hidden'
                            }}>
                                {LOCATIONS.map((location) => (
                                    <button
                                        key={location.code}
                                        onClick={() => {
                                            setSelectedLocation(location);
                                            setShowLocationDropdown(false);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '12px 15px',
                                            backgroundColor: selectedLocation.code === location.code ? theme.inputBg : 'transparent',
                                            border: 'none',
                                            borderBottom: `1px solid ${theme.border}`,
                                            cursor: 'pointer',
                                            color: theme.text,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            fontSize: '14px',
                                            textAlign: 'left',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.inputBg}
                                        onMouseLeave={(e) => {
                                            if (selectedLocation.code !== location.code) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }
                                        }}
                                    >
                                        <span style={{ fontSize: '20px' }}>{location.flag}</span>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{location.name}</div>
                                            <div style={{ fontSize: '11px', color: theme.textSecondary }}>
                                                {location.code} ({location.symbol})
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchPrices}
                        disabled={loading}
                        style={{
                            padding: '10px',
                            backgroundColor: theme.inputBg,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '12px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            color: theme.text,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Metal Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                {metals.map((metal, index) => {
                    const isPositive = metal.change?.startsWith('+');

                    return (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            style={{
                                backgroundColor: theme.inputBg,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '16px',
                                padding: '20px',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Metal Icon */}
                            <div style={{ fontSize: '32px', marginBottom: '10px' }}>
                                {metal.symbol}
                            </div>

                            {/* Metal Name */}
                            <div style={{ fontSize: '12px', color: theme.textSecondary, fontWeight: 'bold', marginBottom: '8px' }}>
                                {metal.name}
                            </div>

                            {/* Price per Gram */}
                            <div style={{ fontSize: '24px', fontWeight: '900', color: theme.text, marginBottom: '5px' }}>
                                {selectedLocation.symbol}{metal.pricePerGram || 'N/A'}
                            </div>
                            <div style={{ fontSize: '11px', color: theme.textSecondary, marginBottom: '10px' }}>
                                per gram
                            </div>

                            {/* Change Indicator */}
                            {metal.change && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    color: isPositive ? '#10b981' : '#ef4444'
                                }}>
                                    {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                    {metal.change}
                                </div>
                            )}

                            {/* Price per Ounce (small text) */}
                            <div style={{ fontSize: '10px', color: theme.textSecondary, marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${theme.border}` }}>
                                {selectedLocation.symbol}{metal.pricePerOunce || 'N/A'} / oz
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Info Message */}
            {prices?._source === 'derived' && (
                <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#10b981'
                }}>
                    ✓ Live gold price. Silver, platinum and palladium are approximate estimates derived from typical ratios.
                </div>
            )}

            {/* Unavailable Warning */}
            {prices?._source === 'unavailable' && (
                <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#ef4444'
                }}>
                    ⚠️ {prices.error || 'Live metal prices are currently unavailable.'}
                </div>
            )}

            <style>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default LiveMetalPrices;
