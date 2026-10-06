import { MapPin } from 'lucide-react';
import { useWeather } from '../../hooks/personal_expense/useWeather';

/** Small header chip replacing the old full weather card. */
export function WeatherChip({ location, onClick }) {
    const { data, error, loading } = useWeather(location);

    if (loading) {
        return <div className="pem-skeleton hidden h-9 w-24 rounded-control sm:block" aria-hidden="true" />;
    }

    const Icon = data?.icon;
    const cityName = data?.location
        ? data.location.split(',')[0].trim()
        : (data?.condition || '');

    return (
        <button
            type="button"
            onClick={onClick}
            title={data ? `${data.location} · ${data.condition}` : 'Change weather location'}
            aria-label="Weather — change location"
            className="hidden h-9 items-center gap-1.5 rounded-control border border-line px-2.5 text-ink-muted transition-colors hover:text-ink sm:inline-flex"
        >
            {Icon ? <Icon size={15} color={data.iconColor} aria-hidden="true" /> : <MapPin size={14} aria-hidden="true" />}
            <span className="tnum text-xs font-bold text-ink">{data ? `${data.temp}°` : '—'}</span>
            <span className="hidden max-w-[85px] truncate text-xs font-medium text-ink-faint lg:inline">
                {error ? 'N/A' : cityName}
            </span>
        </button>
    );
}
