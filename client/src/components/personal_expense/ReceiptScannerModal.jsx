import { useState, useRef, useMemo } from 'react';
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
    Plus,
    Trash2,
    AlertCircle,
    Loader
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { API_URL } from '../../config';
import axios from 'axios';

export default function ReceiptScannerModal({
    isOpen,
    onClose,
    onSaveExpense,
}) {
    const fileInputRef = useRef(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scannedData, setScannedData] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [splitWithFriends, setSplitWithFriends] = useState(false);
    const [splitMembers, setSplitMembers] = useState([
        { name: 'You (Self)', share: 0, isSelf: true },
        { name: 'Friend 1', share: 0, isSelf: false }
    ]);
    const [newFriendName, setNewFriendName] = useState('');

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setScannedData(null);
        setErrorMsg(null);

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('bill', file);

            const res = await axios.post(`${API_URL}/sms/bill-upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.data && res.data.success) {
                const parsed = res.data.parsed || {};
                setScannedData({
                    fileName: file.name,
                    merchant: parsed.merchant || 'Store / Merchant',
                    amount: parsed.amount || 0,
                    date: parsed.date || new Date().toISOString().slice(0, 10),
                    category: parsed.category || 'General',
                    tax: parsed.tax || 0,
                    source: 'OCR_SCAN'
                });
            } else {
                setErrorMsg(res.data?.error || 'Could not parse text from this receipt. Please enter details manually.');
            }
        } catch (err) {
            console.error('Receipt OCR failed:', err);
            setErrorMsg(err.response?.data?.error || 'OCR processing service is currently offline. Please enter receipt manually.');
        } finally {
            setIsScanning(false);
        }
    };

    const splitPerPerson = useMemo(() => {
        if (!scannedData || splitMembers.length === 0) return 0;
        return Math.round((scannedData.amount || 0) / splitMembers.length);
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
        if (onSaveExpense) {
            onSaveExpense({
                merchant: scannedData.merchant,
                amount: scannedData.amount,
                date: scannedData.date,
                category: scannedData.category,
                splitWith: splitWithFriends ? splitMembers : null,
                splitAmount: splitWithFriends ? splitPerPerson : null
            });
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sunken/80 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-lg p-6 rounded-3xl bg-surface border border-line shadow-2xl space-y-5 text-ink"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                                <ScanText className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-ink">Smart Receipt Scanner (OCR)</h3>
                                <p className="text-xs text-ink-muted">Upload receipt image or PDF to extract charges</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-xl bg-raised hover:bg-line text-ink-muted"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Upload Dropzone */}
                    {!scannedData && (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-line hover:border-indigo-500/80 rounded-2xl p-8 text-center cursor-pointer transition-all bg-sunken/50 hover:bg-sunken/80 group"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleUpload}
                                className="hidden"
                            />
                            {isScanning ? (
                                <div className="space-y-3">
                                    <Loader className="w-8 h-8 mx-auto text-indigo-400 animate-spin" />
                                    <p className="text-xs font-bold text-ink-muted">Extracting receipt items with OCR...</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                        <UploadCloud className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-ink">Click to upload or take a receipt photo</p>
                                        <p className="text-[10px] text-ink-faint mt-1">Supports PNG, JPG, WEBP, and PDF receipts</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Parsed Receipt View */}
                    {scannedData && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-sunken/80 border border-line space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-ink">{scannedData.merchant}</span>
                                    <span className="text-base font-black text-emerald-400">{formatCurrency(scannedData.amount)}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
                                    <div>Date: <span className="text-ink font-semibold">{scannedData.date}</span></div>
                                    <div>Category: <span className="text-ink font-semibold">{scannedData.category}</span></div>
                                </div>
                            </div>

                            {/* Split with friends */}
                            <div className="p-4 rounded-2xl bg-sunken/40 border border-line space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-ink-muted flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={splitWithFriends}
                                            onChange={(e) => setSplitWithFriends(e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
                                        />
                                        <span>Split with group / friends</span>
                                    </label>
                                    {splitWithFriends && (
                                        <span className="text-xs font-bold text-indigo-300">{formatCurrency(splitPerPerson)} / person</span>
                                    )}
                                </div>

                                {splitWithFriends && (
                                    <div className="space-y-2 pt-2 border-t border-line">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Add friend name..."
                                                value={newFriendName}
                                                onChange={(e) => setNewFriendName(e.target.value)}
                                                className="flex-1 px-3 py-1.5 bg-surface border border-line rounded-xl text-xs text-ink outline-none"
                                            />
                                            <button
                                                onClick={handleAddMember}
                                                className="px-3 py-1.5 bg-raised hover:bg-line text-ink text-xs font-bold rounded-xl"
                                            >
                                                Add
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            {splitMembers.map((m, idx) => (
                                                <span key={idx} className="px-2.5 py-1 rounded-lg bg-surface border border-line text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                                                    {m.name}
                                                    {!m.isSelf && (
                                                        <button onClick={() => handleRemoveMember(idx)} className="text-ink-faint hover:text-rose-400">
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setScannedData(null)}
                                    className="flex-1 py-2.5 rounded-xl bg-raised hover:bg-line text-ink-muted font-bold text-xs"
                                >
                                    Rescan
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25"
                                >
                                    Save to Ledger
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
