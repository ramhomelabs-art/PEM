const express = require('express');
const { Op } = require('sequelize');
const { authenticateToken } = require('../../middleware/auth');
const { Transaction, Bill } = require('../../models');

const router = express.Router();
router.use(authenticateToken);

function amountsMatch(a, b) {
    const av = Math.abs(Number(a) || 0);
    const bv = Math.abs(Number(b) || 0);
    const tolerance = Math.max(1, Math.max(av, bv) * 0.02);
    return Math.abs(av - bv) <= tolerance;
}

function publicBill(b) {
    return {
        id: b.id,
        name: b.name,
        amount: b.amount,
        category: b.category,
        status: b.status,
        dueDate: b.dueDate,
        provider: b.provider || null
    };
}

function publicTxn(t) {
    return {
        id: t.id,
        amount: t.amount,
        category: t.category,
        description: t.description,
        date: t.date,
        paymentMode: b_ = b => b.otherPaymentMode || b.paymentMode,
        source: t.source,
        billId: b.billId || null
    };
}

/**
 * GET /api/reconciliation?days=90
 * Suggests links between paid/unpaid bills and expense transactions, and
 * reports items that could not be reconciled.
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const days = Math.min(Math.max(parseInt(req.query.days, 10) || 90, 7), 365);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [transactions, bills] = await Promise.all([
            Transaction.findAll({
                where: { userId, type: 'expense', date: { [Op.gte]: since } },
                order: [['date', 'DESC']],
                limit: 500
            }),
            Bill.findAll({ where: { userId }, order: [['dueDate', 'DESC']], limit: 500 })
        ]);

        const txns = transactions.map((t) => t.toJSON());
        const billList = bills.map((b) => b.toJSON());

        const usedTxnIds = new Set();
        const matched = [];
        const unmatchedBills = [];

        for (const bill of billList) {
            if (bill.status === 'paid') continue;
            const due = new Date(bill.dueDate).getTime();
            let best = null;
            let bestDelta = Infinity;

            for (const t of txns) {
                if (usedTxnIds.has(t.id)) continue;
                if (t.billId) continue;
                if (!amountsMatch(t.amount, bill.amount)) continue;
                const delta = Math.abs(new Date(t.date).getTime() - due) / 86400000;
                if (delta > 45) continue;
                if (delta < bestDelta) {
                    bestDelta = delta;
                    best = t;
                }
            }

            if (best) {
                usedTxnIds.add(best.id);
                const dayDelta = Math.round(bestDelta);
                matched.push({
                    bill: publicBill(bill),
                    transaction: {
                        id: best.id,
                        amount: best.amount,
                        category: best.category,
                        description: best.description,
                        date: best.date,
                        paymentMode: best.paymentMode,
                        source: best.source
                    },
                    dayDelta,
                    confidence: bestDelta <= 5 ? 'high' : bestDelta <= 20 ? 'medium' : 'low'
                });
            } else {
                unmatchedBills.push(publicBill(bill));
            }
        }

        const unmatchedTransactions = txns
            .filter((t) => !usedTxnIds.has(t.id) && !t.billId)
            .map((t) => ({
                id: t.id,
                amount: t.amount,
                category: t.category,
                description: t.description,
                date: t.date,
                paymentMode: t.paymentMode,
                source: t.source
            }));

        res.json({
            windowDays: days,
            summary: {
                transactions: txns.length,
                bills: billList.length,
                matched: matched.length,
                unmatchedBills: unmatchedBills.length,
                unmatchedTransactions: unmatchedTransactions.length
            },
            matched,
            unmatchedBills,
            unmatchedTransactions
        });
    } catch (err) {
        console.error('[reconciliation] error:', err.message);
        res.status(500).json({ error: 'Failed to compute reconciliation' });
    }
});

/**
 * POST /api/reconciliation/link
 * Body: { billId, transactionId }
 * Links a transaction to a bill and marks the bill paid.
 */
router.post('/link', async (req, res) => {
    try {
        const { billId, transactionId } = req.body || {};
        if (!billId || !transactionId) {
            return res.status(400).json({ error: 'billId and transactionId are required' });
        }
        const [bill, txn] = await Promise.all([
            Bill.findOne({ where: { id: billId, userId: req.user.id } }),
            Transaction.findOne({ where: { id: transactionId, userId: req.user.id } })
        ]);
        if (!bill || !txn) return res.status(404).json({ error: 'Bill or transaction not found' });

        await txn.update({ billId: bill.id });
        await bill.update({ status: 'paid', lastPaidDate: txn.date });

        res.json({ success: true, bill: publicBill(bill), transactionId: txn.id });
    } catch (err) {
        console.error('[reconciliation] link error:', err.message);
        res.status(500).json({ error: 'Failed to link transaction' });
    }
});

module.exports = router;
