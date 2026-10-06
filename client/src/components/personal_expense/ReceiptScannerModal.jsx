import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ScanText,
    UploadCloud,
    FileText,
    Sparkles,
    CheckCircle2,
    Users,
    ArrowRight,
    X,
    Receipt,
    Calendar,
    Tag,
    DollarSign,
    Divide,
    Plus,
    Trash2,
    RotateCcw,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { cx } from '../ui/cx';

const SAMPLE_RECEIPTS = [
    {
        name: 'Fine Dine Bistro (Dinner)',
        merchant: 'Truffles & Bistro Cafe',
        amount: 3450,
        tax: 172.5,
        date: new Date().toISOString().slice(0, 10),
        category: 'Food & Dining',
        items: [
            { name: 'Woodfired Pizza', price: 650 },
            { name: 'Truffle Pasta', price: 780 },
            { name: 'Craft Beverages (x3)', price: 1200 },
            { name: 'Dessert Platter', price: 647.5 },
        ],
    },
    {
        name: 'Supermarket Grocery Mart',
        merchant: 'Nature’s Fresh Basket',
        amount: 2840,
        tax: 120,
        date: new Date().toISOString().slice(0, 10),
        category: 'Groceries',
        items: [
            { name: 'Organic Almond Milk', price: 340 },
            { name: 'Weekly Produce & Fruit', price: 1100 },
            { name: 'Pantry Staples & Grains', price: 1280 },
        ],
    },
    {
        name: 'Electronics & Gadget Store',
        merchant: 'Croma Digital Hub',
        amount: 4999,
        tax: 450,
        date: new Date().toISOString().slice(0, 10),
        category: 'Electronics',
        items: [
            { name: 'Fast Charger & Braided Cable', price: 1999 },
            { name: 'Wireless Ergonomic Mouse', price: 3000 },
        ],
    },
];

export function ReceiptScannerModal({
    isOpen,
    onClose,
    onSaveTransaction,
    currency = 'INR',
}) {
    const fileInputRef = useRef(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scannedData, setScannedData] = useState(null);
    const [splitWithFriends, setSplitWithFriends] = useState(false);
    const [splitMembers, setSplitMembers] = useState([
        { name: 'You (Self)', share: 0, isSelf: true },
        { name: 'Rahul S.', share: 0, isSelf: false },
        { name: 'Ananya M.', share: 0, isSelf: false },
    ]);
    const [newFriendName, setNewFriendName] = useState('');

    const handleUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setScannedData(null);

        // Simulate OCR scan
        setTimeout(() => {
            const randomSample = SAMPLE_RECEIPTS[Math.floor(Math.random() * SAMPLE_RECEIPTS.length)];
            setScannedData({
                ...randomSample,
                fileName: file.name,
            });
            setIsScanning(false);
        }, 1200);
    };

    const handleSelectSample = (sample) => {
        setIsScanning(true);
        setTimeout(() => {
            setScannedData(sample);
            setIsScanning(false);
        }, 600);
    };

    const splitPerPerson = useMemo(() => {
        if (!scannedData || splitMembers.length === 0) return 0;
        return Math.round(scannedData.amount / splitMembers.length);
    }, [scannedData, splitMembers]);

    const handleAddMember = () => {
        if (!newFriendName.trim()) return;
        setSplitMembers([...splitMembers, { name: newFriendName.trim(), share: 0, isSelf: false }]);
        setNewFriendName('');
    };

    const handleRemoveMember = (idx) => {
        setSplitMembers(splitMembers.filter((_, i) => i !== idx));
    };

    const handleSave = () => {
        if (!scannedData) return;

        const txData = {
            description: `${scannedData.merchant} (Scanned Receipt)`,
            amount: splitWithFriends ? splitPerPerson : scannedData.amount,
            type: 'expense',
            category: scannedData.category,
            date: scannedData.date,
        };

        if (onSaveTransaction) {
            onSaveTransaction(txData);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/85 backdrop-blur-md"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-[#0c1427] shadow-[0_24px_80px_rgba(0,0,0,0.95)] z-10 my-6 flex flex-col max-h-[92vh]"
                >
                    {/* Top ambient highlight */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-teal-400 via-brand to-emerald-400 opacity-90" />

                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#080e1d] px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400/20 to-emerald-500/20 text-teal-300 shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                                <ScanText size={20} />
                            </span>
                            <div>
                                <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                                    Instant Receipt &amp; Bill OCR Scanner
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full">
                                        Smart OCR
                                    </span>
                                </h3>
                                <p className="text-xs text-ink-muted">
                                    Drop any restaurant bill or receipt to auto-extract items, taxes, categories, and split with friends.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.04] text-ink-muted hover:bg-white/[0.08] hover:text-white transition"
                        >
                            <X size={17} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#0c1427]">
                        {!scannedData ? (
                            <div className="space-y-4">
                                {/* Upload Dropzone */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="cursor-pointer rounded-2xl border-2 border-dashed border-teal-500/30 bg-[#101a33]/60 hover:bg-[#101a33] p-8 text-center transition flex flex-col items-center justify-center gap-3 shadow-inner"
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handleUpload}
                                        className="hidden"
                                    />
                                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-500/15 text-teal-300 shadow-[0_0_20px_rgba(20,184,166,0.2)]">
                                        <UploadCloud size={28} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-extrabold text-white">
                                            Click or Drop Receipt / Invoice photo here
                                        </p>
                                        <p className="text-xs text-ink-muted mt-0.5">
                                            Supports JPG, PNG, WebP, PDF
                                        </p>
                                    </div>
                                </div>

                                {isScanning && (
                                    <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-[#101a33] text-teal-300 text-xs font-bold animate-pulse">
                                        <Sparkles size={16} />
                                        <span>Analyzing merchant, line items, taxes, and total amount...</span>
                                    </div>
                                )}

                                {/* Quick Samples */}
                                <div className="space-y-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-ink-faint block">
                                        Or test with instant demo receipts
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        {SAMPLE_RECEIPTS.map((s, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSelectSample(s)}
                                                className="flex flex-col items-start p-3 rounded-xl bg-[#101a33] hover:bg-[#152243] text-left transition"
                                            >
                                                <p className="text-xs font-bold text-white line-clamp-1">{s.merchant}</p>
                                                <div className="mt-1 flex items-center justify-between w-full text-[11px]">
                                                    <span className="text-teal-400 font-extrabold tnum">{formatCurrency(s.amount, currency)}</span>
                                                    <span className="text-ink-faint">{s.category}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Scanned Result Card */}
                                <div className="rounded-2xl bg-[#101a33] p-5 shadow-inner space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] pb-3">
                                        <div>
                                            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                                                Auto-Detected Merchant
                                            </span>
                                            <h4 className="text-base font-extrabold text-white">
                                                {scannedData.merchant}
                                            </h4>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-ink-faint uppercase block">Total Scanned</span>
                                            <span className="text-xl font-black text-white tnum">
                                                {formatCurrency(scannedData.amount, currency)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Line Items */}
                                    {scannedData.items && scannedData.items.length > 0 && (
                                        <div className="space-y-1.5">
                                            <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                                                Parsed Line Items ({scannedData.items.length})
                                            </span>
                                            <div className="rounded-xl bg-[#080e1d] p-3 space-y-2">
                                                {scannedData.items.map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between text-xs">
                                                        <span className="text-ink-muted">{item.name}</span>
                                                        <span className="font-bold text-white tnum">
                                                            {formatCurrency(item.price, currency)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                        <div className="rounded-xl bg-[#080e1d] p-2.5">
                                            <span className="text-[10px] text-ink-faint block uppercase">Category</span>
                                            <span className="font-bold text-teal-300">{scannedData.category}</span>
                                        </div>
                                        <div className="rounded-xl bg-[#080e1d] p-2.5">
                                            <span className="text-[10px] text-ink-faint block uppercase">Date</span>
                                            <span className="font-bold text-white">{scannedData.date}</span>
                                        </div>
                                        <div className="rounded-xl bg-[#080e1d] p-2.5">
                                            <span className="text-[10px] text-ink-faint block uppercase">Estimated Tax</span>
                                            <span className="font-bold text-white tnum">{formatCurrency(scannedData.tax, currency)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Split with Friends Section */}
                                <div className="rounded-2xl bg-[#101a33] p-5 shadow-inner space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Users size={16} className="text-teal-400" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-white">
                                                Split Bill with Friends
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSplitWithFriends(!splitWithFriends)}
                                            className={cx(
                                                'px-3 py-1 rounded-lg text-xs font-bold transition',
                                                splitWithFriends
                                                    ? 'bg-teal-500/20 text-teal-300'
                                                    : 'bg-[#080e1d] text-ink-muted hover:text-white'
                                            )}
                                        >
                                            {splitWithFriends ? 'Split Mode Enabled' : '+ Enable Split'}
                                        </button>
                                    </div>

                                    {splitWithFriends && (
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-teal-500/20 via-[#080e1d] to-[#080e1d]">
                                                <div>
                                                    <p className="text-xs font-bold text-white">
                                                        Your Share: <strong className="text-teal-300 text-sm">{formatCurrency(splitPerPerson, currency)}</strong>
                                                    </p>
                                                    <p className="text-[11px] text-ink-muted">
                                                        Divided equally among {splitMembers.length} people
                                                    </p>
                                                </div>
                                                <span className="text-xs font-bold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full">
                                                    {formatCurrency(splitPerPerson, currency)} / person
                                                </span>
                                            </div>

                                            {/* Members list */}
                                            <div className="space-y-1.5">
                                                {splitMembers.map((m, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#080e1d] text-xs"
                                                    >
                                                        <span className={cx('font-bold', m.isSelf ? 'text-teal-300' : 'text-white')}>
                                                            {m.name}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-extrabold tnum text-white">
                                                                {formatCurrency(splitPerPerson, currency)}
                                                            </span>
                                                            {!m.isSelf && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveMember(idx)}
                                                                    className="text-ink-faint hover:text-rose-400 transition"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Add member input */}
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Add friend's name (e.g. Vikram)"
                                                    value={newFriendName}
                                                    onChange={(e) => setNewFriendName(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                                                    className="flex-1 rounded-xl bg-[#080e1d] px-3.5 py-2 text-xs font-bold text-white placeholder:text-ink-faint outline-none focus:ring-1 focus:ring-teal-400"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddMember}
                                                    className="rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 px-3.5 py-2 text-xs font-bold transition"
                                                >
                                                    + Add
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setScannedData(null)}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-white transition"
                                    >
                                        <RotateCcw size={14} />
                                        <span>Scan Another Receipt</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-black px-5 py-2.5 text-xs font-black transition shadow-[0_0_20px_rgba(20,184,166,0.3)] active:scale-95"
                                    >
                                        Log Expense ({formatCurrency(splitWithFriends ? splitPerPerson : scannedData.amount, currency)})
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

export default ReceiptScannerModal;
