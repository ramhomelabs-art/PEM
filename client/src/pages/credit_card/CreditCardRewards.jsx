import { useState, useMemo } from 'react';
import {
    Gift,
    Award,
    Sparkles,
    Plane,
    ChevronRight,
    TrendingUp,
    ShieldCheck,
    CreditCard as CardIcon,
    ArrowUpRight,
    Tag,
    Zap,
    Edit3,
    CheckCircle2,
    AlertTriangle,
    X,
    RefreshCw,
    Sliders,
    Coins,
    Wallet
} from 'lucide-react';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { formatCurrency } from '../../utils/currency';

// Helper to determine real-world benefits & rules for Indian credit cards
const getCardIntelligence = (card) => {
    const name = (card.name || card.cardName || '').toLowerCase();
    const cardType = (card.cardType || '').toLowerCase();

    // Lounge Access detection
    let loungeVisitsPerQuarter = 0;
    let loungeType = 'None';
    let loungeDetails = 'No complimentary airport lounge access on this card tier.';

    if (cardType.includes('rupay') || name.includes('rupay')) {
        loungeVisitsPerQuarter = 2;
        loungeType = 'Domestic (RuPay)';
        loungeDetails = '2 complimentary visits per calendar quarter at participating domestic airport lounges via RuPay program.';
    } else if (name.includes('prime') || name.includes('regalia') || name.includes('infinia') || name.includes('magnus') || name.includes('select')) {
        loungeVisitsPerQuarter = 2;
        loungeType = 'Domestic & International';
        loungeDetails = '2 complimentary domestic lounge visits per quarter + Priority Pass access.';
    } else if (name.includes('flipkart') || name.includes('millennia') || cardType.includes('signature')) {
        loungeVisitsPerQuarter = 1;
        loungeType = 'Domestic Lounge';
        loungeDetails = '1 complimentary domestic airport lounge visit per quarter (subject to spend criteria).';
    }

    // Annual Fee Waiver Milestone detection
    const annualFee = Number(card.annualFee) || 0;
    let milestoneSpend = 0;
    let milestoneDesc = 'Standard billing';

    if (annualFee === 0) {
        milestoneDesc = 'Lifetime Free Card (₹0 annual fee)';
    } else if (name.includes('simplyclick') || name.includes('simply click')) {
        milestoneSpend = 100000;
        milestoneDesc = 'Spend ₹1,00,000 in a year to waive ₹499 annual renewal fee';
    } else if (name.includes('flipkart')) {
        milestoneSpend = 350000;
        milestoneDesc = 'Spend ₹3,50,000 in a year to waive ₹500 annual renewal fee';
    } else if (name.includes('prime')) {
        milestoneSpend = 300000;
        milestoneDesc = 'Spend ₹3,00,000 in a year to waive ₹2,999 annual renewal fee';
    } else {
        milestoneSpend = annualFee > 0 ? annualFee * 200 : 0;
        milestoneDesc = annualFee > 0 ? `Spend ${formatCurrency(milestoneSpend, 'INR')} annually for renewal fee waiver` : 'Lifetime Free';
    }

    // Real merchant reward accelerators
    const merchantPerks = [];
    if (name.includes('amazon')) {
        merchantPerks.push({ merchant: 'Amazon.in', benefit: '5% Unlimited Cashback (Prime) / 3% (Non-Prime)', tag: 'Direct Credit' });
        merchantPerks.push({ merchant: 'Swiggy / Uber / Partner Apps', benefit: '2% Cashback on 100+ partner merchants', tag: 'Cashback' });
        merchantPerks.push({ merchant: 'Fuel Outlets', benefit: '1% Fuel Surcharge Waiver across Indian pumps', tag: 'Waiver' });
    } else if (name.includes('flipkart')) {
        merchantPerks.push({ merchant: 'Flipkart & Cleartrip', benefit: '5% Unlimited Direct Cashback', tag: 'Direct Credit' });
        merchantPerks.push({ merchant: 'Swiggy / Uber / PVR', benefit: '4% Cashback on preferred partner merchants', tag: 'Dining & Commute' });
        merchantPerks.push({ merchant: 'Fuel Outlets', benefit: '1% Fuel Surcharge Waiver (spends ₹400 - ₹4,000)', tag: 'Waiver' });
    } else if (name.includes('simplyclick') || name.includes('simply click')) {
        merchantPerks.push({ merchant: 'Amazon / BookMyShow / Cleartrip', benefit: '10x Reward Points (5% equivalent value)', tag: '10x Boost' });
        merchantPerks.push({ merchant: 'Apollo 24|7 / Netmeds / Yatra', benefit: '10x Reward Points on online health & travel', tag: '10x Boost' });
        merchantPerks.push({ merchant: 'Cleartrip Voucher Milestone', benefit: '₹2,000 Cleartrip e-voucher on ₹1,00,000 annual spend', tag: 'Milestone' });
    } else if (name.includes('prime')) {
        merchantPerks.push({ merchant: 'Dining, Groceries & Dept Stores', benefit: '20 Reward Points per ₹100 spent (5% return)', tag: '20x Reward' });
        merchantPerks.push({ merchant: 'Airport Lounge', benefit: '4 complimentary International + 8 Domestic visits/yr', tag: 'Travel' });
        merchantPerks.push({ merchant: 'Pizza Hut Voucher', benefit: '₹1,00,000 annual spend unlocks ₹1,000 voucher', tag: 'Milestone' });
    } else {
        merchantPerks.push({ merchant: 'All Retail Spends', benefit: `${Number(card.rewardRate) || 1} pts per ₹100 spent`, tag: 'Standard Rate' });
        merchantPerks.push({ merchant: 'Fuel Surcharge', benefit: '1% Fuel Surcharge Waiver across fuel outlets', tag: 'Waiver' });
    }

    const customBenefits = Array.isArray(card.benefits) ? card.benefits : [];
    customBenefits.forEach(cb => {
        if (typeof cb === 'string' && cb.trim() && !merchantPerks.some(mp => mp.benefit === cb)) {
            merchantPerks.push({ merchant: 'Card Perk', benefit: cb, tag: 'Included' });
        }
    });

    return {
        loungeVisitsPerQuarter,
        loungeType,
        loungeDetails,
        annualFee,
        milestoneSpend,
        milestoneDesc,
        merchantPerks,
        isLifetimeFree: annualFee === 0
    };
};

export default function CreditCardRewards() {
    const { cards = [], loading, updateCard, fetchCards } = useCreditCards();
    const [selectedCardId, setSelectedCardId] = useState('all');
    const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'perks' | 'calculator'
    const [calcSpend, setCalcSpend] = useState(30000);
    const [toast, setToast] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Edit Points / Rate Modal state
    const [editingCard, setEditingCard] = useState(null);
    const [editForm, setEditForm] = useState({ rewardPoints: 0, rewardRate: 1, annualFee: 0 });
    const [saving, setSaving] = useState(false);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleManualRefresh = async () => {
        setRefreshing(true);
        try {
            const ok = await fetchCards();
            if (ok === false) {
                showToast('Failed to refresh card data', 'error');
            } else {
                showToast('Real-time rewards data refreshed!', 'success');
            }
        } catch {
            showToast('Failed to refresh card data', 'error');
        } finally {
            setRefreshing(false);
        }
    };

    // Calculate Real Aggregated Metrics from Active Cards
    const stats = useMemo(() => {
        let totalSpend = 0;
        let totalStoredPoints = 0;
        let cycleEarnedPoints = 0;
        let totalQuarterlyLoungeVisits = 0;
        let totalAnnualFees = 0;
        let lifetimeFreeCount = 0;
        let feeWaivedCount = 0;

        cards.forEach((card) => {
            const spend = Number(card.usedAmount) || 0;
            const rate = Number(card.rewardRate) || 1;
            const storedPoints = Number(card.rewardPoints) || 0;
            const annualFee = Number(card.annualFee) || 0;

            totalSpend += spend;
            totalStoredPoints += storedPoints;
            const cyclePts = Math.floor((spend / 100) * rate);
            cycleEarnedPoints += cyclePts;

            const intel = getCardIntelligence(card);
            totalQuarterlyLoungeVisits += intel.loungeVisitsPerQuarter;

            totalAnnualFees += annualFee;
            if (annualFee === 0) {
                lifetimeFreeCount++;
            } else if (intel.milestoneSpend > 0 && spend >= intel.milestoneSpend) {
                feeWaivedCount++;
            }
        });

        const totalPoints = totalStoredPoints + cycleEarnedPoints;
        const estimatedValueInRupees = totalPoints * 0.25;

        return {
            totalSpend,
            totalStoredPoints,
            cycleEarnedPoints,
            totalPoints,
            estimatedValueInRupees,
            totalQuarterlyLoungeVisits,
            totalAnnualFees,
            lifetimeFreeCount,
            feeWaivedCount,
            activeCardsCount: cards.length
        };
    }, [cards]);

    const filteredCards = useMemo(() => {
        if (selectedCardId === 'all') return cards;
        return cards.filter((c) => String(c.id) === String(selectedCardId));
    }, [cards, selectedCardId]);

    // Open Edit Modal
    const handleOpenEdit = (card) => {
        setEditingCard(card);
        setEditForm({
            rewardPoints: Number(card.rewardPoints) || 0,
            rewardRate: Number(card.rewardRate) || 1,
            annualFee: Number(card.annualFee) || 0
        });
    };

    // Submit Edit to Backend
    const handleSaveCardRewards = async (e) => {
        e.preventDefault();
        if (!editingCard) return;
        setSaving(true);
        try {
            await updateCard(editingCard.id, {
                rewardPoints: parseInt(editForm.rewardPoints, 10) || 0,
                rewardRate: parseInt(editForm.rewardRate, 10) || 1,
                annualFee: parseFloat(editForm.annualFee) || 0
            });
            showToast(`Updated rewards & points for ${editingCard.name || editingCard.cardName}!`, 'success');
            setEditingCard(null);
        } catch (err) {
            showToast(err.message || 'Failed to update card details', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="flex items-center space-x-3 text-ink-muted">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    <span>Loading Rewards & Benefits...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1400px] p-6 md:p-8 space-y-6">
            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl transition-all animate-in fade-in slide-in-from-bottom-5 bg-slate-900 border border-line">
                    {toast.type === 'error' ? (
                        <AlertTriangle className="h-4 w-4 text-rose-400" />
                    ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header: Clean, balanced, and responsive */}
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-2">
                <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20">
                        <Award className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
                            Rewards & Benefits
                        </h1>
                        <p className="mt-0.5 text-xs text-ink-muted">
                            Real-time tracking of point accruals, lounge quotas, and milestone fee waivers.
                        </p>
                    </div>
                </div>

                {/* Filter and Tab controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={handleManualRefresh}
                        disabled={refreshing}
                        className="flex h-10 items-center gap-1.5 rounded-control border border-line bg-surface px-3.5 text-xs font-semibold text-ink-muted hover:text-ink hover:border-line-strong transition shadow-sm"
                        title="Sync latest balances from database"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
                        <span>Sync</span>
                    </button>

                    <div className="flex h-10 items-center rounded-control border border-line bg-surface p-1 shadow-sm">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`rounded-[8px] px-3.5 py-1.5 text-xs font-bold transition ${
                                activeTab === 'summary'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('perks')}
                            className={`rounded-[8px] px-3.5 py-1.5 text-xs font-bold transition ${
                                activeTab === 'perks'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            Perks & Lounge
                        </button>
                        <button
                            onClick={() => setActiveTab('calculator')}
                            className={`rounded-[8px] px-3.5 py-1.5 text-xs font-bold transition ${
                                activeTab === 'calculator'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            Spend Simulator
                        </button>
                    </div>

                    <div className="relative">
                        <select
                            value={selectedCardId}
                            onChange={(e) => setSelectedCardId(e.target.value)}
                            className="h-10 rounded-control border border-line bg-surface px-3.5 pr-8 text-xs font-semibold text-ink outline-none transition focus:border-line-strong cursor-pointer shadow-sm"
                        >
                            <option value="all">All Cards ({cards.length})</option>
                            {cards.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name || c.cardName} (•••• {c.lastFourDigits || c.last4 || '0000'})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            {/* Top Stat Tiles: Equal heights, clear alignment */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* 1. Total Points Accrued */}
                <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Total Points Accrued</span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Sparkles className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-1.5">
                            <span className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">
                                {stats.totalPoints.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs font-semibold text-ink-muted">pts</span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            +{stats.cycleEarnedPoints} this cycle
                        </span>
                        <span className="text-ink-faint">
                            {stats.totalStoredPoints} banked
                        </span>
                    </div>
                </div>

                {/* 2. Estimated Cash Value */}
                <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Estimated Cash Value</span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Coins className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <span className="text-2xl md:text-3xl font-extrabold text-emerald-400 tracking-tight">
                                {formatCurrency(stats.estimatedValueInRupees, 'INR')}
                            </span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs text-ink-muted">
                        <span>Redeemable at ₹0.25 – ₹0.50 / pt</span>
                    </div>
                </div>

                {/* 3. Eligible Lounge Visits */}
                <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Eligible Lounge Visits</span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <Plane className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-1.5">
                            <span className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">
                                {stats.totalQuarterlyLoungeVisits}
                            </span>
                            <span className="text-xs font-semibold text-ink-muted">/ quarter</span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-line/60 text-xs text-ink-muted">
                        Across {cards.filter(c => getCardIntelligence(c).loungeVisitsPerQuarter > 0).length} eligible card(s)
                    </div>
                </div>

                {/* 4. Annual Fee Status */}
                <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Annual Fee Status</span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-1.5">
                            <span className="text-2xl md:text-3xl font-extrabold text-indigo-400 tracking-tight">
                                {stats.lifetimeFreeCount} LTF
                            </span>
                            <span className="text-xs font-semibold text-ink-muted">
                                {stats.totalAnnualFees > 0 ? `| ${formatCurrency(stats.totalAnnualFees, 'INR')} active` : '| ₹0 Active Fees'}
                            </span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-line/60 text-xs text-ink-muted">
                        {stats.feeWaivedCount > 0 ? `${stats.feeWaivedCount} card fee waived on spend` : 'Milestone waivers tracked'}
                    </div>
                </div>
            </div>

            {/* TAB: SUMMARY / OVERVIEW */}
            {activeTab === 'summary' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                    {/* Left: Card Points & Accruals (lg:col-span-8) */}
                    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm lg:col-span-7 xl:col-span-8">
                        <div className="flex items-center justify-between border-b border-line pb-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-ink">Card Points & Accruals</h2>
                                <p className="text-xs text-ink-muted mt-0.5">
                                    Current bank loyalty balances and cycle earning rates
                                </p>
                            </div>
                            <span className="rounded-control bg-raised px-3 py-1 text-xs font-semibold text-ink-muted border border-line">
                                {filteredCards.length} {filteredCards.length === 1 ? 'Card' : 'Cards'}
                            </span>
                        </div>

                        {filteredCards.length === 0 ? (
                            <div className="py-12 text-center text-ink-faint">
                                <CardIcon className="mx-auto mb-3 h-10 w-10 text-ink-faint" />
                                No credit cards found matching your selection.
                            </div>
                        ) : (
                            <div className="mt-5 space-y-3.5">
                                {filteredCards.map((card) => {
                                    const spend = Number(card.usedAmount) || 0;
                                    const rate = Number(card.rewardRate) || 1;
                                    const storedPoints = Number(card.rewardPoints) || 0;
                                    const cyclePoints = Math.floor((spend / 100) * rate);
                                    const totalCardPoints = storedPoints + cyclePoints;
                                    const approxCash = totalCardPoints * 0.25;
                                    const intel = getCardIntelligence(card);

                                    return (
                                        <div
                                            key={card.id}
                                            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-raised/40 border border-line/60 hover:border-line-strong transition shadow-sm"
                                        >
                                            {/* Left Info */}
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700/60 to-slate-850 border border-line text-amber-400 shadow-sm">
                                                    <CardIcon className="h-6 w-6" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-sm font-bold text-ink truncate">
                                                            {card.name || card.cardName}
                                                        </h3>
                                                        {intel.isLifetimeFree ? (
                                                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold text-emerald-400 border border-emerald-500/20">
                                                                LTF
                                                            </span>
                                                        ) : (
                                                            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-ink-muted border border-line">
                                                                Fee: {formatCurrency(intel.annualFee, 'INR')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-ink-muted mt-0.5">
                                                        {card.bank || card.bankName || 'Bank'} •••• {card.lastFourDigits || card.last4 || '0000'} <span className="text-ink-faint">|</span> {card.cardType || 'Visa'}
                                                    </p>
                                                    <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint">
                                                        <span className="text-amber-400 font-medium">Earns {rate} pts / ₹100</span>
                                                        <span>•</span>
                                                        <span>Spend: <strong className="text-ink">{formatCurrency(spend, 'INR')}</strong></span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Stats & Button */}
                                            <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/40">
                                                <div className="text-left sm:text-right">
                                                    <div className="text-base font-extrabold text-ink tracking-tight">
                                                        {totalCardPoints.toLocaleString('en-IN')} <span className="text-xs font-normal text-ink-muted">pts</span>
                                                    </div>
                                                    <div className="text-xs font-semibold text-emerald-400">
                                                        ≈ {formatCurrency(approxCash, 'INR')}
                                                    </div>
                                                    <div className="text-[10px] text-ink-faint mt-0.5">
                                                        {cyclePoints > 0 ? `+${cyclePoints} cycle pts` : 'Zero cycle spend'}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleOpenEdit(card)}
                                                    className="flex h-9 items-center gap-1.5 rounded-control border border-line bg-surface hover:bg-raised px-3 text-xs font-semibold text-ink-muted hover:text-ink hover:border-emerald-500/60 transition shadow-sm"
                                                    title="Update Bank Reward Balance or Earning Rate"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5 text-emerald-400" />
                                                    <span>Adjust</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right: Dynamic Redemption Value (lg:col-span-5) */}
                    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm lg:col-span-5 xl:col-span-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between border-b border-line pb-4">
                                <div>
                                    <h2 className="text-lg font-extrabold text-ink">Redemption Value</h2>
                                    <p className="text-xs text-ink-muted mt-0.5">
                                        Realizable value based on your actual points
                                    </p>
                                </div>
                                <span className="rounded-control bg-emerald-500/10 px-2.5 py-1 text-xs font-extrabold text-emerald-400 border border-emerald-500/20">
                                    {stats.totalPoints} pts
                                </span>
                            </div>

                            <div className="mt-5 space-y-3.5">
                                {/* Air Miles */}
                                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 transition hover:border-sky-500/40">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Plane className="h-4 w-4 text-sky-400" />
                                            <span className="text-sm font-bold text-sky-300">Air Miles & Flight Bookings</span>
                                        </div>
                                        <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-extrabold text-sky-300">
                                            1 pt = ₹0.50
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
                                        Transferable to partner airline loyalty accounts.
                                    </p>
                                    <div className="mt-3 flex items-center justify-between border-t border-sky-500/10 pt-2.5 text-xs">
                                        <span className="text-ink-muted font-medium">Realizable Value:</span>
                                        <span className="text-sm font-extrabold text-sky-300">
                                            {formatCurrency(stats.totalPoints * 0.50, 'INR')}
                                        </span>
                                    </div>
                                </div>

                                {/* Shopping Vouchers */}
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 transition hover:border-amber-500/40">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Gift className="h-4 w-4 text-amber-400" />
                                            <span className="text-sm font-bold text-amber-300">Brand Shopping Vouchers</span>
                                        </div>
                                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                                            1 pt = ₹0.35
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
                                        Instant e-vouchers for Amazon Pay, Flipkart, Myntra.
                                    </p>
                                    <div className="mt-3 flex items-center justify-between border-t border-amber-500/10 pt-2.5 text-xs">
                                        <span className="text-ink-muted font-medium">Realizable Value:</span>
                                        <span className="text-sm font-extrabold text-amber-300">
                                            {formatCurrency(stats.totalPoints * 0.35, 'INR')}
                                        </span>
                                    </div>
                                </div>

                                {/* Statement Cash Credit */}
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition hover:border-emerald-500/40">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Tag className="h-4 w-4 text-emerald-400" />
                                            <span className="text-sm font-bold text-emerald-300">Statement Cash Credit</span>
                                        </div>
                                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                                            1 pt = ₹0.25
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
                                        Direct credit adjusted against your upcoming bill.
                                    </p>
                                    <div className="mt-3 flex items-center justify-between border-t border-emerald-500/10 pt-2.5 text-xs">
                                        <span className="text-ink-muted font-medium">Realizable Value:</span>
                                        <span className="text-sm font-extrabold text-emerald-400">
                                            {formatCurrency(stats.totalPoints * 0.25, 'INR')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 pt-3.5 border-t border-line/60 text-center">
                            <span className="text-[11px] text-ink-faint">
                                Points can be redeemed anytime via your card issuer netbanking portal.
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: PERKS & LOUNGE */}
            {activeTab === 'perks' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* 1. Lounge Access Breakdown */}
                        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                            <div className="flex items-center justify-between pb-4 border-b border-line">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                        <Plane className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-ink">Airport Lounge Access</h3>
                                        <p className="text-xs text-ink-muted">Quarterly allowances mapped by card tier</p>
                                    </div>
                                </div>
                                <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-400 border border-sky-500/20">
                                    {stats.totalQuarterlyLoungeVisits} Total / Qtr
                                </span>
                            </div>

                            <div className="mt-4 space-y-3">
                                {cards.map((c) => {
                                    const intel = getCardIntelligence(c);
                                    return (
                                        <div key={c.id} className="flex items-center justify-between rounded-xl bg-raised/50 p-3.5 border border-line/60">
                                            <div>
                                                <div className="text-xs font-bold text-ink">
                                                    {c.name || c.cardName}
                                                </div>
                                                <div className="text-[11px] text-ink-muted mt-0.5">
                                                    {c.bank || c.bankName} •••• {c.lastFourDigits || c.last4 || '0000'} | {intel.loungeType}
                                                </div>
                                            </div>
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${intel.loungeVisitsPerQuarter > 0 ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-ink-faint'}`}>
                                                {intel.loungeVisitsPerQuarter > 0 ? `${intel.loungeVisitsPerQuarter} visits / qtr` : 'No complimentary access'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. Annual Fee Waivers & Milestone Tracking */}
                        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                            <div className="flex items-center justify-between pb-4 border-b border-line">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        <ShieldCheck className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-ink">Fee Waivers & Milestones</h3>
                                        <p className="text-xs text-ink-muted">Annual renewal waiver criteria</p>
                                    </div>
                                </div>
                                <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-bold text-indigo-400 border border-indigo-500/20">
                                    {stats.lifetimeFreeCount} Free / {cards.length} Total
                                </span>
                            </div>

                            <div className="mt-4 space-y-3">
                                {cards.map((c) => {
                                    const intel = getCardIntelligence(c);
                                    const spend = Number(c.usedAmount) || 0;
                                    const progress = intel.milestoneSpend > 0 ? Math.min(100, (spend / intel.milestoneSpend) * 100) : 100;

                                    return (
                                        <div key={c.id} className="rounded-xl bg-raised/50 p-3.5 border border-line/60">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-xs font-bold text-ink">{c.name || c.cardName}</span>
                                                    <span className="ml-2 text-[11px] text-ink-muted">
                                                        {intel.isLifetimeFree ? 'Lifetime Free (₹0)' : `Annual Fee: ${formatCurrency(intel.annualFee, 'INR')}`}
                                                    </span>
                                                </div>
                                                <span className={`text-[11px] font-extrabold ${progress >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {intel.isLifetimeFree ? 'Active Waiver' : `${progress.toFixed(0)}% to waiver`}
                                                </span>
                                            </div>

                                            {intel.milestoneSpend > 0 && (
                                                <div className="mt-2.5">
                                                    <div className="flex justify-between text-[10px] text-ink-faint mb-1">
                                                        <span>Spend: {formatCurrency(spend, 'INR')}</span>
                                                        <span>Target: {formatCurrency(intel.milestoneSpend, 'INR')}</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* 3. Card-by-Card Merchant Boosts */}
                    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                        <div className="flex items-center justify-between pb-4 border-b border-line">
                            <div>
                                <h3 className="text-base font-bold text-ink">Merchant Cashbacks & Multipliers</h3>
                                <p className="text-xs text-ink-muted">Accelerated earning rules mapped to your active cards</p>
                            </div>
                            <span className="text-xs font-semibold text-emerald-400">
                                Auto-detected from cards
                            </span>
                        </div>

                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {cards.map((c) => {
                                const intel = getCardIntelligence(c);
                                return (
                                    <div key={c.id} className="rounded-xl border border-line bg-raised/40 p-4 flex flex-col justify-between shadow-sm">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-xs font-bold text-ink">{c.name || c.cardName}</h4>
                                                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                    {c.rewardRate || 1} pts / ₹100
                                                </span>
                                            </div>
                                            <div className="space-y-2 mt-3">
                                                {intel.merchantPerks.map((mp, i) => (
                                                    <div key={i} className="text-xs rounded-lg bg-surface p-2.5 border border-line/40">
                                                        <div className="flex items-center justify-between text-[11px] font-semibold text-ink">
                                                            <span>{mp.merchant}</span>
                                                            <span className="text-[10px] text-emerald-400 font-bold">{mp.tag}</span>
                                                        </div>
                                                        <p className="mt-1 text-[11px] text-ink-muted leading-relaxed">{mp.benefit}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-2.5 border-t border-line/40 flex items-center justify-between text-[10px] text-ink-faint">
                                            <span>Bank: {c.bank || c.bankName}</span>
                                            <span>•••• {c.lastFourDigits || c.last4 || '0000'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: SPEND & REWARD CALCULATOR */}
            {activeTab === 'calculator' && (
                <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-6 md:p-8 shadow-sm">
                    <div className="flex items-center justify-between pb-4 border-b border-line">
                        <div>
                            <h2 className="text-xl font-extrabold text-ink">Spend & Reward Simulator</h2>
                            <p className="mt-0.5 text-xs text-ink-muted">
                                Test projected monthly & annual rewards based on your actual cards and rates.
                            </p>
                        </div>
                        <Sliders className="h-5 w-5 text-emerald-400" />
                    </div>

                    <div className="mt-6 space-y-6">
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-ink-muted">
                                    Projected Monthly Card Spend
                                </label>
                                <span className="text-lg font-extrabold text-emerald-400">
                                    {formatCurrency(calcSpend, 'INR')}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={5000}
                                max={300000}
                                step={5000}
                                value={calcSpend}
                                onChange={(e) => setCalcSpend(Number(e.target.value))}
                                className="mt-3.5 h-2 w-full cursor-pointer appearance-none rounded-lg bg-raised accent-emerald-500"
                            />
                            <div className="mt-1.5 flex justify-between text-[11px] text-ink-faint">
                                <span>₹5,000</span>
                                <span>₹1,50,000</span>
                                <span>₹3,00,000</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-line space-y-3">
                            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                                Projected Annual Yield Across Cards
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="rounded-xl border border-line bg-raised/50 p-4 text-center">
                                    <span className="text-xs text-ink-muted font-medium">Monthly Points</span>
                                    <div className="mt-1 text-xl font-extrabold text-amber-400">
                                        {Math.floor((calcSpend / 100) * 2).toLocaleString('en-IN')}
                                    </div>
                                    <span className="text-[11px] text-ink-faint">pts / month</span>
                                </div>

                                <div className="rounded-xl border border-line bg-raised/50 p-4 text-center">
                                    <span className="text-xs text-ink-muted font-medium">Annual Points</span>
                                    <div className="mt-1 text-xl font-extrabold text-ink">
                                        {Math.floor((calcSpend / 100) * 2 * 12).toLocaleString('en-IN')}
                                    </div>
                                    <span className="text-[11px] text-ink-faint">pts / year</span>
                                </div>

                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                                    <span className="text-xs text-emerald-400 font-semibold">Net Annual Value</span>
                                    <div className="mt-1 text-xl font-extrabold text-emerald-300">
                                        {formatCurrency(Math.floor((calcSpend / 100) * 2 * 12 * 0.35), 'INR')}
                                    </div>
                                    <span className="text-[11px] text-emerald-500 font-medium">via vouchers & cashback</span>
                                </div>
                            </div>
                        </div>

                        {calcSpend >= 50000 && (
                            <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300">
                                <Sparkles className="h-5 w-5 shrink-0 text-amber-400" />
                                <div className="leading-relaxed">
                                    <strong className="font-bold">Milestone Unlocked:</strong> At {formatCurrency(calcSpend, 'INR')}/month (annual spend {formatCurrency(calcSpend * 12, 'INR')}), you easily qualify for full annual fee waivers across your fee-charging cards!
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* EDIT POINTS & REWARDS MODAL */}
            {editingCard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-line">
                            <div>
                                <h3 className="text-base font-bold text-ink">
                                    Adjust Card Rewards
                                </h3>
                                <p className="text-xs text-ink-muted mt-0.5">
                                    {editingCard.name || editingCard.cardName} •••• {editingCard.lastFourDigits || editingCard.last4 || '0000'}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingCard(null)}
                                className="rounded-lg p-1.5 text-ink-muted hover:bg-raised hover:text-ink transition"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCardRewards} className="mt-5 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-ink-muted">
                                    Bank Loyalty Points Balance
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editForm.rewardPoints}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, rewardPoints: e.target.value }))}
                                    placeholder="e.g. 2500"
                                    className="mt-1.5 w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 text-sm text-ink outline-none focus:border-emerald-500 font-mono"
                                />
                                <span className="text-[11px] text-ink-faint">
                                    Total reward points shown on your netbanking statement.
                                </span>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-ink-muted">
                                    Reward Rate (Points earned per ₹100 spend)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={editForm.rewardRate}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, rewardRate: e.target.value }))}
                                    placeholder="e.g. 2"
                                    className="mt-1.5 w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 text-sm text-ink outline-none focus:border-emerald-500 font-mono"
                                />
                                <span className="text-[11px] text-ink-faint">
                                    Base points accrued per ₹100 retail transaction.
                                </span>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-ink-muted">
                                    Annual Card Fee (₹)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editForm.annualFee}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, annualFee: e.target.value }))}
                                    placeholder="e.g. 499 (0 if Lifetime Free)"
                                    className="mt-1.5 w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 text-sm text-ink outline-none focus:border-emerald-500 font-mono"
                                />
                                <span className="text-[11px] text-ink-faint">
                                    Set to 0 if this is a Lifetime Free (LTF) credit card.
                                </span>
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-line">
                                <button
                                    type="button"
                                    onClick={() => setEditingCard(null)}
                                    className="rounded-control border border-line px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-raised transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-1.5 rounded-control bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 transition disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save & Update'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
