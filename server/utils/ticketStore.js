'use strict';

const crypto = require('crypto');

// In-memory registry of consumed one-time ticket IDs (jti -> expiry ms epoch).
// Single-node deployment (same assumption as sessionTracker), so a process-local
// map is sufficient. Prevents a reset ticket from being replayed after use.
const consumed = new Map();

function newTicketId() {
    return crypto.randomUUID();
}

/** Returns true if the jti was already consumed (i.e. the ticket is spent). */
function isConsumed(jti) {
    if (!jti) return true;
    const until = consumed.get(jti);
    if (until === undefined) return false;
    if (Date.now() >= until) {
        consumed.delete(jti);
        return false;
    }
    return true;
}

/** Mark a jti as consumed until the given expiry (ms epoch). */
function consume(jti, expiresAtMs) {
    if (!jti) return;
    consumed.set(jti, expiresAtMs || Date.now() + 15 * 60 * 1000);
}

const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [jti, until] of consumed) {
        if (now >= until) consumed.delete(jti);
    }
}, 5 * 60 * 1000);
if (sweeper.unref) sweeper.unref();

module.exports = { newTicketId, isConsumed, consume };
