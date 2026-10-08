import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cx } from '../ui/cx';
import { IconBadge } from '../ui/primitives';

/**
 * Count-up animation. The rAF callback owns every `setDisplay`, so there is no
 * synchronous state write inside the effect (keeps the hooks lint quiet) and
 * re-running on `value` changes makes the number animate when the date-range
 * filter changes.
 */
function AnimatedNumber({ value, format, duration = 900 }) {
    const target = Number(value) || 0;
    const [display, setDisplay] = useState(target);
    const fromRef = useRef(target);

    useEffect(() => {
        const from = fromRef.current;
        if (from === target) return undefined;
        let raf;
        const start = performance.now();
        const tick = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - (1 - p) ** 3;
            setDisplay(from + (target - from) * eased);
            if (p < 1) raf = requestAnimationFrame(tick);
            else fromRef.current = target;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);

    return <>{format(display)}</>;
}

/** Area sparkline. Pure SVG so it costs nothing next to the Recharts bundle. */
export function Sparkline({ data = [], color = '#10b981', className }) {
    const gradId = useId();
    if (!data.length) return <div className={cx('h-10', className)} />;

    const w = 100;
    const h = 40;
    const max = Math.max(...data, 0);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const step = w / Math.max(1, data.length - 1);
    const points = data.map((v, i) => [
        i * step,
        h - ((v - min) / range) * (h - 8) - 4,
    ]);
    const line = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`)
        .join(' ');
    const area = `${line} L${w},${h} L0,${h} Z`;

    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className={cx('h-10 w-full', className)}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradId})`} />
            <path
                d={line}
                fill="none"
                stroke={color}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

/** Savings-rate ring. `value` is a 0-100 percentage. */
export function RadialProgress({ value = 0, size = 72, stroke = 7, color = '#10b981', children }) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.min(100, Math.max(0, Number(value) || 0));

    return (
        <div className="relative grid place-items-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--pem-border-strong)"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (pct / 100) * circumference}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)' }}
                />
            </svg>
            <div className="absolute inset-0 grid place-items-center">{children}</div>
        </div>
    );
}

const DIRECTION = {
    up: { Icon: ArrowUpRight, label: 'up' },
    down: { Icon: ArrowDownRight, label: 'down' },
    flat: { Icon: Minus, label: 'no change' },
};

/**
 * KPI tile: icon + label, animated value, period delta and a sparkline (or a
 * radial ring when `ring` is supplied, e.g. savings rate).
 */
export function KpiCard({
    icon,
    label,
    value,
    format,
    delta,
    deltaInverse = false,
    spark,
    sparkColor = '#8b5cf6',
    ring,
    ringColor = '#10b981',
    tone = 'brand',
    hint,
    loading,
    footer,
}) {
    if (loading) return <KpiSkeleton />;

    const direction =
        delta == null || Math.abs(delta) < 0.05 ? 'flat' : delta > 0 ? 'up' : 'down';
    const { Icon: DeltaIcon } = DIRECTION[direction];
    const positive = deltaInverse ? direction === 'down' : direction === 'up';
    const deltaTone =
        direction === 'flat' ? 'text-ink-faint' : positive ? 'text-pos' : 'text-neg';

    return (
        <article className="pem-card pem-card-hover flex h-full flex-col p-5">
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
                        {label}
                    </p>
                </div>
                <IconBadge icon={icon} tone={tone} size="sm" />
            </header>

            <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p
                        className="tnum text-[20px] sm:text-[22px] 2xl:text-[26px] font-extrabold leading-none tracking-tight text-ink whitespace-nowrap overflow-visible"
                        title={typeof format === 'function' ? format(value) : String(value)}
                    >
                        <AnimatedNumber value={value} format={format} />
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                        <span
                            className={cx('tnum inline-flex items-center gap-0.5 text-xs font-bold', deltaTone)}
                            title={delta == null ? 'No prior period to compare' : undefined}
                        >
                            {delta == null ? (
                                <Minus size={13} aria-hidden="true" />
                            ) : (
                                <DeltaIcon size={13} aria-hidden="true" />
                            )}
                            {delta == null ? '—' : `${Math.abs(delta).toFixed(1)}%`}
                        </span>
                        <span className="text-xs text-ink-faint">vs prev</span>
                        {hint ? <span className="text-xs text-ink-faint">• {hint}</span> : null}
                    </div>
                </div>

                {typeof ring === 'number' ? (
                    <div className="shrink-0">
                        <RadialProgress value={ring} size={60} color={ringColor}>
                            <span className="tnum text-xs font-bold text-ink">
                                {Math.round(Math.min(100, Math.max(0, ring)))}%
                            </span>
                        </RadialProgress>
                    </div>
                ) : spark ? (
                    <div className="w-[28%] max-w-[85px] shrink-0 self-center">
                        <Sparkline data={spark} color={sparkColor} />
                    </div>
                ) : null}
            </div>
            {footer ? <div className="mt-3 text-xs text-ink-faint">{footer}</div> : null}
        </article>
    );
}

const KpiSkeleton = () => (
    <div className="pem-card flex h-full flex-col p-5" aria-hidden="true">
        <div className="flex items-start justify-between">
            <div className="pem-skeleton h-3 w-24" />
            <div className="pem-skeleton h-8 w-8 rounded-[10px]" />
        </div>
        <div className="pem-skeleton mt-4 h-8 w-32" />
        <div className="pem-skeleton mt-3 h-3 w-20" />
    </div>
);
