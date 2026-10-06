import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

/**
 * MethodPopover Component
 * Accessible, lightweight popover explaining the exact 5-line forecast methodology.
 */
export function MethodPopover() {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative inline-flex items-center" ref={popoverRef}>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition hover:text-ink focus:outline-none"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
            >
                <HelpCircle size={13} aria-hidden="true" />
                <span>How is this calculated?</span>
            </button>

            {isOpen && (
                <div
                    role="dialog"
                    aria-label="Forecast Calculation Methodology"
                    className="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-xl border border-white/[0.08] bg-[#0c1427]/98 p-4 shadow-2xl backdrop-blur-xl sm:w-96"
                >
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <span className="text-xs font-bold text-ink">Forecast Methodology</span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close explanation"
                            className="grid h-5 w-5 place-items-center rounded text-ink-muted hover:bg-white/[0.08] hover:text-ink"
                        >
                            <X size={12} />
                        </button>
                    </div>

                    <ol className="mt-3 space-y-2 text-xs leading-relaxed text-ink-secondary">
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-brand">1.</span>
                            <span><strong>Time Model:</strong> Elapsed days count complete days plus today's fraction; remaining days never double-count today.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-brand">2.</span>
                            <span><strong>Clean Baselines:</strong> Excludes account transfers and isolates one-offs (&gt;3× median) so they don't distort burn rates.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-brand">3.</span>
                            <span><strong>Adaptive Run-Rate:</strong> Blends this month's velocity with trailing 3-month history using weight <em>w = elapsed / (elapsed + 10)</em>.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-brand">4.</span>
                            <span><strong>Committed Dues:</strong> Adds verified upcoming bills, EMIs, and subscriptions scheduled before month end.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-brand">5.</span>
                            <span><strong>Safe Cap & Range:</strong> Computes the maximum safe daily spend and p25–p75 confidence intervals to prevent breach.</span>
                        </li>
                    </ol>
                </div>
            )}
        </div>
    );
}

export default MethodPopover;
