import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { API_URL } from '../../config';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/primitives';

const inputClass =
    'h-10 w-full rounded-control border border-line bg-sunken px-3 text-sm text-ink outline-none transition focus:border-line-strong';

const Labeled = ({ label, hint, children }) => (
    <label>
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</span>
        {children}
        {hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
);

const todayISO = () => new Date().toISOString().slice(0, 10);

const InvestmentContributionModal = ({ isOpen, onClose, onSuccess, plan }) => {
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setError('');
        if (!isOpen || !plan) return;
        setForm({
            type: 'SIP',
            date: todayISO(),
            amount: plan.amount ?? '',
            units: '',
            pricePerUnit: ''
        });
    }, [isOpen, plan]);

    if (!form || !plan) return null;

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/investments/${plan.investmentId}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    type: form.type,
                    date: form.date,
                    amount: Number(form.amount) || 0,
                    units: form.units === '' ? 0 : Number(form.units) || 0,
                    pricePerUnit: form.pricePerUnit === '' ? null : Number(form.pricePerUnit) || null,
                    planId: plan.id
                })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || 'Failed to record contribution');
                return;
            }

            onSuccess(data);
            onClose();
        } catch (err) {
            console.error(err);
            setError('Unexpected error — please try again');
        } finally {
            setSaving(false);
        }
    };

    const investmentName = plan.investment?.name || 'the linked holding';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Record Contribution — ${plan.name || investmentName}`}
            subtitle="Logs a transaction against this plan's schedule"
            icon={Wallet}
            size="md"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" loading={saving} onClick={handleSubmit} className="bg-pos hover:brightness-110">
                        Record Contribution
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Labeled label="Type">
                    <div className="inline-flex w-full rounded-control border border-line bg-sunken p-0.5">
                        {['SIP', 'BUY'].map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => set('type', type)}
                                className={
                                    form.type === type
                                        ? 'flex-1 rounded-control bg-brand px-2 py-1.5 text-xs font-bold text-slate-950'
                                        : 'flex-1 rounded-control px-2 py-1.5 text-xs font-bold text-ink-muted hover:text-ink'
                                }
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </Labeled>

                <Labeled label="Date">
                    <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required className={inputClass} />
                </Labeled>

                <Labeled label="Amount" hint="Defaults to the plan instalment amount">
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => set('amount', e.target.value)}
                        required
                        className={inputClass}
                    />
                </Labeled>

                <Labeled label="Units">
                    <input
                        type="number"
                        min="0"
                        step="any"
                        value={form.units}
                        onChange={(e) => set('units', e.target.value)}
                        placeholder="Units bought (optional)"
                        className={inputClass}
                    />
                </Labeled>

                <Labeled label="Price / Unit" hint="Optional — used for cost basis (FIFO)">
                    <input
                        type="number"
                        min="0"
                        step="any"
                        value={form.pricePerUnit}
                        onChange={(e) => set('pricePerUnit', e.target.value)}
                        placeholder="Optional"
                        className={`${inputClass} sm:col-span-2`}
                    />
                </Labeled>

                {error ? <p className="rounded-control border border-neg/25 bg-neg-soft px-3 py-2 text-xs font-bold text-neg sm:col-span-2">{error}</p> : null}
            </form>
        </Modal>
    );
};

export default InvestmentContributionModal;