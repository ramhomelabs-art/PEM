import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { API_URL } from '../../config';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/primitives';

const FREQUENCIES = ['weekly', 'monthly', 'quarterly'];

const inputClass =
    'h-10 w-full rounded-control border border-line bg-sunken px-3 text-sm text-ink outline-none transition focus:border-line-strong';

const Labeled = ({ label, hint, children, className }) => (
    <label className={className}>
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</span>
        {children}
        {hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
);

const todayISO = () => new Date().toISOString().slice(0, 10);

const InvestmentPlanModal = ({ isOpen, onClose, onSuccess, plan, investments }) => {
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const editing = Boolean(plan);
    const dayMax = form?.frequency === 'weekly' ? 7 : 31;

    useEffect(() => {
        setError('');
        if (!isOpen) return;
        setForm({
            investmentId: plan?.investmentId || investments?.[0]?.id || '',
            name: plan?.name || '',
            frequency: plan?.frequency || 'monthly',
            amount: plan?.amount ?? '',
            instalmentDay: plan?.instalmentDay ?? '',
            startDate: plan?.startDate || todayISO(),
            endDate: plan?.endDate || '',
            stepUpPct: plan?.stepUpPct ?? 0,
            expectedReturnPct: plan?.expectedReturnPct ?? 0
        });
    }, [isOpen, plan, investments]);

    if (!form) return null;

    const set = (key, value) => {
        setForm((prev) => {
            const next = { ...prev, [key]: value };
            if (key === 'frequency') {
                const max = value === 'weekly' ? 7 : 31;
                if (!next.instalmentDay || Number(next.instalmentDay) > max) next.instalmentDay = '';
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const method = editing ? 'PUT' : 'POST';
            const url = editing ? `${API_URL}/investments/plans/${plan.id}` : `${API_URL}/investments/plans`;
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    investmentId: form.investmentId,
                    name: form.name || null,
                    frequency: form.frequency,
                    amount: Number(form.amount),
                    instalmentDay: form.instalmentDay === '' ? null : Number(form.instalmentDay),
                    startDate: form.startDate,
                    endDate: form.endDate || null,
                    stepUpPct: Number(form.stepUpPct) || 0,
                    expectedReturnPct: Number(form.expectedReturnPct) || 0
                })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || `Failed to ${editing ? 'update' : 'create'} plan`);
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

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editing ? 'Edit Plan' : 'New Investment Plan'}
            subtitle="A recurring contribution schedule against a holding"
            icon={CalendarClock}
            size="lg"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" loading={saving} onClick={handleSubmit} className="bg-pos hover:brightness-110">
                        {editing ? 'Save Changes' : 'Create Plan'}
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Labeled label="Target Investment" className="sm:col-span-2">
                    <select value={form.investmentId} onChange={(e) => set('investmentId', e.target.value)} required className={inputClass}>
                        {investments?.length === 0 ? <option value="">No investments — add one first</option> : null}
                        {investments?.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                                {inv.name} · {inv.category}
                            </option>
                        ))}
                    </select>
                </Labeled>

                <Labeled label="Plan Name" hint="Optional — defaults to the holding name">
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="e.g. Monthly Equity SIP"
                        className={inputClass}
                    />
                </Labeled>

                <Labeled label="Frequency">
                    <div className="inline-flex w-full rounded-control border border-line bg-sunken p-0.5">
                        {FREQUENCIES.map((freq) => (
                            <button
                                key={freq}
                                type="button"
                                onClick={() => set('frequency', freq)}
                                className={
                                    form.frequency === freq
                                        ? 'flex-1 rounded-control bg-brand px-2 py-1.5 text-xs font-bold text-slate-950'
                                        : 'flex-1 rounded-control px-2 py-1.5 text-xs font-bold text-ink-muted hover:text-ink'
                                }
                            >
                                {freq[0].toUpperCase() + freq.slice(1)}
                            </button>
                        ))}
                    </div>
                </Labeled>

                <Labeled label="Amount Per Instalment">
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => set('amount', e.target.value)}
                        placeholder="e.g. 5000"
                        required
                        className={inputClass}
                    />
                </Labeled>

                <Labeled
                    label="Instalment Day"
                    hint={form.frequency === 'weekly' ? '1–7 (Mon–Sun); blank uses start date' : `Day of month, 1–${dayMax}; blank uses start date`}
                >
                    <input
                        type="number"
                        min="1"
                        max={dayMax}
                        value={form.instalmentDay}
                        onChange={(e) => set('instalmentDay', e.target.value)}
                        placeholder={form.frequency === 'weekly' ? 'Mon–Sun' : '1–31'}
                        className={inputClass}
                    />
                </Labeled>

                <Labeled label="Start Date">
                    <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} required className={inputClass} />
                </Labeled>

                <Labeled label="End Date" hint="Optional — blank keeps the plan open-ended">
                    <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => set('endDate', e.target.value)}
                        min={form.startDate}
                        className={inputClass}
                    />
                </Labeled>

                <Labeled label="Step-Up % Per Year" hint="Annual increase to the instalment amount (0–100)">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={form.stepUpPct}
                        onChange={(e) => set('stepUpPct', e.target.value)}
                        className={inputClass}
                    />
                </Labeled>

                <Labeled label="Expected Return % Per Year" hint="Used for the end-date projection (-100 to 100)">
                    <input
                        type="number"
                        min="-100"
                        max="100"
                        step="0.1"
                        value={form.expectedReturnPct}
                        onChange={(e) => set('expectedReturnPct', e.target.value)}
                        className={inputClass}
                    />
                </Labeled>

                {error ? <p className="rounded-control border border-neg/25 bg-neg-soft px-3 py-2 text-xs font-bold text-neg sm:col-span-2">{error}</p> : null}
            </form>
        </Modal>
    );
};

export default InvestmentPlanModal;