
const express = require('express');
const router = express.Router();
const { Expense, Loan, User } = require('../../models');

// Get Dashboard Data (for a specific user)
router.get('/dashboard/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const expenses = await Expense.findAll({ where: { userId } });
        const loans = await Loan.findAll({ where: { userId } });

        // Calculate totals
        const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
        const totalLoan = loans.reduce((sum, item) => sum + item.amount, 0);

        res.json({
            expenses,
            loans,
            summary: {
                totalExpense,
                totalLoan
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add Expense
router.post('/expense', async (req, res) => {
    try {
        const { amount, category, description, userId } = req.body;
        const expense = await Expense.create({ amount, category, description, userId });
        res.json(expense);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add Loan
router.post('/loan', async (req, res) => {
    try {
        const { type, amount, emiAmount, userId } = req.body;
        const loan = await Loan.create({ type, amount, emiAmount, userId });
        res.json(loan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
