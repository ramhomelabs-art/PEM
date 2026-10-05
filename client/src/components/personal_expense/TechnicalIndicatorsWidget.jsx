import React from 'react';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const TechnicalIndicatorsWidget = ({ rsiData, isDarkMode }) => {
    if (!rsiData || !rsiData.value) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                <p>No technical indicator data available</p>
            </div>
        );
    }

    // Parse RSI value
    const rsiValue = parseFloat(rsiData.value.RSI || rsiData.value);

    // Determine signal based on RSI
    const getSignal = (rsi) => {
        if (rsi >= 70) return { label: 'OVERBOUGHT', color: '#ef4444', icon: <TrendingDown size={16} />, action: 'Consider Selling' };
        if (rsi <= 30) return { label: 'OVERSOLD', color: '#10b981', icon: <TrendingUp size={16} />, action: 'Consider Buying' };
        return { label: 'NEUTRAL', color: '#f59e0b', icon: <Minus size={16} />, action: 'Hold Position' };
    };

    const signal = getSignal(rsiValue);

    // Calculate gauge position (0-100 scale)
    const gaugePosition = Math.min(Math.max(rsiValue, 0), 100);

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
                    color: '#8b5cf6',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <Activity size={20} />
                    Technical Indicators
                </h3>
                <span style={{
                    fontSize: '12px',
                    color: signal.color,
                    backgroundColor: `${signal.color}20`,
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    {signal.icon}
                    {signal.label}
                </span>
            </div>

            {/* RSI Gauge */}
            <div style={{ marginBottom: '25px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px'
                }}>
                    <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 'bold' }}>
                        RSI (Relative Strength Index)
                    </span>
                    <span style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: signal.color
                    }}>
                        {rsiValue.toFixed(2)}
                    </span>
                </div>

                {/* Gauge Bar */}
                <div style={{
                    position: 'relative',
                    height: '40px',
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    borderRadius: '12px',
                    overflow: 'hidden'
                }}>
                    {/* Background zones */}
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '30%',
                        height: '100%',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderRight: '2px solid rgba(16, 185, 129, 0.3)'
                    }} />
                    <div style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        width: '30%',
                        height: '100%',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        borderLeft: '2px solid rgba(239, 68, 68, 0.3)'
                    }} />

                    {/* RSI Indicator */}
                    <div style={{
                        position: 'absolute',
                        left: `${gaugePosition}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '4px',
                        height: '100%',
                        backgroundColor: signal.color,
                        boxShadow: `0 0 10px ${signal.color}`
                    }} />

                    {/* Value marker */}
                    <div style={{
                        position: 'absolute',
                        left: `${gaugePosition}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: signal.color,
                        border: '2px solid white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }} />
                </div>

                {/* Scale labels */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    fontSize: '11px',
                    color: '#64748b'
                }}>
                    <span>0 (Oversold)</span>
                    <span>30</span>
                    <span>50</span>
                    <span>70</span>
                    <span>100 (Overbought)</span>
                </div>
            </div>

            {/* Signal Card */}
            <div style={{
                padding: '15px',
                backgroundColor: `${signal.color}10`,
                borderRadius: '12px',
                border: `1px solid ${signal.color}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div>
                    <p style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        margin: '0 0 4px 0',
                        fontWeight: 'bold'
                    }}>
                        TRADING SIGNAL
                    </p>
                    <p style={{
                        fontSize: '16px',
                        color: signal.color,
                        margin: 0,
                        fontWeight: 'bold'
                    }}>
                        {signal.action}
                    </p>
                </div>
                <div style={{
                    fontSize: '32px',
                    color: signal.color,
                    opacity: 0.3
                }}>
                    {signal.icon}
                </div>
            </div>

            {/* Info note */}
            <div style={{
                marginTop: '15px',
                padding: '12px',
                backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(139, 92, 246, 0.1)'
            }}>
                <p style={{
                    fontSize: '11px',
                    color: '#a78bfa',
                    margin: 0,
                    lineHeight: '1.5'
                }}>
                    <strong>Note:</strong> RSI above 70 indicates overbought conditions (potential sell signal).
                    RSI below 30 indicates oversold conditions (potential buy signal).
                    This is for informational purposes only and not financial advice.
                </p>
            </div>
        </div>
    );
};

export default TechnicalIndicatorsWidget;
