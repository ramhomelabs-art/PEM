import { useState, useEffect } from 'react';
import { X, Search, MapPin, Loader2, LocateFixed } from 'lucide-react';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

const WeatherLocationModal = ({ isOpen, onClose, onSelectLocation, currentLocation }) => {
    const { theme } = useTheme();
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null); // Temporary selection
    const [locating, setLocating] = useState(false);

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                let name = 'Current location';
                let display = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
                try {
                    const res = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );
                    const j = await res.json();
                    name = j.city || j.locality || j.principalSubdivision || j.countryName || name;
                    display =
                        [j.city || j.locality, j.principalSubdivision, j.countryName]
                            .filter(Boolean)
                            .join(', ') || display;
                } catch {
                    // Keep coordinate fallback.
                }
                setSelectedLocation({ name, lat: latitude, lng: longitude, display });
                setLocating(false);
            },
            () => setLocating(false),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
        );
    };

    // Debounce Search
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (!query || query.length < 3) {
                setSuggestions([]);
                return;
            }

            setLoading(true);
            try {
                const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
                const data = await res.json();
                if (data.results) {
                    setSuggestions(data.results);
                } else {
                    setSuggestions([]);
                }
            } catch (err) {
                console.error("Geo fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchSuggestions, 500);
        return () => clearTimeout(timeoutId);
    }, [query]);

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSuggestions([]);
            setSelectedLocation(null); // Reset selection
        }
    }, [isOpen]);

    const handleSave = () => {
        if (selectedLocation) {
            onSelectLocation(selectedLocation);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }} onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '24px',
                    padding: '30px',
                    width: '90%',
                    maxWidth: '500px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h3 style={{ color: theme.text, margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Select Location</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Search Input */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: theme.inputBg,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '16px',
                        padding: '15px',
                        gap: '10px'
                    }}>
                        <Search size={20} color={theme.textSecondary} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search city..."
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                color: theme.text,
                                fontSize: '16px',
                                outline: 'none'
                            }}
                            autoFocus
                        />
                        {loading && <Loader2 size={20} className="animate-spin" color={theme.accent} />}
                    </div>

                    {/* Use browser location */}
                    <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={locating}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            padding: '13px',
                            backgroundColor: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: '16px',
                            color: theme.accent,
                            fontWeight: 'bold',
                            fontSize: '14px',
                            cursor: locating ? 'wait' : 'pointer'
                        }}
                    >
                        {locating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
                        {locating ? 'Locating…' : 'Use my current location'}
                    </button>

                    {/* Suggestions List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                        {suggestions.length > 0 ? (
                            suggestions.map((place) => {
                                const locationData = {
                                    name: place.name,
                                    lat: place.latitude,
                                    lng: place.longitude,
                                    display: `${place.name}, ${place.admin1 ? place.admin1 + ', ' : ''}${place.country}`
                                };
                                const isSelected = selectedLocation?.name === place.name && selectedLocation?.lat === place.latitude;

                                return (
                                    <button
                                        key={place.id}
                                        onClick={() => setSelectedLocation(locationData)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '15px',
                                            padding: '15px',
                                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                                            border: isSelected ? '2px solid #3b82f6' : 'none',
                                            borderRadius: '16px',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            color: theme.text,
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                                        onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                                    >
                                        <div style={{ padding: '10px', backgroundColor: isSelected ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.1)', borderRadius: '12px', color: '#3b82f6' }}>
                                            <MapPin size={20} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{place.name}</div>
                                            <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                                                {place.admin1 ? `${place.admin1}, ` : ''}{place.country}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        ) : query.length > 2 && !loading ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: theme.textSecondary }}>
                                No locations found.
                            </div>
                        ) : null}

                        {/* Current Selection Display (if no search) */}
                        {!query && (
                            <div style={{ padding: '15px', borderTop: `1px solid ${theme.border}`, marginTop: '10px' }}>
                                <span style={{ fontSize: '12px', color: theme.textSecondary, fontWeight: 'bold' }}>CURRENT LOCATION</span>
                                <div style={{ fontSize: '16px', color: theme.accent, marginTop: '5px', fontWeight: 'bold' }}>
                                    {currentLocation}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={!selectedLocation}
                        style={{
                            width: '100%',
                            padding: '15px',
                            backgroundColor: selectedLocation ? '#10b981' : theme.border,
                            color: selectedLocation ? 'white' : theme.textSecondary,
                            border: 'none',
                            borderRadius: '16px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: selectedLocation ? 'pointer' : 'not-allowed',
                            marginTop: '10px',
                            transition: 'all 0.2s',
                            opacity: selectedLocation ? 1 : 0.5
                        }}
                    >
                        {selectedLocation ? `Save Location: ${selectedLocation.name}` : 'Select a location to save'}
                    </button>
                </div>
            </motion.div>
            <style>{`.animate-spin { animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default WeatherLocationModal;
