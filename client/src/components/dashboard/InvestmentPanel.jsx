import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { cx } from '../ui/cx';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { API_URL } from '../../config';
import { formatCurrency } from '../../utils/currency';
import { assignCategoryColors } from '../../utils/theme';

const EMPTY = {
    invested: 0,
    current: 0,
    unrealized: 0,
    percentage: 0,
    count: 0,
    allocation: [],
};

/**
 * Portfolio card. Uses the same `/investments/dashboard/stats` endpoint as the
 * full dashboard page, so the empty/populated logic can never drift from it.
 */
export function InvestmentPanel() {
    const { user } = useAuth();
    const currency = user?.currency || 'INR';
    const [stats, setStats] = useState(EMPTY);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return undefined;
        let cancelled = false;
        fetch(`${API_URL}/investments/dashboard/stats`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then((res) => {
                if (res.ok) return res.json();
                return fetch(`${API_URL}/investing/dashboard`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed'))));
            })
            .then((data) => {
                if (!cancelled) setStats({ ...EMPTY, ...data });
            })
            .catch(() => {
                if (!cancelled) setStats(EMPTY);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [user]);

    const allocation = useMemo(() => {
        const rows = Array.isArray(stats.allocation) ? stats.allocation : [];
        const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0) || 1;
        return rows.map((r) => ({
            name: r.name || r.type || r.label || 'Other',
            value: Number(r.value) || 0,
            pct: ((Number(r.value) || 0) / total) * 100,
        }));
    }, [stats.allocation]);

    const allocColors = useMemo(
        () => assignCategoryColors(allocation.map((a) => a.name)),
        [allocation]
    );

    const positive = Number(stats.unrealized) >= 0;
    const hasHoldings = Number(stats.count) > 0 || Number(stats.current) > 0;
    const history = Array.isArray(stats.history) ? stats.history : [];

    return (
        <div className="pem-card pem-card-hover flex h-full flex-col p-5">
            <header className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-bold tracking-tight text-ink">Investments</h2>
                    <p className="mt-0.5 text-xs text-ink-muted">Portfolio value</p>
                </div>
                <Link
                    to="/investments"
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
                >
                    Open <ArrowRight size={13} aria-hidden="true" />
                </Link>
            </header>

            {loading ? (
                <div className="space-y-3">
                    <div className="pem-skeleton h-8 w-40" />
                    <div className="pem-skeleton h-3 w-28" />
                    <div className="pem-skeleton h-12 w-full" />
                </div>
            ) : !hasHoldings ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-violet-soft text-violet">
                        <TrendingUp size={20} aria-hidden="true" />
                    </span>
                    <p className="text-sm font-bold text-ink-muted">No investments yet</p>
                    <p className="max-w-[14rem] text-xs text-ink-faint">
                        Track stocks, mutual funds and crypto to see returns here.
                    </p>
                    <Link to="/investments" className="mt-1 text-xs font-bold text-brand hover:underline">
                        Add your first holding →
                    </Link>
                </div>
            ) : (
                <div className="flex flex-1 flex-col">
                    <p className="tnum text-2xl font-black tracking-tight text-ink sm:text-3xl">
                        {formatCurrency(stats.current, currency)}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                        Invested <span className="font-semibold text-ink">{formatCurrency(stats.invested, currency)}</span>
                    </p>
                    <span
                        className={cx(
                            'mt-3 inline-flex w-fit items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-bold',
                            positive ? 'bg-pos-soft text-pos' : 'bg-neg-soft text-neg'
                        )}
                    >
                        {positive ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
                        {positive ? '+' : '−'}
                        {formatCurrency(Math.abs(Number(stats.unrealized) || 0), currency)} (
                        {Number(stats.percentage || 0).toFixed(1)}%)
                    </span>

                    {history.length > 1 ? (
                        <div className="mt-4 h-[120px] w-full min-w-0">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 120 }} debounce={60}>
                                <AreaChart data={history}>
                                    <defs>
                                        <linearGradient id="inv-area" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--pem-surface-raised)',
                                            border: '1px solid var(--pem-border)',
                                            borderRadius: 10,
                                            fontSize: 12,
                                        }}
                                        formatter={(v) => formatCurrency(v, currency)}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#8b5cf6"
                                        strokeWidth={2}
                                        fill="url(#inv-area)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : allocation.length ? (
                        <ul className="mt-4 space-y-2.5">
                            {allocation.slice(0, 4).map((a) => (
                                <li key={a.name}>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="truncate font-medium text-ink">{a.name}</span>
                                        <span className="tnum text-ink-muted">{a.pct.toFixed(0)}%</span>
                                    </div>
                                    <div className="mt-1">
                                        <span
                                            className="block h-1.5 rounded-pill"
                                            style={{
                                                width: `${a.pct}%`,
                                                backgroundColor: allocColors.get(a.name) ?? '#8b5cf6',
                                            }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            )}
        </div>
    );
}
