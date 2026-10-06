import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import Toast from '../components/ui/Toast';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// Subtle Web Audio synthesizer for tactile notification chimes
function playChime(type) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === 'error') {
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(180, now + 0.16);
        } else if (type === 'financial' || type === 'success') {
            osc.frequency.setValueAtTime(560, now);
            osc.frequency.exponentialRampToValueAtTime(840, now + 0.16);
        } else {
            osc.frequency.setValueAtTime(460, now);
            osc.frequency.exponentialRampToValueAtTime(620, now + 0.14);
        }

        gain.gain.setValueAtTime(0.04, now); // Soft, non-intrusive volume
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

        osc.start(now);
        osc.stop(now + 0.2);
        setTimeout(() => ctx.close().catch(() => {}), 280);
    } catch {
        // Safe fallback if audio context blocked or unprompted
    }
}

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setToasts([]);
    }, []);

    const addToast = useCallback((messageOrConfig, type = 'info', duration = 4000, options = {}) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        let config = {};
        if (typeof messageOrConfig === 'string') {
            config = {
                id,
                message: messageOrConfig,
                type: typeof type === 'string' ? type : 'info',
                duration: typeof duration === 'number' ? duration : 4000,
                ...options
            };
        } else if (messageOrConfig && typeof messageOrConfig === 'object') {
            config = {
                id,
                type: 'info',
                duration: 4000,
                ...messageOrConfig
            };
        }

        if (config.sound !== false) {
            playChime(config.type);
        }

        setToasts((prev) => {
            // Keep at most 4 floating toasts simultaneously to prevent screen clutter
            const next = [config, ...prev];
            return next.slice(0, 4);
        });

        return id;
    }, []);

    // Extended convenience helpers
    const toast = useMemo(() => {
        const fn = (config) => addToast(config);
        fn.success = (msg, opts = {}) => addToast(msg, 'success', opts.duration || 4000, opts);
        fn.error = (msg, opts = {}) => addToast(msg, 'error', opts.duration || 5000, opts);
        fn.warning = (msg, opts = {}) => addToast(msg, 'warning', opts.duration || 4500, opts);
        fn.info = (msg, opts = {}) => addToast(msg, 'info', opts.duration || 4000, opts);
        fn.financial = (msg, opts = {}) => addToast(msg, 'financial', opts.duration || 4500, opts);
        fn.dismiss = removeToast;
        fn.clear = clearAll;
        return fn;
    }, [addToast, removeToast, clearAll]);

    // Backwards compatibility aliases
    const showToast = addToast;
    const notify = addToast;

    return (
        <ToastContext.Provider
            value={{
                toast,
                addToast,
                showToast,
                notify,
                removeToast,
                clearAll,
                toasts
            }}
        >
            {children}

            {/* Floating Top-Center Dynamic Island / Toast Portal */}
            <div
                aria-live="polite"
                aria-atomic="true"
                className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none flex w-full max-w-md flex-col items-center gap-2.5 px-4"
            >
                <AnimatePresence mode="popLayout">
                    {toasts.map((item) => (
                        <Toast
                            key={item.id}
                            {...item}
                            onClose={() => removeToast(item.id)}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

export default ToastProvider;
