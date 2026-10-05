import React, { useState } from 'react';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { API_URL } from '../../config';
import { Lock, Unlock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SecurityLock = ({ onUnlock }) => {
    const { theme } = useTheme();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleUnlock = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/auth/verify-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                onUnlock();
            } else {
                setError(data.error || 'Incorrect password');
            }
        } catch {
            setError('Verification failed. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.55)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '24px'
        }}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 180 }}
                style={{
                    backgroundColor: theme.card,
                    padding: '40px',
                    borderRadius: '24px',
                    border: `1px solid ${theme.border}`,
                    width: '100%',
                    maxWidth: '400px',
                    textAlign: 'center',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                <div style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px auto'
                }}>
                    <Lock size={40} color={theme.accent} />
                </div>

                <h2 style={{ fontSize: '24px', fontWeight: '900', color: theme.text, marginBottom: '10px' }}>Security Check</h2>
                <p style={{ color: theme.textSecondary, marginBottom: '30px' }}>Please enter your password to view sensitive card details.</p>

                <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ position: 'relative', width: '100%', marginBottom: '5px' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: theme.accent }} />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            style={{
                                width: '100%',
                                padding: '15px 48px 15px 48px',
                                backgroundColor: theme.inputBg,
                                border: `1px solid ${error ? '#ef4444' : theme.border}`,
                                borderRadius: '12px',
                                color: theme.text,
                                outline: 'none',
                                fontSize: '16px',
                                fontWeight: '700',
                                boxSizing: 'border-box'
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '16px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: theme.textSecondary,
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '14px', marginBottom: '15px', justifyContent: 'center' }}
                            >
                                <AlertCircle size={16} /> {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        type="submit"
                        disabled={loading || !password}
                        style={{
                            width: '100%',
                            padding: '15px',
                            backgroundColor: theme.accent,
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: '900',
                            cursor: loading || !password ? 'not-allowed' : 'pointer',
                            opacity: loading || !password ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}
                    >
                        {loading ? 'Verifying...' : <><Unlock size={20} /> UNLOCK</>}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default SecurityLock;

