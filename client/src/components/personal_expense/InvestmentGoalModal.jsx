import React, { useState } from 'react';
import { X, Target, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';

const InvestmentGoalModal = ({ isOpen, onClose, onSuccess, goal }) => {
    const [formData, setFormData] = useState({
        name: '',
        targetAmount: '',
        targetDate: '',
        priority: 'Medium',
        color: '#3b82f6'
    });
    const [loading, setLoading] = useState(false);

    const [availableInvestments, setAvailableInvestments] = useState([]);
    const [selectedInvestmentIds, setSelectedInvestmentIds] = useState([]);

    React.useEffect(() => {
        // Fetch all investments to allow tagging
        const fetchInvestments = async () => {
            try {
                const res = await fetch(`${API_URL}/investments`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setAvailableInvestments(data);
                }
            } catch (err) {
                console.error("Failed to fetch investments", err);
            }
        };
        fetchInvestments();
    }, [isOpen]);

    React.useEffect(() => {
        if (goal) {
            setFormData({
                name: goal.name,
                targetAmount: goal.targetAmount,
                targetDate: goal.targetDate,
                priority: goal.priority || 'Medium',
                color: goal.color || '#3b82f6'
            });
            // Pre-select investments linked to this goal
            // We need to wait for availableInvestments to be loaded or just trust the goal prop if it has investments
            // Better to rely on availableInvestments matching goalId
        } else {
            setFormData({ name: '', targetAmount: '', targetDate: '', priority: 'Medium', color: '#3b82f6' });
            setSelectedInvestmentIds([]);
        }
    }, [goal, isOpen]);

    // Update selected IDs once investments are loaded and we have a goal
    React.useEffect(() => {
        if (goal && availableInvestments.length > 0) {
            const linked = availableInvestments.filter(inv => inv.goalId === goal.id).map(inv => inv.id);
            setSelectedInvestmentIds(linked);
        }
    }, [goal, availableInvestments]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const method = goal ? 'PUT' : 'POST';
            const url = `${API_URL}/investments/goals${goal ? `/${goal.id}` : ''}`;

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    targetAmount: parseFloat(formData.targetAmount) || 0,
                    investmentIds: selectedInvestmentIds
                })
            });
            if (res.ok) {
                if (onSuccess) onSuccess();
                if (onClose) onClose();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || `Failed to ${goal ? 'update' : 'create'} goal`);
            }
        } catch (err) {
            console.error(err);
            alert(`Error ${goal ? 'updating' : 'creating'} goal: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteGoal = async () => {
        // Removed window.confirm
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/investments/goals/${goal.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert('Failed to delete goal');
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting goal');
        }
        setLoading(false);
    };

    const toggleInvestment = (id) => {
        if (selectedInvestmentIds.includes(id)) {
            setSelectedInvestmentIds(prev => prev.filter(i => i !== id));
        } else {
            setSelectedInvestmentIds(prev => [...prev, id]);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                zIndex: 9999,
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '500px',
                    backgroundColor: '#1e293b',
                    borderRadius: '24px',
                    padding: '30px',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    maxHeight: '90vh',
                    overflowY: 'auto'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                        <Target color="#f472b6" /> {goal ? 'Edit Goal' : 'Set New Goal'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px', fontSize: '14px' }}>Goal Name</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Retirement, New Car"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px', fontSize: '14px' }}>Target Amount (₹)</label>
                            <input
                                type="number"
                                required
                                placeholder="500000"
                                value={formData.targetAmount}
                                onChange={e => setFormData({ ...formData, targetAmount: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px', fontSize: '14px' }}>Target Date</label>
                            <input
                                type="date"
                                required
                                value={formData.targetDate}
                                onChange={e => setFormData({ ...formData, targetDate: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px', fontSize: '14px' }}>Priority</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {['Low', 'Medium', 'High'].map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, priority: p })}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                        backgroundColor: formData.priority === p ? (p === 'High' ? '#ef4444' : p === 'Medium' ? '#eab308' : '#3b82f6') : '#334155',
                                        color: 'white', fontWeight: 'bold'
                                    }}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Investment Tagging Section */}
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px', fontSize: '14px' }}>Tag Investments (Source of Funds)</label>
                        <div style={{ maxHeight: '150px', overflowY: 'auto', backgroundColor: '#0f172a', borderRadius: '12px', padding: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {availableInvestments.length === 0 ? <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center' }}>No investments available.</p> :
                                availableInvestments.map(inv => (
                                    <div key={inv.id} onClick={() => toggleInvestment(inv.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', cursor: 'pointer', borderRadius: '8px', backgroundColor: selectedInvestmentIds.includes(inv.id) ? 'rgba(59, 130, 246, 0.2)' : 'transparent' }}>
                                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: selectedInvestmentIds.includes(inv.id) ? 'none' : '2px solid #64748b', backgroundColor: selectedInvestmentIds.includes(inv.id) ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {selectedInvestmentIds.includes(inv.id) && <X size={12} color="white" style={{ transform: 'rotate(45deg)' }} />}
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '13px', color: 'white', fontWeight: 'bold' }}>{inv.name}</p>
                                            <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>{inv.category} • ₹{Number(inv.currentValue).toLocaleString()}</p>
                                        </div>
                                        {inv.goalId && inv.goalId !== goal?.id && (
                                            <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                Linked to other goal
                                            </span>
                                        )}
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        {goal && (
                            <button
                                type="button"
                                onClick={handleDeleteGoal}
                                disabled={loading}
                                style={{
                                    flex: 1, marginTop: '10px', padding: '15px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                                    fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
                                    opacity: loading ? 0.7 : 1
                                }}
                            >
                                {loading ? 'Deleting...' : 'Delete Goal'}
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                flex: 2, marginTop: '10px', padding: '15px', borderRadius: '16px', border: 'none',
                                background: 'linear-gradient(to right, #ec4899, #8b5cf6)', color: 'white',
                                fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            {loading ? 'Saving Goal...' : goal ? 'Update Goal' : 'Create Goal'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default InvestmentGoalModal;
