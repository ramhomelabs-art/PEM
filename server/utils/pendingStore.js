// Shared store for the "Automation Inbox" pending transactions.
//
// Pending SMS / manual / OCR entries are persisted to a small JSON file that is
// written by the ingestion webhook (routes/personal_expense/sms.js) and the
// manual-entry route (routes/personal_expense/bills.js). Centralising the read
// + write + per-user filtering here keeps the Automation inbox, the digest
// service and both routes in lock-step.

const fs = require('fs');
const path = require('path');

// Historically this file lived at server/routes/data/pending_sms.json — keep
// the exact location so existing installs keep their queued items.
const DATA_DIR = path.join(__dirname, '../routes/data');
const PENDING_FILE = path.join(DATA_DIR, 'pending_sms.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(PENDING_FILE)) {
    fs.writeFileSync(PENDING_FILE, '[]');
}

function getPendingSMS() {
    if (!fs.existsSync(PENDING_FILE)) return [];
    try {
        const parsed = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function savePendingSMS(data) {
    try {
        fs.writeFileSync(PENDING_FILE, JSON.stringify(data || [], null, 2));
    } catch (err) {
        console.error('[PendingSMS] Save error:', err.message);
    }
}

// Credit-card transactions belong on the Credit Card page, never in the
// Personal Expense Automation inbox.
function isCreditCardItem(p) {
    if (!p) return false;
    return (
        p.isCreditCard === true ||
        p.paymentMethod === 'Credit Card' ||
        p.mode === 'CREDIT_CARD' ||
        /\b(credit\s*card|creditcard)\b/i.test(p.raw_message || p.description || '') ||
        /\bcard\s+(?:ending|x{2,}|\*{2,})\b/i.test(p.raw_message || p.description || '') ||
        /\b(spent\s+on\s+.*card|used\s+at\s+.*limit)\b/i.test(p.raw_message || p.description || '')
    );
}

// Mirror of the GET /api/sms/pending visibility rule.
// - credit-card items are always excluded
// - admins see every user's items
// - regular users see their own items (plus legacy ownerless items for user 1)
function filterPendingForUser(pending, userId, role) {
    const isAdmin = role === 'admin' || role === 'administrator';
    return (pending || []).filter((p) => {
        if (isCreditCardItem(p)) return false;
        if (isAdmin) return true;
        return String(p.userId) === String(userId) || (!p.userId && String(userId) === '1');
    });
}

// Own-items-only variant used for the per-user email digest. Unlike the admin
// inbox view this never returns other users' items — an email must never leak
// someone else's transactions.
function filterPendingOwnedBy(pending, userId) {
    return (pending || []).filter((p) => {
        if (isCreditCardItem(p)) return false;
        return String(p.userId) === String(userId) || (!p.userId && String(userId) === '1');
    });
}

module.exports = {
    PENDING_FILE,
    DATA_DIR,
    getPendingSMS,
    savePendingSMS,
    isCreditCardItem,
    filterPendingForUser,
    filterPendingOwnedBy
};
