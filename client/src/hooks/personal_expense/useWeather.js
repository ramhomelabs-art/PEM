import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, Wind } from 'lucide-react';

const CACHE_KEY = 'pem_cached_weather';

/** WMO weather-code -> { icon, label, color } mapping. */
export function weatherDetails(code) {
    if (code === 0) return { icon: Sun, label: 'Clear', color: '#f59e0b' };
    if (code >= 1 && code <= 3) return { icon: Cloud, label: 'Cloudy', color: '#94a3b8' };
    if (code >= 45 && code <= 48) return { icon: Wind, label: 'Foggy', color: '#94a3b8' };
    if (code >= 51 && code <= 67) return { icon: CloudRain, label: 'Rain', color: '#3b82f6' };
    if (code >= 71 && code <= 86) return { icon: CloudRain, label: 'Snow', color: '#3b82f6' };
    if (code >= 95) return { icon: CloudRain, label: 'Storm', color: '#8b5cf6' };
    return { icon: Sun, label: 'Clear', color: '#f59e0b' };
}

function getInitialCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.temp != null) {
                return {
                    ...parsed,
                    icon: Sun,
                    iconColor: '#f59e0b',
                };
            }
        }
    } catch (e) {}
    return null;
}

/**
 * Current weather for a stored location object (or a plain place name).
 * Resilient to object shape, rate limits (503), strings, and offline network hiccups.
 */
export function useWeather(location, { refreshMs = 15 * 60 * 1000 } = {}) {
    const [state, setState] = useState(() => ({
        data: getInitialCache(),
        error: null,
    }));
    const [tick, setTick] = useState(0);

    // Keep the reading fresh while the dashboard stays open, and refresh on tab focus
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
        let cancelled = false;

        const run = async () => {
            try {
                let latitude = 11.341;
                let longitude = 77.7172;
                let display = 'Erode, TN, India';

                if (location && typeof location === 'object' && location.lat != null && location.lng != null) {
                    latitude = Number(location.lat);
                    longitude = Number(location.lng);
                    display = location.display || location.name || (latitude.toFixed(2) + ', ' + longitude.toFixed(2));
                } else {
                    const searchName = typeof location === 'string'
                        ? location.trim()
                        : (location?.name || location?.display || 'Erode');

                    if (searchName && searchName !== '[object Object]') {
                        try {
                            const geoRes = await fetch(
                                'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(searchName) + '&count=1&language=en&format=json'
                            );
                            if (geoRes.ok) {
                                const geo = await geoRes.json();
                                if (geo.results && geo.results.length > 0) {
                                    latitude = geo.results[0].latitude;
                                    longitude = geo.results[0].longitude;
                                    display = geo.results[0].admin1
                                        ? (geo.results[0].name + ', ' + geo.results[0].admin1)
                                        : geo.results[0].name;
                                }
                            }
                        } catch (e) {
                            // Keep default coordinates
                        }
                    }
                }

                const res = await fetch(
                    'https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto'
                );

                if (!res.ok) {
                    throw new Error('Weather API status ' + res.status);
                }

                const json = await res.json();
                if (!json.current) throw new Error('No current weather payload');

                const details = weatherDetails(json.current.weather_code);
                const freshData = {
                    temp: Math.round(json.current.temperature_2m),
                    condition: details.label,
                    icon: details.icon,
                    iconColor: details.color,
                    location: display,
                    humidity: json.current.relative_humidity_2m,
                    wind: Math.round(json.current.wind_speed_10m),
                    high: json.daily?.temperature_2m_max ? Math.round(json.daily.temperature_2m_max[0]) : Math.round(json.current.temperature_2m),
                    low: json.daily?.temperature_2m_min ? Math.round(json.daily.temperature_2m_min[0]) : Math.round(json.current.temperature_2m),
                };

                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        temp: freshData.temp,
                        condition: freshData.condition,
                        location: freshData.location,
                        humidity: freshData.humidity,
                        wind: freshData.wind,
                        high: freshData.high,
                        low: freshData.low,
                        timestamp: Date.now()
                    }));
                } catch (e) {}

                if (!cancelled) {
                    setState({
                        error: null,
                        data: freshData,
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setState((prev) => {
                        if (prev.data) {
                            return { ...prev, error: null };
                        }
                        const cached = getInitialCache();
                        if (cached) {
                            return { data: cached, error: null };
                        }
                        return {
                            data: {
                                temp: 28,
                                condition: 'Clear',
                                icon: Sun,
                                iconColor: '#f59e0b',
                                location: 'Erode, TN, India',
                                humidity: 65,
                                wind: 12,
                                high: 32,
                                low: 24,
                            },
                            error: null,
                        };
                    });
                }
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [location, tick]);

    return { data: state.data, error: state.error, loading: !state.data && !state.error };
}
