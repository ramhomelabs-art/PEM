import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { useSmartNotes } from '../../context/personal_expense/SmartNotesContext';
import {
    useBudgetAlerts,
    useBudgetVsActual,
    useCategoryBreakdown,
    useCommitments,
    useDailySeries,
    useDailySpendMonth,
    useInsights,
    useKpiMetrics,
    useTransactions,
    useUnreadMessages,
    useUpcomingObligations,
    useWeatherLocation,
} from '../../hooks/personal_expense/useDashboardData';

import { IconBadge, Panel, PanelHeader } from '../../components/ui/primitives';
import { formatCurrency, formatPercent } from '../../utils/currency';
import { CHART, RANGE_PRESETS } from '../../utils/theme';
import { exportTransactionsCsv, printDashboard } from '../../utils/exportDashboard';

import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { CashFlowCard } from '../../components/dashboard/CashFlowCard';
import { CategoryDonut } from '../../components/dashboard/CategoryDonut';
import { BudgetActualChart } from '../../components/dashboard/charts';
import { DailySpendingCard } from '../../components/dashboard/DailySpendingCard';
import { ActivityList } from '../../components/dashboard/ActivityList';
import { DueList } from '../../components/dashboard/DueList';
import { CreditCardsPanel } from '../../components/dashboard/CreditCardsPanel';
import { InvestmentPanel } from '../../components/dashboard/InvestmentPanel';
import { InsightsCard } from '../../components/dashboard/InsightsCard';
import { CommandPalette } from '../../components/dashboard/CommandPalette';
import { EmergencyFundRunwayCard } from '../../components/dashboard/EmergencyFundRunwayCard';
import { SafeToSpendWidget } from '../../components/dashboard/SafeToSpendWidget';

import WeatherLocationModal from '../../components/personal_expense/WeatherLocationModal';
import TransactionModal from '../../components/personal_expense/TransactionModal';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';
import NotificationCenter from '../../components/personal_expense/NotificationCenter';
import CalculatorPanel from '../../components/personal_expense/CalculatorPanel';
import ContactsDropdown from '../../components/personal_expense/ContactsDropdown';
import MessagesDropdown from '../../components/personal_expense/MessagesDropdown';
import ShareDropdown from '../../components/personal_expense/ShareDropdown';
import BirthdayGreeting from '../../components/personal_expense/BirthdayGreeting';
import { FinancialIntelligenceHub } from '../../components/dashboard/FinancialIntelligenceHub';
import FinancialTimeMachineModal from '../../components/personal_expense/FinancialTimeMachineModal';
import FunSavingsJarModal from '../../components/personal_expense/FunSavingsJarModal';
import FunPotVerificationModal from '../../components/personal_expense/FunPotVerificationModal';
import WeekendBurnModal from '../../components/personal_expense/WeekendBurnModal';
import ReceiptScannerModal from '../../components/personal_expense/ReceiptScannerModal';

const currencyOf = (user) => user?.currency || 'INR';

function resolveMonths(range, customRange) {
    if (range === 'custom' && customRange.from) {
        const from = new Date(customRange.from);
        const to = customRange.to ? new Date(customRange.to) : new Date();
        const days = Math.max(1, (to - from) / 86400000);
        return Math.max(1, Math.round(days / 30));
    }
    return RANGE_PRESETS.find((p) => p.id === range)?.months ?? 6;
}

const isTypingTarget = (el) =>
    el &&
    (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable);

const Dashboard = () => {
    const { user } = useAuth();
    const { cards = [] } = useCreditCards();
    const { notes = [], openNotes } = useSmartNotes();
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();

    const userId = user?.id;
    const currency = currencyOf(user);

    /* data ------------------------------------------------------------- */
    const {
        transactions,
        loading: txLoading,
        reload: reloadTransactions,
        remove: deleteTransaction,
    } = useTransactions(userId);

    const { bills, loans, borrow, budgets, banks, loading: commitmentsLoading } =
        useCommitments(userId);

    const { location: weatherLocation, update: updateWeather } = useWeatherLocation(
        user?.preferences?.weather
    );

    /* ui state --------------------------------------------------------- */
    // Defaults to the current calendar month.
    const [range, setRange] = useState('1m');
    const [customRange, setCustomRange] = useState({ from: '', to: '' });
    const [compare, setCompare] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [activityTab, setActivityTab] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState(null);

    const [dismissed, setDismissed] = useState([]);
    const [modal, setModal] = useState({ open: false, mode: 'add', entry: null });
    const [confirm, setConfirm] = useState({ open: false, id: null });
    const [showNotifications, setShowNotifications] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [showContacts, setShowContacts] = useState(false);
    const [showMessages, setShowMessages] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showWeather, setShowWeather] = useState(false);
    const [showTimeMachine, setShowTimeMachine] = useState(false);
    const [showFunJar, setShowFunJar] = useState(false);
    const [showWeekendBurn, setShowWeekendBurn] = useState(false);
    const [showReceiptScanner, setShowReceiptScanner] = useState(false);
    const [funJarBalance, setFunJarBalance] = useState(() => {
        const saved = localStorage.getItem('pem-fun-jar-balance');
        if (!saved || saved === '7101' || saved === '8450') {
            localStorage.setItem('pem-fun-jar-balance', '0');
            return 0;
        }
        return Number(saved) || 0;
    });
    const [pendingVerification, setPendingVerification] = useState(null);
    const [messageToast, setMessageToast] = useState(null);

    // Check for unverified physical cash pot deposits from previous day / pending holds
    useEffect(() => {
        try {
            const savedList = JSON.parse(localStorage.getItem('pem-fun-jar-pending-verifications') || '[]');
            const itemToVerify = savedList.find((item) => item.status === 'pending');
            if (itemToVerify) {
                setPendingVerification(itemToVerify);
                return;
            }

            // Also check directly from transactions if any hold exists
            if (Array.isArray(transactions) && transactions.length > 0) {
                const holdTx = transactions.find((t) => t.source === 'fun_jar_hold');
                if (holdTx) {
                    setPendingVerification({
                        id: `verify_${holdTx.id}`,
                        transactionId: holdTx.id,
                        amount: holdTx.amount,
                        goalTitle: holdTx.description || 'Fun Money Goal',
                        date: holdTx.date,
                        dateStr: new Date(holdTx.date).toISOString().split('T')[0],
                        status: 'pending',
                    });
                }
            }
        } catch {
            // ignore JSON error
        }
    }, [transactions]);

    const openAdd = useCallback(
        () => setModal({ open: true, mode: 'add', entry: null }),
        []
    );

    /* keyboard shortcuts ---------------------------------------------- */
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen(true);
                return;
            }
            if (
                !e.ctrlKey &&
                !e.metaKey &&
                !e.altKey &&
                e.key.toLowerCase() === 'n' &&
                !isTypingTarget(e.target)
            ) {
                e.preventDefault();
                openAdd();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openAdd]);

    /* derived data ---------------------------------------------------- */
    const months = resolveMonths(range, customRange);

    // Transactions limited to the selected date range, so range-driven widgets
    // (e.g. Spend by category) reconcile with the header filter instead of
    // silently showing all-time totals.
    const scopedTransactions = useMemo(() => {
        const start = new Date();
        if (range === 'custom' && customRange.from) {
            start.setTime(new Date(customRange.from).getTime());
        } else {
            start.setMonth(start.getMonth() - (months - 1));
            start.setDate(1);
        }
        start.setHours(0, 0, 0, 0);
        const end =
            range === 'custom' && customRange.to
                ? new Date(`${customRange.to}T23:59:59.999`)
                : null;

        return transactions.filter((t) => {
            const d = new Date(t.date);
            if (Number.isNaN(d.getTime())) return false;
            if (d < start) return false;
            if (end && d > end) return false;
            return true;
        });
    }, [transactions, range, customRange, months]);

    const kpi = useKpiMetrics(transactions, months);
    const daily = useDailySeries(transactions, 30);
    const expenseBreakdown = useCategoryBreakdown(scopedTransactions, 'expense');
    const dailyCurrent = useDailySpendMonth(transactions, 0);
    const dailyPrevious = useDailySpendMonth(transactions, 1);
    const budgetVsActual = useBudgetVsActual(transactions, budgets, 0);
    const budgetAlerts = useBudgetAlerts(transactions, budgets);
    const obligations = useUpcomingObligations(bills, loans, borrow, { days: 30 });
    const insights = useInsights(transactions, budgets);

    const { count: unreadCount, conversations } = useUnreadMessages(Boolean(user), {
        onNewMessage: (msg) => setMessageToast(msg),
    });

    const sparks = useMemo(() => {
        let cumulative = 0;
        const balance = daily.map((d) => (cumulative += d.net));
        return {
            balance,
            income: daily.map((d) => d.income),
            expense: daily.map((d) => d.expense),
        };
    }, [daily]);

    const heatmapSeries = useMemo(
        () => daily.map((d) => ({ date: d.date, amount: d.expense })),
        [daily]
    );

    const dismiss = useCallback((id) => {
        setDismissed((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }, []);

    const activeObligations = obligations.filter((o) => !dismissed.includes(o.id));
    const activeBudgetAlerts = budgetAlerts.filter(
        (b) => !dismissed.includes(`budget-${b.category}`)
    );
    const activeNoteReminders = useMemo(() => {
        return (notes || [])
            .filter((n) => !n.isTrashed && !n.isArchived && Boolean(n.due))
            .map((n) => ({
                id: n.id,
                title: n.title || 'Smart Keep Note',
                message: n.content ? (n.content.length > 80 ? n.content.slice(0, 80) + '…' : n.content) : '',
                due: n.due,
            }))
            .filter((n) => !dismissed.includes(`note-${n.id}`));
    }, [notes, dismissed]);
    const alertCount =
        activeObligations.length +
        activeBudgetAlerts.length +
        activeNoteReminders.length +
        unreadCount;

    const historyFeed = useMemo(
        () =>
            transactions.slice(0, 25).map((t) => ({
                id: t.id,
                title: t.description || t.category,
                time: t.date,
                desc: `${t.type === 'income' ? 'Received' : 'Paid'} ${t.amount}`,
                type: t.type === 'income' ? 'success' : 'info',
            })),
        [transactions]
    );

    const safeToSpendData = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const currentDay = today.getDate();
        const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);

        const isToday = (dateVal) => {
            if (!dateVal) return false;
            const d = new Date(dateVal);
            return (
                !isNaN(d.getTime()) &&
                d.getFullYear() === year &&
                d.getMonth() === month &&
                d.getDate() === currentDay
            );
        };

        const todayExpenseTransactions = (transactions || []).filter(
            (t) => (t.type === 'expense' || !t.type) && isToday(t.date)
        );
        const todaySpent = todayExpenseTransactions.reduce(
            (sum, t) => sum + Math.abs(Number(t.amount) || 0),
            0
        );

        const bankBalanceSum = Array.isArray(banks)
            ? banks.reduce((sum, b) => sum + (Number(b.balance) || 0), 0)
            : 0;
        const liquidCash = bankBalanceSum > 0 ? bankBalanceSum : Math.max(0, kpi.current.balance || 0);

        const upcomingBills = (bills || []).filter((b) => {
            if (b.status === 'paid') return false;
            if (!b.dueDate) return true;
            const due = new Date(b.dueDate);
            return (
                due.getMonth() === month &&
                due.getFullYear() === year &&
                due.getDate() >= currentDay
            );
        });
        const billsTotal = upcomingBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);

        const activeEmis = (loans || []).filter((l) => l.status !== 'closed' && !l.isEmiPaid);
        const emisTotal = activeEmis.reduce((s, l) => s + (Number(l.emiAmount) || 0), 0);

        const pendingPayables = (borrow || []).filter((w) => w.status !== 'settled' && w.type === 'borrowed');
        const payablesTotal = pendingPayables.reduce((s, w) => s + (Number(w.amount) || 0), 0);

        const totalObligations = billsTotal + emisTotal + payablesTotal;
        const safeMonth = Math.max(0, liquidCash - totalObligations);
        const poolStartOfToday = safeMonth + todaySpent;
        const dailyTarget = Math.max(0, Math.round(poolStartOfToday / daysRemaining));
        const safeTodayRemaining = Math.max(0, dailyTarget - todaySpent);

        return {
            liquidCash,
            todaySpent,
            dailyTarget,
            safeTodayRemaining,
            totalObligations,
        };
    }, [transactions, banks, bills, loans, borrow, kpi.current.balance]);

    const loading = txLoading || commitmentsLoading;

    const handleDelete = useCallback(async () => {
        try {
            await deleteTransaction(confirm.id);
        } catch {
            // Row remains until the next successful reload; nothing else to do.
        } finally {
            setConfirm({ open: false, id: null });
        }
    }, [confirm.id, deleteTransaction]);

    const handleExportCsv = useCallback(() => {
        exportTransactionsCsv(transactions, 'pem-dashboard.csv');
    }, [transactions]);

    /* KPI definitions ------------------------------------------------- */
    const money = useCallback((v) => formatCurrency(v, currency), [currency]);
    const kpis = [
        {
            icon: Wallet,
            label: 'Total Balance',
            value: kpi.current.balance,
            format: money,
            delta: kpi.deltas.balance,
            spark: sparks.balance,
            sparkColor: CHART.net,
            tone: 'brand',
        },
        {
            icon: TrendingUp,
            label: 'Income',
            value: kpi.current.income,
            format: money,
            delta: kpi.deltas.income,
            spark: sparks.income,
            sparkColor: CHART.income,
            tone: 'pos',
        },
        {
            icon: TrendingDown,
            label: 'Spend',
            value: kpi.current.expense,
            format: money,
            delta: kpi.deltas.expense,
            deltaInverse: true,
            spark: sparks.expense,
            sparkColor: CHART.expense,
            tone: 'neg',
        },
        {
            icon: PiggyBank,
            label: 'Savings Rate',
            value: kpi.current.savingsRate,
            format: (v) => formatPercent(v),
            delta: kpi.deltas.savingsRate,
            ring: kpi.current.savingsRate,
            ringColor: CHART.net,
            tone: 'violet',
        },
    ];

    const enter = (i) =>
        reduceMotion
            ? {}
            : {
                  initial: { opacity: 0, y: 14 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.35, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
              };

    return (
        <>
            <DashboardHeader
                user={user}
                unreadCount={unreadCount}
                alertCount={alertCount}
                weatherLocation={weatherLocation}
                range={range}
                onRangeChange={setRange}
                customRange={customRange}
                onCustomRangeChange={setCustomRange}
                compare={compare}
                onToggleCompare={() => setCompare((c) => !c)}
                onSearch={() => setPaletteOpen(true)}
                onAdd={openAdd}
                onOpenWeather={() => setShowWeather(true)}
                onOpenNotes={openNotes}
                onOpenContacts={() => setShowContacts(true)}
                onOpenMessages={() => setShowMessages(true)}
                onOpenShare={() => setShowShare(true)}
                onOpenNotifications={() => setShowNotifications((prev) => !prev)}
                notificationSlot={
                    <NotificationCenter
                        isOpen={showNotifications}
                        onClose={() => setShowNotifications(false)}
                        activeReminders={{
                            bills: activeObligations.filter((o) => o.kind === 'bill'),
                            loans: activeObligations.filter((o) => o.kind === 'emi'),
                            borrow: activeObligations.filter((o) => o.kind === 'borrow'),
                            notes: activeNoteReminders,
                        }}
                        budgetAlerts={activeBudgetAlerts}
                        historyData={historyFeed}
                        messages={conversations}
                        onDismiss={dismiss}
                        onOpenMessages={() => {
                            setShowMessages(true);
                        }}
                        onOpenNotes={openNotes}
                    />
                }
                onExportCsv={handleExportCsv}
                onExportPdf={printDashboard}
            />

            <main className="print-area page-container">
                {/* Safe-to-Spend Intelligence Widget */}
                <motion.div {...enter(0)}>
                    <SafeToSpendWidget
                        transactions={transactions}
                        banks={banks}
                        bills={bills}
                        loans={loans}
                        borrow={borrow}
                        budgets={budgets}
                        kpiBalance={kpi.current.balance}
                        currency={currency}
                        loading={loading}
                    />
                </motion.div>

                {/* KPI row */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {kpis.map((k, i) => (
                        <motion.div key={k.label} {...enter(i)}>
                            <KpiCard {...k} loading={loading} />
                        </motion.div>
                    ))}
                </section>

                {/* 1. Recent activity + Spend by category */}
                <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
                    <motion.div className="md:col-span-2 xl:col-span-5" {...enter(0)}>
                        <Panel className="flex h-full flex-col">
                            <PanelHeader
                                title="Recent Activity"
                                subtitle="Latest transactions"
                                icon={Wallet}
                            />
                            <ActivityList
                                transactions={transactions}
                                currency={currency}
                                loading={txLoading}
                                tab={activityTab}
                                onTabChange={setActivityTab}
                                categoryFilter={categoryFilter}
                                onClearFilter={() => setCategoryFilter(null)}
                                onViewAll={() => navigate('/transactions')}
                                limit={6}
                            />
                        </Panel>
                    </motion.div>

                    <motion.div className="md:col-span-2 xl:col-span-7" {...enter(1)}>
                        <Panel className="flex h-full flex-col">
                            <PanelHeader
                                title="Spend by Category"
                                subtitle={categoryFilter ? `Filtered: ${categoryFilter}` : 'Click a slice to filter activity'}
                                icon={PiggyBank}
                            />
                            <CategoryDonut
                                data={expenseBreakdown}
                                currency={currency}
                                loading={txLoading}
                                activeCategory={categoryFilter}
                                onSelect={(c) => setCategoryFilter((prev) => (prev === c ? null : c))}
                                transactions={scopedTransactions}
                                allTransactions={transactions}
                                range={range}
                            />
                        </Panel>
                    </motion.div>
                </section>

                {/* 2. Cash flow stream */}
                <section className="mt-4">
                    <motion.div {...enter(0)}>
                        <CashFlowCard
                            transactions={transactions}
                            range={range}
                            customRange={customRange}
                            currency={currency}
                            loading={txLoading}
                            onAdd={openAdd}
                        />
                    </motion.div>
                </section>

                {/* 3. Daily spend + budget vs actual */}
                <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
                    <motion.div className="md:col-span-2 xl:col-span-7" {...enter(0)}>
                        <Panel className="h-full">
                            <DailySpendingCard
                                transactions={transactions}
                                budgets={budgets}
                                currency={currency}
                                loading={txLoading}
                            />
                        </Panel>
                    </motion.div>

                    <motion.div className="md:col-span-2 xl:col-span-5" {...enter(1)}>
                        <Panel className="h-full">
                            <PanelHeader title="Budget vs Actual" subtitle="This month" icon={PiggyBank} />
                            <BudgetActualChart data={budgetVsActual} currency={currency} loading={loading} />
                        </Panel>
                    </motion.div>
                </section>

                {/* 4. Insights + upcoming dues */}
                <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
                    <motion.div className="md:col-span-2 xl:col-span-7" {...enter(0)}>
                        <Panel className="flex h-full flex-col">
                            <PanelHeader title="Insights" subtitle="Smart financial alerts" icon={TrendingUp} />
                            <InsightsCard
                                transactions={transactions}
                                budgets={budgets}
                                currency={currency}
                                loading={loading}
                            />
                        </Panel>
                    </motion.div>

                    <motion.div className="md:col-span-2 xl:col-span-5" {...enter(1)}>
                        <Panel className="flex h-full flex-col">
                            <PanelHeader title="Upcoming Dues" subtitle="Next 30 days" icon={Wallet} />
                            <DueList items={activeObligations} currency={currency} loading={loading} />
                        </Panel>
                    </motion.div>
                </section>

                {/* Financial Intelligence & Prediction Lab */}
                <motion.div className="mt-4" {...enter(0)}>
                    <FinancialIntelligenceHub
                        onOpenTimeMachine={() => setShowTimeMachine(true)}
                        onOpenFunJar={() => setShowFunJar(true)}
                        onOpenWeekendBurn={() => setShowWeekendBurn(true)}
                        onOpenReceiptScanner={() => setShowReceiptScanner(true)}
                        funJarBalance={funJarBalance}
                        currency={currency}
                    />
                </motion.div>

                {/* 5. Credit cards + investment */}
                <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
                    <motion.div className="md:col-span-1 xl:col-span-6" {...enter(0)}>
                        <Panel className="h-full">
                            <PanelHeader title="Credit Cards" subtitle="Balance & utilisation" icon={Wallet} />
                            <CreditCardsPanel cards={cards} currency={currency} loading={loading} />
                        </Panel>
                    </motion.div>

                    <motion.div className="md:col-span-1 xl:col-span-6" {...enter(1)}>
                        <InvestmentPanel />
                    </motion.div>
                </section>

                {/* 6. Emergency Fund Runway Intelligence (Overview End) */}
                <motion.div className="mt-4 pb-6" {...enter(0)}>
                    <EmergencyFundRunwayCard
                        banks={banks}
                        transactions={transactions}
                        kpiBalance={kpi.current.balance}
                        liquidBalance={safeToSpendData.liquidCash}
                        currency={currency}
                        loading={loading}
                    />
                </motion.div>
            </main>

            {/* ------------------------------------------------ overlays -- */}

            <AnimatePresence>
                {paletteOpen ? (
                    <CommandPalette
                        transactions={transactions}
                        currency={currency}
                        onClose={() => setPaletteOpen(false)}
                        onAdd={openAdd}
                    />
                ) : null}
            </AnimatePresence>

            <TransactionModal
                isOpen={modal.open}
                onClose={() => setModal({ open: false, mode: 'add', entry: null })}
                user={user}
                onReload={reloadTransactions}
                mode={modal.mode}
                editData={modal.entry}
            />

            <ConfirmDialog
                isOpen={confirm.open}
                onConfirm={handleDelete}
                onCancel={() => setConfirm({ open: false, id: null })}
                title="Delete transaction"
                message="This permanently removes the entry. This cannot be undone."
            />

            <CalculatorPanel isOpen={showCalculator} onClose={() => setShowCalculator(false)} />

            <ContactsDropdown
                isOpen={showContacts}
                onClose={() => setShowContacts(false)}
                currentUser={user}
                onOpenMessages={() => setShowMessages(true)}
            />

            <MessagesDropdown
                isOpen={showMessages}
                onClose={() => setShowMessages(false)}
                currentUser={user}
                initialFriend={null}
            />

            <ShareDropdown
                isOpen={showShare}
                onClose={() => setShowShare(false)}
                currentUser={user}
            />

            <WeatherLocationModal
                isOpen={showWeather}
                onClose={() => setShowWeather(false)}
                onSelectLocation={(next) => {
                    updateWeather(next);
                    setShowWeather(false);
                }}
                currentLocation={
                    weatherLocation?.display || weatherLocation?.name || ''
                }
            />

            <MessageToast
                toast={messageToast}
                onDismiss={() => setMessageToast(null)}
                onOpen={() => {
                    setMessageToast(null);
                    setShowMessages(true);
                }}
            />

            <BirthdayGreeting user={user} />

            {/* Financial Intelligence Modals */}
            <FinancialTimeMachineModal
                isOpen={showTimeMachine}
                onClose={() => setShowTimeMachine(false)}
                currentBalance={safeToSpendData.liquidCash}
                monthlyIncome={kpi.current.income}
                monthlyExpense={kpi.current.expense}
                activeObligations={safeToSpendData.totalObligations}
                currency={currency}
            />

            <FunSavingsJarModal
                isOpen={showFunJar}
                onClose={() => setShowFunJar(false)}
                todayUnderSpend={safeToSpendData.safeTodayRemaining}
                todaySpent={safeToSpendData.todaySpent}
                dailyTarget={safeToSpendData.dailyTarget}
                currency={currency}
                user={user}
                onReloadTransactions={reloadTransactions}
                onJarUpdate={(newBal) => setFunJarBalance(newBal)}
            />

            <FunPotVerificationModal
                isOpen={Boolean(pendingVerification)}
                verificationItem={pendingVerification}
                onClose={() => setPendingVerification(null)}
                onVerified={() => setPendingVerification(null)}
                onRolledBack={(item, newJar) => {
                    setFunJarBalance(newJar);
                    setPendingVerification(null);
                    reloadTransactions();
                }}
                currency={currency}
            />

            <WeekendBurnModal
                isOpen={showWeekendBurn}
                onClose={() => setShowWeekendBurn(false)}
                transactions={transactions}
                currency={currency}
            />

            <ReceiptScannerModal
                isOpen={showReceiptScanner}
                onClose={() => setShowReceiptScanner(false)}
                onSaveTransaction={async (tx) => {
                    try {
                        openAdd();
                    } catch (e) {
                        console.error(e);
                    }
                }}
                currency={currency}
            />
        </>
    );
};

/* --------------------------------------------------------------- toast -- */

function MessageToast({ toast, onDismiss, onOpen }) {
    return (
        <AnimatePresence>
            {toast ? (
                <motion.button
                    type="button"
                    onClick={onOpen}
                    initial={{ opacity: 0, y: -16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className="fixed left-1/2 top-20 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-card border border-line bg-surface p-3 text-left shadow-raised backdrop-blur-xl"
                >
                    <IconBadge icon={MessageCircle} tone="info" />
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">
                            New message from{' '}
                            {toast.sender?.fullName || toast.sender?.username || 'a contact'}
                        </span>
                        <span className="block truncate text-xs text-ink-faint">{toast.message}</span>
                    </span>
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDismiss();
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && onDismiss()}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-ink-faint hover:text-ink"
                    >
                        Dismiss
                    </span>
                </motion.button>
            ) : null}
        </AnimatePresence>
    );
}

export default Dashboard;
