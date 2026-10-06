import { useState } from 'react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { motion } from 'framer-motion';
import { Calculator, TrendingUp, Calendar, Wallet, Plus, Trash2, ChevronDown } from 'lucide-react';
import ActionModal from '../../components/credit_card/ActionModal';
import { Panel, PanelHeader, Button, IconBadge, EmptyState, Progress } from '../../components/ui/primitives';
import { formatCurrency } from '../../utils/currency';

const CreditCardEMI = () => {
    const { cards, payEMI, addEMI, deleteEMI } = useCreditCards();
    const { user } = useAuth();
    const currency = user?.currency || 'INR';

    const [selectedCard, setSelectedCard] = useState('');
    const [filterCardId, setFilterCardId] = useState('all');
    const [emiAmount, setEmiAmount] = useState('');
    const [merchantName, setMerchantName] = useState('');
    const [tenure, setTenure] = useState(6);
    const [interestRate, setInterestRate] = useState(12);
    const [monthlyEMI, setMonthlyEMI] = useState(null);

    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'confirm', onConfirm: null });

    const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));
    const showAlert = (title, message, type = 'success') =>
        setModal({ isOpen: true, title, message, type, onConfirm: null });

    const calculateEMI = () => {
        const principal = parseFloat(emiAmount);
        const rate = parseFloat(interestRate) / 12 / 100;
        const months = parseInt(tenure);

        if (principal && rate && months) {
            const emi = (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
            const totalAmount = emi * months;
            setMonthlyEMI({
                monthly: emi.toFixed(2),
                total: totalAmount.toFixed(2),
                interest: (totalAmount - principal).toFixed(2),
                principal: principal.toFixed(2)
            });
        }
    };

    const handleConvertToEMI = async () => {
        if (!monthlyEMI || !selectedCard || !merchantName) return;

        const card = cards.find((c) => c.id.toString() === selectedCard.toString());
        if (!card) {
            showAlert('Error', 'Selected card not found', 'error');
            return;
        }

        const amount = parseFloat(monthlyEMI.principal);
        const availableLimit = parseFloat(card.limit) - parseFloat(card.used);
        if (amount > availableLimit) {
            showAlert('Limit Exceeded', `EMI amount (${formatCurrency(amount, currency)}) exceeds available credit limit (${formatCurrency(availableLimit, currency)}).`, 'error');
            return;
        }

        try {
            await addEMI(selectedCard, {
                merchant: merchantName,
                principalAmount: parseFloat(monthlyEMI.principal),
                monthlyPayment: parseFloat(monthlyEMI.monthly),
                tenure: parseInt(tenure),
                interestRate: parseFloat(interestRate)
            });
            showAlert('Success!', 'Purchase converted to EMI successfully.', 'success');
            setEmiAmount('');
            setMerchantName('');
            setMonthlyEMI(null);
        } catch (err) {
            showAlert('Conversion Failed', err.message, 'error');
        }
    };

    const activeEMIs = cards.flatMap((card) =>
        (card.emis || []).map((emi) => ({ ...emi, cardName: card.name, cardDueDate: card.dueDate }))
    );

    const visibleEMIs = activeEMIs.filter(
        (emi) => filterCardId === 'all' || emi.creditCardId.toString() === filterCardId.toString()
    );

    const inputClass =
        'w-full rounded-control border border-line bg-sunken px-3.5 py-3 text-sm font-semibold text-ink outline-none transition focus:border-line-strong';
    const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-wide text-ink-faint';

    return (
        <div className="mx-auto max-w-[1400px] p-6 md:p-10">
            <header className="mb-8">
                <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">EMI Management</h1>
                <p className="mt-1 text-sm text-ink-muted">Convert purchases to EMI and manage payment schedules.</p>
            </header>

            <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Panel>
                    <PanelHeader title="EMI Calculator" subtitle="Calculate your monthly payments" icon={Calculator} />

                    <div className="flex flex-col gap-5">
                        <div>
                            <label className={labelClass}>Select Card</label>
                            <div className="relative">
                                <select value={selectedCard} onChange={(e) => setSelectedCard(e.target.value)} className={cxSelect(inputClass)}>
                                    <option value="">Choose a card...</option>
                                    {cards.map((card) => (
                                        <option key={card.id} value={card.id}>
                                            {card.bankName} - {card.name} ({formatCurrency(card.used, currency)} / {formatCurrency(card.limit, currency)})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Merchant / Item Name</label>
                            <input
                                type="text"
                                value={merchantName}
                                onChange={(e) => setMerchantName(e.target.value)}
                                placeholder="e.g. Samsung TV"
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Purchase Amount</label>
                            <input
                                type="number"
                                value={emiAmount}
                                onChange={(e) => setEmiAmount(e.target.value)}
                                placeholder="50000"
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Tenure: {tenure} months</label>
                            <input type="range" min="3" max="24" value={tenure} onChange={(e) => setTenure(e.target.value)} className="w-full accent-violet" />
                            <div className="mt-1.5 flex justify-between text-[11px] text-ink-faint">
                                <span>3 months</span>
                                <span>24 months</span>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Interest Rate: {interestRate}% p.a.</label>
                            <input type="range" min="0" max="36" step="0.5" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} className="w-full accent-violet" />
                            <div className="mt-1.5 flex justify-between text-[11px] text-ink-faint">
                                <span>0%</span>
                                <span>36%</span>
                            </div>
                        </div>

                        <Button variant="primary" size="lg" icon={Calculator} onClick={calculateEMI} disabled={!emiAmount || !selectedCard} className="w-full">
                            Calculate EMI
                        </Button>
                    </div>
                </Panel>

                <Panel>
                    <PanelHeader title="EMI Breakdown" subtitle="Payment details" icon={TrendingUp} />

                    {monthlyEMI ? (
                        <div className="flex flex-col gap-5">
                            <div className="rounded-card border-2 border-violet bg-violet-soft p-5">
                                <p className="text-xs font-bold uppercase tracking-wide text-violet">Monthly EMI</p>
                                <p className="tnum mt-1 text-3xl font-black text-violet">{formatCurrency(monthlyEMI.monthly, currency)}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Detail label="Principal Amount" value={formatCurrency(monthlyEMI.principal, currency)} />
                                <Detail label="Total Interest" value={formatCurrency(monthlyEMI.interest, currency)} valueClass="text-neg" />
                                <Detail label="Total Amount" value={formatCurrency(monthlyEMI.total, currency)} />
                                <Detail label="Tenure" value={`${tenure} months`} />
                            </div>

                            <Button
                                variant="primary"
                                size="lg"
                                icon={Plus}
                                onClick={handleConvertToEMI}
                                disabled={!merchantName}
                                className="w-full"
                                title={!merchantName ? 'Please enter Merchant Name' : 'Convert to EMI'}
                            >
                                Convert to EMI
                            </Button>
                        </div>
                    ) : (
                        <EmptyState icon={Calculator} title="No calculation yet" description="Enter the details and calculate to see the EMI breakdown." />
                    )}
                </Panel>
            </div>

            <Panel>
                <PanelHeader
                    title="Active EMIs"
                    subtitle="Track your ongoing EMI payments"
                    icon={Calendar}
                    action={
                        <div className="relative">
                            <select value={filterCardId} onChange={(e) => setFilterCardId(e.target.value)} className={cxSelect('h-10 rounded-control border border-line bg-sunken pl-3 pr-9 text-xs font-bold text-ink outline-none focus:border-line-strong')}>
                                <option value="all">All Cards</option>
                                {cards.map((card) => (
                                    <option key={card.id} value={card.id}>
                                        {card.bankName} - {card.name} (Ending {card.number?.slice(-4)})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                        </div>
                    }
                />

                {visibleEMIs.length === 0 ? (
                    <EmptyState icon={Wallet} title="No active EMIs" description="Convert a purchase to an EMI to start tracking it here." />
                ) : (
                    <div className="flex flex-col gap-4">
                        {visibleEMIs.map((emi) => {
                            const pct = emi.tenure > 0 ? (emi.paid / emi.tenure) * 100 : 0;
                            return (
                                <motion.div
                                    key={emi.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="rounded-card border border-line bg-sunken p-4"
                                >
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <IconBadge icon={Wallet} tone="violet" size="sm" />
                                                <p className="truncate text-sm font-bold text-ink">{emi.merchant}</p>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setModal({
                                                            isOpen: true,
                                                            title: 'Delete EMI',
                                                            message: `Are you sure you want to delete the EMI for ${emi.merchant}? This will stop future tracking but won't revert previous payments.`,
                                                            type: 'confirm',
                                                            onConfirm: async () => {
                                                                try {
                                                                    await deleteEMI(emi.id);
                                                                    closeModal();
                                                                    setTimeout(() => showAlert('Deleted', 'EMI deleted successfully.', 'success'), 300);
                                                                } catch {
                                                                    closeModal();
                                                                    setTimeout(() => showAlert('Error', 'Failed to delete EMI.', 'error'), 300);
                                                                }
                                                            }
                                                        })
                                                    }
                                                    title="Delete EMI"
                                                    className="rounded-control p-1.5 text-ink-faint transition hover:bg-neg-soft hover:text-neg"
                                                >
                                                    <Trash2 size={14} aria-hidden="true" />
                                                </button>
                                            </div>
                                            <p className="mt-0.5 text-xs text-ink-faint">{emi.cardName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="tnum text-base font-black text-violet">{formatCurrency(emi.monthlyPayment, currency)}/mo</p>
                                            <p className="text-[11px] text-ink-faint">{emi.paid}/{emi.tenure} paid</p>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <div className="mb-1.5 flex justify-between text-[11px] text-ink-faint">
                                            <span>Progress</span>
                                            <span className="tnum">{pct.toFixed(0)}%</span>
                                        </div>
                                        <Progress value={pct} tone="violet" />
                                    </div>

                                    <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        <Detail label="Principal" value={formatCurrency(emi.principal, currency)} compact />
                                        <Detail label="Paid" value={formatCurrency(emi.totalPaid, currency)} valueClass="text-pos" compact />
                                        <Detail label="Remaining" value={formatCurrency(emi.totalRemaining, currency)} valueClass="text-neg" compact />
                                        <Detail label="Due Date" value={`${emi.cardDueDate}th of month`} compact />
                                    </div>

                                    <Button
                                        variant="primary"
                                        size="md"
                                        icon={Wallet}
                                        onClick={() =>
                                            setModal({
                                                isOpen: true,
                                                title: 'Confirm Payment',
                                                message: `Pay EMI installment of ${formatCurrency(emi.monthlyPayment, currency)} for ${emi.merchant}?`,
                                                type: 'confirm',
                                                onConfirm: async () => {
                                                    try {
                                                        await payEMI(emi.creditCardId, emi.id);
                                                        closeModal();
                                                        setTimeout(() => showAlert('Paid!', 'EMI Installment paid successfully.', 'success'), 300);
                                                    } catch (err) {
                                                        closeModal();
                                                        setTimeout(() => showAlert('Payment Failed', err.message, 'error'), 300);
                                                    }
                                                }
                                            })
                                        }
                                        className="w-full"
                                    >
                                        Pay EMI ({formatCurrency(emi.monthlyPayment, currency)})
                                    </Button>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </Panel>

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

function cxSelect(base) {
    return `${base} appearance-none cursor-pointer`;
}

function Detail({ label, value, valueClass = 'text-ink', compact }) {
    return (
        <div className={compact ? '' : 'rounded-control border border-line bg-sunken p-3.5'}>
            <p className="text-[11px] text-ink-faint">{label}</p>
            <p className={`tnum font-bold ${compact ? 'text-[13px]' : 'text-lg'} ${valueClass}`}>{value}</p>
        </div>
    );
}

export default CreditCardEMI;
