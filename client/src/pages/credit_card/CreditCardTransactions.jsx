import { useState } from 'react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { motion } from 'framer-motion';
import { Search, Download, Calendar, ShoppingBag, Trash2, Pencil, ChevronDown, Receipt } from 'lucide-react';
import ActionModal from '../../components/credit_card/ActionModal';
import CreditCardTransactionEditModal from '../../components/credit_card/CreditCardTransactionEditModal';
import { Panel, Button, IconBadge, EmptyState, Badge } from '../../components/ui/primitives';
import { cx } from '../../components/ui/cx';
import { formatCurrency } from '../../utils/currency';

function formatTxnDate(dateString) {
    if (!dateString || dateString === 'N/A') return 'N/A';

    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-');
        return new Date(year, month - 1, day).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

const typeTone = (type) => {
    if (type === 'credit') return { tone: 'pos', sign: '+' };
    if (type === 'refund') return { tone: 'info', sign: '+' };
    return { tone: 'neg', sign: '-' };
};

const CreditCardTransactions = () => {
    const { cards, deleteTransaction, updateTransaction } = useCreditCards();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCard, setFilterCard] = useState('all');
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'confirm', onConfirm: null });

    const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));
    const showAlert = (title, message, type = 'success') =>
        setModal({ isOpen: true, title, message, type, onConfirm: null });

    const currency = user?.currency || 'INR';

    const transactions = cards
        .flatMap((card) =>
            (card.transactions || []).map((t) => {
                const tDate = t.transactionDate || t.date;
                return {
                    ...t,
                    date: tDate,
                    card: `${card.name} (${card.number ? card.number.slice(-4) : 'XXXX'})`,
                    cardId: card.id
                };
            })
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const filteredTransactions = transactions.filter(
        (t) =>
            (t.merchant || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
            (filterCard === 'all' || t.cardId.toString() === filterCard)
    );

    const handleExport = () => {
        const rows = [
            ['Date', 'Merchant', 'Card', 'Category', 'Type', 'Amount'],
            ...filteredTransactions.map((t) => [
                t.date || '',
                (t.merchant || '').replace(/"/g, '""'),
                t.card,
                t.category || 'Uncategorized',
                t.type || 'debit',
                t.amount
            ])
        ];
        const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `credit-card-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="mx-auto max-w-[1200px] p-6 md:p-10">
            <header className="mb-8">
                <h1 className="text-3xl font-black tracking-tight text-ink">Transactions</h1>
                <p className="mt-1 text-sm text-ink-muted">View and manage your credit card transactions.</p>
            </header>

            <div className="mb-6 flex flex-wrap gap-3">
                <div className="relative min-w-[260px] flex-1">
                    <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-12 w-full rounded-control border border-line bg-surface pl-11 pr-4 text-sm font-semibold text-ink outline-none transition focus:border-line-strong"
                    />
                </div>

                <div className="relative">
                    <select
                        value={filterCard}
                        onChange={(e) => setFilterCard(e.target.value)}
                        className="h-12 appearance-none rounded-control border border-line bg-surface pl-4 pr-10 text-sm font-semibold text-ink outline-none transition focus:border-line-strong"
                    >
                        <option value="all">All Cards</option>
                        {cards.map((card) => (
                            <option key={card.id} value={card.id.toString()}>
                                {card.bankName} - {card.name} (•••• {card.number ? card.number.slice(-4) : 'XXXX'})
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                </div>

                <Button variant="primary" icon={Download} onClick={handleExport} disabled={filteredTransactions.length === 0}>
                    Export
                </Button>
            </div>

            <Panel className="!p-4">
                {filteredTransactions.length === 0 ? (
                    <EmptyState icon={Receipt} title="No transactions found" description="Try adjusting your search or card filter." />
                ) : (
                    <ul className="flex flex-col gap-3">
                        {filteredTransactions.map((txn, index) => {
                            const { tone, sign } = typeTone(txn.type);
                            return (
                                <motion.li
                                    key={txn.id}
                                    initial={{ opacity: 0, x: -16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(index * 0.04, 0.4) }}
                                    className="flex items-center justify-between gap-3 rounded-card border border-line bg-sunken p-4 transition hover:border-line-strong"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <IconBadge icon={ShoppingBag} tone="violet" />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-ink">{txn.merchant || 'Unknown Merchant'}</p>
                                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-faint">
                                                <Calendar size={12} aria-hidden="true" />
                                                {formatTxnDate(txn.date)} • {txn.card}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className={cx('tnum text-base font-black', tone === 'pos' ? 'text-pos' : tone === 'info' ? 'text-info' : 'text-neg')}>
                                                {sign}{formatCurrency(txn.amount, currency)}
                                            </p>
                                            <div className="mt-1 flex justify-end">
                                                <Badge tone={tone}>{txn.category || 'Uncategorized'}</Badge>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingTx(txn);
                                                    setIsEditOpen(true);
                                                }}
                                                title="Edit transaction"
                                                className="rounded-control p-2 text-ink-faint transition hover:bg-violet-soft hover:text-violet"
                                            >
                                                <Pencil size={15} aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setModal({
                                                        isOpen: true,
                                                        title: 'Delete Transaction',
                                                        message: `Are you sure you want to delete the transaction from ${txn.merchant}?`,
                                                        type: 'confirm',
                                                        onConfirm: async () => {
                                                            try {
                                                                await deleteTransaction(txn.cardId, txn.id);
                                                                closeModal();
                                                            } catch {
                                                                closeModal();
                                                                setTimeout(() => showAlert('Delete Failed', 'Failed to delete transaction', 'error'), 300);
                                                            }
                                                        }
                                                    })
                                                }
                                                title="Delete transaction"
                                                className="rounded-control p-2 text-ink-faint transition hover:bg-neg-soft hover:text-neg"
                                            >
                                                <Trash2 size={15} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.li>
                            );
                        })}
                    </ul>
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

            <CreditCardTransactionEditModal
                isOpen={isEditOpen}
                onClose={() => {
                    setIsEditOpen(false);
                    setEditingTx(null);
                }}
                user={user}
                editData={editingTx}
                onSave={async (updatedData) => {
                    if (editingTx) {
                        await updateTransaction(editingTx.cardId, editingTx.id, {
                            merchant: updatedData.merchant,
                            amount: updatedData.amount,
                            transactionDate: updatedData.transactionDate,
                            category: updatedData.category,
                            type: updatedData.type,
                            description: updatedData.description
                        });
                    }
                }}
            />
        </div>
    );
};

export default CreditCardTransactions;
