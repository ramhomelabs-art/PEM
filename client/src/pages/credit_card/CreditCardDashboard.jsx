import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    CreditCard,
    TrendingUp,
    Calendar,
    DollarSign,
    ShoppingBag,
    Zap,
    AlertCircle,
    Wallet,
    Plus,
    Filter,
    Trash2,
    ShieldAlert,
    ChevronDown
} from 'lucide-react';
import {
    PieChart as RePie, Pie, Cell, ResponsiveContainer, Tooltip,
    LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import ActionModal from '../../components/credit_card/ActionModal';
import RbiCalculatorWidget from '../../components/credit_card/RbiCalculatorWidget';
import { Panel, PanelHeader, StatTile, Button, IconBadge, Badge, EmptyState, Progress } from '../../components/ui/primitives';
import { cx } from '../../components/ui/cx';
import { formatCurrency, formatDate } from '../../utils/currency';

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

const getLocalISOString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localTime = new Date(now.getTime() - offset * 60 * 1000);
    return localTime.toISOString().slice(0, 16);
};

function bankGradient(bank = '', name = '') {
    const b = (bank || '').toLowerCase();
    const n = (name || '').toLowerCase();

    if (b.includes('hdfc')) return 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
    if (b.includes('icici')) return 'linear-gradient(135deg, #f97316 0%, #2563eb 100%)';
    if (b.includes('sbi')) return 'linear-gradient(135deg, #075985 0%, #0ea5e9 100%)';
    if (b.includes('axis')) return 'linear-gradient(135deg, #9f1239 0%, #e11d48 100%)';
    if (b.includes('kotak')) return 'linear-gradient(135deg, #be123c 0%, #fb7185 100%)';
    if (b.includes('amex') || b.includes('american express')) return 'linear-gradient(135deg, #064e3b 0%, #059669 100%)';
    if (b.includes('standard chartered') || b.includes('scb')) return 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)';
    if (b.includes('citi')) return 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)';
    if (b.includes('rbl')) return 'linear-gradient(135deg, #4338ca 0%, #818cf8 100%)';
    if (b.includes('yes bank') || b.includes('yesbank')) return 'linear-gradient(135deg, #1e40af 0%, #60a5fa 100%)';
    if (b.includes('idfc')) return 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)';
    if (b.includes('hsbc')) return 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)';
    if (n.includes('platinum')) return 'linear-gradient(135deg, #475569 0%, #94a3b8 100%)';
    if (n.includes('gold')) return 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)';
    if (n.includes('black') || n.includes('infinia')) return 'linear-gradient(135deg, #000000 0%, #333333 100%)';
    return DEFAULT_GRADIENT;
}

function cardBackground(card) {
    const c = card.color;
    if (typeof c === 'string' && c.trim() && c !== DEFAULT_GRADIENT) return c;
    return bankGradient(card.bankName, card.name);
}

const CHART_COLORS = ['var(--pem-positive)', 'var(--pem-info)', 'var(--pem-warning)', 'var(--pem-violet)', 'var(--pem-negative)'];

const tooltipStyle = {
    backgroundColor: 'var(--pem-surface-raised)',
    border: '1px solid var(--pem-border)',
    borderRadius: '12px',
    color: 'var(--pem-text)'
};

const CreditCardDashboard = () => {
    const { user } = useAuth();
    const { cards, categories, loading, addTransaction, deleteTransaction } = useCreditCards();
    const [filterCard, setFilterCard] = useState('all');
    const [error, setError] = useState('');
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });

    const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));
    const showAlert = (title, message, type = 'success') => setModal({ isOpen: true, title, message, type });

    useEffect(() => {
        document.title = 'Credit Cards | Dashboard';
    }, []);

    const currency = user?.currency || 'INR';
    const filteredCards = filterCard === 'all' ? cards : cards.filter((c) => c.id === parseInt(filterCard));

    const totalLimit = filteredCards.reduce((sum, card) => sum + (parseFloat(card.limit) || 0), 0);
    const totalUsed = filteredCards.reduce((sum, card) => sum + (parseFloat(card.used) || 0), 0);
    const availableCredit = totalLimit - totalUsed;
    const utilizationRate = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

    const allTransactions = filteredCards
        .flatMap((card) =>
            (card.transactions || []).map((t) => ({
                ...t,
                cardName: card.name,
                cardLast4: card.number ? card.number.slice(-4) : 'XXXX'
            }))
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const recentTransactions = allTransactions.slice(0, 5);

    const categoryTotals = filteredCards
        .flatMap((c) => c.transactions || [])
        .filter((txn) => txn.type !== 'credit')
        .reduce((acc, txn) => {
            acc[txn.category] = (acc[txn.category] || 0) + parseFloat(txn.amount);
            return acc;
        }, {});

    const categoryData = Object.keys(categoryTotals).length
        ? Object.entries(categoryTotals).map(([name, value]) => ({ name, value }))
        : [];

    const monthlyData = (() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentYear = new Date().getFullYear();
        const monthMap = months.reduce((acc, month) => ({ ...acc, [month]: 0 }), {});

        allTransactions.forEach((txn) => {
            if (txn.type === 'credit') return;
            const date = new Date(txn.date);
            if (date.getFullYear() === currentYear) {
                monthMap[months[date.getMonth()]] += parseFloat(txn.amount) || 0;
            }
        });

        return months.map((month) => ({ month, amount: monthMap[month] }));
    })();

    // Due-soon + RBI grace-period alerts
    const { notifications, gracePeriodAlerts } = (() => {
        const today = new Date();
        const currentDay = today.getDate();
        const notes = [];
        const grace = [];

        filteredCards.forEach((card) => {
            if (parseFloat(card.totalDue) > 0) {
                const dueDay = parseInt(card.dueDate);
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                const currentDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
                const currentDiff = Math.floor((todayStart - currentDue) / 86400000);
                const prevDue = new Date(today.getFullYear(), today.getMonth() - 1, dueDay);
                const prevDiff = Math.floor((todayStart - prevDue) / 86400000);

                let daysPast = -1;
                let resolvedDueDate = null;
                if (currentDiff > 0 && currentDiff <= 3) {
                    daysPast = currentDiff;
                    resolvedDueDate = currentDue;
                } else if (prevDiff > 0 && prevDiff <= 3) {
                    daysPast = prevDiff;
                    resolvedDueDate = prevDue;
                }

                if (daysPast > 0) {
                    const outstanding = parseFloat(card.totalDue);
                    let lateFee = 0;
                    if (outstanding <= 500) lateFee = 0;
                    else if (outstanding <= 1000) lateFee = 100;
                    else if (outstanding <= 10000) lateFee = 500;
                    else if (outstanding <= 25000) lateFee = 750;
                    else lateFee = 1000;

                    grace.push({
                        name: card.name,
                        bankName: card.bankName,
                        amount: card.totalDue,
                        daysPast,
                        lateFee,
                        dueDateStr: resolvedDueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    });
                }

                let daysUntilDue = dueDay - currentDay;
                if (daysUntilDue < 0) daysUntilDue += 30;

                if (daysUntilDue <= 7 && daysPast <= 0) {
                    notes.push({ type: 'card', name: card.name, amount: card.totalDue, date: card.dueDate, days: daysUntilDue });
                }
            }

            (card.emis || []).forEach((emi) => {
                if (!emi.isActive) return;
                const diffDays = Math.ceil((new Date(emi.nextDueDate) - today) / 86400000);
                if (diffDays >= 0 && diffDays <= 7) {
                    notes.push({ type: 'emi', name: `${card.name} (${emi.merchant})`, amount: emi.monthlyPayment, date: formatDate(emi.nextDueDate, { day: 'numeric', month: 'short' }), days: diffDays });
                }
            });
        });

        return { notifications: notes, gracePeriodAlerts: grace };
    })();

    const handleQuickAdd = async (e) => {
        e.preventDefault();
        setError('');
        const formData = new FormData(e.target);
        const cardId = formData.get('cardId');
        const amount = formData.get('amount');
        const merchant = formData.get('merchant');
        const category = formData.get('category');
        const transactionDateTime = formData.get('transactionDateTime');

        if (!cardId || !amount || !merchant) return;
        try {
            await addTransaction(cardId, {
                merchant,
                amount: parseFloat(amount),
                date: transactionDateTime || getLocalISOString(),
                category: category || 'Others',
                status: 'Completed',
                type: 'debit'
            });
            e.target.reset();
            showAlert('Transaction added', `${merchant} · ${formatCurrency(amount, currency)}`, 'success');
        } catch (err) {
            setError(err.message || 'Failed to add transaction');
        }
    };

    const statTiles = [
        { label: 'Total credit limit', value: formatCurrency(totalLimit, currency), icon: DollarSign, tone: 'brand' },
        { label: 'Total used', value: formatCurrency(totalUsed, currency), icon: TrendingUp, tone: 'warn' },
        { label: 'Available credit', value: formatCurrency(availableCredit, currency), icon: Wallet, tone: 'info' },
        { label: 'Utilisation', value: `${utilizationRate.toFixed(1)}%`, icon: Zap, tone: utilizationRate > 30 ? 'neg' : 'pos', hint: utilizationRate > 30 ? 'Aim below 30%' : 'Healthy' }
    ];

    // Estimated finance charges on any revolving (unpaid billed) balance, plus
    // the interest-free window, derived from the per-card APR added in Phase 3.
    const financeRows = filteredCards.map((card) => {
        const apr = parseFloat(card.apr) || 42;
        const revolving = Math.max(0, parseFloat(card.totalDue) || 0);
        const isRevolving = revolving > 0;
        const monthlyInterest = isRevolving ? revolving * (apr / 100 / 12) : 0;
        const gst = monthlyInterest * 0.18;
        return {
            id: card.id,
            name: card.name,
            bankName: card.bankName,
            apr,
            interestFreeDays: parseInt(card.interestFreeDays, 10) || 45,
            daysUntilDue: card.interestFree?.daysUntilDue ?? null,
            revolving,
            isRevolving,
            monthlyInterest,
            gst,
            total: monthlyInterest + gst
        };
    });

    return (
        <div className="mx-auto max-w-[1400px] p-6 md:p-8">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-ink">Credit Card Dashboard</h1>
                    <p className="mt-1 text-sm text-ink-muted">Track spending, dues and rewards across all your cards.</p>
                </div>

                <div className="relative">
                    <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                    <select
                        value={filterCard}
                        onChange={(e) => setFilterCard(e.target.value)}
                        className="h-10 rounded-control border border-line bg-surface pl-9 pr-8 text-sm font-semibold text-ink outline-none transition focus:border-line-strong"
                    >
                        <option value="all">All Cards</option>
                        {cards.map((card) => (
                            <option key={card.id} value={card.id}>
                                {card.bankName} - {card.name} (•••• {card.number ? card.number.slice(-4) : 'XXXX'})
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                </div>
            </header>

            {(gracePeriodAlerts.length > 0 || notifications.length > 0) && (
                <div className="mb-6 flex flex-col gap-3">
                    {gracePeriodAlerts.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-3 rounded-card border border-violet bg-violet-soft p-4"
                        >
                            <IconBadge icon={ShieldAlert} tone="violet" />
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-violet">RBI grace-period safe zone</h3>
                                {gracePeriodAlerts.map((alert, idx) => (
                                    <p key={idx} className="mt-1 text-xs leading-relaxed text-ink">
                                        <strong>{alert.bankName} - {alert.name}</strong> bill of{' '}
                                        <strong>{formatCurrency(alert.amount, currency)}</strong> was due {alert.dueDateStr}{' '}
                                        ({alert.daysPast === 1 ? 'yesterday' : `${alert.daysPast} days ago`}). Pay within the 3-day
                                        grace window to avoid a late fee of <strong>{formatCurrency(alert.lateFee, currency)} + 18% GST</strong>.
                                    </p>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {notifications.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-3 rounded-card border border-neg bg-neg-soft p-4"
                        >
                            <IconBadge icon={AlertCircle} tone="neg" />
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-neg">Payments due soon</h3>
                                {notifications.map((note, idx) => (
                                    <p key={idx} className="mt-1 text-xs leading-relaxed text-ink">
                                        <strong>{note.name}</strong>: {formatCurrency(note.amount, currency)} due{' '}
                                        {note.type === 'card' ? `on ${note.date}th` : `on ${note.date}`}{' '}
                                        ({note.days === 0 ? 'today' : note.days === 1 ? 'tomorrow' : `in ${note.days} days`})
                                    </p>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {statTiles.map((stat) => (
                    <StatTile key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} tone={stat.tone} hint={stat.hint} loading={loading} />
                ))}
            </div>

            <Panel className="mb-6">
                <PanelHeader
                    title="Quick transaction"
                    subtitle="Log a spend against any card"
                    icon={Plus}
                />
                <form onSubmit={handleQuickAdd} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <select name="cardId" required defaultValue={filterCard !== 'all' ? filterCard : ''} className="h-10 rounded-control border border-line bg-sunken px-3 text-sm font-semibold text-ink outline-none focus:border-line-strong">
                        <option value="">Select card</option>
                        {cards.map((card) => (
                            <option key={card.id} value={card.id}>{card.bankName} - {card.name}</option>
                        ))}
                    </select>
                    <select name="category" className="h-10 rounded-control border border-line bg-sunken px-3 text-sm font-semibold text-ink outline-none focus:border-line-strong">
                        <option value="">Category</option>
                        {categories && categories.length > 0 ? (
                            categories.map((cat) => <option key={cat.id} value={cat.name}>{cat.name}</option>)
                        ) : (
                            <>
                                <option value="Shopping">Shopping</option>
                                <option value="Food">Food</option>
                                <option value="Travel">Travel</option>
                                <option value="Bills">Bills</option>
                                <option value="Others">Others</option>
                            </>
                        )}
                    </select>
                    <input name="transactionDateTime" type="datetime-local" defaultValue={getLocalISOString()} required className="h-10 rounded-control border border-line bg-sunken px-3 text-sm font-semibold text-ink outline-none focus:border-line-strong" />
                    <input name="amount" type="number" min="0" step="0.01" placeholder="Amount" required className="h-10 rounded-control border border-line bg-sunken px-3 text-sm font-semibold text-ink outline-none focus:border-line-strong" />
                    <input name="merchant" type="text" placeholder="Merchant name" required className="h-10 rounded-control border border-line bg-sunken px-3 text-sm font-semibold text-ink outline-none focus:border-line-strong md:col-span-3" />
                    <Button type="submit" variant="primary" icon={Plus}>Add transaction</Button>
                </form>
                {error ? <p className="mt-3 text-xs font-semibold text-neg">{error}</p> : null}
            </Panel>

            <section className="mb-6">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-ink-faint">Your Cards</h3>
                {filteredCards.length === 0 ? (
                    <EmptyState icon={CreditCard} title="No cards yet" description="Add a card from the My Cards tab to see it here." />
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filteredCards.map((card, index) => {
                            const limit = Number(card.limit) || 0;
                            const used = Number(card.used) || 0;
                            const pct = limit > 0 ? (used / limit) * 100 : 0;
                            return (
                                <motion.div
                                    key={card.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="overflow-hidden rounded-card border border-line bg-sunken p-3"
                                >
                                    <div className="relative overflow-hidden rounded-[14px] p-5 text-white shadow-card" style={{ background: cardBackground(card) }}>
                                        <div className="flex items-start justify-between">
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-extrabold uppercase tracking-wide opacity-90">{card.bankName}</p>
                                                <p className="truncate text-xs opacity-80">{card.name}</p>
                                            </div>
                                            <CreditCard size={20} className="opacity-80" aria-hidden="true" />
                                        </div>
                                        <p className="tnum mt-5 text-base tracking-[0.22em]">
                                            •••• •••• •••• {card.number ? card.number.slice(-4) : '****'}
                                        </p>
                                        <div className="mt-4 flex items-end justify-between">
                                            <div>
                                                <p className="text-[11px] uppercase tracking-wide opacity-70">Total due</p>
                                                <p className="tnum text-xl font-extrabold">{formatCurrency(card.totalDue, currency)}</p>
                                                <p className="mt-0.5 text-[11px] opacity-70">Unbilled {formatCurrency(card.unbilled, currency)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] uppercase tracking-wide opacity-70">Available</p>
                                                <p className="tnum text-base font-bold">{formatCurrency(card.available, currency)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between text-xs">
                                        <span className="text-ink-faint">Utilisation</span>
                                        <span className="tnum font-bold text-ink-muted">{pct.toFixed(0)}%</span>
                                    </div>
                                    <div className="mt-1.5">
                                        <Progress value={pct} threshold={30} />
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs text-ink-faint">
                                        <span className="inline-flex items-center gap-1"><Calendar size={12} aria-hidden="true" /> Due {card.dueDate}th</span>
                                        <Link
                                            to="/credit-cards/monthly-bills"
                                            className="rounded-control border border-line bg-raised px-2 py-0.5 font-bold text-ink transition hover:border-line-strong"
                                        >
                                            Pay now
                                        </Link>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </section>

            <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Panel>
                    <PanelHeader title="Spending by category" icon={ShoppingBag} />
                    {categoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 300 }}>
                            <RePie>
                                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value, currency)} />
                            </RePie>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState icon={ShoppingBag} title="No expense data yet" description="Add transactions to see the breakdown." />
                    )}
                </Panel>

                <Panel>
                    <PanelHeader title="Monthly spending trend" icon={TrendingUp} />
                    <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 300 }}>
                        <LineChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--pem-border)" />
                            <XAxis dataKey="month" stroke="var(--pem-text-secondary)" tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--pem-text-secondary)" tickLine={false} axisLine={false} width={48} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value, currency)} />
                            <Line type="monotone" dataKey="amount" stroke="var(--pem-violet)" strokeWidth={3} dot={{ fill: 'var(--pem-violet)', r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </Panel>
            </div>

            <Panel className="mb-6">
                <PanelHeader title="Recent transactions" icon={ShoppingBag} />
                {recentTransactions.length === 0 ? (
                    <EmptyState icon={ShoppingBag} title="No recent transactions" description="Transactions across your cards will appear here." />
                ) : (
                    <ul className="flex flex-col gap-2">
                        {recentTransactions.map((txn) => (
                            <li key={txn.id} className="flex items-center justify-between gap-3 rounded-control border border-line bg-sunken p-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <IconBadge icon={ShoppingBag} tone="violet" size="sm" />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-ink">{txn.merchant}</p>
                                        <p className="truncate text-xs text-ink-faint">
                                            {formatDate(txn.date, { day: 'numeric', month: 'short', year: 'numeric' })} • {txn.cardName} •••• {txn.cardLast4}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <p className={cx('tnum text-sm font-extrabold', txn.type === 'credit' ? 'text-pos' : 'text-neg')}>
                                            {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount, currency)}
                                        </p>
                                        <p className="text-[11px] text-ink-faint">{txn.category}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => deleteTransaction(txn.creditCardId, txn.id)}
                                        title="Delete transaction"
                                        className="rounded-control p-2 text-ink-faint transition hover:bg-neg-soft hover:text-neg"
                                    >
                                        <Trash2 size={15} aria-hidden="true" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>

            <Panel className="mb-6">
                <PanelHeader
                    title="Finance charges & interest-free period"
                    subtitle="Estimated cost of carrying a balance at your card APR"
                    icon={DollarSign}
                />
                {financeRows.length === 0 ? (
                    <EmptyState icon={DollarSign} title="No cards yet" description="Add a card to see finance charges." />
                ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {financeRows.map((row) => (
                            <div key={row.id} className="rounded-control border border-line bg-sunken p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-ink">
                                            {row.bankName} - {row.name}
                                        </p>
                                        <p className="text-xs text-ink-faint">
                                            APR {row.apr}% p.a. · Interest-free {row.interestFreeDays} days
                                        </p>
                                    </div>
                                    <Badge tone={row.isRevolving ? 'neg' : 'pos'}>
                                        {row.isRevolving ? 'Revolving' : 'Grace'}
                                    </Badge>
                                </div>

                                {row.isRevolving ? (
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        <Metric label="Balance" value={formatCurrency(row.revolving, currency)} />
                                        <Metric label="Interest/mo" value={formatCurrency(row.monthlyInterest, currency)} />
                                        <Metric label="Est. with GST" value={formatCurrency(row.total, currency)} />
                                    </div>
                                ) : (
                                    <p className="mt-3 text-xs text-ink-muted">
                                        No revolving balance. Paying in full keeps this card interest-free
                                        {row.daysUntilDue != null ? ` — ${row.daysUntilDue} days left in the current cycle.` : '.'}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Panel>

            <RbiCalculatorWidget />

            <ActionModal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} message={modal.message} type={modal.type} />
        </div>
    );
};

function Metric({ label, value }) {
    return (
        <div className="rounded-[8px] border border-line bg-surface p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
            <p className="tnum mt-0.5 text-sm font-bold text-ink">{value}</p>
        </div>
    );
}

export default CreditCardDashboard;
