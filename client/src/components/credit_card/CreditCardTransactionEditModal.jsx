import { useState, useEffect } from 'react';
import { Check, Save } from 'lucide-react';
import { useCategories } from '../../context/CategoryContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/primitives';
import { cx } from '../ui/cx';
import { symbolFor } from '../../utils/currency';

const CreditCardTransactionEditModal = ({ isOpen, onClose, user, onSave, editData }) => {
    const defaultState = {
        merchant: '',
        amount: '',
        category: 'General',
        type: 'debit',
        description: '',
        transactionDate: ''
    };

    const [formData, setFormData] = useState(defaultState);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { categories } = useCategories();

    const availableCategories = categories
        ? categories.map((c) => c.name)
        : ['Food', 'Travel', 'Shopping', 'Medical', 'Utility', 'Entertainment', 'General', 'Bills', 'Other'];

    useEffect(() => {
        if (isOpen && editData) {
            const initialMerchant = editData.merchant || editData.description || '';
            const rawType = (editData.type || '').toLowerCase();
            const normalizedType = (rawType === 'credit' || rawType === 'income' || rawType === 'refund') ? 'credit' : 'debit';
            setFormData({
                merchant: initialMerchant.split(' - ')[0],
                amount: editData.amount.toString(),
                category: editData.category || 'General',
                type: normalizedType,
                description: editData.description || '',
                transactionDate: editData.date
                    ? new Date(editData.date).toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0]
            });
            setSuccess(false);
        }
    }, [isOpen, editData]);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 1000);
        } catch (err) {
            alert(`Failed to save: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const inputClass =
        'w-full rounded-control border border-line bg-sunken px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-line-strong';
    const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-wide text-ink-faint';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Card Transaction" subtitle="Credit Card Ledger" size="md">
            {success ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-pos-soft text-pos">
                        <Check size={32} aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-black text-ink">Transaction Saved</h3>
                    <p className="text-xs font-semibold text-ink-muted">Credit card limits and records updated.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex rounded-control bg-sunken p-1">
                        {['debit', 'credit'].map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setFormData((p) => ({ ...p, type: t }))}
                                className={cx(
                                    'flex-1 rounded-[8px] px-3 py-2.5 text-xs font-black uppercase tracking-wide transition',
                                    formData.type === t
                                        ? t === 'debit'
                                            ? 'bg-neg text-white'
                                            : 'bg-pos text-white'
                                        : 'text-ink-faint hover:text-ink'
                                )}
                            >
                                {t === 'debit' ? 'Spend (Debit)' : 'Refund/Payment (Credit)'}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className={labelClass}>Merchant</label>
                        <input
                            type="text"
                            placeholder="E.g. Amazon, Starbucks..."
                            value={formData.merchant}
                            onChange={(e) => setFormData((p) => ({ ...p, merchant: e.target.value }))}
                            required
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-violet">
                                {symbolFor(user?.currency || 'INR')}
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                    setFormData((prev) => ({ ...prev, amount: val }));
                                }}
                                required
                                className="w-full rounded-control border border-line bg-sunken py-4 pl-12 pr-4 text-2xl font-black text-ink outline-none transition focus:border-line-strong"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Category</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                                className={inputClass}
                            >
                                {availableCategories.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Date</label>
                            <input
                                type="date"
                                value={formData.transactionDate}
                                onChange={(e) => setFormData((p) => ({ ...p, transactionDate: e.target.value }))}
                                required
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Description (Optional)</label>
                        <input
                            type="text"
                            placeholder="Add notes..."
                            value={formData.description}
                            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                            className={inputClass}
                        />
                    </div>

                    <Button type="submit" variant="primary" size="lg" icon={Save} loading={loading} className="mt-2 w-full">
                        Save changes
                    </Button>
                </form>
            )}
        </Modal>
    );
};

export default CreditCardTransactionEditModal;
