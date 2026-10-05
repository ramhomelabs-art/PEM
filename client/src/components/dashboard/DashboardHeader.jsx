import { useState } from 'react';
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
                'relative grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted transition-colors hover:bg-raised hover:text-ink',
                className
            )}
        >
            <Icon size={16} aria-hidden="true" />
            {badge > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-pill bg-neg px-1 text-xs font-bold text-white">
                    {badge > 99 ? '99+' : badge}
                </span>
            ) : null}
        </button>
    );
}

function RangeFilter({ range, onRangeChange, customRange, onCustomRangeChange }) {
    const [showCustom, setShowCustom] = useState(false);

    return (
        <div className="relative">
            <div
                role="group"
                aria-label="Date range"
                className="inline-flex items-center rounded-control border border-line bg-sunken p-0.5"
            >
                {RANGE_PRESETS.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onRangeChange(p.id)}
                        aria-pressed={range === p.id}
                        className={cx(
                            'rounded-[8px] px-2.5 py-1 text-xs font-semibold transition',
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
                        'rounded-[8px] px-2.5 py-1 text-xs font-semibold transition',
                        range === 'custom'
                            ? 'bg-surface text-ink shadow-card'
                            : 'text-ink-muted hover:text-ink'
                    )}
                >
                    Custom
                </button>
            </div>

            {showCustom ? (
                <div className="absolute right-0 z-40 mt-2 w-64 rounded-card border border-line bg-surface p-3 shadow-raised">
                    <p className="mb-2 text-xs font-bold text-ink">Custom range</p>
                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-ink-muted">
                            From
                            <input
                                type="date"
                                value={customRange.from}
                                onChange={(e) =>
                                    onCustomRangeChange({ ...customRange, from: e.target.value })
                                }
                                className="mt-1 w-full rounded-control border border-line bg-sunken px-2 py-1.5 text-xs text-ink"
                            />
                        </label>
                        <label className="text-xs text-ink-muted">
                            To
                            <input
                                type="date"
                                value={customRange.to}
                                onChange={(e) =>
                                    onCustomRangeChange({ ...customRange, to: e.target.value })
                                }
                                className="mt-1 w-full rounded-control border border-line bg-sunken px-2 py-1.5 text-xs text-ink"
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
    const item =
        'flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left text-xs font-semibold text-ink hover:bg-raised';

    return (
        <details className="relative">
            <summary
                className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-control border border-line text-ink-muted transition-colors hover:bg-raised hover:text-ink [&::-webkit-details-marker]:hidden"
                title="More actions"
                aria-label="More actions"
            >
                <MoreHorizontal size={16} aria-hidden="true" />
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-48 rounded-card border border-line bg-surface p-1 shadow-raised">
                <button type="button" onClick={onOpenNotes} className={item}>
                    <StickyNote size={15} aria-hidden="true" /> Smart notes
                </button>
                <button type="button" onClick={onOpenContacts} className={item}>
                    <Users size={15} aria-hidden="true" /> Contacts
                </button>
                <button type="button" onClick={onOpenShare} className={item}>
                    <Share2 size={15} aria-hidden="true" /> Share
                </button>
                <div className="my-1 border-t border-line" />
                <button type="button" onClick={onExportCsv} className={item}>
                    <FileSpreadsheet size={15} aria-hidden="true" /> Export CSV
                </button>
                <button type="button" onClick={onExportPdf} className={item}>
                    <FileText size={15} aria-hidden="true" /> Export PDF
                </button>
            </div>
        </details>
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
    compare,
    onToggleCompare,
    onSearch,
    onAdd,
    onOpenWeather,
    onOpenNotes,
    onOpenContacts,
    onOpenMessages,
    onOpenShare,
    onOpenNotifications,
    onExportCsv,
    onExportPdf,
}) {
    const { isDark, toggleTheme } = useTheme();

    return (
        <header className="no-print sticky top-0 z-30 border-b border-line bg-bg backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 sm:px-6">
                <div className="min-w-[180px] flex-1">
                    <h1 className="truncate text-base font-extrabold tracking-tight text-ink">
                        {greetingFor()}, {firstNameOf(user)}
                    </h1>
                    <p className="truncate text-xs text-ink-faint">
                        {new Date().toLocaleDateString(undefined, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                        })}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onSearch}
                    className="group inline-flex h-9 items-center gap-2 rounded-control border border-line bg-sunken px-3 text-ink-muted transition-colors hover:text-ink"
                    aria-label="Global search"
                >
                    <Search size={15} aria-hidden="true" />
                    <span className="hidden text-xs md:inline">Search…</span>
                    <kbd className="ml-1 hidden rounded border border-line px-1.5 py-0.5 text-xs font-semibold text-ink-faint md:inline">
                        Ctrl K
                    </kbd>
                </button>

                <RangeFilter
                    range={range}
                    onRangeChange={onRangeChange}
                    customRange={customRange}
                    onCustomRangeChange={onCustomRangeChange}
                />

                <button
                    type="button"
                    onClick={onToggleCompare}
                    aria-pressed={compare}
                    title="Compare with previous period"
                    className={cx(
                        'hidden h-9 items-center rounded-control border px-3 text-xs font-semibold transition-colors lg:inline-flex',
                        compare
                            ? 'border-brand bg-brand-soft text-brand'
                            : 'border-line text-ink-muted hover:text-ink'
                    )}
                >
                    Compare
                </button>

                <WeatherChip location={weatherLocation} onClick={onOpenWeather} />

                <button
                    type="button"
                    onClick={toggleTheme}
                    title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                    aria-label="Toggle colour theme"
                    className="grid h-9 w-9 place-items-center rounded-control border border-line text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                >
                    {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                </button>

                <MoreMenu
                    onOpenNotes={onOpenNotes}
                    onOpenContacts={onOpenContacts}
                    onOpenShare={onOpenShare}
                    onExportCsv={onExportCsv}
                    onExportPdf={onExportPdf}
                />
                <IconAction
                    icon={MessageCircle}
                    label="Messages"
                    onClick={onOpenMessages}
                    badge={unreadCount}
                />
                <IconAction
                    icon={Bell}
                    label="Notifications"
                    onClick={onOpenNotifications}
                    badge={alertCount}
                />

                <Button variant="primary" icon={Plus} onClick={onAdd} className="ml-1">
                    <span className="hidden sm:inline">Add entry</span>
                    <span className="sm:hidden">Add</span>
                </Button>
            </div>
        </header>
    );
}
