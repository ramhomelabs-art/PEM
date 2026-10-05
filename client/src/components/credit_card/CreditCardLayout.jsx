import { useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCardSession } from '../../context/credit_card/CardSessionContext';
import { cx } from '../ui/cx';
import {
    LayoutDashboard,
    CreditCard,
    Receipt,
    Gift,
    Settings,
    ArrowLeft,
    Wallet,
    Calculator,
    FileText,
    ShieldCheck
} from 'lucide-react';

const CreditCardLayout = () => {
    const { user } = useAuth();
    const { unlocked, lock } = useCardSession();
    const navigate = useNavigate();
    const location = useLocation();

    // Guard: the section is only reachable with a live card session.
    useEffect(() => {
        if (!unlocked) {
            navigate('/credit-cards', { replace: true });
        }
    }, [unlocked, navigate]);

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', id: '/credit-cards/dashboard' },
        { icon: CreditCard, label: 'My Cards', id: '/credit-cards/cards' },
        { icon: Receipt, label: 'Transactions', id: '/credit-cards/transactions' },
        { icon: Calculator, label: 'EMI', id: '/credit-cards/emi' },
        { icon: FileText, label: 'Monthly Bills', id: '/credit-cards/monthly-bills' },
        { icon: FileText, label: 'Auto Statement', id: '/credit-cards/auto-statement' },
        { icon: Gift, label: 'Rewards', id: '/credit-cards/rewards' },
        { icon: Settings, label: 'Settings', id: '/credit-cards/settings' }
    ];

    const handleLockAndExit = () => {
        lock();
        navigate('/');
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-bg text-ink">
            <aside className="flex w-[280px] shrink-0 flex-col border-r border-line bg-surface p-6">
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

                    <button
                        type="button"
                        onClick={handleLockAndExit}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-control border border-line bg-raised px-3 py-2.5 text-xs font-bold text-ink-muted transition hover:border-line-strong hover:text-ink"
                    >
                        <ArrowLeft size={15} aria-hidden="true" /> Lock &amp; Exit
                    </button>
                </div>

                <nav className="flex flex-1 flex-col gap-1.5">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.id;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => navigate(item.id)}
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

                <div className="mt-4 rounded-card border border-line bg-raised p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                        Logged in as
                    </p>
                    <p className="truncate text-sm font-extrabold text-ink">
                        {user?.fullName || user?.username}
                    </p>
                </div>
            </aside>

            <main className="relative flex-1 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default CreditCardLayout;
