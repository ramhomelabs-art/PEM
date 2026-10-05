import React from 'react';
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

const CompanyNewsWidget = ({ news, isDarkMode }) => {
    if (!news || news.length === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                <Newspaper size={48} style={{ opacity: 0.3, marginBottom: '10px' }} />
                <p>No news available</p>
            </div>
        );
    }

    const getSentimentIcon = (label) => {
        if (!label) return <Minus size={14} />;
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('positive') || lowerLabel.includes('bullish')) {
            return <TrendingUp size={14} />;
        }
        if (lowerLabel.includes('negative') || lowerLabel.includes('bearish')) {
            return <TrendingDown size={14} />;
        }
        return <Minus size={14} />;
    };

    const getSentimentColor = (label) => {
        if (!label) return '#94a3b8';
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('positive') || lowerLabel.includes('bullish')) {
            return '#10b981';
        }
        if (lowerLabel.includes('negative') || lowerLabel.includes('bearish')) {
            return '#ef4444';
        }
        return '#f59e0b';
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        try {
            // Alpha Vantage format: YYYYMMDDTHHMMSS
            const year = timeStr.substring(0, 4);
            const month = timeStr.substring(4, 6);
            const day = timeStr.substring(6, 8);
            const hour = timeStr.substring(9, 11);
            const minute = timeStr.substring(11, 13);

            const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
            const now = new Date();
            const diffMs = now - date;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);

            if (diffHours < 1) return 'Just now';
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        } catch {
            return timeStr;
        }
    };

    return (
        <div style={{
            backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
            padding: '25px',
            borderRadius: '20px',
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            marginTop: '20px'
        }}>
            <h3 style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#3b82f6',
                margin: '0 0 20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <Newspaper size={20} />
                Latest Company News
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {news.map((article, index) => {
                    const sentimentColor = getSentimentColor(article.sentiment?.label);
                    const sentimentIcon = getSentimentIcon(article.sentiment?.label);

                    return (
                        <div
                            key={index}
                            style={{
                                padding: '15px',
                                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'white',
                                borderRadius: '12px',
                                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                            onClick={() => window.open(article.url, '_blank')}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateX(4px)';
                                e.currentTarget.style.borderColor = '#3b82f6';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateX(0)';
                                e.currentTarget.style.borderColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
                            }}
                        >
                            {/* Sentiment Badge */}
                            <div style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                backgroundColor: `${sentimentColor}20`,
                                color: sentimentColor,
                                fontSize: '10px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                            }}>
                                {sentimentIcon}
                                {article.sentiment?.label || 'Neutral'}
                            </div>

                            {/* Title */}
                            <h4 style={{
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: isDarkMode ? 'white' : '#1e293b',
                                margin: '0 0 8px 0',
                                paddingRight: '80px',
                                lineHeight: '1.4'
                            }}>
                                {article.title}
                            </h4>

                            {/* Summary */}
                            {article.summary && (
                                <p style={{
                                    fontSize: '12px',
                                    color: '#94a3b8',
                                    margin: '0 0 10px 0',
                                    lineHeight: '1.5',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}>
                                    {article.summary}
                                </p>
                            )}

                            {/* Footer */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '10px'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '11px',
                                    color: '#64748b'
                                }}>
                                    <span style={{
                                        fontWeight: 'bold',
                                        color: '#3b82f6'
                                    }}>
                                        {article.source || 'Unknown Source'}
                                    </span>
                                    <span>•</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} />
                                        {formatTime(article.timePublished)}
                                    </div>
                                </div>

                                <ExternalLink size={14} color="#3b82f6" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Disclaimer */}
            <div style={{
                marginTop: '15px',
                padding: '12px',
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.1)'
            }}>
                <p style={{
                    fontSize: '10px',
                    color: '#60a5fa',
                    margin: 0,
                    lineHeight: '1.4'
                }}>
                    <strong>Disclaimer:</strong> News sentiment is algorithmically generated and may not reflect actual market conditions.
                    Always conduct your own research before making investment decisions.
                </p>
            </div>
        </div>
    );
};

export default CompanyNewsWidget;
