import { useCallback } from 'react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import useIdleTimeout from '../../hooks/useIdleTimeout';
import SessionTimeoutModal from './SessionTimeoutModal';
import { API_URL } from '../../config';

const SessionTimeoutManager = () => {
    const { user, logout } = useAuth();

    const handleTimeout = useCallback(() => {
        logout({ reason: 'idle', notifyServer: true });
    }, [logout]);

    // Ping the server so an actively-used session is not treated as idle server-side.
    const handleHeartbeat = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        fetch(`${API_URL}/auth/heartbeat`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
            keepalive: true,
        }).catch(() => { /* network hiccup - the idle timer still governs logout */ });
    }, []);

    const { warning, secondsLeft, stay } = useIdleTimeout({
        enabled: Boolean(user),
        onTimeout: handleTimeout,
        onHeartbeat: handleHeartbeat,
    });

    if (!user || !warning) return null;

    return (
        <SessionTimeoutModal
            secondsLeft={secondsLeft}
            onStay={stay}
            onLogout={handleTimeout}
        />
    );
};

export default SessionTimeoutManager;
