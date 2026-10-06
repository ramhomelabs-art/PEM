import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    ReceiptText,
    CreditCard,
    Calculator,
    Handshake,
    PieChart,
    Archive,
    Settings,
    LogOut,
    Wallet,
    X,
    Menu,
    FileText,
    Zap,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    Moon,
    Sun,
} from 'lucide-react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { BASE_URL } from '../../config';
import { cx } from '../ui/cx';

const MENU_ITEMS = [
    { icon: LayoutDashboard, label: 'Overview', id: '/' },
    { icon: ReceiptText, label: 'Transactions', id: '/transactions' },
    { icon: CreditCard, label: 'Bills & Payments', id: '/bills' },
    { icon: TrendingUp, label: 'Investments', id: '/investments' },
    { icon: Calculator, label: 'Loans & EMI', id: '/loans' },
    { icon: Handshake, label: 'Borrow & Lending', id: '/borrow' },
    { icon: PieChart, label: 'Budgets', id: '/budgets' },
    { icon: CreditCard, label: 'Credit Cards', id: '/credit-cards' },
    { icon: FileText, label: 'Accounts & Documents', id: '/cards' },
    { icon: Zap, label: 'Automation Spot', id: '/automation' },
    { icon: Archive, label: 'Archive Data', id: '/archive' },
    { icon: Settings, label: 'Settings', id: '/profile' },
];

const avatarUrl = (user) => {
    if (user?.profilePhoto && typeof user.profilePhoto === 'string') {
        return user.profilePhoto.startsWith('http')
            ? user.profilePhoto
            : `${BASE_URL}/${user.profilePhoto.replace(/\\/g, '/')}`;
    }
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'Guest'}`;
};

function isActiveRoute(pathname, id) {
    if (id === '/') return pathname === '/';
    return pathname === id || pathname.startsWith(`${id}/`);
}

function Brand({ compact = false }) {
    return (
        <div className="flex items-center gap-3 overflow-hidden">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-brand text-slate-950 shadow-sm">
                <Wallet size={22} aria-hidden="true" />
            </div>
            <div
                className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                style={{
                    maxWidth: compact ? 0 : 160,
                    opacity: compact ? 0 : 1,
                    transform: compact ? 'translateX(-8px)' : 'translateX(0)',
                }}
            >
                <p className="text-xl font-black leading-none tracking-tight text-ink">PEM</p>
                <p className="text-xs font-bold text-brand">CORE</p>
            </div>
        </div>
    );
}

function ProfileCard({ user, compact = false, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={compact ? user?.fullName || user?.username : undefined}
            className={cx(
                'flex w-full items-center rounded-[16px] border border-line bg-sunken text-left transition-all duration-300 hover:border-line-strong',
                compact ? 'p-1.5 justify-center' : 'gap-3 p-3'
            )}
        >
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-brand">
                <img
                    src={avatarUrl(user)}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${
                            user?.username || 'Guest'
                        }`;
                    }}
                />
            </span>
            <div
                className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                style={{
                    maxWidth: compact ? 0 : 160,
                    opacity: compact ? 0 : 1,
                    transform: compact ? 'translateX(-8px)' : 'translateX(0)',
                }}
            >
                <span className="block truncate text-sm font-bold text-ink">
                    {user?.fullName || user?.username}
                </span>
                <span className="block text-xs font-bold text-brand">
                    {user?.role?.toUpperCase() || 'USER'} ACCOUNT
                </span>
            </div>
        </button>
    );
}

function NavList({ pathname, onNavigate, compact = false }) {
    return (
        <nav className="flex flex-col gap-1.5" aria-label="Primary">
            {MENU_ITEMS.map((item) => {
                const active = isActiveRoute(pathname, item.id);
                return (
                    <button
                        key={item.id}
                        type="button"
                        title={compact ? item.label : undefined}
                        aria-label={item.label}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => onNavigate(item.id)}
                        className={cx(
                            'flex items-center rounded-[12px] py-2.5 text-sm font-bold transition-all duration-300',
                            compact ? 'justify-center px-2' : 'gap-3 px-3',
                            active
                                ? 'bg-brand-soft text-brand'
                                : 'text-ink-muted hover:bg-raised hover:text-ink'
                        )}
                    >
                        <item.icon size={20} className="shrink-0" aria-hidden="true" />
                        <span
                            className="overflow-hidden whitespace-nowrap text-left transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                            style={{
                                maxWidth: compact ? 0 : 160,
                                opacity: compact ? 0 : 1,
                                transform: compact ? 'translateX(-6px)' : 'translateX(0)',
                            }}
                        >
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}

function LogoutButton({ onLogout, compact = false }) {
    return (
        <button
            type="button"
            onClick={onLogout}
            title={compact ? 'Logout' : undefined}
            aria-label="Logout"
            className={cx(
                'flex items-center justify-center rounded-[12px] bg-neg-soft py-2.5 text-sm font-bold text-neg transition-all duration-300 hover:bg-neg hover:text-white',
                compact ? 'px-2' : 'gap-2.5 px-3'
            )}
        >
            <LogOut size={18} className="shrink-0" aria-hidden="true" />
            <span
                className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                style={{
                    maxWidth: compact ? 0 : 160,
                    opacity: compact ? 0 : 1,
                    transform: compact ? 'translateX(-6px)' : 'translateX(0)',
                }}
            >
                Logout
            </span>
        </button>
    );
}

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const { theme, mode, isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);
    // Hybrid sidebar: expanded on wide screens, icon rail on tablet — and the
    // user can override either way with the edge handle; choice is remembered.
    const [collapsed, setCollapsed] = useState(() => {
        try {
            const stored = localStorage.getItem('pem.sidebarCollapsed');
            if (stored != null) return stored === 'true';
        } catch {
            // Corrupt/unavailable storage; fall through to the width heuristic.
        }
        return typeof window !== 'undefined' ? window.innerWidth < 1280 : false;
    });

    const toggleSidebar = () =>
        setCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('pem.sidebarCollapsed', String(next));
            } catch {
                // Non-fatal: collapse state just won't persist.
            }
            return next;
        });

    const go = (id) => {
        navigate(id);
        setDrawerOpen(false);
    };

    return (
        <div
            className="flex h-screen w-full flex-col overflow-hidden bg-bg text-ink md:flex-row"
            style={{ transition: 'background-color 0.3s, color 0.3s' }}
        >
            {mode === 'dark' ? <div className="animated-bg" /> : null}

            {/* Mobile top bar */}
            <div className="no-print safe-top z-30 flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-2 md:hidden">
                <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    aria-label="Open navigation"
                    className="grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted"
                >
                    <Menu size={18} aria-hidden="true" />
                </button>
                <Brand />
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                        aria-label="Toggle colour theme"
                        className="grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted"
                    >
                        {isDark ? (
                            <Sun size={17} aria-hidden="true" />
                        ) : (
                            <Moon size={17} aria-hidden="true" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={logout}
                        aria-label="Logout"
                        className="grid h-9 w-9 place-items-center rounded-control border border-line text-neg"
                    >
                        <LogOut size={17} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Desktop / tablet sidebar (collapsible) */}
            <aside
                className={cx(
                    'sidebar-aside relative z-20 hidden shrink-0 flex-col overflow-x-hidden border-r border-line bg-surface md:flex',
                    collapsed ? 'md:w-[76px] md:p-3' : 'md:w-[260px] md:p-5'
                )}
                style={{ backgroundColor: theme.sidebar }}
            >
                <button
                    type="button"
                    onClick={toggleSidebar}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className="absolute -right-3 top-6 z-30 hidden h-6 w-6 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-card transition hover:border-line-strong hover:text-ink md:grid"
                >
                    {collapsed ? (
                        <ChevronRight size={14} aria-hidden="true" />
                    ) : (
                        <ChevronLeft size={14} aria-hidden="true" />
                    )}
                </button>

                <div className="mb-6 flex items-center overflow-hidden">
                    <Brand compact={collapsed} />
                </div>

                <div className="mb-6 overflow-hidden">
                    <ProfileCard user={user} compact={collapsed} onClick={() => go('/profile')} />
                </div>

                <div className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden">
                    <NavList pathname={location.pathname} onNavigate={go} compact={collapsed} />
                </div>

                <div className="mt-4 overflow-hidden">
                    <LogoutButton onLogout={logout} compact={collapsed} />
                </div>
            </aside>

            <main className="relative z-[1] flex-1 overflow-y-auto overflow-x-hidden min-w-0">{children}</main>

            {/* Mobile drawer */}
            {drawerOpen ? (
                <div className="fixed inset-0 z-50 md:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={() => setDrawerOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <aside
                        className="absolute left-0 top-0 flex h-full w-[280px] flex-col border-r border-line bg-surface p-4"
                        style={{ backgroundColor: theme.sidebar }}
                    >
                        <div className="mb-5 flex items-center justify-between">
                            <Brand />
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(false)}
                                aria-label="Close navigation"
                                className="grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted"
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="mb-5">
                            <ProfileCard user={user} onClick={() => go('/profile')} />
                        </div>
                        <div className="no-scrollbar flex-1 overflow-y-auto">
                            <NavList pathname={location.pathname} onNavigate={go} />
                        </div>
                        <div className="mt-4">
                            <LogoutButton onLogout={logout} />
                        </div>
                    </aside>
                </div>
            ) : null}
        </div>
    );
};

export default Layout;
