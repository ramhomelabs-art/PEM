import { useTheme } from '../../context/personal_expense/ThemeContext';
import { AlertCircle } from 'lucide-react';

const ConfirmDialog = ({ isOpen, onConfirm, onCancel, title, message }) => {
    const { theme } = useTheme();

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(8px)'
            }}
            onClick={onCancel}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: theme.sidebar,
                    padding: '30px',
                    borderRadius: '20px',
                    width: '100%',
                    maxWidth: '450px',
                    border: `1px solid ${theme.border}`,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(239,68,68,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <AlertCircle size={24} color="#ef4444" />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: theme.text }}>
                        {title || 'Confirm Action'}
                    </h2>
                </div>

                <p style={{ color: theme.textSecondary, marginBottom: '25px', lineHeight: '1.6' }}>
                    {message || 'Are you sure you want to proceed?'}
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '12px',
                            backgroundColor: theme.card,
                            color: theme.text,
                            border: 'none',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '12px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;


