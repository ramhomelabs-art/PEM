import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCardSession } from '../../context/credit_card/CardSessionContext';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { cx } from '../ui/cx';
import {
    LayoutDashboard,
    CreditCard,
    Receipt,
    Gift,
    Settings,
    ArrowLeft,
    Calculator,
    FileText,
    ShieldCheck,
    Menu,
    X,
    Moon,
    Sun,
} from 'lucide-react';

const MENU_ITEMS = [
    { icon: LayoutDashboard, label: 'Dashboard', id: '/credit-cards/dashboard' },
    { icon: CreditCard, label: 'My Cards', id: '/credit-cards/cards' },
    { icon: Receipt, label: 'Transactions', id: '/credit-cards/transactions' },
    { icon: Calculator, label: 'EMI', id: '/credit-cards/emi' },
    { icon: FileText, label: 'Monthly Bills', id: '/credit-cards/monthly-bills' },
    { icon: FileText, label: 'Auto Statement', id: '/credit-cards/auto-statement' },
    { icon: Gift, label: 'Rewards', id: '/credit-cards/rewards' },
    { icon: Settings, label: 'Settings', id: '/credit-cards/settings' },
];

function NavItems({ pathname, onNavigate }) {
    return (
        <nav className="flex flex-1 flex-col gap-1.5">
            {MENU_ITEMS.map((item) => {
                const isActive = pathname === item.id;
                const Icon = item.icon;
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        className={cx(
                            'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-bold transition',
                            isActive
                                ? 'bg-violet-soft text-violet'
                                : 'text-ink-muted hover:bg-raised hover:text-ink'
                        )}
                    >
                        <Icon size={18} aria-hidden="true" />
                        {item.label}
                    </button>
                );
            })}
        </nav>
    );
}

const CreditCardLayout = () => {
    const { user } = useAuth();
    const { unlocked, lock } = useCardSession();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Guard: the section is only reachable with a live card session.
    useEffect(() => {
        if (!unlocked) {
            navigate('/credit-cards', { replace: true });
        }
    }, [unlocked, navigate]);

    const go = (id) => {
        navigate(id);
        setDrawerOpen(false);
    };

    const handleLockAndExit = () => {
        lock();
        navigate('/');
    };

    const lockButton = (
        <button
            type="button"
            onClick={handleLockAndExit}
            className="flex w-full items-center justify-center gap-2 rounded-control border border-line bg-raised px-3 py-2.5 text-xs font-bold text-ink-muted transition hover:border-line-strong hover:text-ink"
        >
            <ArrowLeft size={15} aria-hidden="true" /> Lock &amp; Exit
        </button>
    );

    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-ink md:flex-row">
            {/* Mobile top bar */}
            <div className="safe-top z-30 flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:hidden">
                <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    aria-label="Open navigation"
                    className="grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted"
                >
                    <Menu size={18} aria-hidden="true" />
                </button>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-violet to-info text-white">
                    <CreditCard size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold leading-tight text-ink">
                        Credit Cards
                    </p>
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-violet">
                        <ShieldCheck size={11} aria-hidden="true" /> Secure zone
                    </p>
                </div>
                <button
                    type="button"
                    onClick={toggleTheme}
                    title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                    aria-label="Toggle colour theme"
                    className="grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                >
                    {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                </button>
            </div>

            {/* Desktop sidebar */}
            <aside className="hidden w-[280px] shrink-0 flex-col border-r border-line bg-surface p-6 md:flex">
                <div className="mb-6">
                    <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-gradient-to-br from-violet to-info text-white">
                            <CreditCard size={22} aria-hidden="true" />
                        </span>
                        <div>
                            <h2 className="text-base font-extrabold leading-tight text-ink">Credit Cards</h2>
                            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-violet">
                                <ShieldCheck size={11} aria-hidden="true" /> Secure zone
                            </p>
                        </div>
                    </div>

                    <div className="mt-5">{lockButton}</div>
                </div>

                <NavItems pathname={location.pathname} onNavigate={go} />

                <div className="mt-4 rounded-card border border-line bg-raised p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                        Logged in as
                    </p>
                    <p className="truncate text-sm font-extrabold text-ink">
                        {user?.fullName || user?.username}
                    </p>
                </div>
            </aside>

            <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
                <Outlet />
            </main>

            {/* Mobile drawer */}
            {drawerOpen ? (
                <div className="fixed inset-0 z-50 md:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={() => setDrawerOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <aside className="absolute left-0 top-0 flex h-full w-[280px] max-w-[85vw] flex-col border-r border-line bg-surface p-4">
                        <div className="mb-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-gradient-to-br from-violet to-info text-white">
                                    <CreditCard size={20} aria-hidden="true" />
                                </span>
                                <div>
                                    <h2 className="text-sm font-extrabold leading-tight text-ink">
                                        Credit Cards
                                    </h2>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet">
                                        Secure zone
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(false)}
                                aria-label="Close navigation"
                                className="grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted"
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="mb-5">{lockButton}</div>

                        <NavItems pathname={location.pathname} onNavigate={go} />

                        <div className="mt-4 rounded-card border border-line bg-raised p-3.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                                Logged in as
                            </p>
                            <p className="truncate text-sm font-extrabold text-ink">
                                {user?.fullName || user?.username}
                            </p>
                        </div>
                    </aside>
                </div>
            ) : null}
        </div>
    );
};

export default CreditCardLayout;
