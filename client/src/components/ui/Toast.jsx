import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Info,
    Wallet,
    X,
    ExternalLink,
    BellRing
} from 'lucide-react';
import { useTheme } from '../../context/personal_expense/ThemeContext';

const TYPE_CONFIG = {
    success: {
        icon: CheckCircle2,
        accent: '#10b981',
        border: 'rgba(16, 185, 129, 0.4)',
        glow: 'rgba(16, 185, 129, 0.18)',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeText: '#34d399',
        defaultTitle: 'Success'
    },
    error: {
        icon: AlertCircle,
        accent: '#ef4444',
        border: 'rgba(239, 68, 68, 0.4)',
        glow: 'rgba(239, 68, 68, 0.18)',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
        badgeText: '#f87171',
        defaultTitle: 'Action Required'
    },
    warning: {
        icon: AlertTriangle,
        accent: '#f59e0b',
        border: 'rgba(245, 158, 11, 0.4)',
        glow: 'rgba(245, 158, 11, 0.18)',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        badgeText: '#fbbf24',
        defaultTitle: 'Attention'
    },
    financial: {
        icon: Wallet,
        accent: '#8b5cf6',
        border: 'rgba(139, 92, 246, 0.45)',
        glow: 'rgba(139, 92, 246, 0.22)',
        badgeBg: 'rgba(139, 92, 246, 0.15)',
        badgeText: '#a78bfa',
        defaultTitle: 'Finance Alert'
    },
    info: {
        icon: Info,
        accent: '#3b82f6',
        border: 'rgba(59, 130, 246, 0.4)',
        glow: 'rgba(59, 130, 246, 0.18)',
        badgeBg: 'rgba(59, 130, 246, 0.15)',
        badgeText: '#60a5fa',
        defaultTitle: 'Notification'
    }
};

const Toast = ({
    id,
    message,
    title,
    type = 'info',
    badge,
    action,
    duration = 4500,
    onClose
}) => {
    const { isDark } = useTheme() || { isDark: true };
    const [paused, setPaused] = useState(false);
    const [progress, setProgress] = useState(100);
    const startTimeRef = useRef(Date.now());
    const remainingTimeRef = useRef(duration);
    const timerRef = useRef(null);

    const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
    const Icon = config.icon;

    // Manage countdown timer with pause on hover
    useEffect(() => {
        if (duration <= 0) return;

        if (paused) {
            clearTimeout(timerRef.current);
            return;
        }

        startTimeRef.current = Date.now();
        const intervalStep = 25;
        const totalDuration = remainingTimeRef.current;

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const left = Math.max(0, totalDuration - elapsed);
            setProgress((left / duration) * 100);

            if (left <= 0) {
                clearInterval(interval);
                onClose?.();
            }
        }, intervalStep);

        timerRef.current = setTimeout(() => {
            clearInterval(interval);
            onClose?.();
        }, totalDuration);

        return () => {
            clearInterval(interval);
            clearTimeout(timerRef.current);
            remainingTimeRef.current -= Date.now() - startTimeRef.current;
        };
    }, [paused, duration, onClose]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -24, scale: 0.92, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, scale: 0.92, filter: 'blur(4px)', transition: { duration: 0.2 } }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => {
                if (info.offset.y < -25) {
                    onClose?.();
                }
            }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className={`group relative pointer-events-auto flex flex-col overflow-hidden rounded-2xl transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                isDark
                    ? 'bg-slate-900/90 text-slate-100 shadow-[0_20px_45px_-12px_rgba(0,0,0,0.85)]'
                    : 'bg-white/95 text-slate-800 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.22)]'
            }`}
            style={{
                width: '100%',
                maxWidth: '430px',
                minWidth: '320px',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${config.border}`,
                boxShadow: `0 14px 34px -8px ${config.glow}, 0 4px 12px rgba(0,0,0,0.25)`
            }}
        >
            {/* Top ambient colored line accent */}
            <div
                className="h-[2.5px] w-full"
                style={{
                    background: `linear-gradient(90deg, transparent, ${config.accent}, transparent)`
                }}
            />

            <div className="flex items-start gap-3.5 p-3.5 sm:p-4">
                {/* Glowing Floating Icon Pill */}
                <div
                    className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-inner transition-transform group-hover:scale-105"
                    style={{
                        backgroundColor: config.badgeBg,
                        color: config.accent,
                        boxShadow: `0 0 16px ${config.glow}`
                    }}
                >
                    <Icon size={20} strokeWidth={2.4} aria-hidden="true" />
                </div>

                {/* Content hierarchy */}
                <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-bold tracking-tight text-ink leading-tight">
                            {title || config.defaultTitle}
                        </span>

                        {badge && (
                            <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                                style={{
                                    backgroundColor: config.badgeBg,
                                    color: config.badgeText
                                }}
                            >
                                {badge}
                            </span>
                        )}
                    </div>

                    <p className={`text-xs leading-relaxed font-medium break-words ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                    }`}>
                        {message}
                    </p>

                    {/* Action Button */}
                    {action && (
                        <div className="mt-2.5 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick?.();
                                    onClose?.();
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all shadow-sm active:scale-95"
                                style={{
                                    backgroundColor: config.accent,
                                    color: '#ffffff'
                                }}
                            >
                                <span>{action.label}</span>
                                <ExternalLink size={12} aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Dismiss Button */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose?.();
                    }}
                    className={`-mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-lg transition-colors ${
                        isDark
                            ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                    aria-label="Dismiss notification"
                >
                    <X size={15} />
                </button>
            </div>

            {/* Countdown Progress Bar */}
            {duration > 0 && (
                <div className="h-[2px] w-full bg-slate-500/10 overflow-hidden">
                    <div
                        className="h-full transition-all ease-linear"
                        style={{
                            width: `${progress}%`,
                            backgroundColor: config.accent,
                            opacity: paused ? 0.4 : 0.85
                        }}
                    />
                </div>
            )}
        </motion.div>
    );
};

export default Toast;
