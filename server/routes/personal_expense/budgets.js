const express = require('express');
const router = express.Router();
const { Budget, Transaction } = require('../../models');
const { Op } = require('sequelize');

// Fetch all budgets for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const budgets = await Budget.findAll({
            where: { userId: req.params.userId },
            order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
        });

        // There must be at most one budget per category. Keep the most recently
        // updated row and remove any historical duplicates so the UI never
        // renders the same category more than once.
        const byCategory = new Map();
        const duplicates = [];
        for (const budget of budgets) {
            if (byCategory.has(budget.category)) duplicates.push(budget.id);
            else byCategory.set(budget.category, budget);
        }
        if (duplicates.length) {
            await Budget.destroy({ where: { id: duplicates } });
        }

        res.json([...byCategory.values()]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create (or update) a budget for a category
router.post('/', async (req, res) => {
    try {
        const { userId, category, amountLimit, period, startDate } = req.body;
        if (!userId || !category) {
            return res.status(400).json({ error: 'userId and category are required' });
        }

        const existing = await Budget.findOne({ where: { userId, category } });
        if (existing) {
            await existing.update({
                amountLimit,
                period: period || existing.period,
                startDate: startDate || existing.startDate
            });
            return res.json(existing);
        }

        const budget = await Budget.create({
            userId,
            category,
            amountLimit,
            period,
            startDate: startDate || new Date()
        });
        res.json(budget);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a budget
router.put('/:id', async (req, res) => {
    try {
        const { amountLimit, category, period } = req.body;
        const budget = await Budget.findByPk(req.params.id);
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        await budget.update({ amountLimit, category, period });

        // If another budget already exists for the new category, drop it so the
        // edited budget stays the single source for that category.
        await Budget.destroy({
            where: {
                userId: budget.userId,
                category: budget.category,
                id: { [Op.ne]: budget.id }
            }
        });

        res.json(budget);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a budget
router.delete('/:id', async (req, res) => {
    try {
        const budget = await Budget.findByPk(req.params.id);
        if (!budget) return res.status(404).json({ error: 'Budget not found' });
        await budget.destroy();
        res.json({ message: 'Budget deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
