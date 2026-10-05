import { useState } from 'react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { useCardSession } from '../../context/credit_card/CardSessionContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CreditCard, Plus, Eye, EyeOff, Copy, Check, ChevronDown, ChevronUp,
    Trash2, AlertCircle, Radio, Lock, RefreshCw
} from 'lucide-react';
import { Panel, Button, IconBadge, Badge, EmptyState, Progress } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { cx } from '../../components/ui/cx';
import { formatCurrency } from '../../utils/currency';

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

const CardChip = () => (
    <div className="relative h-[35px] w-[45px] overflow-hidden rounded-[6px] border border-black/10 bg-gradient-to-br from-[#ffd700] to-[#daa520] shadow-[inset_0_0_5px_rgba(0,0,0,0.2)]">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-black/20" />
        <div className="absolute bottom-0 left-1/2 top-0 w-px bg-black/20" />
        <div className="absolute inset-[25%] rounded-[2px] border border-black/20" />
    </div>
);

const Contactless = () => (
    <div className="rotate-90 opacity-80">
        <Radio size={20} aria-hidden="true" />
    </div>
);

const INDIAN_BANKS = [
    'HDFC Bank', 'ICICI Bank', 'SBI Card', 'Axis Bank', 'Kotak Mahindra Bank',
    'IndusInd Bank', 'Yes Bank', 'HSBC India', 'Standard Chartered', 'Citibank India',
    'American Express India', 'RBL Bank', 'IDFC First Bank', 'AU Small Finance Bank'
];

const CARD_TYPES = {
    'HDFC Bank': ['Regalia', 'Diners Club Black', 'Infinia', 'MoneyBack+', 'Millennia'],
    'ICICI Bank': ['Amazon Pay', 'Coral', 'Sapphiro', 'Rubyx', 'Platinum'],
    'SBI Card': ['SimplyCLICK', 'Prime', 'Elite', 'Pulse', 'Octane'],
    'Axis Bank': ['Magnus', 'Vistara', 'Flipkart', 'Ace', 'Neo'],
    'Kotak Mahindra Bank': ['811', 'White', 'Royale Signature', 'Zen Signature'],
    'IndusInd Bank': ['Legend', 'Pinnacle', 'Tiger', 'Iconia'],
    Default: ['Platinum', 'Gold', 'Silver', 'Signature', 'Rewards']
};

const CARD_NETWORKS = ['Visa', 'MasterCard', 'RuPay', 'American Express', 'Diners Club'];

function getBankColor(bank = '', name = '') {
    const b = bank.toLowerCase();
    const n = name.toLowerCase();

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

    const defaults = [
        'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
        'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
        'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)'
    ];
    return defaults[bank.length % defaults.length];
}

const cardGradient = (card) =>
    !card.color || card.color === DEFAULT_GRADIENT ? getBankColor(card.bankName, card.name) : card.color;

const emptyCard = (fullName = '') => ({
    bankName: '',
    cardType: '',
    cardNetwork: 'Visa',
    cardNumber: '',
    cvv: '',
    expiryMonth: '',
    expiryYear: '',
    cardholderName: fullName,
    creditLimit: '',
    billingDate: '',
    dueDate: '',
    annualFee: '',
    joiningFee: '',
    benefits: ''
});

const inputClass =
    'w-full rounded-control border border-line bg-sunken px-3.5 py-3 text-sm font-semibold text-ink outline-none transition focus:border-line-strong';
const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-wide text-ink-faint';

const CreditCardsList = () => {
    const { user } = useAuth();
    const { cards, addCard, deleteCard, resetCardUtilization } = useCreditCards();
    const { unlock } = useCardSession();

    const [showDetails, setShowDetails] = useState({});
    const [copied, setCopied] = useState(null);
    const [expandedCard, setExpandedCard] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [cardToDelete, setCardToDelete] = useState(null);
    const [cardToReset, setCardToReset] = useState(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [resetPassword, setResetPassword] = useState('');
    const [resetError, setResetError] = useState('');
    const [addError, setAddError] = useState('');
    const [newCard, setNewCard] = useState(emptyCard(user?.fullName));

    const toggleDetails = (id) => setShowDetails((prev) => ({ ...prev, [id]: !prev[id] }));
    const toggleExpand = (id) => setExpandedCard(expandedCard === id ? null : id);

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleDeleteClick = (card) => {
        setCardToDelete(card);
        setShowDeleteModal(true);
        setDeletePassword('');
        setDeleteError('');
    };

    const handleDeleteConfirm = async () => {
        setDeleteError('');
        try {
            await unlock(deletePassword);
        } catch (err) {
            setDeleteError(err.message || 'Incorrect password. Please try again.');
            return;
        }
        try {
            await deleteCard(cardToDelete.id);
            setShowDeleteModal(false);
            setCardToDelete(null);
            setDeletePassword('');
        } catch (err) {
            setDeleteError('Failed to delete card: ' + err.message);
        }
    };

    const handleResetClick = (card) => {
        setCardToReset(card);
        setShowResetModal(true);
        setResetPassword('');
        setResetError('');
    };

    const handleResetConfirm = async () => {
        setResetError('');
        try {
            await unlock(resetPassword);
        } catch (err) {
            setResetError(err.message || 'Incorrect password. Please try again.');
            return;
        }
        try {
            await resetCardUtilization(cardToReset.id);
            setShowResetModal(false);
            setCardToReset(null);
            setResetPassword('');
        } catch (error) {
            setResetError('Failed to reset card utilization: ' + error.message);
        }
    };

    const handleAddCard = async () => {
        setAddError('');
        try {
            await addCard({
                ...newCard,
                cardName: newCard.cardType || 'Standard',
                cardType: newCard.cardNetwork,
                color: getBankColor(newCard.bankName, newCard.cardType),
                benefits: newCard.benefits ? newCard.benefits.split(',').map((b) => b.trim()).filter(Boolean) : []
            });
            setShowAddModal(false);
            setNewCard(emptyCard(user?.fullName));
        } catch (error) {
            setAddError('Failed to add card: ' + error.message);
        }
    };

    const addReady = newCard.bankName && newCard.cardType && newCard.cardNumber && newCard.cvv;

    return (
        <div className="mx-auto max-w-[1400px] p-6 md:p-10">
            <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-ink">My Cards</h1>
                    <p className="mt-1 text-sm text-ink-muted">Manage your credit cards and view details.</p>
                </div>
                <Button variant="primary" size="lg" icon={Plus} onClick={() => setShowAddModal(true)}>
                    Add New Card
                </Button>
            </header>

            {cards.length === 0 ? (
                <EmptyState icon={CreditCard} title="No cards yet" description="Add your first credit card to start tracking spending." />
            ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {cards.map((card, index) => {
                        const limit = Number(card.limit) || 0;
                        const used = Number(card.used) || 0;
                        const pct = limit > 0 ? (used / limit) * 100 : 0;
                        const revealed = !!showDetails[card.id];
                        const expanded = expandedCard === card.id;

                        return (
                            <motion.div key={card.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
                                <div
                                    onClick={() => toggleExpand(card.id)}
                                    className="group relative mb-4 min-h-[240px] w-full cursor-pointer overflow-hidden rounded-card border border-white/10 p-7 text-left text-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.3)] transition-transform duration-300 hover:-translate-y-1"
                                    style={{ background: cardGradient(card) }}
                                >
                                    <div className="pointer-events-none absolute -right-10 -top-16 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.15)_0%,transparent_70%)]" />
                                    <div className="pointer-events-none absolute -bottom-10 -left-10 h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)]" />

                                    <div className="relative z-10 flex h-full flex-col justify-between gap-6">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-[2px] opacity-90">{card.bankName}</p>
                                                <p className="text-xl font-bold [text-shadow:0_2px_4px_rgba(0,0,0,0.2)]">{card.name}</p>
                                            </div>
                                            <Contactless />
                                        </div>

                                        <div className="flex items-center gap-5">
                                            <CardChip />
                                            <p className="font-mono text-2xl font-bold tracking-[0.2em] [text-shadow:2px_2px_4px_rgba(0,0,0,0.3)]">
                                                {revealed ? card.number || 'N/A' : `•••• •••• •••• ${card.number ? card.number.slice(-4) : '****'}`}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-end justify-between gap-4">
                                            <div className="flex gap-7">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wide opacity-70">Valid thru</p>
                                                    <p className="tnum text-base font-bold">{card.expiry}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wide opacity-70">CVV</p>
                                                    <p className="tnum text-base font-bold">{revealed ? card.cvv : '•••'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wide opacity-70">Network</p>
                                                    <p className="text-sm font-black uppercase italic">{card.cardType || 'VISA'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); toggleDetails(card.id); }}
                                                    className="flex items-center gap-2 rounded-control border border-white/20 bg-white/15 px-4 py-2 text-xs font-bold backdrop-blur transition hover:bg-white/25"
                                                >
                                                    {revealed ? <><EyeOff size={14} aria-hidden="true" /> Hide</> : <><Eye size={14} aria-hidden="true" /> Show</>}
                                                </button>
                                                <span className="opacity-80">
                                                    {expanded ? <ChevronUp size={24} strokeWidth={3} aria-hidden="true" /> : <ChevronDown size={24} strokeWidth={3} aria-hidden="true" />}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {expanded && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mb-4 overflow-hidden"
                                        >
                                            <Panel>
                                                <h4 className="mb-4 text-sm font-black text-ink">Card Details</h4>

                                                <div className="mb-4 grid grid-cols-2 gap-3">
                                                    <MiniStat label="Credit Limit" value={formatCurrency(card.limit, card.currency)} />
                                                    <MiniStat label="Available" value={formatCurrency(card.available, card.currency)} valueClass="text-pos" />
                                                    <MiniStat label="Current Due" value={formatCurrency(card.totalDue, card.currency)} valueClass="text-neg" />
                                                    <MiniStat label="Min Payment" value={formatCurrency(card.minPayment, card.currency)} />
                                                </div>

                                                <div className="mb-4 grid grid-cols-2 gap-3">
                                                    <MiniStat label="Billing Date" value={`${card.billingDate} of every month`} compact />
                                                    <MiniStat label="Payment Due Date" value={`${card.dueDate} of every month`} compact />
                                                </div>

                                                <div className="mb-4 grid grid-cols-2 gap-3">
                                                    <div className="rounded-control border border-violet bg-violet-soft p-3.5">
                                                        <p className="text-[11px] text-violet">Reward Points</p>
                                                        <p className="tnum text-lg font-bold text-violet">{(card.rewardPoints || 0).toLocaleString()}</p>
                                                    </div>
                                                    <div className="rounded-control border border-pos bg-pos-soft p-3.5">
                                                        <p className="text-[11px] text-pos">Cashback Earned</p>
                                                        <p className="tnum text-lg font-bold text-pos">{formatCurrency(card.cashback, card.currency)}</p>
                                                    </div>
                                                </div>

                                                {(card.benefits || []).length > 0 && (
                                                    <div className="mb-4">
                                                        <p className="mb-2 text-xs font-bold text-ink">Card Benefits</p>
                                                        <ul className="space-y-1">
                                                            {(card.benefits || []).map((benefit, i) => (
                                                                <li key={i} className="flex gap-2 text-xs text-ink-muted">
                                                                    <span className="text-violet">•</span> {benefit}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                <div className="mb-4 flex gap-3">
                                                    <div className="flex-1 rounded-control border border-line bg-sunken p-3">
                                                        <p className="text-[11px] text-ink-faint">Annual Fee</p>
                                                        <p className="tnum text-sm font-bold text-ink">{formatCurrency(card.annualFee, card.currency)}</p>
                                                    </div>
                                                    <div className="flex-1 rounded-control border border-line bg-sunken p-3">
                                                        <p className="text-[11px] text-ink-faint">Joining Fee</p>
                                                        <p className="tnum text-sm font-bold text-ink">{card.joiningFee === 0 ? 'FREE' : formatCurrency(card.joiningFee, card.currency)}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                                                    {revealed ? (
                                                        <>
                                                            <Button variant="secondary" size="sm" icon={copied === `number-${card.id}` ? Check : Copy} onClick={() => copyToClipboard(card.number, `number-${card.id}`)}>
                                                                {copied === `number-${card.id}` ? 'Copied' : 'Copy Number'}
                                                            </Button>
                                                            <Button variant="secondary" size="sm" icon={copied === `cvv-${card.id}` ? Check : Copy} onClick={() => copyToClipboard(card.cvv, `cvv-${card.id}`)}>
                                                                {copied === `cvv-${card.id}` ? 'Copied' : 'Copy CVV'}
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <span className="self-center text-xs text-ink-faint">Click &ldquo;Show&rdquo; on the card to copy details</span>
                                                    )}
                                                    <div className="ml-auto flex gap-2">
                                                        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => handleResetClick(card)}>
                                                            Reset
                                                        </Button>
                                                        <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDeleteClick(card)}>
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Panel>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="rounded-card border border-line bg-surface p-4">
                                    <div className="mb-2 flex justify-between text-xs text-ink-muted">
                                        <span>Utilization: {formatCurrency(card.used, card.currency)} / {formatCurrency(card.limit, card.currency)}</span>
                                        <span className="tnum font-bold">{pct.toFixed(1)}%</span>
                                    </div>
                                    <Progress value={pct} threshold={80} />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Add New Card"
                subtitle="Enter the card details to start tracking"
                icon={CreditCard}
                size="lg"
                footer={
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
                        <Button variant="primary" onClick={handleAddCard} disabled={!addReady} className="flex-1">Add Card</Button>
                    </div>
                }
            >
                <div className="mb-6">
                    <p className={labelClass}>Card Preview</p>
                    <div
                        className="relative flex min-h-[200px] flex-col justify-between overflow-hidden rounded-card border border-white/10 p-6 text-white shadow-[0_15px_30px_rgba(0,0,0,0.3)]"
                        style={{ background: getBankColor(newCard.bankName, newCard.cardType) }}
                    >
                        <div className="relative z-10 flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wide opacity-80">{newCard.bankName || 'BANK NAME'}</p>
                                <p className="text-base font-bold">{newCard.cardType || 'Card Name'}</p>
                            </div>
                            <Contactless />
                        </div>
                        <div className="relative z-10 mt-5 flex items-center gap-4">
                            <CardChip />
                            <p className="font-mono text-xl font-bold tracking-[0.18em]">
                                {newCard.cardNumber ? newCard.cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                            </p>
                        </div>
                        <div className="relative z-10 flex items-end justify-between">
                            <div>
                                <p className="text-[8px] opacity-70">VALID THRU</p>
                                <p className="tnum text-sm font-bold">{newCard.expiryMonth || 'MM'}/{newCard.expiryYear || 'YYYY'}</p>
                            </div>
                            <p className="text-sm font-black uppercase italic opacity-90">{newCard.cardNetwork}</p>
                        </div>
                        <div className="absolute -right-6 -top-6 h-[150px] w-[150px] rounded-full bg-white/10" />
                    </div>
                </div>

                <div className="flex flex-col gap-5">
                    <div>
                        <label className={labelClass}>Select Bank</label>
                        <select value={newCard.bankName} onChange={(e) => setNewCard({ ...newCard, bankName: e.target.value, cardType: '' })} className={inputClass}>
                            <option value="">Choose a bank...</option>
                            {INDIAN_BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Card Network</label>
                        <select value={newCard.cardNetwork} onChange={(e) => setNewCard({ ...newCard, cardNetwork: e.target.value })} className={inputClass}>
                            {CARD_NETWORKS.map((network) => <option key={network} value={network}>{network}</option>)}
                        </select>
                    </div>

                    {newCard.bankName && (
                        <div>
                            <label className={labelClass}>Card Variant (Product)</label>
                            <select value={newCard.cardType} onChange={(e) => setNewCard({ ...newCard, cardType: e.target.value })} className={inputClass}>
                                <option value="">Choose card type...</option>
                                {(CARD_TYPES[newCard.bankName] || CARD_TYPES.Default).map((type) => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className={labelClass}>Card Number</label>
                        <input type="text" value={newCard.cardNumber} onChange={(e) => setNewCard({ ...newCard, cardNumber: e.target.value })} placeholder="1234 5678 9012 3456" maxLength="19" className={inputClass} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className={labelClass}>CVV</label>
                            <input type="text" value={newCard.cvv} onChange={(e) => setNewCard({ ...newCard, cvv: e.target.value })} placeholder="123" maxLength="3" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Month</label>
                            <input type="text" value={newCard.expiryMonth} onChange={(e) => setNewCard({ ...newCard, expiryMonth: e.target.value })} placeholder="MM" maxLength="2" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Year</label>
                            <input type="text" value={newCard.expiryYear} onChange={(e) => setNewCard({ ...newCard, expiryYear: e.target.value })} placeholder="YYYY" maxLength="4" className={inputClass} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Credit Limit</label>
                        <input type="number" value={newCard.creditLimit} onChange={(e) => setNewCard({ ...newCard, creditLimit: e.target.value })} placeholder="500000" className={inputClass} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Billing Date</label>
                            <input type="text" value={newCard.billingDate} onChange={(e) => setNewCard({ ...newCard, billingDate: e.target.value })} placeholder="5th" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Due Date</label>
                            <input type="text" value={newCard.dueDate} onChange={(e) => setNewCard({ ...newCard, dueDate: e.target.value })} placeholder="20th" className={inputClass} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Annual Fee</label>
                            <input type="number" value={newCard.annualFee} onChange={(e) => setNewCard({ ...newCard, annualFee: e.target.value })} placeholder="2500" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Joining Fee</label>
                            <input type="number" value={newCard.joiningFee} onChange={(e) => setNewCard({ ...newCard, joiningFee: e.target.value })} placeholder="0 (Enter 0 if free)" className={inputClass} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Card Benefits (comma separated)</label>
                        <textarea value={newCard.benefits} onChange={(e) => setNewCard({ ...newCard, benefits: e.target.value })} placeholder="e.g., Airport Lounge Access, Fuel Surcharge Waiver, Reward Points" rows="3" className={cx(inputClass, 'resize-y')} />
                    </div>

                    {addError && (
                        <div className="flex items-center gap-2 rounded-control border border-neg bg-neg-soft p-3 text-xs font-bold text-neg">
                            <AlertCircle size={15} aria-hidden="true" /> {addError}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Card"
                icon={Trash2}
                size="md"
                footer={
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteConfirm} disabled={!deletePassword} className="flex-1">Delete Card</Button>
                    </div>
                }
            >
                <div className="flex flex-col gap-4">
                    <div className="flex gap-2.5 rounded-control border border-neg bg-neg-soft p-4 text-xs text-neg">
                        <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <div>
                            <p className="mb-1 text-sm font-bold">Warning</p>
                            <p>You are about to delete <strong>{cardToDelete?.name}</strong>.</p>
                            <p className="mt-2">This card has:</p>
                            <ul className="ml-4 mt-1 list-disc">
                                <li>{cardToDelete?.transactions?.length || 0} transaction(s)</li>
                                <li>{cardToDelete?.emis?.length || 0} EMI(s)</li>
                                <li>Balance: {formatCurrency(cardToDelete?.used || 0, cardToDelete?.currency)}</li>
                            </ul>
                            <p className="mt-1">All data will be permanently deleted!</p>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Enter your credit card password to confirm</label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                            <input
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder="Same password used to unlock credit cards"
                                className={cx(inputClass, 'pl-10', deleteError && 'border-neg')}
                            />
                        </div>
                        {deleteError && <p className="mt-1.5 text-xs font-bold text-neg">{deleteError}</p>}
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showResetModal}
                onClose={() => setShowResetModal(false)}
                title="Reset Card Utilization"
                icon={RefreshCw}
                size="md"
                footer={
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowResetModal(false)} className="flex-1">Cancel</Button>
                        <Button variant="primary" onClick={handleResetConfirm} disabled={!resetPassword} className="flex-1">Reset Card</Button>
                    </div>
                }
            >
                <div className="flex flex-col gap-4">
                    <div className="flex gap-2.5 rounded-control border border-warn bg-warn-soft p-4 text-xs text-warn">
                        <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <div>
                            <p className="mb-1 text-sm font-bold">Warning</p>
                            <p>You are about to reset <strong>{cardToReset?.name}</strong>.</p>
                            <p className="mt-2">This will permanently delete:</p>
                            <ul className="ml-4 mt-1 list-disc">
                                <li>{cardToReset?.transactions?.length || 0} transaction(s)</li>
                                <li>{cardToReset?.emis?.length || 0} EMI(s)</li>
                            </ul>
                            <p className="mt-1">Card balance will be reset to 0.</p>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Enter your credit card password to confirm</label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                            <input
                                type="password"
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                                placeholder="Same password used to unlock credit cards"
                                className={cx(inputClass, 'pl-10', resetError && 'border-warn')}
                            />
                        </div>
                        {resetError && <p className="mt-1.5 text-xs font-bold text-warn">{resetError}</p>}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

function MiniStat({ label, value, valueClass = 'text-ink', compact }) {
    return (
        <div className="rounded-control border border-line bg-sunken p-3.5">
            <p className="text-[11px] text-ink-faint">{label}</p>
            <p className={cx('tnum font-bold', compact ? 'text-sm' : 'text-lg', valueClass)}>{value}</p>
        </div>
    );
}

export default CreditCardsList;
