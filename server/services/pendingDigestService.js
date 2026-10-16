// Pending-items email digest.
//
// Periodically emails each user a summary of everything still waiting for their
// attention: unreviewed Automation-inbox transactions (split into expenses and
// income) plus the same notifications the in-app bell shows (upcoming bills /
// EMIs / debts, exceeded budgets, unread messages and Alert rows awaiting
// action). A digest is only sent when the user has at least one pending item,
// has not opted out, and has not already received one within the configured
// interval.
//
// Preferences live at user.preferences.emailDigest = { enabled, lastSentAt }.
// `enabled` defaults to true so the feature works out of the box.

const { User } = require('../models');
const mailer = require('../utils/mailer');
const pendingStore = require('../utils/pendingStore');
const notificationsDigest = require('./notificationsDigestService');
const { isIncomeTransaction } = require('../utils/emailTemplates');

const ENABLED = process.env.PENDING_DIGEST_ENABLED !== 'false';
const RUN_ON_START = process.env.PENDING_DIGEST_RUN_ON_START === 'true';
const INTERVAL_MINUTES = Math.max(1, Number(process.env.PENDING_DIGEST_INTERVAL_MINUTES) || 1440);
const MAX_ITEMS = 40;

function appUrl() {
    const base = process.env.CLIENT_URL || process.env.SERVER_URL || '';
    if (!base) return '';
    return `${base.replace(/\/$/, '')}/automation`;
}

function unsubscribeAddress() {
    try {
        return mailer.getStatus().user || '';
    } catch (e) {
        return '';
    }
}

/** Resolve the effective digest preference for a user (default: enabled). */
function getDigestPreference(user) {
    const p = (user && user.preferences && user.preferences.emailDigest) || {};
    return {
        enabled: p.enabled !== false,
        lastSentAt: p.lastSentAt || null
    };
}

/**
 * Gather the user's pending transactions + notifications for the digest.
 *
 * Transactions are strictly the user's own (never other users' data — an email
 * must not leak someone else's transactions). Notifications mirror the app's
 * NotificationCenter: derived obligations (bills / EMIs / debt / budgets /
 * unread messages) PLUS any Alert rows awaiting action.
 */
async function buildDigest(user) {
    const pending = pendingStore.getPendingSMS();
    const transactions = pendingStore.filterPendingOwnedBy(pending, user.id).slice(0, MAX_ITEMS);
    const notifications = await notificationsDigest.buildNotifications(user);

    const expenses = transactions.filter((t) => !isIncomeTransaction(t));
    const income = transactions.filter(isIncomeTransaction);
    const sum = (arr) => arr.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const summary = {
        expenseCount: expenses.length,
        incomeCount: income.length,
        expenseTotal: sum(expenses),
        incomeTotal: sum(income),
        notificationCount: notifications.length
    };

    return { transactions, expenses, income, notifications, summary };
}

/**
 * Build + send a digest for one user.
 * @returns {object} result describing what happened.
 */
async function sendDigestForUser(user, { force = false } = {}) {
    const pref = getDigestPreference(user);

    if (!pref.enabled && !force) return { sent: false, skipped: 'disabled' };
    if (!user.email) return { sent: false, skipped: 'no-email' };
    if (!mailer.isConfigured()) return { sent: false, skipped: 'smtp-not-configured' };

    // Throttle scheduled sends so a restart (run-on-start) or a slow interval
    // can never double-send. Manual (force) sends always go through.
    if (!force && pref.lastSentAt) {
        const elapsedMs = Date.now() - new Date(pref.lastSentAt).getTime();
        if (elapsedMs < INTERVAL_MINUTES * 60 * 1000 * 0.9) {
            return { sent: false, skipped: 'throttled' };
        }
    }

    const { transactions, expenses, income, notifications, summary } = await buildDigest(user);
    const total = transactions.length + notifications.length;
    if (total === 0 && !force) return { sent: false, skipped: 'nothing-pending' };

    const result = await mailer.sendPendingDigest({
        to: user.email,
        user,
        transactions,
        expenses,
        income,
        notifications,
        summary,
        appUrl: appUrl(),
        unsubscribeTo: unsubscribeAddress()
    });

    // Record the attempt so the throttle applies regardless of transport state.
    try {
        const prefs = { ...(user.preferences || {}) };
        prefs.emailDigest = { ...(prefs.emailDigest || {}), lastSentAt: new Date().toISOString() };
        await user.update({ preferences: prefs });
    } catch (e) {
        console.error('[PendingDigest] Failed to persist lastSentAt:', e.message);
    }

    return {
        sent: true,
        transactions: transactions.length,
        notifications: notifications.length,
        summary,
        delivered: result.delivered,
        reason: result.reason || null
    };
}

/** One scheduler pass over every active user. */
async function runDigestCycle() {
    if (!mailer.isConfigured()) {
        console.log('[PendingDigest] Skipped run (SMTP not configured)');
        return { users: 0, sent: 0, skipped: 0, failed: 0 };
    }

    const users = await User.findAll({
        where: { status: 'active' },
        attributes: ['id', 'username', 'email', 'role', 'preferences', 'currency', 'fullName']
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
        try {
            const r = await sendDigestForUser(user);
            if (r.sent) sent += 1;
            else skipped += 1;
        } catch (err) {
            failed += 1;
            console.error(`[PendingDigest] User ${user.id} failed:`, err.message);
        }
    }

    console.log(`[PendingDigest] Cycle complete: users=${users.length} sent=${sent} skipped=${skipped} failed=${failed}`);
    return { users: users.length, sent, skipped, failed };
}

// --- Scheduler -------------------------------------------------------------
// Dependency-free interval scheduler with a simple overlap guard (mirrors the
// investments price-sync scheduler). The timer is unref()'d so it never holds
// the process open on its own.

let timer = null;
let busy = false;
let lastRunAt = null;

function startPendingDigestScheduler() {
    if (!ENABLED) {
        console.log('[PendingDigest] Scheduler disabled (PENDING_DIGEST_ENABLED=false)');
        return null;
    }
    if (timer) return timer;

    const intervalMs = INTERVAL_MINUTES * 60 * 1000;

    const tick = async () => {
        if (busy) {
            console.log(`[PendingDigest] Skipped tick (previous run in flight, lastRun=${lastRunAt ? lastRunAt.toISOString() : 'never'})`);
            return;
        }
        busy = true;
        try {
            await runDigestCycle();
            lastRunAt = new Date();
        } catch (err) {
            console.error('[PendingDigest] Cycle error:', err.message);
        } finally {
            busy = false;
        }
    };

    if (RUN_ON_START) {
        setTimeout(() => { tick().catch(() => {}); }, 8000).unref?.();
    }

    timer = setInterval(tick, intervalMs);
    timer.unref?.();
    console.log(`[PendingDigest] Scheduler started (interval=${intervalMs / 1000}s, runOnStart=${RUN_ON_START})`);
    return timer;
}

function stopPendingDigestScheduler() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

module.exports = {
    getDigestPreference,
    buildDigest,
    sendDigestForUser,
    runDigestCycle,
    startPendingDigestScheduler,
    stopPendingDigestScheduler,
    INTERVAL_MINUTES
};
