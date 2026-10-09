import {
    Sparkles,
    Gift,
    Flame,
    ScanText,
    ArrowRight,
    TrendingUp,
    Zap,
} from 'lucide-react';
import { cx } from '../ui/cx';
import { formatCurrency } from '../../utils/currency';

export function FinancialIntelligenceHub({
    onOpenTimeMachine,
    onOpenFunJar,
    onOpenWeekendBurn,
    onOpenReceiptScanner,
    funJarBalance = 0,
    currency = 'INR',
}) {
    const tools = [
        {
            id: 'time-machine',
            title: '"What-If" Time Machine',
            tag: 'Future Simulator',
            desc: 'Simulate big purchases, EMIs, salary hikes & lifestyle cuts over 12 months.',
            icon: Sparkles,
            gradient: 'from-teal-500/20 via-teal-500/5 to-transparent',
            iconColor: 'bg-teal-500/15 text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.3)]',
            badge: '12-Mo Forecast',
            onClick: onOpenTimeMachine,
        },
        {
            id: 'fun-jar',
            title: '"Guilt-Free" Fun Jar',
            tag: 'Micro-Saver',
            desc: `Auto-stash underspent Safe-to-Spend allowances. Pool: ${formatCurrency(funJarBalance, currency)}`,
            icon: Gift,
            gradient: 'from-amber-500/20 via-pink-500/5 to-transparent',
            iconColor: 'bg-amber-500/15 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
            badge: `${formatCurrency(funJarBalance, currency)} Saved`,
            onClick: onOpenFunJar,
        },
        {
            id: 'weekend-burn',
            title: 'Weekend Burn Detector',
            tag: 'Behavioral AI',
            desc: 'Detects weekend spending traps and sets dedicated Friday–Sunday shields.',
            icon: Flame,
            gradient: 'from-orange-500/20 via-rose-500/5 to-transparent',
            iconColor: 'bg-orange-500/15 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]',
            badge: 'Impulse Shield',
            onClick: onOpenWeekendBurn,
        },
        {
            id: 'receipt-scanner',
            title: 'Instant Receipt OCR',
            tag: 'Smart Scanner',
            desc: 'Drop invoices/restaurant bills to auto-extract items and split with friends.',
            icon: ScanText,
            gradient: 'from-purple-500/20 via-indigo-500/5 to-transparent',
            iconColor: 'bg-purple-500/15 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]',
            badge: '1-Click Split',
            onClick: onOpenReceiptScanner,
        },
    ];

    return (
        <section className="mb-4">
            <div className="flex items-center justify-between mb-2.5 px-1">
                <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-teal-500/15 text-teal-300">
                        <Zap size={13} />
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                        Financial Intelligence &amp; Prediction Lab
                    </h3>
                </div>
                <span className="text-[10px] font-bold text-ink-muted uppercase">
                    AI Simulators &amp; Micro-Tools
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {tools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                        <button
                            key={tool.id}
                            type="button"
                            onClick={tool.onClick}
                            className={cx(
                                'group relative flex flex-col justify-between p-4 rounded-2xl bg-surface hover:bg-raised transition-all duration-300 text-left shadow-[0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] active:scale-[0.98] overflow-hidden'
                            )}
                        >
                            {/* Ambient gradient */}
                            <div className={cx('absolute top-0 right-0 h-28 w-28 rounded-full bg-gradient-to-br opacity-50 group-hover:opacity-100 transition-opacity blur-2xl pointer-events-none', tool.gradient)} />

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className={cx('grid h-9 w-9 place-items-center rounded-xl transition-transform group-hover:scale-110', tool.iconColor)}>
                                        <Icon size={17} />
                                    </span>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-muted bg-raised group-hover:bg-line px-2.5 py-1 rounded-full transition-colors">
                                        {tool.badge}
                                    </span>
                                </div>

                                <h4 className="text-sm font-extrabold text-ink group-hover:text-teal-300 transition-colors">
                                    {tool.title}
                                </h4>
                                <p className="mt-1 text-xs text-ink-muted leading-relaxed line-clamp-2">
                                    {tool.desc}
                                </p>
                            </div>

                            <div className="mt-3.5 flex items-center gap-1.5 text-xs font-bold text-teal-400 opacity-80 group-hover:opacity-100 transition-opacity">
                                <span>Launch {tool.tag}</span>
                                <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

export default FinancialIntelligenceHub;
