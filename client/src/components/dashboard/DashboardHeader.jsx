import { useState, useRef, useEffect } from 'react';
import {
    Bell,
    FileSpreadsheet,
    FileText,
    MessageCircle,
    Moon,
    MoreHorizontal,
    Plus,
    Search,
    Share2,
    StickyNote,
    Sun,
    Users,
} from 'lucide-react';
import { cx } from '../ui/cx';
import { Button } from '../ui/primitives';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { RANGE_PRESETS } from '../../utils/theme';
import { WeatherChip } from './WeatherChip';

export function greetingFor(date = new Date()) {
    const h = date.getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export function firstNameOf(user) {
    const name = user?.fullName || user?.username || 'there';
    return name.trim().split(/\s+/)[0];
}

function IconAction({ icon: Icon, label, onClick, badge, className }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className={cx(
                'relative grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted transition-all hover:bg-raised hover:text-ink active:scale-95',
                className
            )}
        >
            <Icon size={16} aria-hidden="true" />
            {badge > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-pill bg-neg px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-bg animate-pulse">
                    {badge > 99 ? '99+' : badge}
                </span>
            ) : null}
        </button>
    );
}

function SearchButton({ onSearch }) {
    return (
        <button
            type="button"
            onClick={onSearch}
            aria-label="Global search"
            title="Global search (Ctrl+K)"
            className="group inline-flex h-9 items-center rounded-control border border-line bg-sunken/60 text-ink-muted transition-all hover:border-line-strong hover:bg-sunken hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        >
            <span className="grid h-full w-9 shrink-0 place-items-center">
                <Search
                    size={15}
                    aria-hidden="true"
                    className="text-ink-faint transition-colors group-hover:text-ink group-focus-within:text-ink"
                />
            </span>
            <span className="flex max-w-0 items-center gap-1.5 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover:max-w-[12rem] group-hover:pr-2.5 group-hover:opacity-100 group-focus-within:max-w-[12rem] group-focus-within:pr-2.5 group-focus-within:opacity-100">
                <span className="whitespace-nowrap text-xs">Search…</span>
                <kbd className="rounded border border-line bg-surface/80 px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                    Ctrl K
                </kbd>
            </span>
        </button>
    );
}

function RangeFilter({ range, onRangeChange, customRange, onCustomRangeChange }) {
    const [showCustom, setShowCustom] = useState(false);
    const customRef = useRef(null);

    useEffect(() => {
        if (!showCustom) return;
        const handleOutside = (e) => {
            if (customRef.current && !customRef.current.contains(e.target)) {
                setShowCustom(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [showCustom]);

    return (
        <div ref={customRef} className="relative min-w-0 max-w-full">
            <div
                role="group"
                aria-label="Date range"
                className="no-scrollbar inline-flex max-w-full items-center overflow-x-auto rounded-control border border-line bg-sunken/80 p-0.5 backdrop-blur-sm"
            >
                {RANGE_PRESETS.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onRangeChange(p.id)}
                        aria-pressed={range === p.id}
                        className={cx(
                            'whitespace-nowrap rounded-[8px] px-2.5 py-1 text-xs font-semibold transition-all',
                            range === p.id
                                ? 'bg-surface text-ink shadow-card'
                                : 'text-ink-muted hover:text-ink'
                        )}
                    >
                        {p.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setShowCustom((s) => !s)}
                    aria-expanded={showCustom}
                    className={cx(
                        'whitespace-nowrap rounded-[8px] px-2.5 py-1 text-xs font-semibold transition-all',
                        range === 'custom'
                            ? 'bg-surface text-ink shadow-card'
                            : 'text-ink-muted hover:text-ink'
                    )}
                >
                    Custom
                </button>
            </div>

            {showCustom ? (
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-card border border-line bg-surface/95 p-3.5 shadow-raised backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                    <p className="mb-2.5 text-xs font-bold text-ink">Custom Date Range</p>
                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-ink-muted font-medium">
                            From
                            <input
                                type="date"
                                value={customRange.from}
                                onChange={(e) =>
                                    onCustomRangeChange({ ...customRange, from: e.target.value })
                                }
                                className="mt-1 w-full rounded-control border border-line bg-sunken px-2 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
                            />
                        </label>
                        <label className="text-xs text-ink-muted font-medium">
                            To
                            <input
                                type="date"
                                value={customRange.to}
                                onChange={(e) =>
                                    onCustomRangeChange({ ...customRange, to: e.target.value })
                                }
                                className="mt-1 w-full rounded-control border border-line bg-sunken px-2 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
                            />
                        </label>
                    </div>
                    <Button
                        size="sm"
                        variant="primary"
                        className="mt-3 w-full"
                        onClick={() => {
                            onRangeChange('custom');
                            setShowCustom(false);
                        }}
                    >
                        Apply range
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

function MoreMenu({ onOpenNotes, onOpenContacts, onOpenShare, onExportCsv, onExportPdf }) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    const item =
        'flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-xs font-semibold text-ink transition-colors hover:bg-raised hover:text-brand';

    return (
        <div ref={menuRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className={cx(
                    'grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted transition-all hover:bg-raised hover:text-ink active:scale-95',
                    open && 'border-brand/40 bg-raised text-ink ring-2 ring-brand/10'
                )}
                title="Tools & Export"
                aria-label="Tools and Export"
                aria-expanded={open}
            >
                <MoreHorizontal size={16} aria-hidden="true" />
            </button>
            {open && (
                <div className="absolute right-0 z-50 mt-2 w-52 rounded-card border border-line bg-surface p-1.5 shadow-raised animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                        Quick Hub
                    </div>
                    <button type="button" onClick={() => { setOpen(false); onOpenNotes(); }} className={item}>
                        <StickyNote size={15} aria-hidden="true" className="text-amber-400" /> Smart Notes
                    </button>
                    <button type="button" onClick={() => { setOpen(false); onOpenContacts(); }} className={item}>
                        <Users size={15} aria-hidden="true" className="text-sky-400" /> Contacts & Friends
                    </button>
                    <button type="button" onClick={() => { setOpen(false); onOpenShare(); }} className={item}>
                        <Share2 size={15} aria-hidden="true" className="text-emerald-400" /> Share Access
                    </button>
                    <div className="my-1.5 border-t border-line" />
                    <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                        Reports
                    </div>
                    <button type="button" onClick={() => { setOpen(false); onExportCsv(); }} className={item}>
                        <FileSpreadsheet size={15} aria-hidden="true" className="text-teal-400" /> Export CSV Data
                    </button>
                    <button type="button" onClick={() => { setOpen(false); onExportPdf(); }} className={item}>
                        <FileText size={15} aria-hidden="true" className="text-rose-400" /> Download PDF Report
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * Sticky dashboard header: greeting/date, global search (Ctrl+K), date-range
 * filter, weather chip, theme toggle, notifications and the single primary
 * "Add entry" call to action. Secondary utilities (smart notes, contacts,
 * share, CSV/PDF export) live behind a compact "More" menu so the bar stays
 * uncluttered at every width.
 */
export function DashboardHeader({
    user,
    unreadCount,
    alertCount,
    weatherLocation,
    range,
    onRangeChange,
    customRange,
    onCustomRangeChange,
    onSearch,
    onAdd,
    onOpenWeather,
    onOpenNotes,
    onOpenContacts,
    onOpenMessages,
    onOpenShare,
    onOpenNotifications,
    notificationSlot,
    onExportCsv,
    onExportPdf,
}) {
    const { isDark, toggleTheme } = useTheme();

    return (
        <header className="no-print sticky top-0 z-20 border-b border-line/70 bg-bg/80 backdrop-blur-xl transition-colors duration-200">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-2.5 px-4 py-2.5 sm:px-6 md:flex-row md:items-center md:justify-between">
                {/* Zone 1: Greeting */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-extrabold tracking-tight text-ink flex items-center gap-2">
                            <span>{greetingFor()}, {firstNameOf(user)}</span>
                        </h1>
                        <p className="truncate text-xs font-medium text-ink-faint">
                            {new Date().toLocaleDateString(undefined, {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            })}
                        </p>
                    </div>
                </div>

                {/* Zone 2: Filters, Weather, Actions */}
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <SearchButton onSearch={onSearch} />

                    <div className="no-scrollbar overflow-x-auto py-0.5 max-w-full">
                        <RangeFilter
                            range={range}
                            onRangeChange={onRangeChange}
                            customRange={customRange}
                            onCustomRangeChange={onCustomRangeChange}
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <WeatherChip location={weatherLocation} onClick={onOpenWeather} />

                        <button
                            type="button"
                            onClick={toggleTheme}
                            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                            aria-label="Toggle colour theme"
                            className="grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted transition-all hover:bg-raised hover:text-ink active:scale-95"
                        >
                            {isDark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
                        </button>

                        <IconAction
                            icon={MessageCircle}
                            label="Messages"
                            onClick={onOpenMessages}
                            badge={unreadCount}
                        />

                        <div className="relative">
                            <IconAction
                                icon={Bell}
                                label="Notifications"
                                onClick={onOpenNotifications}
                                badge={alertCount}
                            />
                            {notificationSlot}
                        </div>

                        <MoreMenu
                            onOpenNotes={onOpenNotes}
                            onOpenContacts={onOpenContacts}
                            onOpenShare={onOpenShare}
                            onExportCsv={onExportCsv}
                            onExportPdf={onExportPdf}
                        />

                        <Button variant="primary" icon={Plus} onClick={onAdd} className="shadow-sm active:scale-95">
                            <span className="hidden sm:inline">Add Entry</span>
                            <span className="sm:hidden">Add</span>
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}
