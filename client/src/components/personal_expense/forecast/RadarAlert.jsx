import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * RadarAlert Banner
 * Renders a single specific sentence generated from data (e.g. "Food has exceeded its limit. Shopping is on track to exceed by Oct 14.")
 * Dismissible, shown only if something needs attention.
 */
export function RadarAlert({ message }) {
    const [dismissed, setDismissed] = useState(false);

    if (!message || dismissed) return null;

    return (
        <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl bg-negative-soft/40 p-3 text-xs text-ink shadow-sm backdrop-blur-sm transition-all duration-200"
        >
            <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-negative/20 text-negative">
                    <AlertTriangle size={13} aria-hidden="true" />
                </span>
                <p className="font-medium leading-relaxed text-ink">
                    {message}
                </p>
            </div>
            <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss alert"
                className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-ink-muted transition hover:bg-line hover:text-ink active:scale-95"
            >
                <X size={13} aria-hidden="true" />
            </button>
        </div>
    );
}

export default RadarAlert;
