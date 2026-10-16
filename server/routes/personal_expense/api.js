
const express = require('express');
const router = express.Router();
const { Expense, Loan } = require('../../models');

// Get Dashboard Data (only for the authenticated user; admins may view any user)
router.get('/dashboard/:userId', async (req, res) => {
    try {
        const requested = Number(req.params.userId);
        const isAdmin = req.user.role === 'admin' || req.user.role === 'administrator';
        if (!isAdmin && requested !== req.user.id) {
            return res.status(403).json({ error: "Not authorized to view this user's data" });
        }
        const expenses = await Expense.findAll({ where: { userId: requested } });
        const loans = await Loan.findAll({ where: { userId: requested } });

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

// Add Expense (owned by the authenticated user only)
router.post('/expense', async (req, res) => {
    try {
        const { amount, category, description } = req.body;
        const expense = await Expense.create({ amount, category, description, userId: req.user.id });
        res.json(expense);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add Loan (owned by the authenticated user only)
router.post('/loan', async (req, res) => {
    try {
        const { type, amount, emiAmount } = req.body;
        const loan = await Loan.create({ type, amount, emiAmount, userId: req.user.id });
        res.json(loan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
