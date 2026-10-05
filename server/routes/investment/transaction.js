const express = require('express');
const router = express.Router();
const { Investment, InvestmentPlan, InvestmentTransaction } = require('../../models');
const { num, computeLedgerStats, valueDelta } = require('../../utils/investmentLedger');

// Helper: find an investment owned by the current user
const findOwnedInvestment = async (investmentId, userId) =>
    Investment.findOne({ where: { id: investmentId, userId } });

// Normalise and validate an optional plan link. The plan must belong to the
// user and point at the same investment as the transaction.
const planLink = async (planId, investmentId, userId) => {
    if (planId === undefined || planId === null || planId === '') return null;
    const plan = await InvestmentPlan.findOne({ where: { id: planId, userId, investmentId } });
    if (!plan) return null;
    return plan.id;
};

// Cached stats are a replay of the ledger, so create/edit/delete all converge on
// the same numbers instead of incrementing and drifting. `valueAdjustment` is
// applied to the market value, which is never derived from the ledger.
const resyncInvestment = async (investment, userId, valueAdjustment = 0) => {
    const allTxns = await InvestmentTransaction.findAll({
        where: { investmentId: investment.id, userId }
    });
    const stats = computeLedgerStats(allTxns);

    await investment.update({
        totalInvested: stats.totalInvested,
        unitsHeld: stats.unitsHeld,
        currentValue: Math.max(0, num(investment.currentValue) + valueAdjustment)
    });

    return stats;
};

// GET Transactions for an Investment
router.get('/:id/transactions', async (req, res) => {
    try {
        const transactions = await InvestmentTransaction.findAll({
            where: { investmentId: req.params.id, userId: req.user.id },
            order: [['date', 'DESC']]
        });
        res.json(transactions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// ADD Transaction (Buy/Sell/SIP)
router.post('/:id/transactions', async (req, res) => {
    try {
        const investmentId = req.params.id;
        const userId = req.user.id;
        const { type, date, amount, units, pricePerUnit, planId } = req.body;

        const investment = await findOwnedInvestment(investmentId, userId);
        if (!investment) return res.status(404).json({ error: 'Investment not found' });

        const linkedPlanId = await planLink(planId, investmentId, userId);
        if (planId && linkedPlanId === null) {
            return res.status(400).json({ error: 'Invalid planId: plan not found or belongs to a different investment' });
        }

        const txn = await InvestmentTransaction.create({
            userId,
            investmentId,
            planId: linkedPlanId,
            type,
            date: date || new Date(),
            amount: num(amount),
            units: num(units),
            pricePerUnit: num(pricePerUnit),
        });

        await resyncInvestment(investment, userId, valueDelta(txn));

        res.status(201).json(txn);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// UPDATE Transaction (correct a wrong amount/type/date entry)
router.put('/:id/transactions/:txnId', async (req, res) => {
    try {
        const investmentId = req.params.id;
        const userId = req.user.id;
        const { type, date, amount, units, pricePerUnit, planId } = req.body;

        const investment = await findOwnedInvestment(investmentId, userId);
        if (!investment) return res.status(404).json({ error: 'Investment not found' });

        const txn = await InvestmentTransaction.findOne({
            where: { id: req.params.txnId, investmentId, userId }
        });
        if (!txn) return res.status(404).json({ error: 'Transaction not found' });

        const previousDelta = valueDelta(txn);

        const updateData = {};
        if (type !== undefined) updateData.type = type;
        if (date !== undefined) updateData.date = date;
        if (amount !== undefined) updateData.amount = num(amount);
        if (units !== undefined) updateData.units = num(units);
        if (pricePerUnit !== undefined) updateData.pricePerUnit = num(pricePerUnit);
        if (planId !== undefined) {
            const linkedPlanId = await planLink(planId, investmentId, userId);
            if (planId && linkedPlanId === null) {
                return res.status(400).json({ error: 'Invalid planId: plan not found or belongs to a different investment' });
            }
            updateData.planId = linkedPlanId;
        }

        await txn.update(updateData);

        await resyncInvestment(investment, userId, -previousDelta + valueDelta(txn));

        res.json(txn);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// DELETE Transaction (undo a wrong entry)
router.delete('/:id/transactions/:txnId', async (req, res) => {
    try {
        const investmentId = req.params.id;
        const userId = req.user.id;

        const investment = await findOwnedInvestment(investmentId, userId);
        if (!investment) return res.status(404).json({ error: 'Investment not found' });

        const txn = await InvestmentTransaction.findOne({
            where: { id: req.params.txnId, investmentId, userId }
        });
        if (!txn) return res.status(404).json({ error: 'Transaction not found' });

        const delta = valueDelta(txn);
        await txn.destroy();

        await resyncInvestment(investment, userId, -delta);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
