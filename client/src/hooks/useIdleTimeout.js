import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ACTIVITY_KEY,
    HEARTBEAT_MS,
    SESSION_IDLE_MS,
    SESSION_WARNING_MS,
    clearActivity,
    readActivity,
    recordActivity,
} from '../utils/session';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart', 'click', 'visibilitychange'];

/**
 * Tracks user activity and drives the idle-session flow.
 *
 * @param {object}   opts
 * @param {boolean}  opts.enabled      Only run while a user is signed in.
 * @param {Function} opts.onTimeout     Called once the idle window elapses.
 * @param {Function} [opts.onHeartbeat] Called (throttled) while the user is active,
 *                                      to keep the server-side session warm.
 */
export default function useIdleTimeout({ enabled, onTimeout, onHeartbeat }) {
    const [warning, setWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(0);

    const lastActivityRef = useRef(0);
    const lastHeartbeatRef = useRef(0);
    const warnedRef = useRef(false);
    const firedRef = useRef(false);

    const onTimeoutRef = useRef(onTimeout);
    const onHeartbeatRef = useRef(onHeartbeat);

    useEffect(() => {
        onTimeoutRef.current = onTimeout;
        onHeartbeatRef.current = onHeartbeat;
    }, [onTimeout, onHeartbeat]);

    const recordNow = useCallback(() => {
        const now = recordActivity();
        lastActivityRef.current = now;
        if (warnedRef.current) {
            warnedRef.current = false;
            setWarning(false);
        }
        // Keep the server session warm while the user is genuinely active.
        if (now - lastHeartbeatRef.current > HEARTBEAT_MS) {
            lastHeartbeatRef.current = now;
            try { onHeartbeatRef.current?.(); } catch { /* ignore */ }
        }
    }, []);

    // Seed from persisted activity so a refresh does not reset the idle clock.
    useEffect(() => {
        if (!enabled) return;
        const seed = readActivity() || Date.now();
        lastActivityRef.current = seed;
        lastHeartbeatRef.current = Date.now();
        warnedRef.current = false;
        firedRef.current = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when a session (re)starts
        setWarning(false);
    }, [enabled]);

    // Local activity listeners (scroll uses capture so nested scrollers count).
    useEffect(() => {
        if (!enabled) return;
        let lastWrite = 0;
        const handle = () => {
            const now = Date.now();
            lastActivityRef.current = now;
            if (warnedRef.current) {
                warnedRef.current = false;
                setWarning(false);
            }
            if (now - lastWrite > 1000) {
                lastWrite = now;
                recordActivity(now);
            }
            if (now - lastHeartbeatRef.current > HEARTBEAT_MS) {
                lastHeartbeatRef.current = now;
                try { onHeartbeatRef.current?.(); } catch { /* ignore */ }
            }
        };
        ACTIVITY_EVENTS.forEach((evt) => {
            const opts = evt === 'scroll' ? { capture: true, passive: true } : { passive: true };
            window.addEventListener(evt, handle, opts);
        });
        return () => {
            ACTIVITY_EVENTS.forEach((evt) => {
                window.removeEventListener(evt, handle, evt === 'scroll' ? { capture: true } : undefined);
            });
        };
    }, [enabled]);

    // Sync activity from other tabs.
    useEffect(() => {
        if (!enabled) return;
        const onStorage = (e) => {
            if (e.key !== ACTIVITY_KEY || !e.newValue) return;
            const ts = Number(e.newValue);
            if (Number.isFinite(ts) && ts > lastActivityRef.current) {
                lastActivityRef.current = ts;
                if (warnedRef.current) {
                    warnedRef.current = false;
                    setWarning(false);
                }
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [enabled]);

    // Evaluation loop.
    useEffect(() => {
        if (!enabled) return;
        const id = setInterval(() => {
            const now = Date.now();
            const remaining = SESSION_IDLE_MS - (now - lastActivityRef.current);

            if (remaining <= 0) {
                if (!firedRef.current) {
                    firedRef.current = true;
                    clearActivity();
                    try { onTimeoutRef.current?.(); } catch { /* ignore */ }
                }
                return;
            }

            if (remaining <= SESSION_WARNING_MS) {
                warnedRef.current = true;
                setWarning(true);
                setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
            } else if (warnedRef.current) {
                warnedRef.current = false;
                setWarning(false);
            }
        }, 1000);
        return () => clearInterval(id);
    }, [enabled]);

    return { warning, secondsLeft, stay: recordNow };
}
