import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, MessageSquare, Calendar, CreditCard, Tag, User, Smartphone, Clock, FileText } from 'lucide-react';

const buildInitialFormData = (data) => {
    if (!data) return null;

    let initialDate = '';
    const sourceDate = data.received_at || data.date || new Date().toISOString();

    try {
        const dateObj = new Date(sourceDate);
        const offset = dateObj.getTimezoneOffset() * 60000;
        initialDate = (new Date(dateObj - offset)).toISOString().slice(0, 16);
    } catch {
        initialDate = new Date().toISOString().slice(0, 16);
    }

    // Detect transaction type from multiple sources
    let transactionType = data.transaction_type;
    if (!transactionType) {
        if (data.type && typeof data.type === 'string') {
            const typeStr = data.type.toLowerCase();
            if (typeStr.includes('debit') || typeStr.includes('expense') || typeStr.includes('sent') || typeStr.includes('spent') || typeStr.includes('paid')) transactionType = 'debit';
            else if (typeStr.includes('credit') || typeStr.includes('income') || typeStr.includes('received')) transactionType = 'credit';
        }
    }
    // Default to debit if still not set
    if (!transactionType) transactionType = 'debit';

    return {
        ...data,
        date: initialDate,
        transaction_type: transactionType,
        merchant: data.merchant || data.provider || data.description || 'Unknown',
        paymentMethod: data.paymentMethod || data.mode || (data.extractor === 'ml_bert_ner' ? 'Transfer' : 'Card')
    };
};

const AutomationDetailsModal = ({ isOpen, onClose, data, onSave, categories = [], user }) => {
    const [formData, setFormData] = useState(() => buildInitialFormData(data));

    // Sync the editable form state when the opened record changes. This modal is mounted
    // by parents in other files, so it cannot be remounted via a `key` prop from here.
    useEffect(() => {
        if (isOpen && data) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData(buildInitialFormData(data));
        }
    }, [isOpen, data]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (!isOpen || !formData) return null;

    const isManualEntry = formData.source === 'MANUAL_ENTRY' || formData.type === 'MANUAL';
    const currentType = formData.transaction_type === 'credit' ? 'income' : 'expense';
    const safeCategories = Array.isArray(categories) ? categories : [];
    const availableCategories = safeCategories.filter(c => c.type === currentType || c.type === 'both');
    const currencySymbol = (formData.currency === 'INR' || user?.currency === 'INR') ? '₹' : '$';

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} />

            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.15 }}
                style={{
                    width: '100%',
                    maxWidth: '550px',
                    backgroundColor: '#1e293b',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
                    overflow: 'hidden',
                    position: 'relative',
                    zIndex: 10
                }}>

                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                {isManualEntry ? <Smartphone size={20} color="#8b5cf6" /> : <MessageSquare size={20} color="#3b82f6" />}
                                <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '800', margin: 0 }}>
                                    {isManualEntry ? 'Manual Entry' : 'SMS Transaction'}
                                </h2>
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                                Review and confirm details
                            </p>
                        </div>
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s' }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
                            onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>

                    {/* Type Toggle */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
                            {['debit', 'credit'].map(t => (
                                <button key={t} onClick={() => {
                                    handleChange('transaction_type', t);
                                    const newType = t === 'credit' ? 'income' : 'expense';
                                    const firstCat = safeCategories.filter(c => c.type === newType || c.type === 'both')[0];
                                    if (firstCat) handleChange('category', firstCat.name);
                                }} style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', border: 'none', fontWeight: '700', textTransform: 'uppercase', fontSize: '12px',
                                    backgroundColor: formData.transaction_type === t ? (t === 'debit' ? '#ef4444' : '#10b981') : 'transparent',
                                    color: formData.transaction_type === t ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s'
                                }}>
                                    {t === 'debit' ? '💸 Expense' : '💰 Income'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Amount - Large and Prominent */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '8px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '22px', top: '50%', transform: 'translateY(-50%)', color: '#10b981', fontSize: '28px', fontWeight: '900' }}>{currencySymbol}</span>
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                                style={{
                                    width: '100%',
                                    padding: '18px 18px 18px 52px',
                                    fontSize: '32px',
                                    fontWeight: '900',
                                    borderRadius: '14px',
                                    border: '2px solid rgba(16,185,129,0.3)',
                                    backgroundColor: 'rgba(16,185,129,0.05)',
                                    color: '#10b981',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    {/* Merchant & Category - Compact Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Merchant</label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type="text"
                                    value={formData.merchant}
                                    onChange={(e) => handleChange('merchant', e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 36px', fontSize: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</label>
                            <div style={{ position: 'relative' }}>
                                <Tag size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 1 }} />
                                <select
                                    value={formData.category}
                                    onChange={(e) => handleChange('category', e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 36px', fontSize: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', appearance: 'none', boxSizing: 'border-box' }}
                                >
                                    {!availableCategories.find(c => c.name === formData.category) && (
                                        <option value={formData.category}>{formData.category}</option>
                                    )}
                                    {availableCategories.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Date & Payment Mode - Compact Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date & Time</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type="datetime-local"
                                    value={formData.date}
                                    onChange={(e) => handleChange('date', e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 36px', fontSize: '13px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment</label>
                            <div style={{ position: 'relative' }}>
                                <CreditCard size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type="text"
                                    value={formData.paymentMethod}
                                    onChange={(e) => handleChange('paymentMethod', e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 36px', fontSize: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Source Info - Compact Badge */}
                    <div style={{ padding: '12px 16px', backgroundColor: isManualEntry ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)', borderRadius: '10px', border: `1px solid ${isManualEntry ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <FileText size={14} color={isManualEntry ? '#8b5cf6' : '#3b82f6'} />
                            <span style={{ fontSize: '11px', fontWeight: '700', color: isManualEntry ? '#8b5cf6' : '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {isManualEntry ? 'App Entry' : 'SMS Parsed'}
                            </span>
                        </div>
                        {/* Show full raw message if available, otherwise description */}
                        {(formData.raw_message || formData.description) && (
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: '1.5', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {formData.raw_message || formData.description}
                            </p>
                        )}
                        {formData.received_at && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <Clock size={12} color="#64748b" />
                                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                                    {new Date(formData.received_at).toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'rgba(0,0,0,0.2)' }}>
                    <button onClick={onClose} style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: '#94a3b8', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}>
                        Cancel
                    </button>
                    <button onClick={() => onSave(formData)} style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
                        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}>
                        <Check size={16} /> Confirm & Save
                    </button>
                </div>

            </motion.div>
        </div>
    );
};

export default AutomationDetailsModal;
