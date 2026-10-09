import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, IndianRupee, Activity, Save, Plus, ArrowUpRight, ArrowDownRight, History, Calendar, Layers } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { API_URL } from '../../config';
import FundamentalsCard from './FundamentalsCard';
import TechnicalIndicatorsWidget from './TechnicalIndicatorsWidget';
import CompanyNewsWidget from './CompanyNewsWidget';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { formatCurrency as formatCurrencyUtil, symbolMap } from '../../utils/currency';
import CurrencyIcon from '../ui/CurrencyIcon';


const InvestmentDetailModal = ({ investment, isOpen, onClose, onUpdate, initialTab = 'overview' }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState(initialTab); // overview | history | add_txn | analysis
    const [currentValue, setCurrentValue] = useState(investment?.currentValue || 0);
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [history, setHistory] = useState([]); // For Graph

    // Transaction Form State
    const [txnForm, setTxnForm] = useState({
        type: 'BUY',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        units: '',
        pricePerUnit: ''
    });

    // Market Analysis State
    const [marketHistory, setMarketHistory] = useState([]);
    const [chartRange, setChartRange] = useState('1mo');
    const [marketLoading, setMarketLoading] = useState(false);
    const [newTicker, setNewTicker] = useState('');

    // Alpha Vantage State
    const [fundamentals, setFundamentals] = useState(null);
    const [technicals, setTechnicals] = useState(null);
    const [news, setNews] = useState([]);
    const [alphaLoading, setAlphaLoading] = useState(false);
    const { theme, isDarkMode } = useTheme();

    const fetchMarketChart = useCallback(async () => {
        setMarketLoading(true);
        try {
            const res = await fetch(`${API_URL}/investments/market/${investment.id}/chart?range=${chartRange}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMarketHistory(data);
            }
        } catch (err) { console.error(err); }
        finally { setMarketLoading(false); }
    }, [investment, chartRange]);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/investments/${investment.id}/history`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) setHistory(await res.json());
        } catch (err) { console.error(err); }
    }, [investment]);

    const fetchTransactions = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/investments/${investment.id}/transactions`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
        } catch (err) {
            console.error(err);
        }
    }, [investment]);

    const fetchAlphaVantageData = useCallback(async () => {
        setAlphaLoading(true);
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            // Fetch fundamentals
            const overviewRes = await fetch(`${API_URL}/investments/alpha/${investment.id}/overview`, { headers });
            if (overviewRes.ok) {
                const data = await overviewRes.json();
                setFundamentals(data.data);
            }

            // Fetch technical indicators (RSI)
            const techRes = await fetch(`${API_URL}/investments/alpha/${investment.id}/technicals?indicator=RSI`, { headers });
            if (techRes.ok) {
                const data = await techRes.json();
                setTechnicals(data.data);
            }

            // Fetch news
            const newsRes = await fetch(`${API_URL}/investments/alpha/${investment.id}/news?limit=5`, { headers });
            if (newsRes.ok) {
                const data = await newsRes.json();
                setNews(data.data);
            }
        } catch (err) {
            console.error('Alpha Vantage fetch error:', err);
        } finally {
            setAlphaLoading(false);
        }
    }, [investment]);

    useEffect(() => {
        if (investment) setCurrentValue(investment.currentValue);
        if (isOpen) {
            setActiveTab(initialTab);
            fetchHistory(); // Fetch graph data
        }
    }, [investment, isOpen, initialTab, fetchHistory]);

    useEffect(() => {
        if (isOpen && activeTab === 'history') {
            fetchTransactions();
        }
        if (isOpen && activeTab === 'analysis' && investment?.ticker) {
            fetchMarketChart();
            fetchAlphaVantageData(); // Fetch Alpha Vantage data
        }
    }, [isOpen, activeTab, chartRange, fetchTransactions, fetchMarketChart, fetchAlphaVantageData, investment?.ticker]);

    if (!isOpen || !investment) return null;

    const returns = Number(currentValue) - Number(investment.totalInvested);
    const returnPerc = investment.totalInvested > 0 ? (returns / investment.totalInvested) * 100 : 0;
    const isProfit = returns >= 0;

    const handleUpdateValue = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/investments/${investment.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ currentValue: parseFloat(currentValue) })
            });

            if (res.ok) {
                onUpdate();
                alert("Value updated successfully!");
            } else {
                alert("Failed to update value");
            }
        } catch (err) {
            console.error(err);
            alert("Error updating value");
        } finally {
            setLoading(false);
        }
    };

    const handleTransactionSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/investments/${investment.id}/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(txnForm)
            });

            if (res.ok) {
                onUpdate(); // Refresh parent stats
                setActiveTab('history'); // Go to history
                setTxnForm({ ...txnForm, amount: '', units: '', pricePerUnit: '' }); // Reset
            } else {
                alert("Failed to add transaction");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSyncPrice = async () => {
        if (!investment.ticker) return alert("No ticker symbol linked to this investment.");
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/investments/market/${investment.id}/sync`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                const data = await res.json();
                setCurrentValue(data.currentValue);
                onUpdate(); // refresh parent
                alert(`Price Synced! New Price: ${formatCurrency(data.price)}`);
            } else {
                const err = await res.json();
                alert(`Sync Failed: ${err.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Error syncing price.");
        } finally {
            setLoading(false);
        }
    };

    const handleLinkTicker = async () => {
        if (!newTicker) return alert("Please enter a ticker symbol");

        try {
            const res = await fetch(`${API_URL}/investments/${investment.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ ticker: newTicker })
            });

            if (res.ok) {
                alert("Ticker Linked! Refreshing...");
                onUpdate(); // Reload investment data to get the new ticker in props
            } else {
                const data = await res.json();
                alert("Failed to link ticker: " + (data.error || "Unknown Error"));
            }
        } catch (err) {
            console.error(err);
            alert("Error linking ticker: " + err.message);
        }
    };

    const handleDelete = async () => {
        // Removed window.confirm due to unresponsiveness issues reported by user.
        // if (!window.confirm("Are you sure...?")) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/investments/${investment.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (res.ok) {
                alert("Investment deleted successfully");
                onUpdate();
                onClose();
            } else {
                alert("Failed to delete investment");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting investment");
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val) => formatCurrencyUtil(val, user?.currency || 'USD');

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{ backgroundColor: 'var(--pem-surface-raised)', border: '1px solid var(--pem-border)', borderRadius: '24px', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
            >
                {/* Header */}
                <div style={{ padding: '25px', borderBottom: '1px solid var(--pem-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'linear-gradient(to right, var(--pem-surface-raised), var(--pem-surface))' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '5px' }}>
                                <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--pem-text)', margin: 0 }}>{investment.name}</h2>
                                <span style={{ fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: '6px' }}>{investment.category}</span>
                                {investment.goal && (
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Layers size={12} /> {investment.goal.name}
                                    </span>
                                )}
                            </div>
                            <p style={{ margin: 0, color: '#94a3b8' }}>{investment.subCategory} • {investment.provider}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                            onClick={handleDelete}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '8px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            Delete
                        </button>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '5px' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--pem-border)' }}>
                    {['overview', 'analysis', 'history', 'add_txn'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1, padding: '15px', background: 'none', border: 'none',
                                color: activeTab === tab ? '#3b82f6' : '#94a3b8',
                                borderBottom: activeTab === tab ? '2px solid #3b82f6' : 'none',
                                fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', fontSize: '12px'
                            }}
                        >
                            {tab.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ padding: '30px' }}>

                    {activeTab === 'overview' && (
                        <>
                            {/* Quick Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                                <div style={{ backgroundColor: 'var(--pem-surface-raised)', padding: '20px', borderRadius: '16px', border: '1px solid var(--pem-border)' }}>
                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>INVESTED</span>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--pem-text)', marginTop: '5px' }}>{formatCurrency(investment.totalInvested)}</div>
                                </div>
                                <div style={{ backgroundColor: 'var(--pem-surface-raised)', padding: '20px', borderRadius: '16px', border: '1px solid var(--pem-border)' }}>
                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>CURRENT VALUE</span>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--pem-text)', marginTop: '5px' }}>{formatCurrency(investment.currentValue)}</div>
                                </div>
                                <div style={{ backgroundColor: 'var(--pem-surface-raised)', padding: '20px', borderRadius: '16px', border: '1px solid var(--pem-border)' }}>
                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>RETURNS</span>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: isProfit ? '#10b981' : '#ef4444', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {isProfit ? '+' : ''}{formatCurrency(returns)}
                                    </div>
                                    <div style={{ fontSize: '12px', color: isProfit ? '#10b981' : '#ef4444' }}>{returnPerc.toFixed(2)}%</div>
                                </div>
                            </div>

                            {/* Goal Progress Section */}
                            {investment.goal && (
                                <div style={{ backgroundColor: 'rgba(124, 58, 237, 0.1)', padding: '20px', borderRadius: '20px', marginBottom: '20px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <h3 style={{ fontSize: '14px', color: '#a78bfa', margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Layers size={16} /> GOAL CONTRIBUTION: {investment.goal.name}
                                        </h3>
                                        <span style={{ fontSize: '12px', color: '#c4b5fd', fontWeight: 'bold' }}>
                                            {((investment.currentValue / investment.goal.targetAmount) * 100).toFixed(1)}% of Goal Target
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.min((investment.currentValue / investment.goal.targetAmount) * 100, 100)}%`, height: '100%', backgroundColor: '#8b5cf6', borderRadius: '4px' }}></div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#a78bfa' }}>
                                        <span>Contribution: {formatCurrency(investment.currentValue)}</span>
                                        <span>Target: {formatCurrency(investment.goal.targetAmount)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Performance Graph */}
                            <div style={{ backgroundColor: 'var(--pem-surface)', padding: '20px', borderRadius: '20px', marginBottom: '20px', height: '250px' }}>
                                <h3 style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Performance History</h3>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 500, height: 200 }}>
                                    <AreaChart data={history.length > 0 ? history : [{ date: new Date(), value: investment.currentValue }]}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--pem-surface-raised)', border: 'none', borderRadius: '8px' }}
                                            itemStyle={{ color: '#10b981' }}
                                            labelFormatter={(l) => new Date(l).toLocaleDateString()}
                                            formatter={(value) => [`${symbolMap[user?.currency] || '$'}${value}`, 'Value']}
                                        />
                                        <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Manual Value Update Section */}
                            <div style={{ backgroundColor: 'var(--pem-surface)', padding: '25px', borderRadius: '20px', border: '1px solid var(--pem-border)' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--pem-text)', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <TrendingUp size={18} color="#f59e0b" />
                                    Update Profit / Market Value
                                </h3>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '10px' }}>NEW CURRENT VALUE</label>
                                        <div style={{ position: 'relative' }}>
                                            <CurrencyIcon currencyCode={user?.currency} size={16} color="#94a3b8" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
                                            <input
                                                type="number"
                                                value={currentValue}
                                                onChange={e => setCurrentValue(e.target.value)}
                                                style={{ width: '100%', padding: '12px 12px 12px 40px', backgroundColor: 'var(--pem-surface-raised)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)', fontSize: '16px', fontWeight: 'bold', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        {investment.ticker && (
                                            <button
                                                onClick={handleSyncPrice}
                                                disabled={loading}
                                                style={{ flexShrink: 0, backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#fbbf24', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '14px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', height: '48px', whiteSpace: 'nowrap' }}
                                            >
                                                {loading ? 'Syncing...' : <><Activity size={18} /> Sync Live ({investment.ticker})</>}
                                            </button>
                                        )}
                                        <button
                                            onClick={handleUpdateValue}
                                            disabled={loading}
                                            style={{ flexShrink: 0, backgroundColor: '#10b981', color: 'white', border: 'none', padding: '14px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', height: '48px', whiteSpace: 'nowrap' }}
                                        >
                                            {loading ? 'Saving...' : <><Save size={18} /> Update</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'analysis' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {!investment.ticker ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                    <Activity size={48} style={{ marginBottom: '10px', opacity: 0.5 }} />
                                    <p style={{ fontWeight: 'bold', color: 'var(--pem-text)' }}>Link Ticker for Live Analysis</p>
                                    <p style={{ fontSize: '12px', marginBottom: '20px' }}>Enter a Yahoo Finance symbol (e.g. TCS.NS, NETF.NS) to enable rich graphs.</p>

                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                        <input
                                            type="text"
                                            placeholder="Symbol (e.g. NETF.NS)"
                                            value={newTicker}
                                            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--pem-border)', backgroundColor: 'var(--pem-surface-raised)', color: 'var(--pem-text)', outline: 'none', width: '200px', fontWeight: 'bold' }}
                                        />
                                        <button
                                            onClick={handleLinkTicker}
                                            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: 'var(--pem-text)', fontWeight: 'bold', cursor: 'pointer' }}
                                        >
                                            Link
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Range Selectors */}
                                    <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--pem-surface-raised)', padding: '5px', borderRadius: '12px', width: 'fit-content' }}>
                                        {['1mo', '3mo', '6mo', '1y', '5y'].map(r => (
                                            <button
                                                key={r}
                                                onClick={() => setChartRange(r)}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    backgroundColor: chartRange === r ? '#3b82f6' : 'transparent',
                                                    color: chartRange === r ? 'white' : '#94a3b8',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    textTransform: 'uppercase'
                                                }}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Chart */}
                                    <div style={{ backgroundColor: 'var(--pem-surface)', padding: '20px', borderRadius: '20px', height: '300px', position: 'relative' }}>
                                        {marketLoading && (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 10 }}>
                                                Loading Chart...
                                            </div>
                                        )}
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 500, height: 250 }}>
                                            <AreaChart data={marketHistory}>
                                                <defs>
                                                    <linearGradient id="colorMarket" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis
                                                    dataKey="date"
                                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                                    tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    minTickGap={30}
                                                />
                                                <YAxis
                                                    domain={['auto', 'auto']}
                                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                                    tickFormatter={(v) => `${symbolMap[user?.currency] || '$'}${v}`}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: 'var(--pem-surface-raised)', border: 'none', borderRadius: '8px' }}
                                                    itemStyle={{ color: '#c4b5fd' }}
                                                    labelFormatter={(l) => new Date(l).toLocaleDateString()}
                                                    formatter={(value) => [`${symbolMap[user?.currency] || '$'}${Number(value).toFixed(2)}`, 'Market Price']}
                                                />
                                                <Area type="monotone" dataKey="close" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMarket)" strokeWidth={2} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Insights */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <div style={{ backgroundColor: 'var(--pem-surface-raised)', padding: '15px', borderRadius: '12px' }}>
                                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>YOUR AVG PRICE</span>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--pem-text)', marginTop: '4px' }}>
                                                {formatCurrency(investment.unitsHeld > 0 ? investment.totalInvested / investment.unitsHeld : 0)}
                                            </div>
                                        </div>
                                        <div style={{ backgroundColor: 'var(--pem-surface-raised)', padding: '15px', borderRadius: '12px' }}>
                                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>LAST CLOSE</span>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#c4b5fd', marginTop: '4px' }}>
                                                {marketHistory.length > 0 ? formatCurrency(marketHistory[marketHistory.length - 1].close) : '-'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Alpha Vantage Enhanced Analytics */}
                                    {alphaLoading ? (
                                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                            <Activity size={32} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                                            <p>Loading enhanced analytics...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <FundamentalsCard data={fundamentals} theme={theme} isDarkMode={isDarkMode} currencyCode={user?.currency} />
                                            <TechnicalIndicatorsWidget rsiData={technicals} theme={theme} isDarkMode={isDarkMode} />
                                            <CompanyNewsWidget news={news} theme={theme} isDarkMode={isDarkMode} />
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'add_txn' && (
                        <form onSubmit={handleTransactionSubmit} style={{ backgroundColor: 'var(--pem-surface)', padding: '25px', borderRadius: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}>TYPE</label>
                                    <select value={txnForm.type} onChange={e => setTxnForm({ ...txnForm, type: e.target.value })} style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-surface-raised)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)' }}>
                                        <option value="BUY">BUY (+ Invested)</option>
                                        <option value="SELL">SELL (Realize)</option>
                                        <option value="SIP">SIP</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}>DATE</label>
                                    <input type="date" value={txnForm.date} onChange={e => setTxnForm({ ...txnForm, date: e.target.value })} style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-surface-raised)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)' }} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}>AMOUNT ({symbolMap[user?.currency] || '$'})</label>
                                    <input type="number" required value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })} style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-surface-raised)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)', fontWeight: 'bold' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}>UNITS / QTY</label>
                                    <input type="number" step="0.0001" value={txnForm.units} onChange={e => setTxnForm({ ...txnForm, units: e.target.value })} style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-surface-raised)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)' }} />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} style={{ width: '100%', backgroundColor: txnForm.type === 'SELL' ? '#ef4444' : '#3b82f6', color: 'var(--pem-text)', padding: '15px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                                {loading ? 'Processing...' : `Confirm ${txnForm.type} Transaction`}
                            </button>
                        </form>
                    )}

                    {activeTab === 'history' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {transactions.length === 0 ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No transactions found</div> :
                                transactions.map(txn => (
                                    <div key={txn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: 'var(--pem-surface-raised)', borderRadius: '16px', borderLeft: `4px solid ${txn.type === 'SELL' ? '#ef4444' : '#10b981'}` }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: 'var(--pem-text)', marginBottom: '4px' }}>{txn.type}</div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(txn.date).toLocaleDateString()}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--pem-text)', marginBottom: '4px' }}>{formatCurrency(txn.amount)}</div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{txn.units} Units</div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}

                </div>
            </motion.div >
        </div >
    );
};

export default InvestmentDetailModal;
