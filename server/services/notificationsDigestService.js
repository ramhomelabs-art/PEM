// Server-side mirror of the in-app NotificationCenter.
//
// The bell / NotificationCenter in the client is DERIVED from obligations
// (bills, loan EMIs, debts), exceeded budgets, unread messages and notes — it
// never reads the Alert table. The email digest must show the same things, so
// this service reconstructs that list on the server from the same models.
//
// Each item is normalised to { type, severity, title, body, weight, sortDate }
// which is exactly what the digest template renders.
//
// NOTE: smart-note reminders live only in the browser (localStorage) and so
// cannot be included in a server-rendered email.

const { Op } = require('sequelize');
const { Alert, Bill, Loan, Borrow, Budget, Message, Transaction } = require('../models');
const { formatAmount, formatDate } = require('../utils/emailTemplates');

const HORIZON_DAYS = 30;
const SOON_DAYS = 3;
const MAX_NOTIFICATIONS = 40;

// Alerts awaiting action. Users flip these to "notified" as soon as a push is
// delivered, so both statuses must be included.
const ACTIVE_ALERT_STATUSES = ['pending', 'notified'];

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function daysUntil(date) {
    const ms = new Date(date).getTime() - Date.now();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function dueSeverity(due, now) {
    if (new Date(due) < now) return 'critical';
    return daysUntil(due) <= SOON_DAYS ? 'warning' : 'info';
}

/**
 * Build the notification list for a single user, mirroring the app bell.
 * @returns {Promise<Array>} normalised notification objects.
 */
async function buildNotifications(user) {
    const uid = user.id;
    const currency = user.currency || 'INR';
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + HORIZON_DAYS);

    const items = [];

    // 1) Alert rows (anomalies, tests) awaiting action.
    try {
        const alerts = await Alert.findAll({
            where: { userId: uid, status: ACTIVE_ALERT_STATUSES },
            order: [['createdAt', 'DESC']],
            limit: MAX_NOTIFICATIONS
        });
        for (const a of alerts) {
            items.push({
                type: a.type || 'ALERT',
                severity: a.severity || 'info',
                title: a.title || 'Notification',
                body: a.body || '',
                weight: 0,
                sortDate: a.createdAt || now
            });
        }
    } catch (e) {
        console.error('[notificationsDigest] Alert query failed:', e.message);
    }

    // 2) Bills due within the reminder window and not yet paid.
    try {
        const bills = await Bill.findAll({ where: { userId: uid, status: { [Op.ne]: 'paid' } } });
        for (const b of bills) {
            if (!b.dueDate) continue;
            const due = new Date(b.dueDate);
            if (due > horizon) continue;
            const overdue = due < now;
            items.push({
                type: 'BILL',
                severity: dueSeverity(b.dueDate, now),
                title: `${b.name || 'Bill'} due${overdue ? ' (overdue)' : ''}`,
                body: `${formatAmount(b.amount, currency)} due ${formatDate(b.dueDate)}`,
                weight: 1,
                sortDate: b.dueDate
            });
        }
    } catch (e) {
        console.error('[notificationsDigest] Bill query failed:', e.message);
    }

    // 3) Active loan EMIs due within the reminder window.
    try {
        const loans = await Loan.findAll({ where: { userId: uid, status: 'active' } });
        for (const l of loans) {
            if (!l.nextEmiDate) continue;
            const due = new Date(l.nextEmiDate);
            if (due > horizon) continue;
            const overdue = due < now;
            items.push({
                type: 'EMI',
                severity: dueSeverity(l.nextEmiDate, now),
                title: `${l.name || 'Loan'} EMI${overdue ? ' (overdue)' : ''}`,
                body: `${formatAmount(l.emiAmount, currency)} due ${formatDate(l.nextEmiDate)}`,
                weight: 1,
                sortDate: l.nextEmiDate
            });
        }
    } catch (e) {
        console.error('[notificationsDigest] Loan query failed:', e.message);
    }

    // 4) Outstanding debts (borrow / lend) with a due date in the window.
    try {
        const borrows = await Borrow.findAll({ where: { userId: uid, status: { [Op.ne]: 'settled' } } });
        for (const b of borrows) {
            if (!b.dueDate) continue;
            const due = new Date(b.dueDate);
            if (due > horizon) continue;
            const person = b.personName || 'Contact';
            const total = toNumber(b.amount);
            const paid = toNumber(b.amountPaid);
            const remaining = total - paid > 0 ? total - paid : total;
            const overdue = due < now;
            items.push({
                type: 'BORROW',
                severity: dueSeverity(b.dueDate, now),
                title: b.type === 'lend' ? `Collect from ${person}` : `Debt settling: ${person}`,
                body: `${formatAmount(remaining, currency)} due ${formatDate(b.dueDate)}${overdue ? ' (overdue)' : ''}`,
                weight: 1,
                sortDate: b.dueDate
            });
        }
    } catch (e) {
        console.error('[notificationsDigest] Borrow query failed:', e.message);
    }

    // 5) Budgets exceeded in the current calendar month.
    try {
        const budgets = await Budget.findAll({ where: { userId: uid } });
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        for (const bd of budgets) {
            const limit = toNumber(bd.amountLimit);
            if (limit <= 0) continue;
            const spent = toNumber(await Transaction.sum('amount', {
                where: {
                    userId: uid,
                    category: bd.category,
                    type: 'expense',
                    date: { [Op.gte]: monthStart, [Op.lt]: monthEnd }
                }
            }));
            if (spent > limit) {
                items.push({
                    type: 'BUDGET',
                    severity: 'warning',
                    title: `Budget exceeded: ${bd.category}`,
                    body: `${formatAmount(spent, currency)} spent of ${formatAmount(limit, currency)}`,
                    weight: 2,
                    sortDate: now
                });
            }
        }
    } catch (e) {
        console.error('[notificationsDigest] Budget query failed:', e.message);
    }

    // 6) Unread messages (single summary item).
    try {
        const unread = await Message.count({ where: { receiver_id: uid, read_status: false } });
        if (unread > 0) {
            items.push({
                type: 'MESSAGE',
                severity: 'info',
                title: 'Unread messages',
                body: `${unread} unread message${unread === 1 ? '' : 's'} waiting`,
                weight: 3,
                sortDate: now
            });
        }
    } catch (e) {
        console.error('[notificationsDigest] Message query failed:', e.message);
    }

    items.sort((a, b) => {
        if (a.weight !== b.weight) return a.weight - b.weight;
        return new Date(a.sortDate) - new Date(b.sortDate);
    });

    return items.slice(0, MAX_NOTIFICATIONS);
}

module.exports = { buildNotifications, ACTIVE_ALERT_STATUSES };
