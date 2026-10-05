import { motion } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

// Auto-dismiss is owned by ToastContext, so `duration` is accepted for API
// compatibility but intentionally not used here.
const Toast = ({ message, type = 'info', onClose }) => {
    const getStyles = () => {
        switch (type) {
            case 'success': return { bg: '#10b981', icon: CheckCircle };
            case 'error': return { bg: '#ef4444', icon: AlertCircle };
            case 'warning': return { bg: '#f59e0b', icon: AlertTriangle };
            default: return { bg: '#3b82f6', icon: Info };
        }
    };

    const { bg, icon: Icon } = getStyles();

    return (
        <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            layout
            style={{
                backgroundColor: 'white', // Theme-aware later? For now clean white/dark
                color: '#1e293b',
                padding: '12px 16px',
                borderRadius: '12px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minWidth: '300px',
                maxWidth: '400px',
                borderLeft: `6px solid ${bg}`,
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: `${bg}20` }}>
                <Icon size={20} color={bg} />
            </div>

            <span style={{ fontSize: '14px', fontWeight: '500', flex: 1 }}>{message}</span>

            <button onClick={onClose} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <X size={16} />
            </button>
        </motion.div>
    );
};

export default Toast;
