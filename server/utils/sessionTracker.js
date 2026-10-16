'use strict';

const crypto = require('crypto');

// Idle session window: how long a token may go unused before it is rejected.
// Configurable via SESSION_IDLE_MINUTES (default 15 minutes).
const IDLE_MINUTES = Math.max(1, Number.parseInt(process.env.SESSION_IDLE_MINUTES, 10) || 15);
const IDLE_MS = IDLE_MINUTES * 60 * 1000;

// tokenHash -> lastSeen (ms epoch). In-memory, per-process.
// Single-node deployment, so a process-local map is sufficient.
const activity = new Map();

// tokenHash -> expiry (ms epoch). Tokens that were explicitly logged out are
// recorded here so a stolen/old token cannot be re-admitted by the freshness
// fallback below. Cleared once the JWT's own expiry has passed.
const revoked = new Map();

function keyFor(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Mark the token as active. Returns true if it is still within its idle window,
 * false if it has been logged out or idle for too long. The token's own `iat`
 * (issue time) is used as the fallback anchor after a process restart cleared the map.
 */
function touch(token, issuedAtSeconds) {
    if (!token) return false;
    const now = Date.now();
    const key = keyFor(token);

    const revokeUntil = revoked.get(key);
    if (revokeUntil !== undefined) {
        if (now < revokeUntil) return false;
        revoked.delete(key);
    }

    const last = activity.get(key);

    if (last === undefined) {
        const issuedAt = issuedAtSeconds ? issuedAtSeconds * 1000 : now;
        if (now - issuedAt > IDLE_MS) return false;
        activity.set(key, now);
        return true;
    }

    if (now - last > IDLE_MS) {
        activity.delete(key);
        return false;
    }

    activity.set(key, now);
    return true;
}

/**
 * Drop a token from the tracker and blacklist it until its JWT expiry so it
 * cannot be resurrected. `expiresAtMs` should be the token's absolute expiry.
 */
function forget(token, expiresAtMs) {
    if (!token) return;
    const key = keyFor(token);
    activity.delete(key);
    revoked.set(key, expiresAtMs || Date.now() + IDLE_MS);
}

/** Evict stale entries so the maps cannot grow without bound. */
const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, last] of activity) {
        if (now - last > IDLE_MS) activity.delete(key);
    }
    for (const [key, until] of revoked) {
        if (now >= until) revoked.delete(key);
    }
}, Math.min(IDLE_MS, 5 * 60 * 1000));
if (sweeper.unref) sweeper.unref();

module.exports = { touch, forget, IDLE_MS, IDLE_MINUTES };
