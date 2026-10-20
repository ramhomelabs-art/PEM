const express = require('express');
const router = express.Router();
const { Transaction, CreditCardTransaction, CreditCard } = require('../../models');

// Category Auto-Mapping Keywords
const categoryKeywords = {
    'Food': ['starbucks', 'mcdonalds', 'swiggy', 'zomato', 'restaurant', 'cafe', 'dinner'],
    'Travel': ['uber', 'ola', 'rapido', 'indigo', 'airbnb', 'hotel', 'flight', 'railway'],
    'Shopping': ['amazon', 'flipkart', 'myntra', 'shopping', 'store', 'retail'],
    'Medical': ['apollo', 'pharmacy', 'hospital', 'doctor', 'clinic', 'medical'],
    'Utility': ['electricity', 'water', 'recharge', 'internet', 'bill'],
    'Entertainment': ['netflix', 'hotstar', 'cinema', 'theatre', 'game', 'spotify']
};

const autoCategorize = (text) => {
    if (!text) return 'Other';
    const lowerText = text.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => lowerText.includes(keyword))) {
            return category;
        }
    }
    return 'General';
};

// 1. Manual Transaction Entry
router.post('/manual', async (req, res) => {
    try {
        const { type, amount, category, description, userId, date, paymentMode, otherPaymentMode, source } = req.body;

        // Enforce user ownership: non-admin cannot create transactions for other users
        const isAdmin = (req.user.role === 'admin' || req.user.role === 'administrator');
        const targetUserId = (isAdmin && userId) ? parseInt(userId, 10) : req.user.id;

        // Safety Check: Ensure user exists to prevent Foreign Key crashes
        const { User } = require('../../models');
        const userExists = await User.findByPk(targetUserId);
        if (!userExists) {
            console.error(`User not found for ID: ${targetUserId}`);
            return res.status(404).json({ error: "User session is invalid or user not found. Please log out and sign up again." });
        }

        const transaction = await Transaction.create({
            type,
            amount: parseFloat(amount),
            category,
            description,
            userId: targetUserId,
            paymentMode,
            otherPaymentMode,
            date: date || new Date(),
            source: source || 'manual' // Support custom source (e.g., 'sms')
        });

        // Auto-reconcile with open bills if this is an expense
        if (type === 'expense') {
            try {
                const { autoReconcilePayment } = require('../../services/billAutomationService');
                await autoReconcilePayment(transaction, targetUserId);
            } catch (reconErr) {
                console.warn('[Transactions] Auto bill reconciliation warning:', reconErr.message);
            }
        }

        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. SMS Parser Webhook (Integrated with Android Automate/Tasker)
router.post('/sms-parse', async (req, res) => {
    try {
        const { sender, content } = req.body;
        const targetUserId = req.user.id;

        // Basic Extracting Regex for amounts like "500", "500.00", "Rs. 500", "$500"
        const amountMatch = content.match(/(?:Rs|Rs\.|INR|\$|USD)?\s?(\d+(?:\.\d{2})?)/i);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

        // Auto determine type based on keywords
        const isIncome = content.toLowerCase().includes('credited') || content.toLowerCase().includes('received');
        const type = isIncome ? 'income' : 'expense';

        // Auto categorize based on content
        const category = autoCategorize(content);

        const transaction = await Transaction.create({
            type,
            amount,
            category,
            description: `SMS from ${sender}: ${content.substring(0, 30)}...`,
            userId: targetUserId,
            source: 'sms',
            rawContent: content
        });

        res.json({ message: 'SMS parsed and logged', transaction });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Email Statement Parser Webhook
router.post('/email-parse', async (req, res) => {
    try {
        const { subject, body } = req.body;
        const targetUserId = req.user.id;

        // Similar to SMS but maybe slightly different regex
        const amountMatch = body.match(/(\d+(?:\.\d{2})?)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

        const transaction = await Transaction.create({
            type: body.toLowerCase().includes('received') ? 'income' : 'expense',
            amount,
            category: autoCategorize(subject + ' ' + body),
            description: `Email Statement: ${subject}`,
            userId: targetUserId,
            source: 'email',
            rawContent: body
        });

        res.json({ message: 'Email parsed and logged', transaction });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Get User Transactions (Personal Expense Only)
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const requestedId = parseInt(userId, 10);
        const isAdmin = (req.user.role === 'admin' || req.user.role === 'administrator');

        // BOLA Prevention: Verify ownership
        if (req.user.id !== requestedId && !isAdmin) {
            return res.status(403).json({ error: 'Access denied: Cannot access another user\'s transactions' });
        }

        const { User } = require('../../models');

        // Fetch regular transactions only - credit card transactions remain isolated to credit card module
        const regularTransactions = await Transaction.findAll({
            where: { userId: requestedId },
            include: [{
                model: User,
                attributes: ['fullName', 'username']
            }],
            order: [['date', 'DESC']]
        });

        res.json(regularTransactions);
    } catch (error) {
        console.error("Fetch transactions error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 5. Update Transaction
router.put('/manual/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type, amount, category, description, date, paymentMode, otherPaymentMode, source } = req.body;

        const transaction = await Transaction.findByPk(id);
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        // BOLA Prevention: Verify ownership
        const isAdmin = (req.user.role === 'admin' || req.user.role === 'administrator');
        if (transaction.userId !== req.user.id && !isAdmin) {
            return res.status(403).json({ error: 'Access denied: Cannot modify another user\'s transaction' });
        }

        await transaction.update({
            type: type || transaction.type,
            amount: amount !== undefined ? parseFloat(amount) : transaction.amount,
            category: category || transaction.category,
            description: description || transaction.description,
            paymentMode: paymentMode || transaction.paymentMode,
            otherPaymentMode: otherPaymentMode !== undefined ? otherPaymentMode : transaction.otherPaymentMode,
            source: source !== undefined ? source : transaction.source,
            date: date || transaction.date
        });

        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Delete Transaction
router.delete('/manual/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await Transaction.findByPk(id);
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        // BOLA Prevention: Verify ownership
        const isAdmin = (req.user.role === 'admin' || req.user.role === 'administrator');
        if (transaction.userId !== req.user.id && !isAdmin) {
            return res.status(403).json({ error: 'Access denied: Cannot delete another user\'s transaction' });
        }

        await transaction.destroy();
        res.json({ message: 'Transaction deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
