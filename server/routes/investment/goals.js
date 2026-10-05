const express = require('express');
const router = express.Router();
const { Goal, Investment, InvestmentPlan } = require('../../models');
const { num } = require('../../utils/investmentLedger');
const { monthsBetween, monthlyEquivalent, requiredMonthly } = require('../../utils/investmentPlan');

// Default assumed annual return for goal projections when no linked plan
// states a return. 12% is a reasonable long-run equity expectation.
const DEFAULT_RETURN_PCT = 12;

const goalStatus = (achieved, targetAmount, monthsLeft, backingMonthly, required) => {
    if (achieved >= targetAmount && monthsLeft <= 0) return 'Achieved';
    if (monthsLeft <= 0) return 'Missed';
    if (required <= 0 || backingMonthly >= required) return 'On track';
    return 'Behind';
};

// GET Goals
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const goals = await Goal.findAll({
            where: { userId },
            include: [{
                model: Investment,
                as: 'investments',
                where: { userId },
                required: false,
                include: [{ model: InvestmentPlan, as: 'plans', required: false }]
            }]
        });

        const now = new Date();
        const result = goals.map(goal => {
            const achieved = goal.investments.reduce((sum, inv) => sum + Number(inv.currentValue), 0);
            const targetAmount = num(goal.targetAmount);

            // Monthly-equivalent contribution the linked plans are pumping in.
            const backingMonthly = goal.investments.reduce(
                (sum, inv) => sum + (inv.plans || []).reduce((s, plan) => s + monthlyEquivalent(plan), 0),
                0
            );

            const monthsLeft = monthsBetween(now, new Date(goal.targetDate));
            const required = requiredMonthly(targetAmount, monthsLeft, DEFAULT_RETURN_PCT);
            const prio = goal.priority ? goal.priority.charAt(0).toUpperCase() + goal.priority.slice(1).toLowerCase() : 'Medium';

            return {
                id: goal.id,
                name: goal.name,
                targetAmount,
                targetDate: goal.targetDate,
                priority: prio,
                color: goal.color || '#3b82f6',
                icon: goal.icon || 'Target',
                achieved,
                percentage: targetAmount > 0 ? (achieved / targetAmount * 100).toFixed(1) : 0,
                monthsLeft,
                requiredMonthly: Math.round(required),
                backingMonthly: Math.round(backingMonthly),
                status: goalStatus(achieved, targetAmount, monthsLeft, backingMonthly, required),
                investments: goal.investments.map(i => i.name)
            };
        });

        res.json(result);
    } catch (err) {
        console.error('❌ [GET GOALS ERROR]', err);
        res.status(500).json({ error: err.message || 'Server Error' });
    }
});

// POST Create Goal
router.post('/', async (req, res) => {
    try {
        const normalizePriority = (p) => {
            if (!p) return 'Medium';
            const s = String(p).trim().toLowerCase();
            if (s === 'low') return 'Low';
            if (s === 'high') return 'High';
            return 'Medium';
        };

        const goal = await Goal.create({
            userId: req.user.id,
            name,
            targetAmount: Number(targetAmount) || 0,
            targetDate: targetDate || null,
            priority: normalizePriority(priority),
            icon: icon || 'Target',
            color: color || '#3b82f6'
        });

        if (investmentIds && Array.isArray(investmentIds) && investmentIds.length > 0) {
            await Investment.update(
                { goalId: goal.id },
                { where: { id: investmentIds, userId: req.user.id } }
            );
        }

        res.status(201).json(goal);
    } catch (err) {
        console.error('❌ [CREATE GOAL ERROR]', err);
        res.status(500).json({ error: err.message || 'Server Error' });
    }
});

// PUT Update Goal & Link Investments
router.put('/:id', async (req, res) => {
    try {
        const { name, targetAmount, targetDate, priority, color, icon, investmentIds } = req.body;
        const goal = await Goal.findOne({ where: { id: req.params.id, userId: req.user.id } });

        if (!goal) return res.status(404).json({ error: 'Goal not found' });

        const normalizePriority = (p) => {
            if (!p) return 'Medium';
            const s = String(p).trim().toLowerCase();
            if (s === 'low') return 'Low';
            if (s === 'high') return 'High';
            return 'Medium';
        };

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (targetAmount !== undefined) updateData.targetAmount = Number(targetAmount) || 0;
        if (targetDate !== undefined) updateData.targetDate = targetDate;
        if (priority !== undefined) updateData.priority = normalizePriority(priority);
        if (color !== undefined) updateData.color = color;
        if (icon !== undefined) updateData.icon = icon;

        await goal.update(updateData);

        // Update Linked Investments if provided
        if (investmentIds !== undefined) {
            // First unlink all current investments for this goal
            await Investment.update({ goalId: null }, { where: { goalId: goal.id, userId: req.user.id } });

            // Then link the new set
            if (Array.isArray(investmentIds) && investmentIds.length > 0) {
                await Investment.update(
                    { goalId: goal.id },
                    { where: { id: investmentIds, userId: req.user.id } }
                );
            }
        }

        res.json(goal);
    } catch (err) {
        console.error('❌ [UPDATE GOAL ERROR]', err);
        res.status(500).json({ error: err.message || 'Server Error' });
    }
});

// DELETE Goal
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const goal = await Goal.findOne({ where: { id: req.params.id, userId } });
        if (!goal) return res.status(404).json({ error: 'Goal not found' });

        // Unlink investments so they are not orphaned or silently re-assigned
        await Investment.update({ goalId: null }, { where: { goalId: goal.id, userId } });
        await goal.destroy();

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
