
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { API_URL } from '../../config';
import { clearActivity, consumeLogoutReason, recordActivity, setLogoutReason } from '../../utils/session';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Central logout. `reason` powers the message shown on the login screen;
    // `notifyServer` invalidates the token server-side (covers idle + manual logout).
    const logout = useCallback((options = {}) => {
        const { reason = 'manual', notifyServer = true } = options;
        const token = localStorage.getItem('token');

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        clearActivity();

        if (reason === 'idle' || reason === 'expired') {
            setLogoutReason(reason);
        }

        setUser(null);

        if (notifyServer && token) {
            fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                keepalive: true,
            }).catch(() => { /* best-effort */ });
        }
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const token = localStorage.getItem('token');
                const storedUser = localStorage.getItem('user');

                if (token) {
                    // Set optimistic user data ONLY for non-critical fields
                    if (storedUser && storedUser !== "undefined") {
                        try {
                            const parsed = JSON.parse(storedUser);
                            setUser({
                                ...parsed,
                                currency: parsed.currency || 'INR',
                                country: parsed.country || 'India',
                                timezone: parsed.timezone || 'IST (UTC+5:30)'
                            });
                        } catch (e) {
                            console.error("Error parsing stored user:", e);
                            localStorage.removeItem('user');
                        }
                    }

                    try {
                        const res = await fetch(`${API_URL}/auth/me`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (res.ok) {
                            const freshData = await res.json();
                            setUser(freshData);
                            localStorage.setItem('user', JSON.stringify(freshData));
                            recordActivity();
                        } else if (res.status === 401 || res.status === 403) {
                            // Expired signature or idle-timeout: require a fresh login.
                            setLogoutReason('expired');
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            clearActivity();
                            setUser(null);
                        } else {
                            console.warn("Server validation failed but session preserved:", res.status);
                        }
                    } catch (error) {
                        console.error("Network error validating session (offline mode):", error);
                    }
                }
            } catch (err) {
                console.error("Auth initialization failed:", err);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    // Keep tabs consistent: if the token is cleared in another tab, sign out here too.
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === 'token' && !e.newValue) {
                clearActivity();
                setUser(null);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Global signal emitted when the server rejects a session as idle/expired.
    useEffect(() => {
        const onExpired = () => logout({ reason: 'expired', notifyServer: false });
        window.addEventListener('pem:session-expired', onExpired);
        return () => window.removeEventListener('pem:session-expired', onExpired);
    }, [logout]);

    const login = useCallback((userData, token) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        consumeLogoutReason(); // discard any stale sign-out banner
        recordActivity();
        setUser(userData);
    }, []);

    const updateUser = useCallback((updatedData) => {
        setUser((prev) => {
            const newUser = { ...prev, ...updatedData };
            if (prev?.preferences && updatedData?.preferences) {
                newUser.preferences = { ...prev.preferences, ...updatedData.preferences };
            }
            localStorage.setItem('user', JSON.stringify(newUser));
            return newUser;
        });
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
