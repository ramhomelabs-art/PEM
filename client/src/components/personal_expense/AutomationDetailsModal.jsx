import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Check, X, MessageSquare, Calendar, CreditCard, Tag,
    User, Smartphone, Clock, FileText, ArrowDownRight, ArrowUpRight
} from 'lucide-react';

const buildInitialFormData = (data) => {
    if (!data) return null;

    let initialDate = '';
    const sourceDate = data.received_at || data.date || new Date().toISOString();

    try {
        const dateObj = new Date(sourceDate);
        const offset = dateObj.getTimezoneOffset() * 60000;
        initialDate = (new Date(dateObj - offset)).toISOString().slice(0, 16);
    } catch {
        initialDate = new Date().toISOString().slice(0, 16);
    }

    // Detect transaction type
    let transactionType = data.transaction_type;
    if (!transactionType) {
        if (data.type && typeof data.type === 'string') {
            const typeStr = data.type.toLowerCase();
            if (typeStr.includes('debit') || typeStr.includes('expense') || typeStr.includes('sent') || typeStr.includes('spent') || typeStr.includes('paid')) {
                transactionType = 'debit';
            } else if (typeStr.includes('credit') || typeStr.includes('income') || typeStr.includes('received')) {
                transactionType = 'credit';
            }
        }
    }
    if (!transactionType) transactionType = 'debit';

    return {
        ...data,
        date: initialDate,
        transaction_type: transactionType,
        merchant: data.merchant || data.provider || data.account || data.description || 'Unknown',
        category: data.category || 'General',
        paymentMethod: data.paymentMethod || data.mode || (data.extractor === 'ml_bert_ner' ? 'Transfer' : 'UPI')
    };
};

const AutomationDetailsModal = ({ isOpen, onClose, data, onSave, categories = [], user }) => {
    const [formData, setFormData] = useState(() => buildInitialFormData(data));

    useEffect(() => {
        if (isOpen && data) {
            setFormData(buildInitialFormData(data));
        }
    }, [isOpen, data]);

    if (!isOpen || !formData) return null;

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const isManualEntry = formData.source === 'MANUAL_ENTRY' || formData.type === 'MANUAL';
    const currentType = formData.transaction_type === 'credit' ? 'income' : 'expense';
    const safeCategories = Array.isArray(categories) ? categories : [];
    const availableCategories = safeCategories.filter(c => c.type === currentType || c.type === 'both');
    const currencySymbol = (formData.currency === 'INR' || user?.currency === 'INR') ? '₹' : '$';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
            />

            {/* Modal Card */}
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="relative w-full max-w-lg rounded-2xl border border-line-strong bg-surface text-ink shadow-2xl overflow-hidden z-10 my-auto"
            >
                {/* Header with gradient accent */}
                <div className="relative px-6 py-5 border-b border-line bg-gradient-to-r from-blue-900/30 via-slate-900 to-indigo-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isManualEntry ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                            {isManualEntry ? <Smartphone className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-ink tracking-tight flex items-center gap-2">
                                {isManualEntry ? 'Manual App Transaction' : 'Automated SMS Record'}
                                <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full font-bold ${
                                    isManualEntry 
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                    {formData.extractor || (isManualEntry ? 'Mobile App' : 'Parser')}
                                </span>
                            </h2>
                            <p className="text-xs text-ink-muted mt-0.5">
                                Verify and categorize before committing to ledger
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-line transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
                    {/* Transaction Direction Segmented Switch */}
                    <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-sunken/70 border border-line">
                        <button
                            type="button"
                            onClick={() => {
                                handleChange('transaction_type', 'debit');
                                const firstCat = safeCategories.filter(c => c.type === 'expense' || c.type === 'both')[0];
                                if (firstCat) handleChange('category', firstCat.name);
                            }}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-xs transition-all ${
                                formData.transaction_type === 'debit'
                                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            <ArrowDownRight className="w-4 h-4" />
                            Expense (Debit)
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                handleChange('transaction_type', 'credit');
                                const firstCat = safeCategories.filter(c => c.type === 'income' || c.type === 'both')[0];
                                if (firstCat) handleChange('category', firstCat.name);
                            }}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-xs transition-all ${
                                formData.transaction_type === 'credit'
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            <ArrowUpRight className="w-4 h-4" />
                            Income (Credit)
                        </button>
                    </div>

                    {/* Amount Input Display */}
                    <div>
                        <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">
                            Transaction Amount
                        </label>
                        <div className="relative flex items-center">
                            <span className="absolute left-4 text-2xl font-black text-emerald-400">
                                {currencySymbol}
                            </span>
                            <input
                                type="number"
                                step="any"
                                value={formData.amount}
                                onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                                className="w-full pl-12 pr-4 py-3.5 bg-sunken/80 border-2 border-line focus:border-emerald-500 rounded-xl text-3xl font-extrabold text-emerald-400 outline-none transition-all placeholder:text-ink-faint"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* Merchant & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">
                                Merchant / Beneficiary
                            </label>
                            <div className="relative">
                                <User className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={formData.merchant}
                                    onChange={(e) => handleChange('merchant', e.target.value)}
                                    className="w-full pl-10 pr-3 py-2.5 bg-sunken/60 border border-line focus:border-blue-500 rounded-xl text-sm text-ink outline-none"
                                    placeholder="Merchant name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">
                                Category
                            </label>
                            <div className="relative">
                                <Tag className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <select
                                    value={formData.category}
                                    onChange={(e) => handleChange('category', e.target.value)}
                                    className="w-full pl-10 pr-3 py-2.5 bg-sunken/60 border border-line focus:border-blue-500 rounded-xl text-sm text-ink outline-none cursor-pointer"
                                >
                                    {!availableCategories.find(c => c.name === formData.category) && (
                                        <option value={formData.category} className="bg-surface text-ink">
                                            {formData.category}
                                        </option>
                                    )}
                                    {availableCategories.map(c => (
                                        <option key={c.id || c.name} value={c.name} className="bg-surface text-ink">
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Date & Payment Method */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">
                                Timestamp
                            </label>
                            <div className="relative">
                                <Calendar className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="datetime-local"
                                    value={formData.date}
                                    onChange={(e) => handleChange('date', e.target.value)}
                                    className="w-full pl-10 pr-3 py-2.5 bg-sunken/60 border border-line focus:border-blue-500 rounded-xl text-xs text-ink outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">
                                Payment Mode
                            </label>
                            <div className="relative">
                                <CreditCard className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={formData.paymentMethod}
                                    onChange={(e) => handleChange('paymentMethod', e.target.value)}
                                    className="w-full pl-10 pr-3 py-2.5 bg-sunken/60 border border-line focus:border-blue-500 rounded-xl text-sm text-ink outline-none"
                                    placeholder="UPI / Card / NetBanking"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Raw Source SMS Payload Preview */}
                    <div className="p-3.5 rounded-xl bg-sunken/90 border border-line space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-ink-muted">
                            <span className="flex items-center gap-1.5 text-blue-400">
                                <FileText className="w-3.5 h-3.5" />
                                Raw Extracted Payload
                            </span>
                            {formData.received_at && (
                                <span className="flex items-center gap-1 font-mono text-ink-faint">
                                    <Clock className="w-3 h-3" />
                                    {new Date(formData.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-mono text-ink-muted bg-surface/80 p-2.5 rounded-lg border border-line leading-relaxed whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                            {formData.raw_message || formData.description || 'No raw string available'}
                        </p>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-sunken/60 border-t border-line flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-line hover:bg-line text-ink-muted font-semibold text-xs transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave(formData)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                        <Check className="w-4 h-4" />
                        Confirm & Save Changes
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default AutomationDetailsModal;
