import { useState, useEffect } from 'react';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, Lock, Check, X, AlertCircle, MessageSquare,
    Plus, CheckCircle2, Eye, Pencil, Save, Trash2, DollarSign
} from 'lucide-react';
import { Panel, PanelHeader, Button, Badge, EmptyState } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import ActionModal from '../../components/credit_card/ActionModal';
import { cx } from '../../components/ui/cx';
import { formatCurrency } from '../../utils/currency';
import { API_URL } from '../../config';

const INPUT_CLASS =
    'w-full rounded-control border border-line bg-sunken px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-line-strong';

const CATEGORY_TONES = {
    Shopping: 'violet',
    'Food & Dining': 'warn',
    Fuel: 'neg',
    Entertainment: 'violet',
    Bills: 'info',
    Travel: 'pos',
    Healthcare: 'pos',
    Groceries: 'warn'
};

const categoryTone = (category) => CATEGORY_TONES[category] || 'muted';

const getLocalISOString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localTime = new Date(now.getTime() - offset * 60 * 1000);
    return localTime.toISOString().slice(0, 16);
};

const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';

    // Handle date-only strings (YYYY-MM-DD) to avoid timezone/time-shift issues
    if (typeof dateString === 'string' && dateString.length === 10 && dateString.includes('-')) {
        const [year, month, day] = dateString.split('-');
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString(undefined, {
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
};

const CreditCardAutoStatement = () => {
    const { cards, addCard, addTransaction, categories } = useCreditCards();
    const [selectedCard, setSelectedCard] = useState('');
    const [pdfFile, setPdfFile] = useState(null);
    const [inputMode, setInputMode] = useState('pdf'); // 'pdf' or 'text'
    const [smsText, setSmsText] = useState('');
    const [pdfPassword, setPdfPassword] = useState('');
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [extractedTransactions, setExtractedTransactions] = useState([]);

    // Helper to update state and localStorage simultaneously
    const updateExtractedTransactions = (updater) => {
        setExtractedTransactions((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            localStorage.setItem('pendingTransactions', JSON.stringify(next));
            return next;
        });
    };

    const [isProcessing, setIsProcessing] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [cardMatchStatus, setCardMatchStatus] = useState(null); // 'matched', 'not-matched', null
    const [statementData, setStatementData] = useState(null);
    const [parseError, setParseError] = useState(null);
    const [rawExtractedText, setRawExtractedText] = useState('');
    const [statementCardEnding, setStatementCardEnding] = useState('');
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [showEMIModal, setShowEMIModal] = useState(false);

    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'confirm', onConfirm: null });

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }));

    const [manualTransaction, setManualTransaction] = useState({
        date: getLocalISOString(),
        merchant: '',
        amount: '',
        category: ''
    });

    const [fileUrl, setFileUrl] = useState(null);

    // Load saved state from localStorage on mount
    useEffect(() => {
        const savedTransactions = localStorage.getItem('pendingTransactions');
        if (savedTransactions) {
            try {
                const parsed = JSON.parse(savedTransactions);
                setExtractedTransactions(parsed);
            } catch (e) {
                console.error('Failed to load saved transactions:', e);
            }
        }

        const savedSelectedCard = localStorage.getItem('selectedCard');
        if (savedSelectedCard) setSelectedCard(savedSelectedCard);

        const savedMatchStatus = localStorage.getItem('cardMatchStatus');
        if (savedMatchStatus) setCardMatchStatus(savedMatchStatus);

        const savedEnding = localStorage.getItem('statementCardEnding');
        if (savedEnding) setStatementCardEnding(savedEnding);
    }, []);

    // Keep other state in sync with localStorage
    useEffect(() => {
        if (selectedCard) localStorage.setItem('selectedCard', selectedCard);
        else localStorage.removeItem('selectedCard');
    }, [selectedCard]);

    useEffect(() => {
        if (cardMatchStatus) localStorage.setItem('cardMatchStatus', cardMatchStatus);
        else localStorage.removeItem('cardMatchStatus');
    }, [cardMatchStatus]);

    useEffect(() => {
        if (statementCardEnding) localStorage.setItem('statementCardEnding', statementCardEnding);
        else localStorage.removeItem('statementCardEnding');
    }, [statementCardEnding]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setInputMode('pdf'); // Switch to PDF mode on file select
            const isImage = file.type.startsWith('image/');
            const isPDF = file.type === 'application/pdf';

            if (isImage || isPDF) {
                setPdfFile(file);
                setCardMatchStatus(null);
                setExtractedTransactions([]);
                setParseError(null);
                setRawExtractedText('');
                setIsUnlocked(false);
                setShowPasswordInput(false);

                // Create preview URL for images
                if (isImage) {
                    const url = URL.createObjectURL(file);
                    setFileUrl(url);
                } else {
                    setFileUrl(null);
                }
            }
        }
    };

    const handleViewStatement = () => {
        if (fileUrl) {
            window.open(fileUrl, '_blank');
        } else if (pdfFile) {
            const url = URL.createObjectURL(pdfFile);
            setFileUrl(url); // Cache the URL
            window.open(url, '_blank');
        }
    };

    const handleProcessText = async () => {
        if (!smsText.trim()) return;
        setIsProcessing(true);
        setParseError(null);
        setStatementData(null);
        setExtractedTransactions([]);

        try {
            const formData = new FormData();
            formData.append('text', smsText);

            const response = await fetch(`${API_URL}/statements/parse`, {
                method: 'POST',
                body: formData // Send as FormData to satisfy multer
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to parse text');
            }

            handleParseSuccess(data);
        } catch (error) {
            console.error('Text parsing error:', error);
            setParseError({
                message: error.message || 'Failed to parse text.',
                details: error.details || 'Please check the text format.'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleProcessStatement = async () => {
        if (pdfFile) {
            await processStatement(pdfFile, null);
        }
    };

    // Extracted success handler to reuse
    const handleParseSuccess = (data) => {
        setStatementData(data);
        setRawExtractedText(data.rawText);

        if (data.transactions && data.transactions.length > 0) {
            // Add approved field to each transaction
            const transactionsWithApproval = data.transactions.map((t) => ({
                ...t,
                approved: null, // null = pending, true = approved/synced, false = rejected
                id: t.id || Date.now() + Math.random(), // Ensure each has unique ID
                rawLine: t.rawLine || t.description // Store raw line if available
            }));
            updateExtractedTransactions(transactionsWithApproval);
        } else {
            setParseError({
                message: 'No transactions found',
                details: 'Could not identify any clear transactions. Try pasting a different format.'
            });
        }

        // Try to match card
        if (data.cardEnding) {
            setStatementCardEnding(data.cardEnding);
            // Robust match: Check strict last 4 or if card number contains the last 4
            const matchedCard = cards.find(
                (card) =>
                    card.number &&
                    (card.number.endsWith(data.cardEnding) || card.number.replace(/\s/g, '').includes(data.cardEnding))
            );

            if (matchedCard) {
                setCardMatchStatus('matched');
                setSelectedCard(matchedCard.id.toString());
            } else {
                setCardMatchStatus('new-detected');
            }
        } else {
            setCardMatchStatus('manual-required');
        }
    };

    const handleUnlockPDF = async () => {
        if (pdfFile && pdfPassword) {
            await processStatement(pdfFile, pdfPassword);
        }
    };

    const processStatement = async (file, password) => {
        setIsProcessing(true);
        setPasswordError('');

        try {
            const formData = new FormData();
            formData.append('statement', file);
            if (password) {
                formData.append('password', password);
            }

            const response = await fetch(`${API_URL}/statements/parse`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.status === 401 && data.encrypted) {
                setShowPasswordInput(true);
                setPasswordError('This PDF is password protected. Please enter the password.');
                setIsProcessing(false);
                return;
            }

            if (!response.ok) {
                const errorText = data.details || data.error || 'Failed to parse statement';
                setParseError({ message: data.error, details: data.details });
                throw new Error(errorText);
            }

            setParseError(null);
            setRawExtractedText(data.rawText || '');
            setIsUnlocked(true);
            handleParseSuccess(data); // Reuse logic
            setIsProcessing(false);
        } catch (error) {
            console.error('Statement processing error:', error);
            setPasswordError(error.message || 'Failed to process statement');
            setIsProcessing(false);
        }
    };

    const handleAddNewCard = (cardData) => {
        // Create new card with statement data
        const newCard = addCard({
            ...cardData,
            number: `**** **** **** ${statementCardEnding}`,
            // Populate other fields from statement if available
            creditLimit: statementData?.credit_limit || 0, // Ensure mapping
            totalDue: statementData?.totalDue || 0,
            minPayment: statementData?.minPayment || 0
        });

        // FORCE UPDATE Selected Card
        setTimeout(() => {
            setSelectedCard(newCard.id.toString());
            setCardMatchStatus('matched');
        }, 100);
    };

    // Creates the card directly from the parsed statement. Previously this
    // opened a card-entry modal that no longer exists in this view.
    const handleCreateNewCard = () => {
        handleAddNewCard({});
    };

    const handleApprove = (id) => {
        // If no card selected, try to auto-select the first one if only one exists
        let targetCardId = selectedCard;
        if (!targetCardId) {
            if (cards.length === 1) {
                targetCardId = cards[0].id.toString();
                setSelectedCard(targetCardId);
            } else {
                setModal({
                    isOpen: true,
                    title: 'No card selected',
                    message: `Do you want to create a new card for the statement ending in ${statementCardEnding}?`,
                    type: 'confirm',
                    onConfirm: () => {
                        closeModal();
                        handleCreateNewCard();
                    }
                });
                return;
            }
        }

        const transaction = extractedTransactions.find((t) => t.id === id);
        if (transaction) {
            addTransaction(targetCardId, {
                ...transaction,
                id: Date.now() + Math.random(),
                description: transaction.merchant
            });

            // Mark as approved (synced) but keep in list for history counts
            updateExtractedTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, approved: true } : t)));
        }
    };

    const handleReject = (id) => {
        updateExtractedTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, approved: false } : t)));
    };

    const handleEdit = (transaction) => {
        setEditingTransaction({ ...transaction });
        setShowEditModal(true);
    };

    const handleSaveEdit = () => {
        updateExtractedTransactions((prev) =>
            prev.map((t) => (t.id === editingTransaction.id ? { ...editingTransaction } : t))
        );
        setShowEditModal(false);
        setEditingTransaction(null);
    };

    const handleBulkApprove = async () => {
        if (!selectedCard) {
            showToast('Please select a card to sync transactions', 'error');
            return;
        }

        const pending = extractedTransactions.filter((t) => t.approved !== true);
        if (pending.length === 0) return;

        setIsProcessing(true);
        try {
            for (const t of pending) {
                await addTransaction(selectedCard, {
                    ...t,
                    id: Date.now() + Math.random(),
                    description: t.merchant,
                    transactionDate: t.date // Ensure naming consistency
                });
            }

            updateExtractedTransactions((prev) => prev.map((t) => ({ ...t, approved: true })));
            showToast(`Successfully synced ${pending.length} transactions!`, 'success');
        } catch (error) {
            console.error('Bulk approve error:', error);
            showToast('Failed to sync some transactions. Please try again.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkReject = () => {
        updateExtractedTransactions((prev) => prev.map((t) => (t.approved === null ? { ...t, approved: false } : t)));
    };

    const handleDeleteAll = () => {
        updateExtractedTransactions([]);
        // Clear all relevant localStorage items
        localStorage.removeItem('pendingTransactions');
        localStorage.removeItem('cardMatchStatus');
        localStorage.removeItem('statementCardEnding');
        localStorage.removeItem('selectedCard');
        setCardMatchStatus(null);
        setSelectedCard('');
        setStatementCardEnding('');
    };

    const handleDelete = (id) => {
        updateExtractedTransactions((prev) => prev.filter((t) => t.id !== id));
    };

    const handleAddManualTransaction = () => {
        const newTransaction = {
            id: Date.now(),
            ...manualTransaction,
            amount: parseFloat(manualTransaction.amount),
            approved: null
        };
        updateExtractedTransactions((prev) => [...prev, newTransaction]);
        setManualTransaction({ date: getLocalISOString(), merchant: '', amount: '', category: 'Shopping' });
        setShowManualEntry(false);
    };

    const approvedCount = extractedTransactions.filter((t) => t.approved === true).length;
    const rejectedCount = extractedTransactions.filter((t) => t.approved === false).length;
    const pendingCount = extractedTransactions.filter((t) => t.approved === null).length;

    const segBtn = (active) =>
        cx(
            'flex flex-1 items-center justify-center gap-2 rounded-[8px] px-4 py-2.5 text-sm font-bold transition',
            active ? 'bg-brand text-slate-950' : 'text-ink-muted hover:text-ink'
        );

    return (
        <div className="mx-auto max-w-[1400px] p-6 md:p-10">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-black tracking-tight text-ink">Auto Statement</h1>
                <p className="mt-1 text-sm text-ink-muted">
                    Upload PDF statements, extract transactions, and sync to your cards.
                </p>
            </header>

            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                {/* Left Panel - Upload & Settings */}
                <div className="flex flex-col gap-5">
                    {/* Select Card - Always show if transactions exist but no card is matched/selected */}
                    {(cardMatchStatus === 'not-matched' || (extractedTransactions.length > 0 && !selectedCard)) && (
                        <Panel>
                            <PanelHeader title="Select Card Manually" icon={FileText} />
                            <select
                                value={selectedCard}
                                onChange={(e) => setSelectedCard(e.target.value)}
                                className={cx(INPUT_CLASS, 'appearance-none')}
                            >
                                <option value="">Choose a card...</option>
                                {cards.map((card) => (
                                    <option key={card.id} value={card.id}>
                                        {card.bankName} - {card.name} (Ending {card.number?.slice(-4)})
                                    </option>
                                ))}
                            </select>
                        </Panel>
                    )}

                    {/* Input Mode Tabs */}
                    <div className="flex gap-2 rounded-control border border-line bg-surface p-1">
                        <button type="button" onClick={() => setInputMode('pdf')} className={segBtn(inputMode === 'pdf')}>
                            <FileText size={17} aria-hidden="true" /> Upload PDF
                        </button>
                        <button type="button" onClick={() => setInputMode('text')} className={segBtn(inputMode === 'text')}>
                            <MessageSquare size={17} aria-hidden="true" /> SMS / Text
                        </button>
                    </div>

                    {/* PDF Upload */}
                    {inputMode === 'pdf' && (
                        <Panel>
                            <PanelHeader title="Upload Statement" icon={Upload} />

                            <label className="flex cursor-pointer flex-col items-center rounded-card border-2 border-dashed border-line bg-sunken px-6 py-8 text-center transition hover:border-line-strong">
                                <Upload size={30} className="mb-3 text-ink-faint" aria-hidden="true" />
                                <span className="text-sm font-bold text-ink">
                                    {pdfFile ? pdfFile.name : 'Click to upload statement'}
                                </span>
                                <span className="mt-1 text-xs text-ink-faint">PDF or Image files</span>
                                <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} className="hidden" />
                            </label>

                            {/* File Preview & Process Buttons */}
                            {pdfFile && !isProcessing && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Button variant="secondary" icon={Eye} onClick={handleViewStatement}>
                                        View
                                    </Button>
                                    {!isUnlocked && !showPasswordInput && (
                                        <Button variant="primary" icon={CheckCircle2} onClick={handleProcessStatement} className="flex-1">
                                            Process Statement
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        icon={FileText}
                                        onClick={() => setShowSummaryModal(true)}
                                        disabled={!statementData}
                                    >
                                        Summary
                                    </Button>
                                    {statementData?.emis && statementData.emis.length > 0 && (
                                        <Button variant="secondary" icon={DollarSign} onClick={() => setShowEMIModal(true)}>
                                            EMIs
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Processing State */}
                            {isProcessing && (
                                <div className="mt-4 flex flex-col items-center gap-3 rounded-card border border-line bg-sunken p-5">
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                        <Upload size={24} className="text-violet" aria-hidden="true" />
                                    </motion.div>
                                    <span className="text-sm font-semibold text-ink">Analyzing statement accurately...</span>
                                </div>
                            )}

                            {/* Card Match Status */}
                            {cardMatchStatus === 'matched' && (
                                <div className="mt-4 flex items-center gap-2 rounded-control border border-pos bg-pos-soft p-3 text-sm font-bold text-pos">
                                    <CheckCircle2 size={16} aria-hidden="true" />
                                    Card matched! Statement card ending in {statementCardEnding}
                                </div>
                            )}

                            {cardMatchStatus === 'new-detected' && (
                                <div className="mt-4">
                                    <div className="flex items-center gap-2 rounded-control border border-warn bg-warn-soft p-3 text-sm font-bold text-warn">
                                        <AlertCircle size={16} aria-hidden="true" />
                                        New Card Detected (Ending {statementCardEnding})
                                    </div>
                                    <Button variant="primary" icon={Plus} onClick={handleCreateNewCard} className="mt-3 w-full">
                                        Create New Card
                                    </Button>
                                </div>
                            )}

                            {(cardMatchStatus === 'manual-required' || cardMatchStatus === 'not-matched') && (
                                <div className="mt-4 flex items-center gap-2 rounded-control border border-info bg-info-soft p-3 text-sm font-bold text-info">
                                    <AlertCircle size={16} aria-hidden="true" />
                                    Please select your card from the list above.
                                </div>
                            )}

                            {/* Password Input */}
                            {showPasswordInput && !isUnlocked && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4">
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint">
                                        PDF Password
                                    </label>
                                    <div className="relative">
                                        <Lock
                                            size={18}
                                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                                            aria-hidden="true"
                                        />
                                        <input
                                            type="password"
                                            value={pdfPassword}
                                            onChange={(e) => setPdfPassword(e.target.value)}
                                            placeholder="Enter PDF password"
                                            className={cx(INPUT_CLASS, 'pl-11', passwordError && 'border-neg')}
                                        />
                                    </div>
                                    {passwordError && <div className="mt-1.5 text-xs text-neg">{passwordError}</div>}
                                    <Button
                                        variant="primary"
                                        onClick={handleUnlockPDF}
                                        disabled={!pdfPassword}
                                        className="mt-3 w-full"
                                    >
                                        Unlock &amp; Extract
                                    </Button>
                                </motion.div>
                            )}

                            {/* Detailed Parse Error */}
                            {parseError && (
                                <div className="mt-4 rounded-card border border-neg bg-neg-soft p-4 text-neg">
                                    <div className="flex items-center gap-2 text-sm font-bold">
                                        <AlertCircle size={16} aria-hidden="true" />
                                        <span>{parseError.message}</span>
                                    </div>
                                    {parseError.details && <p className="mt-1.5 text-xs opacity-90">{parseError.details}</p>}
                                    {rawExtractedText && (
                                        <details className="mt-2.5">
                                            <summary className="cursor-pointer text-xs opacity-80">
                                                Show raw extraction (Technical Info)
                                            </summary>
                                            <div className="mt-1.5 max-h-[150px] overflow-y-auto whitespace-pre-wrap rounded-control bg-black/20 p-2.5 font-mono text-[10px] text-ink-muted">
                                                {rawExtractedText}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )}

                            {isUnlocked && (
                                <div className="mt-4 flex items-center gap-2 rounded-control border border-pos bg-pos-soft p-3 text-sm font-bold text-pos">
                                    <CheckCircle2 size={16} aria-hidden="true" />
                                    PDF unlocked successfully
                                </div>
                            )}
                        </Panel>
                    )}

                    {/* SMS / Text Input */}
                    {inputMode === 'text' && (
                        <Panel>
                            <PanelHeader title="Paste SMS / Text" icon={MessageSquare} />
                            <textarea
                                value={smsText}
                                onChange={(e) => setSmsText(e.target.value)}
                                placeholder={`Paste your bank SMS or raw transactions here...\nExample: \nSpent Rs. 500 at Swiggy on 12 - 12 - 2024\nTxn of INR 1200.00 at Amazon on 15 Oct 2024`}
                                className={cx(INPUT_CLASS, 'min-h-[200px] resize-y font-mono text-[13px] leading-relaxed')}
                            />

                            <Button
                                variant="primary"
                                icon={CheckCircle2}
                                loading={isProcessing}
                                onClick={handleProcessText}
                                disabled={!smsText}
                                className="mt-5 w-full"
                                size="lg"
                            >
                                {isProcessing ? 'Processing Text...' : 'Parse Transactions'}
                            </Button>

                            {/* Detailed Parse Error */}
                            {parseError && (
                                <div className="mt-4 rounded-card border border-neg bg-neg-soft p-4 text-neg">
                                    <div className="flex items-center gap-2 text-sm font-bold">
                                        <AlertCircle size={16} aria-hidden="true" />
                                        <span>{parseError.message}</span>
                                    </div>
                                    {parseError.details && <p className="mt-1.5 text-xs opacity-90">{parseError.details}</p>}
                                </div>
                            )}
                        </Panel>
                    )}

                    {/* Manual Entry Button */}
                    <Button variant="secondary" icon={Plus} onClick={() => setShowManualEntry(true)} className="w-full" size="lg">
                        Add Manual Transaction
                    </Button>

                    {/* Stats */}
                    {extractedTransactions.length > 0 && (
                        <>
                            <Panel>
                                <PanelHeader title="Summary" />
                                <div className="flex flex-col gap-2.5">
                                    <StatRow label="Total" value={extractedTransactions.length} />
                                    <StatRow label="Approved" value={approvedCount} tone="text-pos" />
                                    <StatRow label="Rejected" value={rejectedCount} tone="text-neg" />
                                    <StatRow label="Pending" value={pendingCount} tone="text-warn" />
                                </div>
                            </Panel>

                            {/* Rewards Summary */}
                            {statementData?.rewards && (
                                <Panel>
                                    <PanelHeader title="Reward Points" />
                                    <div className="flex flex-col gap-2.5">
                                        <StatRow label="Opening" value={statementData.rewards.opening} />
                                        <StatRow label="Earned" value={`+${statementData.rewards.earned}`} tone="text-pos" />
                                        <StatRow label="Redeemed" value={`-${statementData.rewards.disbursed}`} tone="text-neg" />
                                        <div className="mt-1 flex items-center justify-between border-t border-line pt-2.5">
                                            <span className="text-xs font-bold text-ink">Closing Balance</span>
                                            <span className="tnum text-sm font-black text-violet">
                                                {statementData.rewards.closing}
                                            </span>
                                        </div>
                                    </div>
                                </Panel>
                            )}
                        </>
                    )}
                </div>

                {/* Right Panel - Transactions */}
                <Panel>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-black text-ink">Extracted Transactions</h3>
                            <p className="text-xs text-ink-muted">Review and approve transactions</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {pdfFile && (
                                <Button variant="secondary" icon={Eye} onClick={handleViewStatement}>
                                    View Original
                                </Button>
                            )}
                            {extractedTransactions.length > 0 && pendingCount > 0 && (
                                <>
                                    <Button variant="primary" icon={Check} onClick={handleBulkApprove} disabled={isProcessing}>
                                        Approve All
                                    </Button>
                                    <Button variant="danger" icon={X} onClick={handleBulkReject}>
                                        Reject All
                                    </Button>
                                    <Button variant="secondary" icon={X} onClick={handleDeleteAll}>
                                        Finish &amp; Clear All
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {extractedTransactions.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title="No transactions yet"
                            description="Upload a PDF statement to extract transactions, or add them manually."
                        />
                    ) : (
                        <div className="flex max-h-[600px] flex-col gap-3 overflow-y-auto">
                            {extractedTransactions.map((t) => {
                                const isGST = t.description?.toUpperCase().includes('GST');
                                return (
                                    <motion.div
                                        key={t.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={cx(
                                            'flex items-center justify-between gap-4 rounded-card border p-4',
                                            isGST ? 'border-warn bg-warn-soft' : 'border-line bg-sunken'
                                        )}
                                    >
                                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                            <span
                                                className={cx(
                                                    'break-words text-sm font-bold leading-relaxed',
                                                    isGST ? 'text-warn' : 'text-ink'
                                                )}
                                            >
                                                {t.description}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-2.5 text-xs text-ink-muted">
                                                <span>{formatDate(t.date)}</span>
                                                <span aria-hidden="true">•</span>
                                                <Badge tone={categoryTone(t.category)}>{t.category || 'Uncategorized'}</Badge>
                                            </div>
                                            {t.rawLine && (
                                                <div className="mt-1 w-fit rounded-[4px] bg-black/20 px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                                                    Raw: {t.rawLine}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <span
                                                className={cx(
                                                    'tnum text-base font-bold',
                                                    t.type === 'credit' ? 'text-pos' : 'text-ink'
                                                )}
                                            >
                                                {t.type === 'credit' ? '+' : '-'}
                                                {formatCurrency(t.amount)}
                                            </span>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEdit(t)}
                                                    disabled={t.approved === true}
                                                    title="Edit transaction"
                                                    className={cx(
                                                        'rounded-control p-2 text-ink-faint transition hover:bg-violet-soft hover:text-violet',
                                                        t.approved === true && 'cursor-default opacity-50 hover:bg-transparent hover:text-ink-faint'
                                                    )}
                                                >
                                                    <Pencil size={15} aria-hidden="true" />
                                                </button>

                                                {t.approved === true ? (
                                                    <Badge tone="pos" icon={CheckCircle2}>
                                                        Synced
                                                    </Badge>
                                                ) : (
                                                    <>
                                                        <Button size="sm" variant="primary" icon={Check} onClick={() => handleApprove(t.id)}>
                                                            Approve
                                                        </Button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReject(t.id)}
                                                            title="Reject transaction"
                                                            className="rounded-control p-2 text-ink-faint transition hover:bg-warn-soft hover:text-warn"
                                                        >
                                                            <X size={15} aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(t.id)}
                                                            title="Delete transaction"
                                                            className="rounded-control p-2 text-ink-faint transition hover:bg-neg-soft hover:text-neg"
                                                        >
                                                            <Trash2 size={15} aria-hidden="true" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </Panel>
            </div>

            {/* Manual Entry Modal */}
            <Modal
                isOpen={showManualEntry}
                onClose={() => setShowManualEntry(false)}
                title="Add Manual Transaction"
                icon={Plus}
                size="md"
                footer={
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowManualEntry(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleAddManualTransaction}
                            disabled={!manualTransaction.date || !manualTransaction.merchant || !manualTransaction.amount}
                            className="flex-1"
                        >
                            Add Transaction
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label="Date">
                        <input
                            type="datetime-local"
                            value={manualTransaction.date}
                            onChange={(e) => setManualTransaction({ ...manualTransaction, date: e.target.value })}
                            className={INPUT_CLASS}
                        />
                    </Field>
                    <Field label="Merchant">
                        <input
                            type="text"
                            value={manualTransaction.merchant}
                            onChange={(e) => setManualTransaction({ ...manualTransaction, merchant: e.target.value })}
                            placeholder="e.g., Amazon, Swiggy"
                            className={INPUT_CLASS}
                        />
                    </Field>
                    <Field label="Amount (₹)">
                        <input
                            type="number"
                            value={manualTransaction.amount}
                            onChange={(e) => setManualTransaction({ ...manualTransaction, amount: e.target.value })}
                            placeholder="2500"
                            className={INPUT_CLASS}
                        />
                    </Field>
                    <Field label="Category">
                        <select
                            value={manualTransaction.category}
                            onChange={(e) => setManualTransaction({ ...manualTransaction, category: e.target.value })}
                            className={cx(INPUT_CLASS, 'appearance-none')}
                        >
                            <option value="">Select Category</option>
                            {categories && categories.length > 0 ? (
                                categories.map((cat) => (
                                    <option key={cat.id} value={cat.name}>
                                        {cat.name}
                                    </option>
                                ))
                            ) : (
                                <>
                                    <option value="Shopping">Shopping</option>
                                    <option value="Food & Dining">Food & Dining</option>
                                    <option value="Fuel">Fuel</option>
                                    <option value="Entertainment">Entertainment</option>
                                    <option value="Bills">Bills</option>
                                    <option value="Travel">Travel</option>
                                </>
                            )}
                        </select>
                    </Field>
                </div>
            </Modal>

            {/* Edit Transaction Modal */}
            <Modal
                isOpen={showEditModal && Boolean(editingTransaction)}
                onClose={() => setShowEditModal(false)}
                title="Edit Transaction"
                icon={Pencil}
                size="md"
                footer={
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowEditModal(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button variant="primary" icon={Save} onClick={handleSaveEdit} className="flex-1">
                            Save Changes
                        </Button>
                    </div>
                }
            >
                {editingTransaction && (
                    <div className="flex flex-col gap-4">
                        <Field label="Date">
                            <input
                                type="datetime-local"
                                value={editingTransaction.date}
                                onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                                className={INPUT_CLASS}
                            />
                        </Field>
                        <Field label="Merchant">
                            <input
                                type="text"
                                value={editingTransaction.merchant}
                                onChange={(e) => setEditingTransaction({ ...editingTransaction, merchant: e.target.value })}
                                placeholder="Enter merchant name"
                                className={INPUT_CLASS}
                            />
                        </Field>
                        <Field label="Amount">
                            <input
                                type="number"
                                value={editingTransaction.amount}
                                onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: e.target.value })}
                                placeholder="0.00"
                                className={INPUT_CLASS}
                            />
                        </Field>
                        <Field label="Category">
                            <select
                                value={editingTransaction.category}
                                onChange={(e) => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
                                className={cx(INPUT_CLASS, 'appearance-none')}
                            >
                                <option value="">Select Category</option>
                                {categories && categories.length > 0 ? (
                                    categories.map((cat) => (
                                        <option key={cat.id} value={cat.name}>
                                            {cat.name}
                                        </option>
                                    ))
                                ) : (
                                    <>
                                        <option value="Shopping">Shopping</option>
                                        <option value="Food & Dining">Food & Dining</option>
                                        <option value="Fuel">Fuel</option>
                                        <option value="Entertainment">Entertainment</option>
                                        <option value="Bills">Bills</option>
                                        <option value="Travel">Travel</option>
                                        <option value="Healthcare">Healthcare</option>
                                        <option value="Groceries">Groceries</option>
                                    </>
                                )}
                            </select>
                        </Field>
                        <Field label="Transaction Type">
                            <select
                                value={editingTransaction.type || 'debit'}
                                onChange={(e) => setEditingTransaction({ ...editingTransaction, type: e.target.value })}
                                className={cx(INPUT_CLASS, 'appearance-none')}
                            >
                                <option value="debit">Debit (Spending)</option>
                                <option value="credit">Credit (Payment)</option>
                                <option value="refund">Refund</option>
                            </select>
                        </Field>
                        {editingTransaction.rawLine && (
                            <div className="mt-1 rounded-control bg-sunken p-3 text-xs text-ink-muted">
                                <strong className="text-ink">Raw Line:</strong>
                                <p className="mt-1 font-mono">{editingTransaction.rawLine}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <SummaryModal isOpen={showSummaryModal} onClose={() => setShowSummaryModal(false)} data={statementData} />
            <EMIModal isOpen={showEMIModal} onClose={() => setShowEMIModal(false)} emis={statementData?.emis} />

            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className={cx(
                            'fixed bottom-8 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2.5 rounded-control px-5 py-3 text-sm font-bold text-white shadow-raised',
                            toast.type === 'error' ? 'bg-neg' : 'bg-pos'
                        )}
                    >
                        {toast.type === 'error' ? <AlertCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

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

export default CreditCardAutoStatement;

function Field({ label, children }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint">{label}</span>
            {children}
        </label>
    );
}

function StatRow({ label, value, tone = 'text-ink' }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">{label}</span>
            <span className={cx('tnum text-xs font-bold', tone)}>{value}</span>
        </div>
    );
}

function SummaryModal({ isOpen, onClose, data }) {
    const items = [
        { label: 'Total Due', value: data?.totalDue || 'N/A' },
        { label: 'Min Amount Due', value: data?.minPayment || 'N/A' },
        { label: 'Statement Date', value: data?.statementDate || 'N/A' },
        { label: 'Payment Due Date', value: data?.paymentDueDate || 'N/A' },
        { label: 'Credit Limit', value: data?.credit_limit || 'N/A' },
        { label: 'Available Credit', value: data?.available_credit || 'N/A' }
    ];

    return (
        <Modal
            isOpen={isOpen && Boolean(data)}
            onClose={onClose}
            title="Statement Summary"
            icon={FileText}
            size="md"
            footer={
                <Button variant="primary" onClick={onClose} className="w-full">
                    Close
                </Button>
            }
        >
            <div className="grid grid-cols-2 gap-5">
                {items.map((item) => (
                    <div key={item.label}>
                        <p className="text-xs text-ink-faint">{item.label}</p>
                        <p className="tnum mt-0.5 text-lg font-black text-ink">{item.value}</p>
                    </div>
                ))}
            </div>
            <div className="mt-5 rounded-control border border-violet bg-violet-soft p-3 text-xs leading-relaxed text-violet">
                <strong>RBI MAD Calculation:</strong> Minimum Amount Due is calculated to cover 100% of interest, fees,
                taxes, and EMIs, plus 5% of spends principal. This prevents negative amortization but carrying balance
                attracts standard ~42% p.a. interest + 18% GST.
            </div>
        </Modal>
    );
}

function EMIModal({ isOpen, onClose, emis }) {
    return (
        <Modal
            isOpen={isOpen && Boolean(emis)}
            onClose={onClose}
            title="Extracted EMIs"
            icon={DollarSign}
            size="md"
            footer={
                <Button variant="primary" onClick={onClose} className="w-full">
                    Close
                </Button>
            }
        >
            <div className="flex flex-col gap-3">
                {(emis || []).map((emi, idx) => (
                    <div key={idx} className="rounded-card border border-line bg-sunken p-4">
                        <div className="text-sm font-bold text-ink">{emi.description}</div>
                        <div className="mt-1.5 flex flex-wrap gap-4 text-sm text-ink-muted">
                            <span>Amount: {emi.amount}</span>
                            <span>Tenure: {emi.tenure} months</span>
                            <span>Interest: {emi.interestRate}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}
