const express = require('express');
const router = express.Router();
const { Investment, InvestmentTransaction, InvestmentSnapshot, Goal } = require('../../models');

// GET ALL Investments for User
router.get('/', async (req, res) => {
    try {
        const investments = await Investment.findAll({
            where: { userId: req.user.id },
            order: [['currentValue', 'DESC']]
        });
        res.json(investments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET Single Investment details
router.get('/:id', async (req, res) => {
    try {
        const investment = await Investment.findOne({
            where: { id: req.params.id, userId: req.user.id },
            include: [
                {
                    model: InvestmentTransaction,
                    as: 'transactions',
                    // separate: true makes `limit` apply per parent instead of
                    // truncating the joined result set.
                    separate: true,
                    limit: 50,
                    order: [['date', 'DESC']]
                },
                {
                    model: Goal,
                    as: 'goal',
                    // Must match real columns on the goals table. Progress is
                    // derived from linked investments, so there is no stored
                    // currentAmount.
                    attributes: ['id', 'name', 'targetAmount', 'targetDate', 'priority', 'color'],
                    required: false
                }
            ]
        });
        if (!investment) return res.status(404).json({ error: 'Not Found' });
        res.json(investment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// CREATE New Investment
router.post('/', async (req, res) => {
    try {
        const {
            name, category, subCategory, provider, accountNumber,
            currency, ticker, status, tags, meta,
            initialAmount, initialDate, initialUnits, initialPricePerUnit
        } = req.body;

        const amount = Number(initialAmount || 0);
        const units = Number(initialUnits !== undefined && initialUnits !== '' ? initialUnits : (req.body.units || 0));
        const pricePerUnit = Number(initialPricePerUnit !== undefined && initialPricePerUnit !== '' ? initialPricePerUnit : (req.body.currentPrice || 0));

        const investment = await Investment.create({
            userId: req.user.id,
            name,
            category,
            subCategory,
            provider,
            accountNumber,
            ticker: ticker || null,
            status: status || 'Active',
            currency: currency || 'INR',
            tags: tags || [],
            meta: meta || {},
            // Initial stats
            totalInvested: amount,
            currentValue: amount,
            unitsHeld: units
        });

        // Optionally create initial transaction if amount > 0
        if (amount > 0) {
            await InvestmentTransaction.create({
                userId: req.user.id,
                investmentId: investment.id,
                type: 'BUY',
                date: initialDate || new Date(),
                amount,
                units,
                pricePerUnit: pricePerUnit,
                netBalance: amount
            });
        }

        res.status(201).json(investment);
    } catch (err) {
        console.error('❌ [CREATE INVESTMENT ERROR]', err);
        // Expose error details safely for debugging
        res.status(500).json({
            error: 'Server Error',
            details: err.message,
            sqlInfo: err.parent ? err.parent.message : null
        });
    }
});

// UPDATE Investment (Manual Value / Profile Update)
router.put('/:id', async (req, res) => {
    try {
        const {
            currentValue, ticker, name, category, subCategory,
            provider, accountNumber, status, tags, goalId
        } = req.body;

        const investment = await Investment.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!investment) {
            return res.status(404).json({ error: 'Not Found' });
        }

        // Record today's value as a snapshot. The unique index is
        // (investmentId, userId, date) so multiple edits on the same day
        // must update the existing row instead of failing.
        if (currentValue !== undefined) {
            const value = Number(currentValue);
            if (Number.isNaN(value) || value < 0) {
                return res.status(400).json({ error: 'Invalid currentValue' });
            }

            const today = new Date().toISOString().slice(0, 10);
            const [snapshot] = await InvestmentSnapshot.findOrCreate({
                where: { investmentId: investment.id, userId: req.user.id, date: today },
                defaults: { value, investedAmount: investment.totalInvested }
            });

            if (Number(snapshot.value) !== value) {
                await snapshot.update({ value, investedAmount: investment.totalInvested });
            }
        }

        const updateData = {};
        if (currentValue !== undefined) updateData.currentValue = currentValue;
        if (ticker !== undefined) updateData.ticker = ticker;
        if (name !== undefined) updateData.name = name;
        if (category !== undefined) updateData.category = category;
        if (subCategory !== undefined) updateData.subCategory = subCategory;
        if (provider !== undefined) updateData.provider = provider;
        if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
        if (status !== undefined) updateData.status = status;
        if (tags !== undefined) updateData.tags = tags;
        if (goalId !== undefined) updateData.goalId = goalId;

        await investment.update(updateData);

        res.json(investment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET Investment History (Snapshots)
router.get('/:id/history', async (req, res) => {
    try {
        const history = await InvestmentSnapshot.findAll({
            where: { investmentId: req.params.id, userId: req.user.id },
            order: [['date', 'ASC']]
        });
        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// DELETE Investment
router.delete('/:id', async (req, res) => {
    try {
        const investmentId = req.params.id;
        const userId = req.user.id;

        // Cleanup dependents first to avoid FK constraints
        await InvestmentSnapshot.destroy({ where: { investmentId, userId } });
        await InvestmentTransaction.destroy({ where: { investmentId, userId } });

        const result = await Investment.destroy({
            where: { id: investmentId, userId }
        });

        if (!result) return res.status(404).json({ error: 'Not Found' });
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
