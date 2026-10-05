import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, Percent, Activity } from 'lucide-react';
import { symbolMap } from '../../utils/currency';

const FundamentalsCard = ({ data, isDarkMode, currencyCode }) => {
    if (!data) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                <p>No fundamental data available</p>
            </div>
        );
    }

    const symbol = symbolMap[currencyCode || 'USD'] || '$';

    const formatNumber = (num) => {
        if (!num) return 'N/A';
        const value = parseFloat(num);
        if (isNaN(value)) return 'N/A';

        if (value >= 1e12) return `${symbol}${(value / 1e12).toFixed(2)}T`;
        if (value >= 1e9) return `${symbol}${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `${symbol}${(value / 1e6).toFixed(2)}M`;
        if (value >= 1e3) return `${symbol}${(value / 1e3).toFixed(2)}K`;
        return `${symbol}${value.toFixed(2)}`;
    };

    const formatPercent = (num) => {
        if (!num) return 'N/A';
        const value = parseFloat(num);
        return isNaN(value) ? 'N/A' : `${(value * 100).toFixed(2)}%`;
    };

    const metrics = [
        {
            label: 'Market Cap',
            value: formatNumber(data.marketCap),
            icon: <DollarSign size={18} />,
            color: '#3b82f6'
        },
        {
            label: 'P/E Ratio',
            value: data.peRatio ? data.peRatio.toFixed(2) : 'N/A',
            icon: <BarChart3 size={18} />,
            color: '#8b5cf6'
        },
        {
            label: 'EPS',
            value: data.eps ? `${symbol}${data.eps.toFixed(2)}` : 'N/A',
            icon: <TrendingUp size={18} />,
            color: '#10b981'
        },
        {
            label: 'Dividend Yield',
            value: formatPercent(data.dividendYield),
            icon: <Percent size={18} />,
            color: '#f59e0b'
        },
        {
            label: '52W High',
            value: data.week52High ? `${symbol}${data.week52High.toFixed(2)}` : 'N/A',
            icon: <TrendingUp size={18} />,
            color: '#10b981'
        },
        {
            label: '52W Low',
            value: data.week52Low ? `${symbol}${data.week52Low.toFixed(2)}` : 'N/A',
            icon: <TrendingDown size={18} />,
            color: '#ef4444'
        },
        {
            label: 'Beta',
            value: data.beta ? data.beta.toFixed(2) : 'N/A',
            icon: <Activity size={18} />,
            color: '#6366f1'
        },
        {
            label: 'Profit Margin',
            value: formatPercent(data.profitMargin),
            icon: <PieChart size={18} />,
            color: '#ec4899'
        }
    ];

    return (
        <div style={{
            backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
            padding: '25px',
            borderRadius: '20px',
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            marginTop: '20px'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <h3 style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#3b82f6',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <BarChart3 size={20} />
                    Company Fundamentals
                </h3>
                {data.sector && (
                    <span style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        fontWeight: 'bold'
                    }}>
                        {data.sector}
                    </span>
                )}
            </div>

            {data.name && (
                <div style={{ marginBottom: '20px' }}>
                    <p style={{
                        fontSize: '14px',
                        color: '#e2e8f0',
                        margin: 0,
                        fontWeight: '600'
                    }}>
                        {data.name}
                    </p>
                    {data.industry && (
                        <p style={{
                            fontSize: '12px',
                            color: '#94a3b8',
                            margin: '4px 0 0 0'
                        }}>
                            {data.industry}
                        </p>
                    )}
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '15px'
            }}>
                {metrics.map((metric, index) => (
                    <div
                        key={index}
                        style={{
                            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'white',
                            padding: '15px',
                            borderRadius: '12px',
                            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            cursor: 'default'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px'
                        }}>
                            <div style={{ color: metric.color }}>
                                {metric.icon}
                            </div>
                            <span style={{
                                fontSize: '11px',
                                color: '#94a3b8',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {metric.label}
                            </span>
                        </div>
                        <div style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: isDarkMode ? 'white' : '#1e293b'
                        }}>
                            {metric.value}
                        </div>
                    </div>
                ))}
            </div>

            {data.description && (
                <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.1)'
                }}>
                    <p style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        margin: 0,
                        lineHeight: '1.6'
                    }}>
                        {data.description.substring(0, 200)}...
                    </p>
                </div>
            )}
        </div>
    );
};

export default FundamentalsCard;
