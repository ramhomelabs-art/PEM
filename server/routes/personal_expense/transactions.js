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

        // Safety Check: Ensure user exists to prevent Foreign Key crashes
        const { User } = require('../../models');
        const userExists = await User.findByPk(userId);
        if (!userExists) {
            console.error(`User not found for ID: ${userId}`);
            return res.status(404).json({ error: "User session is invalid or user not found. Please log out and sign up again." });
        }

        const transaction = await Transaction.create({
            type,
            amount: parseFloat(amount),
            category,
            description,
            userId,
            paymentMode,
            otherPaymentMode,
            date: date || new Date(),
            source: source || 'manual' // Support custom source (e.g., 'sms')
        });
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. SMS Parser Webhook (Integrated with Android Automate/Tasker)
router.post('/sms-parse', async (req, res) => {
    try {
        const { sender, content, userId } = req.body;

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
            userId,
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
        const { subject, body, userId } = req.body;

        // Similar to SMS but maybe slightly different regex
        const amountMatch = body.match(/(\d+(?:\.\d{2})?)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

        const transaction = await Transaction.create({
            type: body.toLowerCase().includes('received') ? 'income' : 'expense',
            amount,
            category: autoCategorize(subject + ' ' + body),
            description: `Email Statement: ${subject}`,
            userId,
            source: 'email',
            rawContent: body
        });

        res.json({ message: 'Email parsed and logged', transaction });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Get User Transactions
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { User } = require('../../models');

        // Fetch regular transactions
        const regularTransactions = await Transaction.findAll({
            where: { userId },
            include: [{
                model: User,
                attributes: ['fullName', 'username']
            }]
        });

        // Fetch credit card transactions
        const ccTransactions = await CreditCardTransaction.findAll({
            where: { userId },
            include: [{
                model: CreditCard,
                attributes: ['cardName', 'bankName']
            }]
        });

        // Format and map credit card transactions to standard transaction schema
        const mappedCcTransactions = ccTransactions.map(t => ({
            id: `cc_${t.id}`, // prefix with cc_ to make unique
            realId: t.id,
            creditCardId: t.creditCardId,
            userId: t.userId,
            amount: parseFloat(t.amount),
            type: t.type === 'credit' ? 'income' : 'expense', // 'credit' -> payment/income, 'debit' -> spend/expense
            category: t.category || 'General',
            description: t.merchant + (t.description ? ` - ${t.description}` : ''),
            paymentMode: t.CreditCard ? `${t.CreditCard.bankName} ${t.CreditCard.cardName}` : 'Credit Card',
            date: t.transactionDate || t.createdAt,
            isCreditCardTx: true,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt
        }));

        // Combine both
        const combined = [
            ...regularTransactions.map(t => t.toJSON()),
            ...mappedCcTransactions
        ];

        // Sort by date descending
        combined.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(combined);
    } catch (error) {
        console.error("Fetch transactions error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 5. Update Transaction
router.put('/manual/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type, amount, category, description, date, paymentMode, otherPaymentMode } = req.body;

        const transaction = await Transaction.findByPk(id);
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        await transaction.update({
            type,
            amount: parseFloat(amount),
            category,
            description,
            paymentMode,
            otherPaymentMode,
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

        await transaction.destroy();
        res.json({ message: 'Transaction deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
