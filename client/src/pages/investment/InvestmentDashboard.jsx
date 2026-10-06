import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
    LayoutDashboard,
    CalendarClock,
    PieChart,
    Target,
    ReceiptText,
    Newspaper,
    Plus,
    TrendingUp,
    Wallet,
    HandCoins,
    Activity,
    Pencil,
    Trash2,
    Download,
    ArrowRight,
    CheckCircle2,
    AlertTriangle,
    FileText
} from 'lucide-react';
import { API_URL } from '../../config';
import { formatCurrency as formatCurrencyUtil } from '../../utils/currency';
import { Panel, PanelHeader, StatTile, Button, Badge, Progress, EmptyState, RowSkeleton, IconBadge } from '../../components/ui/primitives';
import { cx } from '../../components/ui/cx';

import LiveMarketTicker from '../../components/personal_expense/LiveMarketTicker';
import LiveMetalPrices from '../../components/personal_expense/LiveMetalPrices';
import FinancialNewsModal from '../../components/personal_expense/FinancialNewsModal';
import InvestmentForm from '../../components/personal_expense/InvestmentForm';
import InvestmentList from '../../components/personal_expense/InvestmentList';
import InvestmentTable from '../../components/personal_expense/InvestmentTable';
import InvestmentDetailModal from '../../components/personal_expense/InvestmentDetailModal';
import AssetAllocationChart from '../../components/personal_expense/AssetAllocationChart';
import InvestmentGoalsWidget from '../../components/personal_expense/InvestmentGoalsWidget';
import InvestmentGoalModal from '../../components/personal_expense/InvestmentGoalModal';
import TaxReportModal from '../../components/personal_expense/TaxReportModal';
import InvestmentPlanModal from '../../components/personal_expense/InvestmentPlanModal';
import InvestmentContributionModal from '../../components/personal_expense/InvestmentContributionModal';

const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'plan', label: 'Plan', icon: CalendarClock },
    { id: 'holdings', label: 'Holdings', icon: PieChart },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'tax', label: 'Tax', icon: ReceiptText }
];

const TONE_TEXT = {
    pos: 'text-pos',
    neg: 'text-neg',
    warn: 'text-warn',
    brand: 'text-brand',
    info: 'text-info',
    violet: 'text-violet',
    muted: 'text-ink-muted'
};

// Monthly-equivalent contribution of a plan (mirrors server/src util).
const monthlyEquivalent = (plan) => {
    const amount = Number(plan?.amount) || 0;
    switch (plan?.frequency) {
        case 'weekly': return (amount * 52) / 12;
        case 'quarterly': return amount / 3;
        default: return amount;
    }
};

const adherenceTone = (a) => {
    const v = Number(a) || 0;
    if (v >= 0.9) return 'pos';
    if (v >= 0.6) return 'warn';
    return 'neg';
};

const categoryTone = (cat) => {
    switch (cat) {
        case 'Market': return 'pos';
        case 'Fixed': return 'info';
        case 'Alternative': return 'warn';
        case 'Insurance': return 'neg';
        default: return 'brand';
    }
};

const dateLabel = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusSummary = (adherence) => ({
    tone: adherenceTone(adherence),
    text: `${Math.round((adherence || 0) * 100)}%`
});

const MiniStat = ({ label, value, tone = 'muted' }) => (
    <div className="rounded-control border border-line bg-sunken p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
        <p className={`tnum mt-0.5 text-sm font-bold ${TONE_TEXT[tone] || TONE_TEXT.muted}`}>{value}</p>
    </div>
);

const InvestmentDashboard = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [tab, setTab] = useState('overview');
    const [viewMode, setViewMode] = useState('grid');

    const [stats, setStats] = useState({
        invested: 0,
        current: 0,
        unrealized: 0,
        realized: 0,
        todayChange: 0,
        todayChangePerc: 0,
        percentage: 0,
        xirr: 0,
        allocation: []
    });
    const [investments, setInvestments] = useState([]);
    const [goals, setGoals] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isNewsOpen, setIsNewsOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
    const [selectedInvestment, setSelectedInvestment] = useState(null);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [initialModalTab, setInitialModalTab] = useState('overview');

    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [contribPlan, setContribPlan] = useState(null);

    const [taxReport, setTaxReport] = useState(null);
    const [taxError, setTaxError] = useState(false);

    const formatCurrency = (val) => formatCurrencyUtil(val, user?.currency || 'USD');
    const signed = (val) => {
        const n = Number(val) || 0;
        return `${n > 0 ? '+' : ''}${formatCurrency(n)}`;
    };

    const taxPending = tab === 'tax' && taxReport === null && !taxError;

    const fetchAll = () => {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        Promise.all([
            fetch(`${API_URL}/investments/dashboard/stats`, { headers }).then((r) => (r.ok ? r.json() : null)),
            fetch(`${API_URL}/investments`, { headers }).then((r) => (r.ok ? r.json() : [])),
            fetch(`${API_URL}/investments/goals`, { headers }).then((r) => (r.ok ? r.json() : [])),
            fetch(`${API_URL}/investments/plans`, { headers }).then((r) => (r.ok ? r.json() : []))
        ])
            .then(([statsData, invData, goalData, planData]) => {
                if (statsData) setStats(statsData);
                setInvestments(Array.isArray(invData) ? invData : []);
                setGoals(Array.isArray(goalData) ? goalData : []);
                setPlans(Array.isArray(planData) ? planData : []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (user) {
            fetchAll();
        }
    }, [user]);

    // Fetch the tax report lazily the first time the Tax tab is opened.
    useEffect(() => {
        if (!user || tab !== 'tax' || taxReport !== null || taxError) return;
        let cancelled = false;
        fetch(`${API_URL}/investments/tax/report`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled) {
                    if (data) setTaxReport(data);
                    else setTaxError(true);
                }
            })
            .catch(() => {
                if (!cancelled) setTaxError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [tab, user, taxReport, taxError]);

    // Planned (target) allocation mix derived from active plans' monthly commitment.
    const targetAllocation = useMemo(() => {
        const map = {};
        plans.forEach((plan) => {
            if (plan.isActive === false) return;
            const cat = plan.investment?.category || 'Other';
            map[cat] = (map[cat] || 0) + monthlyEquivalent(plan);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [plans]);

    const planHealth = useMemo(() => {
        const due = plans.reduce((s, p) => s + (p.summary?.due || 0), 0);
        const paid = plans.reduce((s, p) => s + (p.summary?.paid || 0), 0);
        const missed = plans.reduce((s, p) => s + (p.summary?.missed || 0), 0);
        let nextDue = null;
        plans.forEach((p) => {
            const d = p.summary?.nextDue;
            if (d && (!nextDue || d < nextDue)) nextDue = d;
        });
        return {
            count: plans.length,
            activeCount: plans.filter((p) => p.isActive !== false).length,
            due,
            paid,
            missed,
            adherence: due > 0 ? paid / due : 1,
            nextDue,
            monthlyCommit: plans.reduce((s, p) => s + monthlyEquivalent(p), 0)
        };
    }, [plans]);

    const handleDeleteInvestment = async (id) => {
        if (!window.confirm('Are you sure you want to delete this investment?')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/investments/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setInvestments((prev) => prev.filter((i) => i.id !== id));
                fetchAll();
                toast.success('Investment deleted successfully');
            } else {
                toast.error('Failed to delete investment');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error deleting investment');
        }
    };

    const handleDeleteGoal = async (id) => {
        if (!window.confirm('Are you sure you want to delete this goal?')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/investments/goals/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setGoals((prev) => prev.filter((g) => g.id !== id));
                toast.success('Goal deleted successfully');
            } else {
                toast.error('Failed to delete goal');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error deleting goal');
        }
    };

    const handleDeletePlan = async (plan) => {
        const label = plan.name || plan.investment?.name || 'this plan';
        if (!window.confirm(`Delete "${label}"? Existing transactions will be kept but unlinked.`)) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/investments/plans/${plan.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                fetchAll();
                toast.success('Plan deleted successfully');
            } else {
                toast.error('Failed to delete plan');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error deleting plan');
        }
    };

    const openPlan = (plan) => {
        setEditingPlan(plan);
        setIsPlanModalOpen(true);
    };

    const downloadCSV = () => {
        if (!taxReport || !taxReport.details) return;
        const headers = ['Investment', 'Buy Date', 'Sell Date', 'Units', 'Buy Price', 'Sell Price', 'Gain/Loss', 'Type', 'Days Held'];
        const rows = taxReport.details.map((d) => [
            d.investmentName,
            new Date(d.buyDate).toLocaleDateString(),
            new Date(d.sellDate).toLocaleDateString(),
            d.units,
            d.buyPrice,
            d.sellPrice,
            d.gain,
            d.type,
            d.daysHeld
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `tax_report_${new Date().getFullYear()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderPlanCard = (plan) => {
        const summary = plan.summary || {};
        const tone = plan.isActive === false ? 'muted' : 'brand';
        const status = statusSummary(summary.adherence);
        const inv = plan.investment;

        return (
            <div key={plan.id} className="rounded-card border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <IconBadge icon={CalendarClock} tone={tone} />
                        <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-ink">
                                {plan.name || inv?.name || 'Untitled plan'}
                            </h3>
                            <p className="mt-0.5 text-xs text-ink-muted">
                                {plan.frequency} · {signed(plan.amount)} · {plan.instalmentDay ? `day ${plan.instalmentDay}` : 'no fixed day'}
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={status.tone}>{status.text}</Badge>
                        <button
                            type="button"
                            title="Edit plan"
                            aria-label="Edit plan"
                            onClick={() => openPlan(plan)}
                            className="grid h-8 w-8 place-items-center rounded-control border border-line text-ink-muted transition hover:border-line-strong hover:text-ink"
                        >
                            <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            title="Delete plan"
                            aria-label="Delete plan"
                            onClick={() => handleDeletePlan(plan)}
                            className="grid h-8 w-8 place-items-center rounded-control border border-line text-ink-faint transition hover:border-neg/30 hover:bg-neg-soft hover:text-neg"
                        >
                            <Trash2 size={13} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {inv ? (
                    <button
                        type="button"
                        onClick={() => {
                            setInitialModalTab('overview');
                            setSelectedInvestment(inv);
                        }}
                        className="mt-3 inline-flex w-full items-center gap-2 rounded-control border border-line bg-sunken px-3 py-2 text-left transition hover:border-line-strong"
                    >
                        <Badge tone={categoryTone(inv.category)}>{inv.category}</Badge>
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">{inv.name}</span>
                        <ArrowRight size={13} className="shrink-0 text-ink-faint" aria-hidden="true" />
                    </button>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MiniStat label="Paid" value={summary.paid ?? 0} tone="pos" />
                    <MiniStat label="Missed" value={summary.missed ?? 0} tone={summary.missed ? 'warn' : 'muted'} />
                    <MiniStat label="Next Due" value={summary.nextDue ? dateLabel(summary.nextDue) : '—'} tone="info" />
                    <MiniStat
                        label="Projected"
                        value={summary.projectedValue != null ? formatCurrency(summary.projectedValue) : 'Open-ended'}
                        tone="brand"
                    />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                    <span>
                        Monthly eq. {signed(monthlyEquivalent(plan))}
                        {plan.expectedReturnPct ? ` · ${plan.expectedReturnPct}% assumed return` : ''}
                    </span>
                    {plan.stepUpPct ? <span>+{plan.stepUpPct}% yearly step-up</span> : null}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                    <Button variant="primary" size="sm" icon={Wallet} onClick={() => setContribPlan(plan)}>
                        Record Contribution
                    </Button>
                    {summary.missed > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-warn">
                            <AlertTriangle size={13} aria-hidden="true" /> {summary.missed} instalment{summary.missed > 1 ? 's' : ''} missed
                        </span>
                    ) : summary.due > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-pos">
                            <CheckCircle2 size={13} aria-hidden="true" /> On schedule
                        </span>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderOverview = () => {
        if (loading) {
            return (
                <>
                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((i) => (
                            <StatTile key={i} loading label="Loading" value="—" />
                        ))}
                    </div>
                    <RowSkeleton rows={4} />
                </>
            );
        }

        return (
            <>
                <div className="mb-5 space-y-5">
                    <LiveMarketTicker />
                    <LiveMetalPrices />
                </div>

                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatTile
                        label="Invested"
                        value={formatCurrency(stats.invested)}
                        icon={HandCoins}
                        tone="brand"
                        hint={`${stats.percentage || 0}% abs.`}
                    />
                    <StatTile
                        label="Current Value"
                        value={formatCurrency(stats.current)}
                        icon={Wallet}
                        tone="info"
                        hint={`${formatCurrency(stats.realized)} realized`}
                    />
                    <StatTile
                        label="Total Gains"
                        value={signed(stats.unrealized)}
                        icon={TrendingUp}
                        tone={stats.unrealized >= 0 ? 'pos' : 'neg'}
                        delta={{ direction: stats.unrealized >= 0 ? 'up' : 'down', label: `${stats.xirr || 0}% XIRR` }}
                        hint="unrealized"
                    />
                    <StatTile
                        label="Today"
                        value={signed(stats.todayChange)}
                        icon={Activity}
                        tone={stats.todayChange >= 0 ? 'pos' : 'neg'}
                        delta={{ direction: stats.todayChange >= 0 ? 'up' : 'down', label: `${stats.todayChangePerc || 0}%` }}
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                    <Panel className="lg:col-span-3">
                        <PanelHeader
                            title="Asset Allocation"
                            subtitle="Actual mix vs planned mix (from active plans)"
                            icon={PieChart}
                        />
                        {stats.allocation?.length ? (
                            <>
                                <AssetAllocationChart
                                    data={stats.allocation}
                                    target={targetAllocation.length ? targetAllocation : undefined}
                                    currencyCode={user?.currency}
                                />
                                {targetAllocation.length ? (
                                    <p className="mt-2 text-center text-xs text-ink-faint">Dashed ring = target mix from active plans</p>
                                ) : null}
                            </>
                        ) : (
                            <EmptyState
                                icon={PieChart}
                                title="No allocation data"
                                description="Add investments to see how your portfolio is split across categories."
                                action={
                                    <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsFormOpen(true)}>
                                        Add Investment
                                    </Button>
                                }
                            />
                        )}
                    </Panel>

                    <Panel className="lg:col-span-2">
                        <PanelHeader
                            title="Plan Health"
                            subtitle="Recurring contribution adherence"
                            icon={CalendarClock}
                            action={
                                <Button variant="ghost" size="sm" onClick={() => setTab('plan')}>
                                    Manage <ArrowRight size={13} className="ml-1" aria-hidden="true" />
                                </Button>
                            }
                        />
                        {plans.length === 0 ? (
                            <EmptyState
                                icon={CalendarClock}
                                title="No schedules yet"
                                description="Create a plan to automate a contribution schedule and track adherence."
                                action={
                                    <Button variant="primary" size="sm" icon={Plus} onClick={() => openPlan(null)}>
                                        Create a Plan
                                    </Button>
                                }
                            />
                        ) : (
                            <>
                                <div className="mb-4 rounded-card bg-sunken p-4">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Adherence</span>
                                        <span className="tnum text-lg font-extrabold text-ink">{Math.round(planHealth.adherence * 100)}%</span>
                                    </div>
                                    <div className="mt-2">
                                        <Progress value={planHealth.adherence * 100} tone={adherenceTone(planHealth.adherence)} />
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                        <MiniStat label="Paid" value={planHealth.paid} tone="pos" />
                                        <MiniStat label="Missed" value={planHealth.missed} tone={planHealth.missed ? 'warn' : 'muted'} />
                                        <MiniStat label="Monthly" value={formatCurrency(planHealth.monthlyCommit)} tone="brand" />
                                    </div>
                                    {planHealth.missed > 0 ? (
                                        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-warn">
                                            <AlertTriangle size={13} aria-hidden="true" /> {planHealth.missed} missed instalments
                                        </p>
                                    ) : planHealth.due > 0 ? (
                                        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-pos">
                                            <CheckCircle2 size={13} aria-hidden="true" /> All due instalments paid
                                        </p>
                                    ) : null}
                                </div>

                                <ul className="space-y-2">
                                    {plans.slice(0, 4).map((plan) => {
                                        const s = statusSummary(plan.summary?.adherence);
                                        return (
                                            <li key={plan.id} className="flex items-center justify-between gap-3 rounded-control border border-line bg-sunken p-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-ink">
                                                        {plan.name || plan.investment?.name || 'Untitled plan'}
                                                    </p>
                                                    <p className="text-xs text-ink-muted">
                                                        next due {plan.summary?.nextDue ? dateLabel(plan.summary.nextDue) : '—'}
                                                    </p>
                                                </div>
                                                <Badge tone={s.tone}>{s.text}</Badge>
                                            </li>
                                        );
                                    })}
                                    {plans.length > 4 ? (
                                        <li>
                                            <Button variant="ghost" size="sm" className="w-full" onClick={() => setTab('plan')}>
                                                View all {plans.length} plans
                                            </Button>
                                        </li>
                                    ) : null}
                                </ul>
                            </>
                        )}
                    </Panel>
                </div>
            </>
        );
    };

    const renderPlanTab = () => (
        <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-ink">Investment Plans</h2>
                    <p className="mt-0.5 text-sm text-ink-muted">Recurring schedules linked to your holdings</p>
                </div>
                <Button variant="primary" size="sm" icon={Plus} onClick={() => openPlan(null)}>
                    New Plan
                </Button>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Active Plans" value={planHealth.activeCount} icon={CalendarClock} tone="brand" hint={`${planHealth.count} total`} />
                <StatTile label="Monthly Commitment" value={formatCurrency(planHealth.monthlyCommit)} icon={HandCoins} tone="info" hint="across all plans" />
                <StatTile
                    label="Adherence"
                    value={`${Math.round(planHealth.adherence * 100)}%`}
                    icon={Target}
                    tone={adherenceTone(planHealth.adherence)}
                    delta={{ direction: planHealth.missed > 0 ? 'down' : 'up', label: planHealth.missed > 0 ? `${planHealth.missed} missed` : 'on schedule' }}
                />
                <StatTile
                    label="Next Instalment"
                    value={planHealth.nextDue ? dateLabel(planHealth.nextDue) : '—'}
                    icon={Activity}
                    tone={planHealth.missed > 0 ? 'warn' : 'pos'}
                    hint="soonest due"
                />
            </div>

            {plans.length === 0 ? (
                <EmptyState
                    icon={CalendarClock}
                    title="No plans yet"
                    description="Create a recurring contribution plan tied to a holding — track due, paid and missed instalments automatically."
                    action={
                        <Button variant="primary" size="sm" icon={Plus} onClick={() => openPlan(null)}>
                            Create a Plan
                        </Button>
                    }
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{plans.map(renderPlanCard)}</div>
            )}
        </>
    );

    const renderHoldingsTab = () => (
        <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-ink">Your Holdings</h2>
                    <p className="mt-0.5 text-sm text-ink-muted">{investments.length} investment{investments.length === 1 ? '' : 's'} tracked</p>
                </div>
                <div className="inline-flex items-center gap-0.5 rounded-control border border-line bg-surface p-0.5">
                    {['grid', 'table'].map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setViewMode(mode)}
                            aria-pressed={viewMode === mode}
                            className={cx(
                                'inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-bold capitalize transition',
                                viewMode === mode ? 'bg-brand text-slate-950' : 'text-ink-muted hover:text-ink'
                            )}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>
            {viewMode === 'grid' ? (
                <InvestmentList
                    investments={investments}
                    onSelect={(inv) => {
                        setInitialModalTab('overview');
                        setSelectedInvestment(inv);
                    }}
                    onAnalyze={(inv) => {
                        setInitialModalTab('analysis');
                        setSelectedInvestment(inv);
                    }}
                    onDelete={handleDeleteInvestment}
                />
            ) : (
                <InvestmentTable
                    investments={investments}
                    onSelect={(inv) => {
                        setInitialModalTab('overview');
                        setSelectedInvestment(inv);
                    }}
                />
            )}
        </>
    );

    const renderGoalsTab = () => (
        <>
            <div className="mb-5">
                <h2 className="text-xl font-extrabold tracking-tight text-ink">Financial Goals</h2>
                <p className="mt-0.5 text-sm text-ink-muted">Monthly contribution needs and on-track status for each goal</p>
            </div>
            <InvestmentGoalsWidget
                goals={goals}
                onAdd={() => {
                    setSelectedGoal(null);
                    setIsGoalModalOpen(true);
                }}
                onSelect={(goal) => {
                    setSelectedGoal(goal);
                    setIsGoalModalOpen(true);
                }}
                onDelete={handleDeleteGoal}
            />
        </>
    );

    const renderTaxTab = () => (
        <Panel>
            <PanelHeader
                title="Tax Report"
                subtitle="Capital gains statement (FIFO method)"
                icon={ReceiptText}
                action={
                    taxReport ? (
                        <Button variant="secondary" size="sm" icon={Download} onClick={downloadCSV}>
                            Download CSV
                        </Button>
                    ) : null
                }
            />
            {taxPending ? (
                <RowSkeleton rows={3} />
            ) : taxReport ? (
                <>
                    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <StatTile label="STCG" value={formatCurrency(taxReport.stcg)} icon={ReceiptText} tone="info" hint="held < 1 year" />
                        <StatTile label="LTCG" value={formatCurrency(taxReport.ltcg)} icon={TrendingUp} tone="warn" hint="held > 1 year" />
                        <StatTile
                            label="Total Realized"
                            value={signed(taxReport.totalGains)}
                            icon={FileText}
                            tone={taxReport.totalGains >= 0 ? 'pos' : 'neg'}
                            delta={{ direction: taxReport.totalGains >= 0 ? 'up' : 'down', label: 'net taxable' }}
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line">
                                    {['Asset', 'Type', 'Buy Date', 'Sell Date', 'Gain/Loss'].map((head) => (
                                        <th key={head} scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-faint">
                                            {head}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {taxReport.details.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-faint">
                                            No realized gains yet
                                        </td>
                                    </tr>
                                ) : (
                                    taxReport.details.map((item, i) => (
                                        <tr key={i} className="border-b border-line/60 transition-colors last:border-0 hover:bg-sunken">
                                            <td className="px-4 py-3.5 font-bold text-ink">{item.investmentName}</td>
                                            <td className="px-4 py-3.5">
                                                <Badge tone={item.type === 'LTCG' ? 'warn' : 'info'}>{item.type}</Badge>
                                            </td>
                                            <td className="px-4 py-3.5 text-ink-muted">{new Date(item.buyDate).toLocaleDateString()}</td>
                                            <td className="px-4 py-3.5 text-ink-muted">{new Date(item.sellDate).toLocaleDateString()}</td>
                                            <td className={item.gain >= 0 ? 'tnum px-4 py-3.5 font-bold text-pos' : 'tnum px-4 py-3.5 font-bold text-neg'}>
                                                {formatCurrency(item.gain)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <EmptyState icon={FileText} title="No tax report" description="Nothing to show — no realized capital gains have been recorded." />
            )}
        </Panel>
    );

    return (
        <div className="mx-auto max-w-[1400px] p-6 md:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-ink">Investment Portfolio</h1>
                    <p className="mt-1 text-sm text-ink-muted">Plan-driven tracking across allocations and goals</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" icon={Newspaper} onClick={() => setIsNewsOpen(true)}>
                        Market News
                    </Button>
                    <Button variant="secondary" size="sm" icon={ReceiptText} onClick={() => setIsTaxModalOpen(true)}>
                        Tax Report
                    </Button>
                    <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsFormOpen(true)}>
                        Add Investment
                    </Button>
                </div>
            </div>

            <div className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-control border border-line bg-surface p-1" role="tablist" aria-label="Portfolio sections">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={cx(
                            'inline-flex items-center gap-2 rounded-control px-3.5 py-2 text-sm font-bold transition',
                            tab === t.id ? 'bg-brand text-slate-950' : 'text-ink-muted hover:bg-raised hover:text-ink'
                        )}
                    >
                        <t.icon size={15} aria-hidden="true" />
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'overview' ? renderOverview() : null}
            {tab === 'plan' ? renderPlanTab() : null}
            {tab === 'holdings' ? renderHoldingsTab() : null}
            {tab === 'goals' ? renderGoalsTab() : null}
            {tab === 'tax' ? renderTaxTab() : null}

            <InvestmentForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSuccess={fetchAll} user={user} />
            <InvestmentGoalModal
                isOpen={isGoalModalOpen}
                onClose={() => {
                    setIsGoalModalOpen(false);
                    setSelectedGoal(null);
                }}
                onSuccess={fetchAll}
                goal={selectedGoal}
            />
            <TaxReportModal isOpen={isTaxModalOpen} onClose={() => setIsTaxModalOpen(false)} />
            <FinancialNewsModal isOpen={isNewsOpen} onClose={() => setIsNewsOpen(false)} />
            <InvestmentDetailModal
                investment={selectedInvestment}
                isOpen={!!selectedInvestment}
                onClose={() => setSelectedInvestment(null)}
                onUpdate={() => {
                    fetchAll();
                    setSelectedInvestment(null);
                }}
                initialTab={initialModalTab}
            />
            <InvestmentPlanModal
                isOpen={isPlanModalOpen}
                onClose={() => {
                    setIsPlanModalOpen(false);
                    setEditingPlan(null);
                }}
                onSuccess={fetchAll}
                plan={editingPlan}
                investments={investments}
            />
            <InvestmentContributionModal
                isOpen={!!contribPlan}
                onClose={() => setContribPlan(null)}
                onSuccess={fetchAll}
                plan={contribPlan}
            />
        </div>
    );
};

export default InvestmentDashboard;