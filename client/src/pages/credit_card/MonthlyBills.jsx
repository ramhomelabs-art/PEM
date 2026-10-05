import { useState, useEffect, Fragment } from 'react';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { useCardSession } from '../../context/credit_card/CardSessionContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Filter,
    Calendar,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    ArrowRight,
    Info,
    RefreshCw,
    Trash2,
    FileDown
} from 'lucide-react';
import { Panel, PanelHeader, Button, Badge, EmptyState } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { cx } from '../../components/ui/cx';
import ActionModal from '../../components/credit_card/ActionModal';
import { formatCurrency } from '../../utils/currency';
import { downloadCreditCardStatement } from '../../utils/creditCardStatement';
import { useAuth } from '../../context/personal_expense/AuthContext';

const MonthlyBills = () => {
    const { cards, updateCard, addTransaction, fetchCards } = useCreditCards();
    const { authFetch } = useCardSession();
    const { user } = useAuth();

    const [filterCard, setFilterCard] = useState('all');
    const [selectedCardForPayment, setSelectedCardForPayment] = useState(null);
    const [paymentMode, setPaymentMode] = useState('full');
    const [customAmount, setCustomAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('current');
    const [historyBills, setHistoryBills] = useState([]);
    const [isGeneratingBills, setIsGeneratingBills] = useState(false);
    const [expandedBillId, setExpandedBillId] = useState(null);

    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'confirm', onConfirm: null });

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const closeModal = () => {
        setSelectedCardForPayment(null);
        setIsSubmitting(false);
        setModal((prev) => ({ ...prev, isOpen: false }));
    };

    const filteredCards = filterCard === 'all' ? cards : cards.filter((c) => c.id === parseInt(filterCard));
    const dueCards = filteredCards.filter((card) => (card.totalDue || 0) > 0);

    useEffect(() => {
        if (activeTab !== 'history') return undefined;

        if (filterCard === 'all') {
            const clear = setTimeout(() => setHistoryBills([]), 0);
            return () => clearTimeout(clear);
        }

        let cancelled = false;
        authFetch(`/credit-cards/${filterCard}/bills`)
            .then((res) => res.json())
            .then((data) => {
                if (!cancelled) setHistoryBills(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (!cancelled) setHistoryBills([]);
            });

        return () => {
            cancelled = true;
        };
    }, [activeTab, filterCard, authFetch]);

    const openPaymentModal = (card) => {
        setSelectedCardForPayment(card);
        setPaymentMode('full');
        setCustomAmount('');
    };

    const closePaymentModal = () => {
        setSelectedCardForPayment(null);
        setIsSubmitting(false);
    };

    const handlePayment = async () => {
        if (!selectedCardForPayment) return;
        setIsSubmitting(true);

        const amountToPay =
            paymentMode === 'full' ? selectedCardForPayment.totalDue || 0 : parseFloat(customAmount);

        try {
            await addTransaction(selectedCardForPayment.id, {
                merchant: 'Bill Payment',
                amount: amountToPay,
                date: new Date().toISOString(),
                category: 'Bills',
                type: 'credit',
                description: 'Monthly Bill Payment'
            });

            const newTotalDue = Math.max(0, (selectedCardForPayment.totalDue || 0) - amountToPay);
            await updateCard(selectedCardForPayment.id, { totalDue: newTotalDue });

            closePaymentModal();
            showToast('Payment successful!', 'success');
        } catch (error) {
            console.error('Payment failed', error);
            showToast('Payment failed. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGenerateBills = async () => {
        setIsGeneratingBills(true);
        try {
            const res = await authFetch('/credit-cards/generate-bills', { method: 'POST' });
            if (res.ok) {
                showToast('Bills regenerated freshly!', 'success');
                fetchCards();
            } else {
                showToast('Failed to regenerate bills.', 'error');
            }
        } catch (error) {
            console.error('Bill generation error:', error);
            showToast('Error regenerating bills.', 'error');
        } finally {
            setIsGeneratingBills(false);
        }
    };

    const handleClearBills = () => {
        setModal({
            isOpen: true,
            title: 'Clear Bills',
            message: "Are you sure you want to clear all current unpaid bills? This will reset all card 'Total Due' balances to 0.",
            type: 'confirm',
            onConfirm: async () => {
                setModal((prev) => ({ ...prev, isOpen: false }));
                setIsGeneratingBills(true);
                try {
                    const res = await authFetch('/credit-cards/clear-bills', { method: 'POST' });
                    if (res.ok) {
                        showToast('Current bills cleared successfully!', 'success');
                        fetchCards();
                    } else {
                        showToast('Failed to clear bills.', 'error');
                    }
                } catch (error) {
                    console.error('Bill clearing error:', error);
                    showToast('Error clearing bills.', 'error');
                } finally {
                    setIsGeneratingBills(false);
                }
            }
        });
    };

    const handleDownloadStatement = () => {
        const card = cards.find((c) => c.id === parseInt(filterCard));
        if (!card) {
            showToast('Select a specific card to download its statement', 'error');
            return;
        }
        downloadCreditCardStatement({
            card,
            bills: historyBills,
            transactions: card.transactions || [],
            currency: card.currency,
            user
        });
    };

    const segBtn = (active) =>
        cx(
            'rounded-[8px] px-5 py-2 text-sm font-bold transition',
            active ? 'bg-brand text-slate-950' : 'text-ink-muted hover:text-ink'
        );

    const statusTone = (status) => (status === 'paid' ? 'pos' : status === 'overdue' ? 'neg' : 'warn');

    return (
        <div className="mx-auto max-w-[1200px] p-6 md:p-10">
            <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-ink">Monthly Bills</h1>
                    <p className="mt-1 text-sm text-ink-muted">Track and pay your credit card bills.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex rounded-control border border-line bg-surface p-1">
                        <button type="button" onClick={() => setActiveTab('current')} className={segBtn(activeTab === 'current')}>Current</button>
                        <button type="button" onClick={() => setActiveTab('history')} className={segBtn(activeTab === 'history')}>History</button>
                    </div>

                    <Button variant="primary" icon={RefreshCw} loading={isGeneratingBills} onClick={handleGenerateBills}>
                        Regenerate
                    </Button>
                    <Button variant="danger" icon={Trash2} disabled={isGeneratingBills} onClick={handleClearBills}>
                        Clear Bills
                    </Button>
                    <Button variant="secondary" icon={FileDown} disabled={filterCard === 'all'} onClick={handleDownloadStatement}>
                        Statement PDF
                    </Button>

                    <div className="relative">
                        <Filter size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                        <select
                            value={filterCard}
                            onChange={(e) => setFilterCard(e.target.value)}
                            className="h-10 appearance-none rounded-control border border-line bg-surface pl-9 pr-8 text-sm font-semibold text-ink outline-none transition focus:border-line-strong"
                        >
                            <option value="all">All Cards</option>
                            {cards.map((card) => (
                                <option key={card.id} value={card.id}>
                                    {card.bankName} - {card.name} (•••• {card.number ? card.number.slice(-4) : 'XXXX'})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            {activeTab === 'current' && (
                <div className="flex flex-col gap-5">
                    {dueCards.length === 0 ? (
                        <EmptyState
                            icon={CheckCircle2}
                            title="All bills paid!"
                            description="You have no outstanding bills. Check History to view past payments."
                        />
                    ) : (
                        dueCards.map((card) => {
                            const totalDue = card.totalDue || 0;
                            return (
                                <motion.div key={card.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                                    <Panel className="relative overflow-hidden !p-0">
                                        <span className="absolute inset-y-0 left-0 w-1.5 bg-neg" aria-hidden="true" />
                                        <div className="flex flex-wrap items-center justify-between gap-6 p-6 pl-8">
                                            <div className="flex min-w-[240px] items-center gap-4">
                                                <div
                                                    className="grid h-11 w-16 shrink-0 place-items-center rounded-[8px] text-[10px] font-black tracking-wider text-white"
                                                    style={{ background: card.color || 'linear-gradient(45deg, #3b82f6, #8b5cf6)' }}
                                                >
                                                    {card.number ? `•••• ${card.number.slice(-4)}` : 'CARD'}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-wide text-ink-faint">{card.bankName}</p>
                                                    <h3 className="text-base font-bold text-ink">{card.name}</h3>
                                                    <p className="text-xs text-ink-muted">Unbilled: {formatCurrency(card.unbilled, card.currency)}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-1 flex-wrap justify-center gap-8">
                                                <div>
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Bill amount</p>
                                                    <p className="tnum text-2xl font-black text-ink">{formatCurrency(totalDue, card.currency)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Min due (MAD)</p>
                                                    <p className="tnum text-xl font-bold text-ink">{formatCurrency(card.minPayment || 0, card.currency)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Due date</p>
                                                    <p className="flex items-center gap-2 text-lg font-bold text-ink">
                                                        <Calendar size={16} className="text-ink-faint" aria-hidden="true" />
                                                        {card.dueDate ? `${card.dueDate}th` : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>

                                            <Button variant="primary" size="lg" icon={ArrowRight} onClick={() => openPaymentModal(card)}>
                                                Pay Bill
                                            </Button>
                                        </div>
                                    </Panel>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <Panel>
                    <PanelHeader title="Bill History" icon={Calendar} />
                    {filterCard === 'all' ? (
                        <EmptyState icon={Filter} title="Select a card" description="Please select a specific card to view its bill history." />
                    ) : historyBills.length === 0 ? (
                        <EmptyState icon={Calendar} title="No bill history" description="No bill history is available for this card." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                                        <th className="p-3 font-bold">Bill Date</th>
                                        <th className="p-3 font-bold">Due Date</th>
                                        <th className="p-3 font-bold">Amount</th>
                                        <th className="p-3 font-bold">Min Due</th>
                                        <th className="p-3 font-bold">Paid</th>
                                        <th className="p-3 font-bold">Status</th>
                                        <th className="p-3 font-bold">RBI Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyBills.map((bill) => {
                                        const isExpanded = expandedBillId === bill.id;
                                        return (
                                            <Fragment key={bill.id}>
                                                <tr
                                                    onClick={() => bill.metadata && setExpandedBillId(isExpanded ? null : bill.id)}
                                                    className={cx('border-b border-line', bill.metadata && 'cursor-pointer hover:bg-raised')}
                                                >
                                                    <td className="p-3 text-ink-muted">{new Date(bill.billDate).toLocaleDateString()}</td>
                                                    <td className="p-3 text-ink-muted">{new Date(bill.dueDate).toLocaleDateString()}</td>
                                                    <td className="tnum p-3 font-bold text-ink">{formatCurrency(bill.totalAmount)}</td>
                                                    <td className="tnum p-3 font-bold text-ink">{formatCurrency(bill.minDueAmount)}</td>
                                                    <td className="tnum p-3 text-ink-muted">{formatCurrency(bill.paidAmount)}</td>
                                                    <td className="p-3">
                                                        <Badge tone={statusTone(bill.status)}>{bill.status}</Badge>
                                                    </td>
                                                    <td className="p-3">
                                                        {bill.metadata ? (
                                                            <span className="flex items-center gap-1.5 text-xs font-bold text-violet">
                                                                <Info size={14} aria-hidden="true" />
                                                                {isExpanded ? 'Hide Info' : 'Show MAD'}
                                                                <ChevronRight size={13} className={cx('transition', isExpanded && 'rotate-90')} aria-hidden="true" />
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-ink-faint">Legacy Bill</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && bill.metadata && (
                                                    <tr key={`${bill.id}-details`} className="border-b border-line bg-violet-soft/40">
                                                        <td colSpan={7} className="p-5">
                                                            <div className="rounded-card border border-line bg-surface p-5">
                                                                <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-violet">
                                                                    <Info size={15} aria-hidden="true" /> Indian RBI Compliant MAD Breakdown
                                                                </h4>
                                                                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                                                                    <MadStat label="Spends Principal (5%)" value={formatCurrency(bill.metadata.spendsPrincipal * 0.05)} sub={`5% of ${formatCurrency(bill.metadata.spendsPrincipal)}`} />
                                                                    <MadStat label="EMI Installments (100%)" value={formatCurrency(bill.metadata.emiPortion)} />
                                                                    <MadStat label="Unpaid Overdues (100%)" value={formatCurrency(bill.metadata.unpaidOverdues)} valueClass={bill.metadata.unpaidOverdues > 0 ? 'text-neg' : 'text-ink'} />
                                                                    <MadStat label="Interest & Fees (100%)" value={formatCurrency(bill.metadata.interestAndFees)} />
                                                                    <MadStat label="GST Tax @18% (100%)" value={formatCurrency(bill.metadata.taxes)} />
                                                                </div>
                                                                <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
                                                                    <strong className="text-ink">RBI Mandated Amortization Guard:</strong> Paying the Minimum Amount Due ensures that 100% of interest, fees, taxes, and EMIs are cleared, preventing negative amortization. Interest at ~3.5% per month (42% p.a.) + 18% GST compiles daily on the unpaid spends principal.
                                                                </p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            )}

            <Modal
                isOpen={Boolean(selectedCardForPayment)}
                onClose={closePaymentModal}
                title="Pay Bill"
                subtitle={selectedCardForPayment ? `${selectedCardForPayment.bankName} - ${selectedCardForPayment.name}` : ''}
                icon={ArrowRight}
                size="md"
                footer={
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={closePaymentModal} className="flex-1">Cancel</Button>
                        <Button
                            variant="primary"
                            onClick={handlePayment}
                            loading={isSubmitting}
                            disabled={paymentMode === 'custom' && !customAmount}
                            className="flex-[2]"
                        >
                            {isSubmitting
                                ? 'Processing...'
                                : `Pay ${formatCurrency(paymentMode === 'full' ? selectedCardForPayment?.totalDue : customAmount, selectedCardForPayment?.currency)}`}
                        </Button>
                    </div>
                }
            >
                {selectedCardForPayment && (
                    <div className="flex flex-col gap-5">
                        <div className="rounded-card border border-line bg-sunken p-4">
                            <p className="text-xs text-ink-muted">Total amount due</p>
                            <p className="tnum text-3xl font-black text-ink">{formatCurrency(selectedCardForPayment.totalDue, selectedCardForPayment.currency)}</p>
                        </div>

                        <div>
                            <p className="mb-2.5 text-sm font-bold text-ink">Select amount</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMode('full')}
                                    className={cx(
                                        'rounded-control border px-4 py-3.5 text-sm font-bold transition',
                                        paymentMode === 'full' ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink hover:border-line-strong'
                                    )}
                                >
                                    Full Amount
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentMode('custom')}
                                    className={cx(
                                        'rounded-control border px-4 py-3.5 text-sm font-bold transition',
                                        paymentMode === 'custom' ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink hover:border-line-strong'
                                    )}
                                >
                                    Custom Amount
                                </button>
                            </div>
                        </div>

                        {paymentMode === 'custom' && (
                            <input
                                type="number"
                                value={customAmount}
                                onChange={(e) => setCustomAmount(e.target.value)}
                                placeholder="Enter amount"
                                className="w-full rounded-control border border-line bg-sunken px-4 py-3.5 text-base font-bold text-ink outline-none transition focus:border-line-strong"
                            />
                        )}

                        {paymentMode === 'custom' && parseFloat(customAmount || 0) < selectedCardForPayment.totalDue && (
                            <div className="flex gap-2.5 rounded-control border border-neg bg-neg-soft p-3 text-xs text-neg">
                                <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
                                <span>
                                    <strong>Warning:</strong> Paying less than the total due will attract interest charges (approx 35% p.a.) on the remaining balance in your next statement.
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className={cx(
                            'fixed bottom-8 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2.5 rounded-control px-5 py-3 text-sm font-bold text-white shadow-raised',
                            toast.type === 'error' ? 'bg-neg' : 'bg-pos'
                        )}
                    >
                        {toast.type === 'error' ? <AlertTriangle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            <ActionModal
                isOpen={modal.isOpen}
                onClose={closeModal}
                onConfirm={modal.onConfirm}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />
        </div>
    );
};

function MadStat({ label, value, sub, valueClass = 'text-ink' }) {
    return (
        <div className="rounded-control border border-line bg-sunken p-3">
            <p className="mb-1 text-[11px] text-ink-faint">{label}</p>
            <p className={cx('tnum text-sm font-bold', valueClass)}>{value}</p>
            {sub ? <span className="text-[10px] text-ink-faint">{sub}</span> : null}
        </div>
    );
}

export default MonthlyBills;
