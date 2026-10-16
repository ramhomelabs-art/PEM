// Idle-session configuration shared by the client timer.
// Keep these values in sync with the server's SESSION_IDLE_MINUTES.

const envIdle = Number(import.meta.env.VITE_SESSION_IDLE_MINUTES);
export const SESSION_IDLE_MS = (Number.isFinite(envIdle) && envIdle > 0 ? envIdle : 15) * 60 * 1000;

// How long before the deadline the warning modal appears (default 60s).
const envWarning = Number(import.meta.env.VITE_SESSION_WARNING_SECONDS);
export const SESSION_WARNING_MS = (Number.isFinite(envWarning) && envWarning > 0 ? envWarning : 60) * 1000;

// How often to ping the server so an actively-used session is not seen as idle.
export const HEARTBEAT_MS = 5 * 60 * 1000;

export const ACTIVITY_KEY = 'pem:lastActivity';
const LOGOUT_REASON_KEY = 'pem:logoutReason';

export function recordActivity(ts = Date.now()) {
    try { localStorage.setItem(ACTIVITY_KEY, String(ts)); } catch { /* ignore */ }
    return ts;
}

export function readActivity() {
    try {
        const v = Number(localStorage.getItem(ACTIVITY_KEY));
        return Number.isFinite(v) && v > 0 ? v : null;
    } catch { return null; }
}

export function clearActivity() {
    try { localStorage.removeItem(ACTIVITY_KEY); } catch { /* ignore */ }
}

// Persist why the previous session ended so the login screen can explain it.
// Uses sessionStorage so it applies to this tab only and clears on next login.
export function setLogoutReason(reason) {
    try { sessionStorage.setItem(LOGOUT_REASON_KEY, reason); } catch { /* ignore */ }
}

export function consumeLogoutReason() {
    try {
        const v = sessionStorage.getItem(LOGOUT_REASON_KEY);
        if (v) sessionStorage.removeItem(LOGOUT_REASON_KEY);
        return v;
    } catch { return null; }
}

// Read-only variant (does not clear) for use during initial render.
export function peekLogoutReason() {
    try { return sessionStorage.getItem(LOGOUT_REASON_KEY); } catch { return null; }
}
