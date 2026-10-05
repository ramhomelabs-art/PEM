import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, Wind } from 'lucide-react';

/** WMO weather-code → { icon, label, color } mapping. */
export function weatherDetails(code) {
    if (code === 0) return { icon: Sun, label: 'Clear', color: '#f59e0b' };
    if (code >= 1 && code <= 3) return { icon: Cloud, label: 'Cloudy', color: '#94a3b8' };
    if (code >= 45 && code <= 48) return { icon: Wind, label: 'Foggy', color: '#94a3b8' };
    if (code >= 51 && code <= 67) return { icon: CloudRain, label: 'Rain', color: '#3b82f6' };
    if (code >= 71 && code <= 86) return { icon: CloudRain, label: 'Snow', color: '#3b82f6' };
    if (code >= 95) return { icon: CloudRain, label: 'Storm', color: '#8b5cf6' };
    return { icon: Sun, label: 'Clear', color: '#f59e0b' };
}

/**
 * Current weather for a stored location object (or a plain place name).
 *
 * Loading is derived from the absence of data/error rather than a `setLoading`
 * in the effect body, so switching locations does not trigger a synchronous
 * cascading render. Debounced 800ms to match the original widget, and guarded
 * against out-of-order responses when the location changes quickly.
 */
export function useWeather(location, { refreshMs = 10 * 60 * 1000 } = {}) {
    const [state, setState] = useState({ data: null, error: null });
    const [tick, setTick] = useState(0);

    // Keep the reading fresh while the dashboard stays open, and refresh on
    // tab focus. Re-running the fetch effect is cheapest way to do both.
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), refreshMs);
        const refresh = () => {
            if (!document.hidden) setTick((t) => t + 1);
        };
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            clearInterval(id);
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [refreshMs]);

    useEffect(() => {
        if (!location) return undefined;

        let cancelled = false;

        const run = async () => {
            try {
                let latitude;
                let longitude;
                let display;

                if (typeof location === 'object' && location.lat && location.lng) {
                    latitude = location.lat;
                    longitude = location.lng;
                    display = location.display || location.name;
                } else {
                    const geoRes = await fetch(
                        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
                            location
                        )}&count=1&language=en&format=json`
                    );
                    const geo = await geoRes.json();
                    if (!geo.results?.length) throw new Error('Location not found');
                    latitude = geo.results[0].latitude;
                    longitude = geo.results[0].longitude;
                    display = geo.results[0].admin1
                        ? `${geo.results[0].name}, ${geo.results[0].admin1}`
                        : geo.results[0].name;
                }

                const res = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
                );
                const json = await res.json();
                const details = weatherDetails(json.current.weather_code);

                if (!cancelled) {
                    setState({
                        error: null,
                        data: {
                            temp: Math.round(json.current.temperature_2m),
                            condition: details.label,
                            icon: details.icon,
                            iconColor: details.color,
                            location: display,
                            humidity: json.current.relative_humidity_2m,
                            wind: Math.round(json.current.wind_speed_10m),
                            high: Math.round(json.daily.temperature_2m_max[0]),
                            low: Math.round(json.daily.temperature_2m_min[0]),
                        },
                    });
                }
            } catch {
                if (!cancelled) setState({ data: null, error: 'Weather unavailable' });
            }
        };

        const timer = setTimeout(run, 800);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [location, tick]);

    return { data: state.data, error: state.error, loading: !state.data && !state.error };
}
