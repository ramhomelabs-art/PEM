import { useState, useEffect } from 'react';
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

function Brand({ compact = false, onToggle }) {
    return (
        <div 
            onClick={compact ? onToggle : undefined}
            title={compact ? "Click to expand sidebar" : undefined}
            className={cx(
                "flex items-center overflow-hidden transition-all duration-300",
                compact ? "justify-center w-full cursor-pointer hover:opacity-90" : "gap-3"
            )}
        >
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-transform duration-200 active:scale-95">
                <Wallet size={20} className="stroke-[2.5]" aria-hidden="true" />
            </div>
            <div
                className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                style={{
                    maxWidth: compact ? 0 : 160,
                    opacity: compact ? 0 : 1,
                    transform: compact ? 'translateX(-8px)' : 'translateX(0)',
                    marginLeft: compact ? 0 : undefined
                }}
            >
                <div className="flex items-center gap-1.5">
                    <p className="text-xl font-black leading-none tracking-tight text-ink">PEM</p>
                    <span className="rounded-[6px] border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                        PRO
                    </span>
                </div>
                <p className="mt-0.5 text-[10px] font-bold tracking-widest text-ink-muted uppercase">FINANCE CORE</p>
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
                'group relative flex w-full items-center rounded-[16px] border border-line bg-surface/80 backdrop-blur-sm text-left transition-all duration-300 hover:border-emerald-500/30 hover:bg-raised shadow-sm',
                compact ? 'p-1.5 justify-center' : 'gap-3 p-3'
            )}
        >
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-emerald-500/30 shadow-sm transition-transform duration-200 group-hover:scale-105">
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
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
            </span>
            <div
                className="overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                style={{
                    maxWidth: compact ? 0 : 160,
                    opacity: compact ? 0 : 1,
                    transform: compact ? 'translateX(-8px)' : 'translateX(0)',
                }}
            >
                <span className="block truncate text-sm font-bold text-ink group-hover:text-emerald-400 transition-colors">
                    {user?.fullName || user?.username}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="block text-[10px] font-bold tracking-wider text-emerald-400/90 uppercase">
                        {user?.role?.toUpperCase() || 'USER'} ACCOUNT
                    </span>
                </div>
            </div>
        </button>
    );
}

function NavList({ pathname, onNavigate, compact = false }) {
    return (
        <nav className="flex flex-col gap-1" aria-label="Primary">
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
                            'group relative flex items-center rounded-[12px] py-2.5 text-sm font-bold transition-all duration-200 select-none',
                            compact ? 'justify-center px-2' : 'gap-3 px-3.5',
                            active
                                ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_0_15px_-4px_rgba(16,185,129,0.3)]'
                                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100 hover:border-white/[0.06] border border-transparent'
                        )}
                    >
                        {active && !compact ? (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-gradient-to-b from-emerald-400 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        ) : null}
                        <item.icon
                            size={19}
                            className={cx(
                                'shrink-0 transition-transform duration-200 group-hover:scale-110',
                                active
                                    ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                    : 'text-slate-400 group-hover:text-slate-200'
                            )}
                            aria-hidden="true"
                        />
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
                'group flex items-center justify-center rounded-[12px] border border-rose-500/20 bg-rose-500/10 py-2.5 text-sm font-bold text-rose-400 transition-all duration-200 hover:border-rose-500/40 hover:bg-rose-500 hover:text-white shadow-sm',
                compact ? 'px-2' : 'gap-2.5 px-3'
            )}
        >
            <LogOut size={17} className="shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
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

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggleSidebar();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
                    'sidebar-aside relative z-40 hidden shrink-0 flex-col border-r border-line bg-surface transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] md:flex',
                    collapsed ? 'md:w-[76px] md:p-3' : 'md:w-[260px] md:p-5'
                )}
                style={{ backgroundColor: theme.sidebar }}
            >
                {/* Sleek Edge Collapse / Expand Toggle Button */}
                <button
                    type="button"
                    onClick={toggleSidebar}
                    aria-label={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
                    title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
                    className={cx(
                        'absolute -right-3.5 top-7 z-30 hidden md:flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink-muted ring-4 ring-bg shadow-md transition-all duration-200 cursor-pointer hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-[0_0_12px_rgba(16,185,129,0.5)] hover:scale-105 active:scale-95'
                    )}
                >
                    {collapsed ? (
                        <ChevronRight size={14} className="stroke-[2.5]" aria-hidden="true" />
                    ) : (
                        <ChevronLeft size={14} className="stroke-[2.5]" aria-hidden="true" />
                    )}
                </button>

                <div className="mb-6 flex items-center overflow-hidden">
                    <Brand compact={collapsed} onToggle={toggleSidebar} />
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

            <main className="relative flex-1 overflow-y-auto overflow-x-hidden min-w-0">{children}</main>

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
