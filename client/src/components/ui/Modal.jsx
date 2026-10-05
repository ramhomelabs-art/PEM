import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cx } from './cx';

/**
 * Shared centered modal dialog. Mirrors the SlideOver shell (portal + semantic
 * tokens) but renders in the middle of the screen for short form flows such as
 * "add record" / "add loan" / "set budget".
 */
const MODAL_SIZES = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
};

export function Modal({
    isOpen,
    onClose,
    title,
    subtitle,
    icon: Icon,
    children,
    footer,
    size = 'md',
    bodyClassName,
}) {
    return createPortal(
        <AnimatePresence>
            {isOpen ? (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={title}
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 12 }}
                        transition={{ type: 'tween', duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className={cx(
                            'relative z-10 my-auto flex max-h-[90vh] w-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-raised',
                            MODAL_SIZES[size]
                        )}
                    >
                        <header className="flex items-start justify-between gap-3 border-b border-line p-5">
                            <div className="flex min-w-0 items-center gap-3">
                                {Icon ? (
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand">
                                        <Icon size={18} aria-hidden="true" />
                                    </span>
                                ) : null}
                                <div className="min-w-0">
                                    <h2 className="truncate text-base font-bold tracking-tight text-ink">
                                        {title}
                                    </h2>
                                    {subtitle ? (
                                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                                            {subtitle}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close dialog"
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-control border border-line text-ink-muted transition hover:bg-raised hover:text-ink"
                            >
                                <X size={16} aria-hidden="true" />
                            </button>
                        </header>

                        <div className={cx('min-h-0 flex-1 overflow-y-auto p-5', bodyClassName)}>
                            {children}
                        </div>

                        {footer ? <footer className="border-t border-line p-4">{footer}</footer> : null}
                    </motion.div>
                </div>
            ) : null}
        </AnimatePresence>,
        document.body
    );
}
