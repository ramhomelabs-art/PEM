'use strict';

// Shared failed-login / account-lockout guard so EVERY password-checking login
// path (web, MFA, mobile) applies the same brute-force brake.

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

/** True when the account is currently locked out. */
function isLocked(user) {
    return Boolean(user && user.lockoutUntil && new Date(user.lockoutUntil).getTime() > Date.now());
}

/**
 * Record a failed password attempt. Locks the account once the threshold is hit.
 * @returns {Promise<{attempts:number, locked:boolean}>}
 */
async function registerFailure(user) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const lockoutUntil = attempts >= LOCKOUT_THRESHOLD
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null;
    await user.update({ failedLoginAttempts: attempts, lockoutUntil });
    return { attempts, locked: Boolean(lockoutUntil) };
}

/** Clear any failed-attempt / lockout state after a successful password check. */
async function clearFailures(user) {
    if (user.failedLoginAttempts || user.lockoutUntil) {
        await user.update({ failedLoginAttempts: 0, lockoutUntil: null });
    }
}

module.exports = {
    isLocked,
    registerFailure,
    clearFailures,
    LOCKOUT_THRESHOLD,
    LOCKOUT_MINUTES
};
