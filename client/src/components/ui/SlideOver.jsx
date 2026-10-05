import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cx } from './cx';

/**
 * Shared right-hand slide-over shell used by the header panels (notifications,
 * contacts, messages, share, smart notes). Renders in a portal so ancestors
 * with transforms (framer-motion) can't break the fixed positioning, and uses
 * the semantic design tokens so it follows the active theme automatically.
 */
export function SlideOver({
    isOpen,
    onClose,
    title,
    subtitle,
    icon: Icon,
    children,
    footer,
    width = 'w-full sm:w-[420px]',
    bodyClassName,
}) {
    return createPortal(
        <AnimatePresence>
            {isOpen ? (
                <div
                    className="fixed inset-0 z-[70]"
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
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.aside
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        className={cx(
                            'absolute right-0 top-0 flex h-full max-w-full flex-col border-l border-line bg-surface shadow-raised',
                            width
                        )}
                    >
                        <header className="flex items-start justify-between gap-3 border-b border-line p-5 sm:p-6">
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
                                aria-label="Close panel"
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-control border border-line text-ink-muted transition hover:bg-raised hover:text-ink"
                            >
                                <X size={16} aria-hidden="true" />
                            </button>
                        </header>

                        <div className={cx('min-h-0 flex-1 overflow-y-auto p-4 sm:p-6', bodyClassName)}>
                            {children}
                        </div>

                        {footer ? <footer className="border-t border-line p-4">{footer}</footer> : null}
                    </motion.aside>
                </div>
            ) : null}
        </AnimatePresence>,
        document.body
    );
}
