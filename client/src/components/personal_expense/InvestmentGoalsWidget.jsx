import React from 'react';
import { Target, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../../utils/currency';
import { Panel, PanelHeader, Badge, Progress, EmptyState, Button } from '../ui/primitives';

const STATUS_TONE = {
    'On track': 'pos',
    'Behind': 'warn',
    'Missed': 'neg',
    'Achieved': 'pos'
};

const InvestmentGoalsWidget = ({ goals, onAdd, onSelect, onDelete }) => {
    const { user } = useAuth();
    const formatCurrency = (val) => formatCurrencyUtil(val, user?.currency || 'USD');

    return (
        <Panel>
            <PanelHeader
                title="Financial Goals"
                subtitle="Targets, monthly needs and on-track status"
                icon={Target}
                action={
                    <Button variant="secondary" size="sm" icon={Plus} onClick={onAdd}>
                        New Goal
                    </Button>
                }
            />

            {goals.length === 0 ? (
                <EmptyState
                    icon={Target}
                    title="No goals set yet"
                    description="Create a goal and link investments to it so we can project the monthly contribution you need."
                    action={
                        <Button variant="primary" size="sm" icon={Plus} onClick={onAdd}>
                            Set a Goal
                        </Button>
                    }
                />
            ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {goals.map((goal) => {
                        const pct = Math.max(0, Math.min(Number(goal.percentage) || 0, 100));
                        const tone = STATUS_TONE[goal.status] || 'muted';
                        const behind =
                            goal.status === 'Behind' && goal.requiredMonthly > 0 ? goal.requiredMonthly - goal.backingMonthly : 0;

                        return (
                            <div
                                key={goal.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => onSelect(goal)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onSelect(goal);
                                    }
                                }}
                                className="group relative cursor-pointer rounded-card border border-line bg-sunken p-4 transition hover:border-line-strong hover:bg-raised"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-ink hover:underline">{goal.name}</p>
                                        <p className="mt-0.5 text-xs text-ink-muted">Target {goal.targetDate}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Badge tone={tone}>{goal.status || '—'}</Badge>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(goal.id);
                                            }}
                                            aria-label={`Delete ${goal.name}`}
                                            className="grid h-7 w-7 place-items-center rounded-control border border-line text-ink-faint transition hover:border-neg/30 hover:bg-neg-soft hover:text-neg"
                                        >
                                            <Trash2 size={13} aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 rounded-card bg-surface p-3">
                                    <div className="mb-1.5 flex items-baseline justify-between text-xs">
                                        <span className="font-bold text-ink">{formatCurrency(goal.achieved)}</span>
                                        <span className="text-ink-faint">of {formatCurrency(goal.targetAmount)}</span>
                                    </div>
                                    <Progress value={pct} tone={tone} />
                                    <div className="mt-1.5 flex items-center justify-between text-xs">
                                        <span
                                            className={
                                                pct >= 100
                                                    ? 'font-bold text-pos'
                                                    : pct >= 60
                                                      ? 'font-bold text-warn'
                                                      : 'font-bold text-neg'
                                            }
                                        >
                                            {goal.percentage}%
                                        </span>
                                        <span className="text-ink-muted">{goal.monthsLeft > 0 ? `${goal.monthsLeft} months left` : 'date passed'}</span>
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                                    <span className="text-ink-muted">Need {formatCurrency(goal.requiredMonthly)}/mo</span>
                                    {behind > 0 ? (
                                        <span className="font-bold text-warn">gap +{formatCurrency(Math.round(behind))}/mo</span>
                                    ) : (
                                        <span className="font-bold text-pos">backing {formatCurrency(goal.backingMonthly)}/mo</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
};

export default InvestmentGoalsWidget;