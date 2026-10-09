const { Alert } = require('../models');
const pushService = require('./pushService');

const DEFAULT_ACTIONS = ['acknowledge', 'dismiss'];

/**
 * Create an Alert record and best-effort deliver it as an interactive push.
 * Push failure is non-fatal: the app's polling worker will still surface it.
 */
async function createAndPush({
    userId,
    type = 'SYSTEM',
    severity = 'info',
    title,
    body = null,
    category = null,
    amount = null,
    referenceId = null,
    actions = DEFAULT_ACTIONS,
    metadata = null,
    push = true
} = {}) {
    if (!userId) throw new Error('alertService.createAndPush requires userId');
    if (!title) throw new Error('alertService.createAndPush requires title');

    const alert = await Alert.create({
        userId,
        type,
        severity,
        title,
        body,
        category,
        amount,
        referenceId,
        actions: actions || DEFAULT_ACTIONS,
        metadata,
        status: 'pending'
    });

    let delivery = { sent: 0, failed: 0, reason: 'push-disabled' };
    if (push) {
        try {
            delivery = await pushService.sendToUser(userId, {
                title,
                body: body || title,
                data: {
                    type: 'ALERT',
                    alertType: type,
                    alertId: alert.id,
                    severity,
                    actions: JSON.stringify(actions || DEFAULT_ACTIONS),
                    referenceId: referenceId || ''
                }
            });
            if (delivery.sent > 0) {
                await alert.update({ status: 'notified' });
            }
        } catch (err) {
            console.error('[alertService] push delivery error:', err.message);
        }
    }

    return { alert, delivery };
}

async function takeAction(userId, alertId, action) {
    const alert = await Alert.findOne({ where: { id: alertId, userId } });
    if (!alert) return null;

    let status = alert.status;
    if (action === 'acknowledge') status = 'acknowledged';
    else if (action === 'dismiss') status = 'dismissed';

    await alert.update({ status, actionTaken: action || null });
    return alert;
}

module.exports = { createAndPush, takeAction, DEFAULT_ACTIONS };
