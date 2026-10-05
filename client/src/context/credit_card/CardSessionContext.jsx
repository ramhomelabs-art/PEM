import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../personal_expense/AuthContext';
import { API_URL } from '../../config';

const STORAGE_KEY = 'cardSession';

const CardSessionContext = createContext();

export const useCardSession = () => {
    const context = useContext(CardSessionContext);
    if (!context) {
        throw new Error('useCardSession must be used within CardSessionProvider');
    }
    return context;
};

function readStoredSession() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.token || !parsed?.expiresAt) return null;
        if (parsed.expiresAt <= Date.now()) {
            sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return parsed;
    } catch {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

/**
 * Holds the short-lived credit-card session token issued after a step-up
 * password check. The token is kept in sessionStorage (per tab) and the
 * provider auto-locks the moment it expires or the user signs out.
 */
export const CardSessionProvider = ({ children }) => {
    const { user } = useAuth();
    const [session, setSession] = useState(readStoredSession);
    const [unlocked, setUnlocked] = useState(() => Boolean(readStoredSession()));
    const lockTimer = useRef(null);

    const lock = useCallback(() => {
        sessionStorage.removeItem(STORAGE_KEY);
        setSession(null);
        setUnlocked(false);
    }, []);

    // Auto-lock when the token expires.
    useEffect(() => {
        if (lockTimer.current) clearTimeout(lockTimer.current);
        if (!session) return undefined;

        const delay = Math.max(0, session.expiresAt - Date.now());
        lockTimer.current = setTimeout(lock, delay);
        return () => {
            if (lockTimer.current) clearTimeout(lockTimer.current);
        };
    }, [session, lock]);

    // Drop the card session whenever the main session ends.
    useEffect(() => {
        if (user) return undefined;
        const timeout = setTimeout(() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setSession(null);
            setUnlocked(false);
        }, 0);
        return () => clearTimeout(timeout);
    }, [user]);

    const unlock = useCallback(async (password) => {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/credit-cards/session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ password })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Incorrect password');
        }

        const data = await res.json();
        const next = {
            token: data.token,
            expiresAt: Date.now() + (data.expiresIn || 900) * 1000
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSession(next);
        setUnlocked(true);
        return next;
    }, []);

    // fetch() wrapper that attaches the main JWT and the card-session header.
    const authFetch = useCallback((path, options = {}) => {
        const token = localStorage.getItem('token');
        const headers = { ...(options.headers || {}) };
        if (token) headers.Authorization = `Bearer ${token}`;

        const cardToken = session?.token;
        if (cardToken) headers['x-card-session'] = cardToken;

        return fetch(`${API_URL}${path}`, { ...options, headers });
    }, [session]);

    const value = {
        unlocked,
        expiresAt: session?.expiresAt || null,
        unlock,
        lock,
        authFetch
    };

    return (
        <CardSessionContext.Provider value={value}>
            {children}
        </CardSessionContext.Provider>
    );
};
