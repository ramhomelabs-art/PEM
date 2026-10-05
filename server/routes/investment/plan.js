const express = require('express');
const router = express.Router();
const { Investment, InvestmentTransaction, InvestmentPlan } = require('../../models');
const { Op } = require('sequelize');
const { num } = require('../../utils/investmentLedger');
const { FREQUENCIES, summarizePlan } = require('../../utils/investmentPlan');

const INVESTMENT_ATTRS = ['id', 'name', 'category', 'subCategory', 'provider', 'ticker', 'currentValue', 'totalInvested', 'status'];

// Determine the short param name for errors, e.g. frequency/weekly.
const FREQ_ERROR = `frequency must be one of: ${FREQUENCIES.join(', ')}`;

const validatePlan = (body) => {
    const errors = [];
    const frequency = body.frequency || 'monthly';

    if (!FREQUENCIES.includes(frequency)) {
        errors.push(FREQ_ERROR);
    }

    const amount = num(body.amount);
    if (!(amount > 0)) {
        errors.push('amount must be greater than 0');
    }

    const day = body.instalmentDay === undefined || body.instalmentDay === null || body.instalmentDay === ''
        ? null
        : Number(body.instalmentDay);
    const dayMax = frequency === 'weekly' ? 7 : 31;
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > dayMax)) {
        errors.push(`instalmentDay must be a whole number between 1 and ${dayMax} for ${frequency}`);
    }

    if (!body.startDate) {
        errors.push('startDate is required (YYYY-MM-DD)');
    }

    const stepUp = body.stepUpPct === undefined ? 0 : Number(body.stepUpPct);
    if (!Number.isFinite(stepUp) || stepUp < 0 || stepUp > 100) {
        errors.push('stepUpPct must be between 0 and 100');
    }

    const expectedReturn = body.expectedReturnPct === undefined ? 0 : Number(body.expectedReturnPct);
    if (!Number.isFinite(expectedReturn) || expectedReturn < -100 || expectedReturn > 100) {
        errors.push('expectedReturnPct must be between -100 and 100');
    }

    const fields = {
        name: body.name || null,
        frequency,
        amount,
        instalmentDay: day,
        startDate: body.startDate || new Date().toISOString().slice(0, 10),
        endDate: body.endDate || null,
        stepUpPct: stepUp,
        expectedReturnPct: expectedReturn,
        isActive: body.isActive === undefined ? true : !!body.isActive
    };

    return { errors, fields };
};

// GET all plans for the user (with per-plan status summary)
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const plans = await InvestmentPlan.findAll({
            where: { userId },
            order: [['startDate', 'DESC']],
            include: [{ model: Investment, as: 'investment', attributes: INVESTMENT_ATTRS }]
        });

        // One query for every contribution instead of one per plan.
        const transactions = await InvestmentTransaction.findAll({
            where: { userId, planId: { [Op.ne]: null } }
        });
        const byPlan = new Map();
        transactions.forEach((txn) => {
            const key = String(txn.planId);
            if (!byPlan.has(key)) byPlan.set(key, []);
            byPlan.get(key).push(txn);
        });

        const result = plans.map((plan) => ({
            ...plan.toJSON(),
            summary: summarizePlan(plan, byPlan.get(String(plan.id)) || [])
        }));

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET single plan with its contributions
router.get('/:id', async (req, res) => {
    try {
        const plan = await InvestmentPlan.findOne({
            where: { id: req.params.id, userId: req.user.id },
            include: [
                { model: Investment, as: 'investment', attributes: INVESTMENT_ATTRS },
                { model: InvestmentTransaction, as: 'contributions', order: [['date', 'DESC']] }
            ]
        });

        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        res.json({
            ...plan.toJSON(),
            summary: summarizePlan(plan, plan.contributions || [])
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// CREATE a plan
router.post('/', async (req, res) => {
    try {
        const { investmentId } = req.body;
        const userId = req.user.id;

        if (!investmentId) {
            return res.status(400).json({ error: 'investmentId is required' });
        }

        const investment = await Investment.findOne({ where: { id: investmentId, userId } });
        if (!investment) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        const { errors, fields } = validatePlan(req.body);
        if (errors.length) return res.status(400).json({ error: errors.join('; ') });

        const plan = await InvestmentPlan.create({ userId, investmentId, ...fields });

        res.status(201).json(plan);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// UPDATE a plan
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const plan = await InvestmentPlan.findOne({ where: { id: req.params.id, userId } });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        // Changing the target holding is allowed, but it must still be owned.
        if (req.body.investmentId !== undefined) {
            const investment = await Investment.findOne({ where: { id: req.body.investmentId, userId } });
            if (!investment) return res.status(404).json({ error: 'Investment not found' });
        }

        const { errors, fields } = validatePlan({ ...plan.toJSON(), ...req.body });
        if (errors.length) return res.status(400).json({ error: errors.join('; ') });

        const updateData = { ...fields };
        if (req.body.investmentId !== undefined) updateData.investmentId = req.body.investmentId;
        await plan.update(updateData);

        const refreshed = await InvestmentPlan.findOne({
            where: { id: plan.id, userId },
            include: [{ model: Investment, as: 'investment', attributes: INVESTMENT_ATTRS }]
        });

        res.json({
            ...refreshed.toJSON(),
            summary: summarizePlan(refreshed, [])
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// DELETE a plan
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const plan = await InvestmentPlan.findOne({ where: { id: req.params.id, userId } });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        // Keep the historical transactions; the FK is ON DELETE SET NULL so
        // this also unlinks them from the plan being removed.
        await InvestmentTransaction.update(
            { planId: null },
            { where: { planId: plan.id, userId } }
        );
        await plan.destroy();

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;