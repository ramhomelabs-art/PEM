import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, TrendingUp, Shield, Grid, Layers, DollarSign } from 'lucide-react';
import { API_URL } from '../../config';

const InvestmentForm = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: '',
        category: 'Market', // Default
        subCategory: 'Equity',
        provider: '',
        accountNumber: '',
        initialAmount: '',
        initialDate: new Date().toISOString().split('T')[0],
        units: '',
        currentPrice: '', // For manual init
        ticker: '' // Market Symbol
    });
    const [loading, setLoading] = useState(false);

    const categories = {
        'Market': {
            icon: TrendingUp,
            color: '#10b981',
            subs: ['Equity', 'Mutual Funds', 'Index Funds', 'ETFs', 'Bonds']
        },
        'Fixed': {
            icon: Shield,
            color: '#3b82f6',
            subs: ['Fixed Deposit', 'Recurring Deposit', 'PPF', 'EPF', 'NPS', 'SGB']
        },
        'Alternative': {
            icon: Layers,
            color: '#f59e0b',
            subs: ['Gold (Physical)', 'Real Estate', 'Crypto', 'P2P Lending', 'Startup']
        },
        'Insurance': {
            icon: Shield, // Reusing shield roughly
            color: '#ef4444',
            subs: ['ULIP', 'Endowment', 'LIC']
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const initialAmount = parseFloat(formData.initialAmount) || 0;
            const units = parseFloat(formData.units) || 0;
            const pricePerUnit = parseFloat(formData.currentPrice) || (units > 0 && initialAmount > 0 ? initialAmount / units : 0);

            const payload = {
                ...formData,
                initialAmount,
                initialUnits: units,
                initialPricePerUnit: pricePerUnit,
                units,
                currentPrice: pricePerUnit
            };

            const res = await fetch(`${API_URL}/investments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                if (onSuccess) onSuccess();
                if (onClose) onClose();
                setFormData({
                    name: '',
                    category: 'Market',
                    subCategory: 'Equity',
                    provider: '',
                    accountNumber: '',
                    initialAmount: '',
                    initialDate: new Date().toISOString().split('T')[0],
                    units: '',
                    currentPrice: '',
                    ticker: ''
                });
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || errData.message || "Failed to add investment");
            }
        } catch (err) {
            console.error(err);
            alert("Error adding investment");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const ActiveIcon = categories[formData.category].icon;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{ backgroundColor: 'var(--pem-surface)', border: '1px solid var(--pem-border)', borderRadius: '24px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--pem-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        Add New Investment
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--pem-text-secondary)', cursor: 'pointer' }}><X /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Category Selection */}
                    <div>
                        <label style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>ASSET CLASS</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            {Object.entries(categories).map(([key, val]) => {
                                const Icon = val.icon;
                                const isSelected = formData.category === key;
                                return (
                                    <div
                                        key={key}
                                        onClick={() => setFormData({ ...formData, category: key, subCategory: val.subs[0] })}
                                        style={{
                                            backgroundColor: isSelected ? val.color : 'var(--pem-surface-raised)',
                                            border: `1px solid ${isSelected ? val.color : 'var(--pem-border)'}`,
                                            borderRadius: '16px',
                                            padding: '15px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Icon color={isSelected ? 'white' : 'var(--pem-text-secondary)'} />
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: isSelected ? 'white' : 'var(--pem-text-secondary)' }}>{key}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                        <div>
                            <label style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: 'bold' }}>INVESTMENT NAME</label>
                            <input
                                required
                                type="text"
                                placeholder="e.g. HDFC Bank, SGB 2024"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-bg-sunken)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)', marginTop: '5px' }}
                            />
                        </div>
                        <div>
                            <label style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: 'bold' }}>SUB-CATEGORY</label>
                            <select
                                value={formData.subCategory}
                                onChange={e => setFormData({ ...formData, subCategory: e.target.value })}
                                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-bg-sunken)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)', marginTop: '5px' }}
                            >
                                {categories[formData.category].subs.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {formData.category === 'Market' && (
                        <div>
                            <label style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: 'bold' }}>TICKER / SYMBOL (Optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. RELIANCE.NS, NETF.NS"
                                value={formData.ticker}
                                onChange={e => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-bg-sunken)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: '#fbbf24', marginTop: '5px', fontWeight: 'bold' }}
                            />
                            <p style={{ margin: '5px 0 0 0', fontSize: '10px', color: 'var(--pem-text-secondary)' }}>Enter Yahoo Finance symbol for live updates (e.g. TCS.NS)</p>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                        <div>
                            <label style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: 'bold' }}>PROVIDER / BROKER</label>
                            <input
                                type="text"
                                placeholder="e.g. Zerodha, SBI"
                                value={formData.provider}
                                onChange={e => setFormData({ ...formData, provider: e.target.value })}
                                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-bg-sunken)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)', marginTop: '5px' }}
                            />
                        </div>
                        <div>
                            <label style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: 'bold' }}>ACCOUNT / FOLIO NO</label>
                            <input
                                type="text"
                                placeholder="Optional"
                                value={formData.accountNumber}
                                onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-bg-sunken)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)', marginTop: '5px' }}
                            />
                        </div>
                    </div>

                    {/* Financials */}
                    <div style={{ backgroundColor: 'var(--pem-surface-raised)', padding: '20px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <DollarSign size={16} color="#10b981" />
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>Initial Investment Details</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: 'bold' }}>INITIAL AMOUNT</label>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    placeholder="0.00"
                                    value={formData.initialAmount}
                                    onChange={e => setFormData({ ...formData, initialAmount: e.target.value })}
                                    style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-bg-sunken)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)', marginTop: '5px', fontWeight: 'bold', fontSize: '16px' }}
                                />
                            </div>
                            <div>
                                <label style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: 'bold' }}>DATE OF INVESTMENT</label>
                                <input
                                    type="date"
                                    value={formData.initialDate}
                                    onChange={e => setFormData({ ...formData, initialDate: e.target.value })}
                                    style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-bg-sunken)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)', marginTop: '5px' }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: 'bold' }}>UNITS / QUANTITY (Optional)</label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder="e.g. 10"
                                    value={formData.units}
                                    onChange={e => setFormData({ ...formData, units: e.target.value })}
                                    style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-bg-sunken)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)', marginTop: '5px' }}
                                />
                            </div>
                            <div>
                                <label style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: 'bold' }}>PRICE PER UNIT (Optional)</label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder="e.g. 250.00"
                                    value={formData.currentPrice}
                                    onChange={e => setFormData({ ...formData, currentPrice: e.target.value })}
                                    style={{ width: '100%', padding: '12px', backgroundColor: 'var(--pem-bg-sunken)', border: '1px solid var(--pem-border)', borderRadius: '12px', color: 'var(--pem-text)', marginTop: '5px' }}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        disabled={loading}
                        style={{
                            backgroundColor: categories[formData.category].color,
                            color: 'white',
                            border: 'none',
                            padding: '16px',
                            borderRadius: '16px',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            marginTop: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}
                    >
                        {loading ? 'Processing...' : <><Save size={20} /> Create Investment Portfolio</>}
                    </button>

                </form>
            </motion.div>
        </div>
    );
};

export default InvestmentForm;
