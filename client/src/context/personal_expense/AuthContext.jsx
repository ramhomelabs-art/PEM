
import { createContext, useContext, useState, useEffect } from 'react';

import { API_URL } from '../../config';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const token = localStorage.getItem('token');
                const storedUser = localStorage.getItem('user');

                if (token) {
                    console.log("AuthContext: TOKEN FOUND, INITIALIZING...");

                    // Set optimistic user data ONLY for non-critical fields
                    if (storedUser && storedUser !== "undefined") {
                        try {
                            const parsed = JSON.parse(storedUser);
                            console.log("AuthContext: OPTIMISTIC USER SET (basic info only)", parsed.username);
                            // Set user with cached info, updating from server shortly
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
                        // Verify & Refresh from Server - ALWAYS use server data for critical fields
                        const res = await fetch(`${API_URL}/auth/me`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (res.ok) {
                            const freshData = await res.json();
                            console.log("AuthContext: FRESH DATA FROM SERVER", freshData.username, "currency:", freshData.currency);
                            setUser(freshData); // Always use fresh server data
                            localStorage.setItem('user', JSON.stringify(freshData));
                        } else if (res.status === 401 || res.status === 403) {
                            throw new Error("Token Invalid");
                        } else {
                            console.warn("Server validation failed but session preserved:", res.status);
                        }
                    } catch (error) {
                        if (error.message === "Token Invalid") {
                            console.error("Session expired:", error);
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            setUser(null);
                        } else {
                            console.error("Network error validating session (offline mode):", error);
                        }
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

    const login = (userData, token) => {
        console.log("AuthContext: LOGIN CALLED", userData.username);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const updateUser = (updatedData) => {
        const newUser = { ...user, ...updatedData };
        // Deep merge preferences if they exist in both
        if (user.preferences && updatedData.preferences) {
            newUser.preferences = { ...user.preferences, ...updatedData.preferences };
        }
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
