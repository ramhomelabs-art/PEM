/**
 * Shared presentational primitives.
 *
 * Everything here is styled with the semantic Tailwind colours from
 * `tailwind.config.js`, so components automatically follow the active theme
 * without reading `useTheme()` or hardcoding hex values.
 */
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from './cx';

/* ---------------------------------------------------------------- Panel -- */

export const Panel = ({ as: Tag = 'section', className, children, ...rest }) => (
    <Tag className={cx('pem-card p-5', className)} {...rest}>
        {children}
    </Tag>
);

export const PanelHeader = ({ title, subtitle, icon: Icon, action }) => (
    <header className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 min-w-0">
            {Icon ? (
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand">
                    <Icon size={18} aria-hidden="true" />
                </span>
            ) : null}
            <div className="min-w-0">
                <h2 className="text-sm font-bold tracking-tight text-ink">{title}</h2>
                {subtitle ? (
                    <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
                ) : null}
            </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
    </header>
);

/* --------------------------------------------------------------- Button -- */

const BUTTON_VARIANTS = {
    primary:
        'bg-brand text-slate-950 hover:brightness-110 active:brightness-95 shadow-[0_8px_20px_-10px_var(--pem-accent)]',
    secondary:
        'bg-raised text-ink border border-line hover:border-line-strong hover:bg-raised/70',
    ghost: 'text-ink-muted hover:text-ink hover:bg-raised',
    danger: 'bg-neg-soft text-neg border border-neg/25 hover:bg-neg hover:text-white',
};

const BUTTON_SIZES = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-11 px-5 text-sm gap-2',
};

export const Button = forwardRef(function Button(
    { variant = 'secondary', size = 'md', icon: Icon, loading, className, children, ...rest },
    ref
) {
    return (
        <button
            ref={ref}
            type="button"
            disabled={rest.disabled || loading}
            className={cx(
                'inline-flex select-none items-center justify-center rounded-control font-bold',
                'transition-[background-color,color,border-color,filter,opacity] duration-150',
                'disabled:pointer-events-none disabled:opacity-50',
                BUTTON_VARIANTS[variant],
                BUTTON_SIZES[size],
                className
            )}
            {...rest}
        >
            {loading ? (
                <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" aria-hidden="true" />
            ) : Icon ? (
                <Icon size={size === 'sm' ? 14 : 16} aria-hidden="true" />
            ) : null}
            {children}
        </button>
    );
});

/* ------------------------------------------------------------------ Icon -- */

const ICON_TONES = {
    brand: 'bg-brand-soft text-brand',
    pos: 'bg-pos-soft text-pos',
    neg: 'bg-neg-soft text-neg',
    warn: 'bg-warn-soft text-warn',
    info: 'bg-info-soft text-info',
    violet: 'bg-violet-soft text-violet',
    muted: 'bg-raised text-ink-muted',
};

const ICON_SIZES = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
const ICON_GLYPHS = { sm: 16, md: 18, lg: 22 };

export const IconBadge = ({ icon: Icon, tone = 'muted', size = 'md', className }) => (
    <span
        className={cx(
            'grid shrink-0 place-items-center rounded-[10px]',
            ICON_TONES[tone],
            ICON_SIZES[size],
            className
        )}
    >
        {Icon ? <Icon size={ICON_GLYPHS[size]} aria-hidden="true" /> : null}
    </span>
);

/* ------------------------------------------------------------- StatTile -- */

export const StatTile = ({ label, value, delta, tone = 'brand', icon, hint, loading }) => {
    if (loading) return <StatSkeleton />;
    return (
        <div className="relative overflow-hidden rounded-card border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
                    {label}
                </p>
                {icon ? <IconBadge icon={icon} tone={tone} size="sm" /> : null}
            </div>
            <p className="tnum mt-2 text-2xl font-extrabold leading-tight tracking-tight text-ink">
                {value}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
                {delta ? (
                    <span
                        className={cx(
                            'tnum text-xs font-bold',
                            delta.direction === 'up'
                                ? 'text-pos'
                                : delta.direction === 'down'
                                  ? 'text-neg'
                                  : 'text-ink-faint'
                        )}
                    >
                        {delta.label}
                    </span>
                ) : null}
                {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------- Skeleton -- */

export const StatSkeleton = () => (
    <div className="rounded-card border border-line bg-surface p-4">
        <div className="pem-skeleton h-2.5 w-20" />
        <div className="pem-skeleton mt-3 h-7 w-28" />
        <div className="pem-skeleton mt-2.5 h-2.5 w-16" />
    </div>
);

export const RowSkeleton = ({ rows = 4 }) => (
    <ul className="space-y-2" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-control border border-line p-3">
                <div className="pem-skeleton h-9 w-9 rounded-[10px]" />
                <div className="flex-1 space-y-2">
                    <div className="pem-skeleton h-2.5 w-1/3" />
                    <div className="pem-skeleton h-2 w-1/4" />
                </div>
                <div className="pem-skeleton h-4 w-16" />
            </li>
        ))}
    </ul>
);

/* ----------------------------------------------------------- EmptyState -- */

export const EmptyState = ({ icon: Icon, title, description, action }) => (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line px-6 py-10 text-center">
        {Icon ? <Icon size={26} className="text-ink-faint" aria-hidden="true" /> : null}
        <p className="text-sm font-bold text-ink-muted">{title}</p>
        {description ? (
            <p className="max-w-xs text-xs leading-relaxed text-ink-faint">{description}</p>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
    </div>
);

/* -------------------------------------------------------------- Progress -- */

/**
 * Threshold-aware progress track. `tone` overrides the automatic
 * colour selection when the caller has extra context (e.g. an EMI schedule).
 */
export const Progress = ({ value, max = 100, tone, threshold = 80 }) => {
    const safeMax = Number(max) > 0 ? Number(max) : 1;
    const pct = Math.min(100, Math.max(0, (Number(value) / safeMax) * 100));
    const resolved =
        tone ?? (pct >= threshold ? 'neg' : pct >= threshold * 0.6 ? 'warn' : 'pos');

    return (
        <div
            className="h-1.5 w-full overflow-hidden rounded-pill bg-raised"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className={cx(
                    'h-full rounded-pill transition-[width] duration-700 ease-out',
                    resolved === 'pos' && 'bg-pos',
                    resolved === 'warn' && 'bg-warn',
                    resolved === 'neg' && 'bg-neg',
                    resolved === 'brand' && 'bg-brand',
                    resolved === 'info' && 'bg-info',
                    resolved === 'violet' && 'bg-violet'
                )}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
};

/* ----------------------------------------------------------------- Badge -- */

const BADGE_TONES = {
    brand: 'bg-brand-soft text-brand',
    pos: 'bg-pos-soft text-pos',
    neg: 'bg-neg-soft text-neg',
    warn: 'bg-warn-soft text-warn',
    info: 'bg-info-soft text-info',
    violet: 'bg-violet-soft text-violet',
    muted: 'bg-raised text-ink-muted',
};

export const Badge = ({ tone = 'muted', icon: Icon, children, className }) => (
    <span
        className={cx(
            'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
            BADGE_TONES[tone],
            className
        )}
    >
        {Icon ? <Icon size={11} aria-hidden="true" /> : null}
        {children}
    </span>
);