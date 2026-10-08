import { notifyDataChanged } from '../../utils/realtimeSync';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCategories } from '../../context/CategoryContext'; // Import context
import { API_URL } from '../../config';
import { X, Check, Plus, Coffee, ArrowRight, ShoppingBag, Heart, Zap, Film, TrendingUp, ReceiptText, Briefcase, CircleDollarSign, Gift, Building, BarChart, Smartphone, AlertTriangle } from 'lucide-react';

export const categoryIcons = {
    // Expense
    'Food': Coffee,
    'Travel': ArrowRight,
    'Shopping': ShoppingBag,
    'Medical': Heart,
    'Utility': Zap,
    'Entertainment': Film,
    'General': ReceiptText,
    // Income
    'Salary': Briefcase,
    'Freelance': Smartphone, // Reusing Smartphone for tech/freelance
    'Investment': BarChart,
    'Business': Building,
    'Gift': Gift,
    'Other': CircleDollarSign
};

const TransactionModal = ({ isOpen, onClose, user, logout, onReload, mode = 'add', editData = null }) => {
    const defaultState = {
        type: 'expense',
        amount: '',
        category: 'General',
        description: '',
        paymentMode: 'Cash',
        otherPaymentMode: ''
    };
    const [formData, setFormData] = useState(defaultState);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [hasChanged, setHasChanged] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [budgetExceeded, setBudgetExceeded] = useState(null);
    const [budgets, setBudgets] = useState([]);
    const [monthlySpent, setMonthlySpent] = useState({});
    const { categories } = useCategories();

    const availableCategories = categories
        .filter(c => c.type === formData.type || c.type === 'both')
        .map(c => c.name);

    const fetchBudgetsAndSpending = useCallback(async () => {
        try {
            const [bRes, tRes] = await Promise.all([
                fetch(`${API_URL}/budgets/user/${user.id}`),
                fetch(`${API_URL}/transactions/user/${user.id}`)
            ]);

            if (bRes.ok && tRes.ok) {
                const bData = await bRes.json();
                const tData = await tRes.json();
                setBudgets(Array.isArray(bData) ? bData : []);

                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                const spending = {};
                if (Array.isArray(tData)) {
                    tData.forEach(t => {
                        const tDate = new Date(t.date);
                        if (t.type === 'expense' && tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
                            spending[t.category] = (spending[t.category] || 0) + Number(t.amount);
                        }
                    });
                }
                setMonthlySpent(spending);
            }
        } catch (err) {
            console.error(err);
        }
    }, [user]);

    useEffect(() => {
        if (isOpen && user?.id) {
            fetchBudgetsAndSpending();
            if (mode === 'edit' && editData) {
                setFormData({
                    type: editData.type,
                    amount: editData.amount.toString(),
                    category: editData.category,
                    description: editData.description,
                    paymentMode: editData.paymentMode,
                    otherPaymentMode: editData.otherPaymentMode || ''
                });
            } else {
                setFormData(defaultState);
            }
            setSuccess(false);
            setHasChanged(false);
            setShowWarning(false);
            setBudgetExceeded(null);
        }
        // defaultState is a fresh object literal on every render; depending on it would
        // re-run this effect endlessly since the effect resets formData.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, mode, editData, user, fetchBudgetsAndSpending]);

    const handleClose = () => {
        if (hasChanged) onReload();
        onClose();
    };

    const handleAddMore = () => {
        setFormData(defaultState);
        setSuccess(false);
    };

    const handleFinish = () => {
        setSuccess(false);
        if (hasChanged) onReload();
        onClose();
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        // Budget Check
        if (formData.type === 'expense' && !showWarning) {
            const budget = budgets.find(b => b.category === formData.category);
            if (budget) {
                const currentSpent = monthlySpent[formData.category] || 0;
                const newAmount = Number(formData.amount);
                // If editing, subtract old amount first (simplified check)
                const projected = currentSpent + newAmount;

                if (projected > budget.amountLimit) {
                    setBudgetExceeded({ limit: budget.amountLimit, current: currentSpent, projected });
                    setShowWarning(true);
                    return;
                }
            }
        }

        setLoading(true);
        try {
            const url = mode === 'edit'
                ? `${API_URL}/transactions/manual/${editData.id}`
                : `${API_URL}/transactions/manual`;

            const method = mode === 'edit' ? 'PUT' : 'POST';

            // Construct date with current time to preserve local day
            const submitDate = new Date(formData.date);
            const now = new Date();
            submitDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, userId: user.id, date: submitDate })
            });

            if (res.ok) {
                setSuccess(true);
                setHasChanged(true);
                setShowWarning(false); // Reset warning on success
                if (mode === 'edit') {
                    setTimeout(() => handleFinish(), 1500);
                }
            } else {
                const errorData = await res.json();
                if (errorData.error && errorData.error.includes("User session is invalid")) {
                    alert("Your session has expired. Please log out.");
                    logout();
                    return;
                }
                alert(`Failed: ${errorData.error}`);
            }
        } catch (err) {
            alert("Network error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)', zIndex: 10 }} />
                    <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%', maxWidth: '500px', backgroundColor: '#0f172a', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)', padding: '40px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', zIndex: 20
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                            <div>
                                <h2 style={{ fontSize: '28px', fontWeight: '900', color: 'white', margin: 0 }}>
                                    {mode === 'edit' ? 'Edit Entry' : 'Add Entry'}
                                </h2>
                                <p style={{ color: '#10b981', fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px' }}>V 5.0 CORE</p>
                            </div>
                            <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        {success && mode === 'add' ? (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '20px 0' }}>
                                <div style={{ width: '80px', height: '80px', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                    <Check size={40} color="#10b981" />
                                </div>
                                <h3 style={{ color: 'white', fontSize: '24px', fontWeight: '900', marginBottom: '10px' }}>Transaction Added</h3>
                                <p style={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '30px' }}>Your records have been synchronized.</p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <button onClick={handleAddMore} style={{ padding: '18px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '14px', letterSpacing: '1px', cursor: 'pointer' }}>
                                        DO YOU WANT TO ADD MORE?
                                    </button>
                                    <button onClick={handleFinish} style={{ padding: '18px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '14px', letterSpacing: '1px', cursor: 'pointer' }}>
                                        FINISH & CLOSE
                                    </button>
                                </div>
                            </motion.div>
                        ) : showWarning ? (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '20px 0' }}>
                                <div style={{ width: '80px', height: '80px', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                    <AlertTriangle size={40} color="#ef4444" />
                                </div>
                                <h3 style={{ color: 'white', fontSize: '24px', fontWeight: '900', marginBottom: '10px' }}>Budget Limit Exceeded!</h3>
                                <p style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: '30px' }}>
                                    This transaction will exceed your monthly budget for {formData.category}.
                                    <br /><br />
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                        Limit: {budgetExceeded?.limit} • Predicted: {budgetExceeded?.projected}
                                    </span>
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <button onClick={handleSubmit} style={{ padding: '18px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '14px', letterSpacing: '1px', cursor: 'pointer' }}>
                                        YES, PROCEED ANYWAY
                                    </button>
                                    <button onClick={() => setShowWarning(false)} style={{ padding: '18px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '14px', letterSpacing: '1px', cursor: 'pointer' }}>
                                        CANCEL & EDIT
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '4px' }}>
                                    {['expense', 'income'].map(t => (
                                        <button key={t} type="button" onClick={() => {
                                            const newType = t;
                                            const newCats = categories.filter(c => c.type === newType || c.type === 'both').map(c => c.name);
                                            setFormData(p => ({
                                                ...p,
                                                type: newType,
                                                category: newCats.length > 0 ? newCats[0] : (newType === 'expense' ? 'General' : 'Other')
                                            }));
                                        }} style={{
                                            flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: '900', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '1px', cursor: 'pointer',
                                            backgroundColor: formData.type === t ? (t === 'expense' ? '#f43f5e' : '#10b981') : 'transparent', color: formData.type === t ? 'white' : '#64748b', transition: 'all 0.2s'
                                        }}>{t}</button>
                                    ))}
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', fontSize: '24px', fontWeight: '900', color: '#10b981' }}>{user?.currency === 'INR' ? '₹' : '$'}</span>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9.]/g, '');
                                            setFormData(prev => ({ ...prev, amount: val }));
                                        }}
                                        required
                                        style={{
                                            width: '100%', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '20px 20px 20px 50px', fontSize: '32px', fontWeight: '900', color: 'white', outline: 'none', boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <select value={formData.category} onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))} style={{
                                        backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', color: 'white', fontWeight: '700', outline: 'none'
                                    }}>
                                        {availableCategories.length > 0 ? availableCategories.map(c => (
                                            <option key={c} value={c} style={{ backgroundColor: '#0f172a' }}>{c}</option>
                                        )) : (
                                            <option value="General">General</option>
                                        )}
                                    </select>

                                    <select value={formData.paymentMode} onChange={(e) => setFormData(p => ({ ...p, paymentMode: e.target.value }))} style={{
                                        backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', color: 'white', fontWeight: '700', outline: 'none'
                                    }}>
                                        <option value="Cash" style={{ backgroundColor: '#0f172a' }}>Cash</option>
                                        <option value="UPI" style={{ backgroundColor: '#0f172a' }}>UPI</option>
                                        <option value="NetBanking" style={{ backgroundColor: '#0f172a' }}>Net Banking</option>
                                        <option value="Other" style={{ backgroundColor: '#0f172a' }}>Other</option>
                                    </select>
                                </div>

                                {formData.paymentMode === 'Other' && (
                                    <motion.input
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        type="text"
                                        placeholder="Specify Method (e.g. Cheque, Barter)..."
                                        value={formData.otherPaymentMode}
                                        onChange={(e) => setFormData(p => ({ ...p, otherPaymentMode: e.target.value }))}
                                        required
                                        style={{
                                            width: '100%', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', color: 'white', fontWeight: '700', outline: 'none', boxSizing: 'border-box'
                                        }}
                                    />
                                )}

                                <input
                                    type="text"
                                    placeholder="Transaction Note..."
                                    value={formData.description}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({ ...prev, description: val }));
                                    }}
                                    style={{
                                        width: '100%', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', color: 'white', fontWeight: '700', outline: 'none', boxSizing: 'border-box'
                                    }}
                                />
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '20px',
                                        backgroundColor: success ? '#059669' : '#10b981',
                                        border: 'none',
                                        borderRadius: '20px',
                                        color: 'white',
                                        fontWeight: '900',
                                        fontSize: '16px',
                                        letterSpacing: '2px',
                                        cursor: 'pointer',
                                        marginTop: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        transition: 'all 0.3s'
                                    }}
                                >
                                    {loading ? 'SAVING...' : success ? <><Check size={20} /> SAVED</> : <><Plus size={20} /> CONFIRM ENTRY</>}
                                </motion.button>
                            </form>
                        )
                        }
                    </motion.div >
                </div >
            )}
        </AnimatePresence >
    );
};

export default TransactionModal;


