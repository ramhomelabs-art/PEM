import { useState, useMemo } from 'react';
import {
    Gift,
    Award,
    Sparkles,
    Plane,
    Coffee,
    Fuel,
    Film,
    ChevronRight,
    TrendingUp,
    ShieldCheck,
    CreditCard as CardIcon,
    ArrowUpRight,
    Tag,
    Zap
} from 'lucide-react';
import { useCreditCards } from '../../context/credit_card/CreditCardContext';
import { formatCurrency } from '../../utils/currency';

export default function CreditCardRewards() {
    const { cards = [], loading } = useCreditCards();
    const [selectedCardId, setSelectedCardId] = useState('all');
    const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'perks' | 'calculator'
    const [calcSpend, setCalcSpend] = useState(25000);

    // Compute aggregated rewards metrics
    const stats = useMemo(() => {
        let totalSpend = 0;
        let estimatedPoints = 0;

        cards.forEach((card) => {
            const spend = Number(card.usedAmount) || 0;
            const rate = Number(card.rewardRate) || 2;
            totalSpend += spend;
            estimatedPoints += Math.floor((spend / 100) * rate);
        });

        const estimatedValueInRupees = estimatedPoints * 0.25; // standard ~25 paise per point

        return {
            totalSpend,
            estimatedPoints,
            estimatedValueInRupees,
            activeCardsCount: cards.length
        };
    }, [cards]);

    const filteredCards = useMemo(() => {
        if (selectedCardId === 'all') return cards;
        return cards.filter((c) => String(c.id) === String(selectedCardId));
    }, [cards, selectedCardId]);

    // Perk catalog mapped by bank/card type
    const standardPerks = [
        {
            icon: Plane,
            category: 'Travel & Lounge',
            color: 'from-sky-500 to-blue-600',
            textColor: 'text-sky-400',
            bgTint: 'bg-sky-500/10 border-sky-500/20',
            title: 'Airport Lounge Access',
            desc: 'Complimentary quarterly access to domestic & international terminals with Priority Pass / Dreamfolks.'
        },
        {
            icon: Fuel,
            category: 'Fuel Surcharge',
            color: 'from-amber-500 to-orange-600',
            textColor: 'text-amber-400',
            bgTint: 'bg-amber-500/10 border-amber-500/20',
            title: '1% Fuel Surcharge Waiver',
            desc: 'Zero surcharge on fuel transactions between ₹400 and ₹5,000 across all oil outlets in India.'
        },
        {
            icon: Film,
            category: 'Entertainment',
            color: 'from-pink-500 to-rose-600',
            textColor: 'text-pink-400',
            bgTint: 'bg-pink-500/10 border-pink-500/20',
            title: 'BOGO Movie Tickets',
            desc: 'Buy 1 Get 1 free movie or event ticket monthly via BookMyShow / INOX.'
        },
        {
            icon: Coffee,
            category: 'Dining & Food',
            color: 'from-emerald-500 to-teal-600',
            textColor: 'text-emerald-400',
            bgTint: 'bg-emerald-500/10 border-emerald-500/20',
            title: 'Up to 20% Dining Discount',
            desc: 'Curated discounts at 4,000+ premium partner restaurants via Swiggy Dineout / Zomato Gold.'
        }
    ];

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
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20">
                            <Award className="h-5 w-5" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
                            Rewards & Benefits
                        </h1>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                        Maximize your credit card point accruals, milestone waivers, and premium travel perks.
                    </p>
                </div>

                {/* Filter and Tab buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-xl bg-raised/80 p-1 border border-line/60">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                activeTab === 'summary'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('perks')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                activeTab === 'perks'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            Perks & Lounge
                        </button>
                        <button
                            onClick={() => setActiveTab('calculator')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                activeTab === 'calculator'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            Spend Calculator
                        </button>
                    </div>

                    <select
                        value={selectedCardId}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                        className="rounded-xl border border-line/60 bg-raised/80 px-3 py-1.5 text-xs font-medium text-ink outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                        <option value="all">All Cards ({cards.length})</option>
                        {cards.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name || c.bank} (••• {c.lastFourDigits || '0000'})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-slate-850 to-slate-900/90 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ink-muted">Total Points Accrued</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Sparkles className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-ink tracking-tight">
                        {stats.estimatedPoints.toLocaleString('en-IN')} <span className="text-xs font-normal text-ink-muted">pts</span>
                    </div>
                    <div className="mt-2 flex items-center text-xs text-amber-400">
                        <TrendingUp className="mr-1 h-3.5 w-3.5" />
                        <span>Based on active billing cycles</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-slate-850 to-slate-900/90 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ink-muted">Estimated Cash Value</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Gift className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-emerald-400 tracking-tight">
                        {formatCurrency(stats.estimatedValueInRupees, 'INR')}
                    </div>
                    <div className="mt-2 text-xs text-ink-muted">
                        Redeemable at ₹0.25 – ₹0.50 / point
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-slate-850 to-slate-900/90 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ink-muted">Eligible Lounge Visits</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            <Plane className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-ink tracking-tight">
                        {cards.length * 2} <span className="text-xs font-normal text-ink-muted">/ quarter</span>
                    </div>
                    <div className="mt-2 text-xs text-ink-muted">
                        Across {cards.length} eligible credit card(s)
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-slate-850 to-slate-900/90 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ink-muted">Annual Fee Savings</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-indigo-400 tracking-tight">
                        {formatCurrency(cards.length * 999, 'INR')}
                    </div>
                    <div className="mt-2 text-xs text-ink-muted">
                        Milestone waivers active on cards
                    </div>
                </div>
            </div>

            {/* TAB: SUMMARY / OVERVIEW */}
            {activeTab === 'summary' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Cards Reward Rates */}
                    <div className="rounded-2xl border border-line bg-surface/80 p-6 lg:col-span-2">
                        <div className="flex items-center justify-between border-b border-line pb-4">
                            <div>
                                <h2 className="text-lg font-bold text-ink">Card Points & Accruals</h2>
                                <p className="text-xs text-ink-muted">Active earning rates per ₹100 spent</p>
                            </div>
                            <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-ink-muted">
                                {filteredCards.length} Cards
                            </span>
                        </div>

                        {filteredCards.length === 0 ? (
                            <div className="py-12 text-center text-ink-faint">
                                <CardIcon className="mx-auto mb-3 h-10 w-10 text-ink-faint" />
                                No credit cards found matching your selection.
                            </div>
                        ) : (
                            <div className="mt-4 divide-y divide-slate-800/80">
                                {filteredCards.map((card) => {
                                    const spend = Number(card.usedAmount) || 0;
                                    const rate = Number(card.rewardRate) || 2;
                                    const points = Math.floor((spend / 100) * rate);
                                    const approxCash = points * 0.25;

                                    return (
                                        <div
                                            key={card.id}
                                            className="flex flex-col gap-4 py-4 transition first:pt-2 last:pb-2 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-line text-ink-muted">
                                                    <CardIcon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-ink">
                                                        {card.name || `${card.bank} Credit Card`}
                                                    </h3>
                                                    <p className="text-xs text-ink-muted">
                                                        {card.bank || 'Bank'} •••• {card.lastFourDigits || '0000'} | {card.cardType || 'Visa'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-6 sm:justify-end">
                                                <div className="text-left sm:text-right">
                                                    <div className="text-xs font-medium text-amber-400">
                                                        {rate} pts / ₹100
                                                    </div>
                                                    <div className="text-xs text-ink-faint">
                                                        Spend: {formatCurrency(spend, 'INR')}
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-ink">
                                                        {points.toLocaleString('en-IN')} pts
                                                    </div>
                                                    <div className="text-xs text-emerald-400">
                                                        ≈ {formatCurrency(approxCash, 'INR')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Redemption Channels */}
                    <div className="rounded-2xl border border-line bg-surface/80 p-6">
                        <h2 className="text-lg font-bold text-ink">Recommended Redemptions</h2>
                        <p className="text-xs text-ink-muted">Best value per reward point</p>

                        <div className="mt-5 space-y-3">
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition hover:border-emerald-500/40">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Plane className="h-4 w-4 text-emerald-400" />
                                        <span className="text-sm font-semibold text-emerald-300">Air Miles & Flight Bookings</span>
                                    </div>
                                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                        1 pt = ₹0.50
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-ink-muted">
                                    Transfer 1:1 to Singapore Airlines, Air India Flying Returns, or Vistara.
                                </p>
                            </div>

                            <div className="rounded-xl border border-line/60 bg-raised/40 p-4 transition hover:border-slate-600">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Gift className="h-4 w-4 text-amber-400" />
                                        <span className="text-sm font-semibold text-ink">Brand Shopping Vouchers</span>
                                    </div>
                                    <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
                                        1 pt = ₹0.35
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-ink-muted">
                                    Instant e-vouchers for Amazon Pay, Flipkart, Myntra, and Apple Store.
                                </p>
                            </div>

                            <div className="rounded-xl border border-line/60 bg-raised/40 p-4 transition hover:border-slate-600">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Tag className="h-4 w-4 text-sky-400" />
                                        <span className="text-sm font-semibold text-ink">Statement Cash Credit</span>
                                    </div>
                                    <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
                                        1 pt = ₹0.25
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-ink-muted">
                                    Direct credit adjusted against your upcoming monthly credit card bill.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: PERKS & LOUNGE */}
            {activeTab === 'perks' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {standardPerks.map((perk, idx) => {
                            const Icon = perk.icon;
                            return (
                                <div
                                    key={idx}
                                    className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface/80 p-6 transition hover:border-line"
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${perk.bgTint}`}>
                                                <Icon className={`h-6 w-6 ${perk.textColor}`} />
                                            </div>
                                            <span className="rounded-full bg-raised px-3 py-1 text-[11px] font-medium text-ink-muted">
                                                {perk.category}
                                            </span>
                                        </div>
                                        <h3 className="mt-4 text-base font-bold text-ink">{perk.title}</h3>
                                        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{perk.desc}</p>
                                    </div>

                                    <div className="mt-6 flex items-center justify-between border-t border-line/80 pt-3 text-xs text-ink-muted">
                                        <span className="flex items-center text-emerald-400 font-medium">
                                            <Zap className="mr-1 h-3.5 w-3.5" /> Active for all cards
                                        </span>
                                        <span className="flex items-center text-ink-faint hover:text-ink-muted cursor-pointer">
                                            View Terms <ArrowUpRight className="ml-1 h-3 w-3" />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB: SPEND & REWARD CALCULATOR */}
            {activeTab === 'calculator' && (
                <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface/90 p-6 md:p-8">
                    <h2 className="text-xl font-bold text-ink">Spend & Reward Simulator</h2>
                    <p className="mt-1 text-xs text-ink-muted">
                        Adjust your anticipated monthly spend to calculate reward earnings and milestone achievements.
                    </p>

                    <div className="mt-6 space-y-6">
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-ink-muted">
                                    Anticipated Monthly Spend
                                </label>
                                <span className="text-lg font-bold text-emerald-400">
                                    {formatCurrency(calcSpend, 'INR')}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={5000}
                                max={200000}
                                step={5000}
                                value={calcSpend}
                                onChange={(e) => setCalcSpend(Number(e.target.value))}
                                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-raised accent-emerald-500"
                            />
                            <div className="mt-1 flex justify-between text-[11px] text-ink-faint">
                                <span>₹5,000</span>
                                <span>₹1,00,000</span>
                                <span>₹2,00,000</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-4 border-t border-line">
                            <div className="rounded-xl border border-line bg-raised p-4 text-center">
                                <span className="text-xs text-ink-muted">Monthly Points</span>
                                <div className="mt-1 text-xl font-bold text-amber-400">
                                    {Math.floor((calcSpend / 100) * 2.5).toLocaleString('en-IN')}
                                </div>
                                <span className="text-[11px] text-ink-faint">pts / mo</span>
                            </div>

                            <div className="rounded-xl border border-line bg-raised p-4 text-center">
                                <span className="text-xs text-ink-muted">Annual Points</span>
                                <div className="mt-1 text-xl font-bold text-ink">
                                    {Math.floor((calcSpend / 100) * 2.5 * 12).toLocaleString('en-IN')}
                                </div>
                                <span className="text-[11px] text-ink-faint">pts / year</span>
                            </div>

                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                                <span className="text-xs text-emerald-400">Net Annual Value</span>
                                <div className="mt-1 text-xl font-bold text-emerald-300">
                                    {formatCurrency(Math.floor((calcSpend / 100) * 2.5 * 12 * 0.35), 'INR')}
                                </div>
                                <span className="text-[11px] text-emerald-500">via voucher / miles</span>
                            </div>
                        </div>

                        {calcSpend >= 50000 && (
                            <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                                <Sparkles className="h-5 w-5 shrink-0 text-amber-400" />
                                <div>
                                    <strong className="font-semibold">Milestone Unlocked:</strong> At ₹{calcSpend.toLocaleString('en-IN')}/month, you qualify for an annual fee waiver and ₹1,500 complimentary gift vouchers!
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
