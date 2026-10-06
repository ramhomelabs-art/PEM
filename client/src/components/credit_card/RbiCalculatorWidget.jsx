import { useState, useMemo } from 'react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, ShieldAlert, Percent, Sparkles } from 'lucide-react';
import { Panel } from '../../components/ui/primitives';
import { cx } from '../../components/ui/cx';
import { formatCurrency, symbolFor } from '../../utils/currency';

const RbiCalculatorWidget = () => {
    const { user } = useAuth();
    const currency = user?.currency || 'INR';

    const [balance, setBalance] = useState(30000);
    const [apr, setApr] = useState(42);
    const [paymentMode, setPaymentMode] = useState('mad');
    const [fixedAmount, setFixedAmount] = useState(2500);

    const simulation = useMemo(() => {
        const monthlyRate = apr / 100 / 12;
        let currentBalance = parseFloat(balance) || 0;

        if (currentBalance <= 0) {
            return { months: 0, totalInterest: 0, totalGst: 0, totalPaid: 0, schedule: [] };
        }

        let months = 0;
        let totalInterest = 0;
        let totalGst = 0;
        let totalPaid = 0;
        const schedule = [];

        while (currentBalance > 0.01 && months < 360) {
            months++;
            const interest = currentBalance * monthlyRate;
            const gst = interest * 0.18;
            const charges = interest + gst;

            let payment = 0;
            if (paymentMode === 'full') {
                payment = currentBalance + charges;
            } else if (paymentMode === 'mad') {
                const principalPortion = currentBalance * 0.05;
                const calculatedMad = principalPortion + charges;
                payment = Math.min(currentBalance + charges, Math.max(500, calculatedMad));
            } else {
                payment = Math.min(currentBalance + charges, parseFloat(fixedAmount) || 500);
                if (payment < charges + 1) {
                    payment = charges + 50;
                }
            }

            totalInterest += interest;
            totalGst += gst;
            totalPaid += payment;

            currentBalance = Math.max(0, currentBalance + charges - payment);

            if (months <= 12 || currentBalance <= 0 || months % 12 === 0) {
                schedule.push({ month: months, payment, interest, gst, remaining: currentBalance });
            }
        }

        return { months, totalInterest, totalGst, totalPaid, schedule };
    }, [balance, apr, paymentMode, fixedAmount]);

    const calculateScenario = (mode, fixedVal = 0) => {
        const monthlyRate = apr / 100 / 12;
        let currentBalance = parseFloat(balance) || 0;
        if (currentBalance <= 0) return { months: 0, paid: 0, interest: 0 };

        let m = 0;
        let iSum = 0;
        let pSum = 0;
        while (currentBalance > 0.01 && m < 360) {
            m++;
            const interest = currentBalance * monthlyRate;
            const gst = interest * 0.18;
            const charges = interest + gst;

            let payment = 0;
            if (mode === 'full') {
                payment = currentBalance + charges;
            } else if (mode === 'mad') {
                payment = Math.min(currentBalance + charges, Math.max(500, currentBalance * 0.05 + charges));
            } else {
                payment = Math.min(currentBalance + charges, Math.max(charges + 50, fixedVal));
            }

            iSum += charges;
            pSum += payment;
            currentBalance = Math.max(0, currentBalance + charges - payment);
        }
        return { months: m, paid: pSum, interest: iSum };
    };

    const madScenario = calculateScenario('mad');
    const doubleMadScenario = calculateScenario('fixed', Math.max(1000, parseFloat(balance) * 0.1 + parseFloat(balance) * (apr / 1200) * 1.18));
    const fullScenario = calculateScenario('full');

    const modes = [
        { id: 'mad', label: 'Pay Only MAD' },
        { id: 'fixed', label: 'Fixed Amount' },
        { id: 'full', label: 'Pay In Full' }
    ];

    const inputClass =
        'w-full rounded-control border border-line bg-sunken px-3.5 py-3 text-sm font-bold text-ink outline-none transition focus:border-line-strong';
    const labelClass = 'mb-2 block text-[11px] font-black uppercase tracking-wide text-ink-faint';

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Panel className="mt-6">
                <div className="mb-6 flex items-start justify-between gap-3 border-b border-line pb-4">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-black text-ink">
                            <Sparkles size={18} className="text-violet" aria-hidden="true" />
                            RBI Credit Cost Calculator
                        </h3>
                        <p className="mt-1 text-xs text-ink-muted">Visualize the real compounding cost of carrying a balance on credit cards in India.</p>
                    </div>
                    <span className="shrink-0 rounded-pill bg-violet-soft px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-violet">
                        RBI Compliant
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr]">
                    <div className="flex flex-col gap-5">
                        <div>
                            <label className={labelClass}>Outstanding Balance</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-ink-faint">{symbolFor(currency)}</span>
                                <input type="number" value={balance} onChange={(e) => setBalance(Math.max(0, parseFloat(e.target.value) || 0))} className={`${inputClass} pl-9 text-base`} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Interest APR (%)</label>
                                <div className="relative">
                                    <input type="number" value={apr} onChange={(e) => setApr(Math.max(5, parseFloat(e.target.value) || 0))} className={`${inputClass} pr-9`} />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-ink-faint">%</span>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>GST Rate in India</label>
                                <input type="text" value="18% (GST)" disabled className={`${inputClass} bg-raised text-ink-faint`} />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Repayment Strategy</label>
                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                                {modes.map((mode) => (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        onClick={() => setPaymentMode(mode.id)}
                                        className={cx(
                                            'rounded-control border px-3 py-3 text-xs font-bold transition',
                                            paymentMode === mode.id
                                                ? 'border-violet bg-violet-soft text-violet'
                                                : 'border-line text-ink hover:border-line-strong'
                                        )}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {paymentMode === 'fixed' && (
                            <div>
                                <label className={labelClass}>Monthly Repayment Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-ink-faint">{symbolFor(currency)}</span>
                                    <input type="number" value={fixedAmount} onChange={(e) => setFixedAmount(Math.max(500, parseFloat(e.target.value) || 500))} className={`${inputClass} pl-9`} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-card border border-line bg-sunken p-4">
                                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                                    <Clock size={13} aria-hidden="true" /> Time to pay off
                                </p>
                                <p className={cx('tnum mt-1.5 text-2xl font-black', simulation.months > 36 ? 'text-neg' : 'text-pos')}>
                                    {simulation.months >= 360 ? '30+ Years' : `${simulation.months} Months`}
                                </p>
                            </div>

                            <div className="rounded-card border border-line bg-sunken p-4">
                                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                                    <Percent size={13} aria-hidden="true" /> Total interest + GST
                                </p>
                                <p className={cx('tnum mt-1.5 text-2xl font-black', simulation.totalInterest > balance ? 'text-neg' : 'text-ink')}>
                                    {formatCurrency(simulation.totalInterest + simulation.totalGst, currency)}
                                </p>
                                <span className="text-[11px] text-ink-faint">Incl. {formatCurrency(simulation.totalGst, currency)} GST</span>
                            </div>
                        </div>

                        <div className="rounded-card border border-line bg-sunken p-4">
                            <Row label="Principal Outstanding" value={formatCurrency(balance, currency)} />
                            <Row label="Total Interest Paid" value={formatCurrency(simulation.totalInterest, currency)} />
                            <Row label="Total 18% GST on Interest" value={formatCurrency(simulation.totalGst, currency)} />
                            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                                <span className="text-sm font-bold text-ink">Total amount paid</span>
                                <span className="tnum text-lg font-black text-violet">{formatCurrency(simulation.totalPaid, currency)}</span>
                            </div>
                        </div>

                        {paymentMode === 'mad' && simulation.months > 24 && (
                            <div className="flex gap-3 rounded-card border border-neg bg-neg-soft p-4 text-xs leading-relaxed text-neg">
                                <AlertTriangle size={20} className="shrink-0" aria-hidden="true" />
                                <div>
                                    <strong>Debt trap warning:</strong> Paying only the Minimum Amount Due is highly discouraged. You will pay{' '}
                                    <strong>{formatCurrency(simulation.totalInterest + simulation.totalGst, currency)}</strong> in interest &amp; GST on a{' '}
                                    <strong>{formatCurrency(balance, currency)}</strong> debt, taking <strong>{simulation.months} months</strong> to clear. Pay in full, or at least double the MAD.
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 border-t border-line pt-6">
                    <h4 className="mb-5 flex items-center gap-2 text-sm font-bold text-ink">
                        <ShieldAlert size={16} className="text-violet" aria-hidden="true" />
                        How repayment strategies compare
                    </h4>

                    <div className="flex flex-col gap-4">
                        <ScenarioBar label="Pay Only MAD" sub={madScenario.months >= 360 ? '30+ Years' : `${madScenario.months} mo`} total={madScenario.paid} ratio={100} width={100} colorClass="bg-neg" currency={currency} />
                        <ScenarioBar label="Pay 10% Balance Fixed" sub={`${doubleMadScenario.months} mo`} total={doubleMadScenario.paid} ratio={(doubleMadScenario.paid / madScenario.paid) * 100} width={Math.min(100, Math.max(10, (doubleMadScenario.paid / madScenario.paid) * 100))} colorClass="bg-warn" currency={currency} />
                        <ScenarioBar label="Pay in Full" sub="1 mo (Instant)" total={fullScenario.paid} ratio={(fullScenario.paid / madScenario.paid) * 100} width={Math.min(100, Math.max(5, (fullScenario.paid / madScenario.paid) * 100))} colorClass="bg-pos" currency={currency} />
                    </div>
                </div>
            </Panel>
        </motion.div>
    );
};

function Row({ label, value }) {
    return (
        <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs text-ink-muted">{label}</span>
            <span className="tnum text-sm font-bold text-ink">{value}</span>
        </div>
    );
}

function ScenarioBar({ label, sub, total, width, colorClass, currency }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="w-[180px] text-xs">
                <strong className="text-ink">{label}</strong>
                <div className="text-[11px] text-ink-faint">Time: {sub}</div>
            </div>
            <div className="h-2 min-w-[150px] flex-1 overflow-hidden rounded-pill bg-raised">
                <div className={cx('h-full rounded-pill', colorClass)} style={{ width: `${width}%` }} />
            </div>
            <div className="tnum w-[150px] text-right text-xs font-bold text-ink">Total: {formatCurrency(total, currency)}</div>
        </div>
    );
}

export default RbiCalculatorWidget;
