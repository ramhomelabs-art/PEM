const express = require('express');
const router = express.Router();
const { Borrow, Transaction, BorrowPayment } = require('../../models');

const isValidUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// Get all borrow/lend records for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const records = await Borrow.findAll({
            where: { userId: req.params.userId },
            order: [['date', 'DESC']]
        });
        res.json(records || []);
    } catch (err) {
        console.error('Error fetching user borrow records:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get single record by ID or fallback to user query
router.get('/:id', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) return res.status(404).json({ error: 'Record not found' });
        
        // 1. Try finding by PK
        const record = await Borrow.findByPk(req.params.id);
        if (record) return res.json(record);

        // 2. Try finding by userId
        const userRecords = await Borrow.findAll({
            where: { userId: req.params.id },
            order: [['date', 'DESC']]
        });
        if (userRecords && userRecords.length > 0) {
            return res.json(userRecords);
        }

        res.status(404).json({ error: 'Record not found' });
    } catch (err) {
        console.error('Error fetching borrow record by ID:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add new record
router.post('/', async (req, res) => {
    try {
        const { userId, type, personName, amount, date, dueDate, description } = req.body;

        const record = await Borrow.create({
            userId,
            type,
            personName,
            amount,
            date,
            dueDate,
            description,
            status: 'active'
        });

        // Optional: Record as Transaction immediately?
        // If I borrow, it's Income (Cash In). If I lend, it's Expense (Cash Out).
        // Let's create a transaction for it automatically.
        const txnType = type === 'borrow' ? 'income' : 'expense';
        await Transaction.create({
            userId,
            type: txnType,
            amount,
            category: 'Debt/Loan', // Or 'Borrow/Lend'
            description: `${type === 'borrow' ? 'Borrowed from' : 'Lent to'} ${personName}`,
            date: date || new Date(),
            source: 'manual'
        });

        res.status(201).json(record);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Settle (Mark as paid/received)
router.post('/settle/:id', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) return res.status(404).json({ error: 'Record not found' });
        const record = await Borrow.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Record not found' });

        if (record.status === 'settled') return res.status(400).json({ error: 'Already settled' });

        record.status = 'settled';
        await record.save();

        // Create Offsetting Transaction
        // If I borrowed (Income originally), Settling means I Pay Back (Expense).
        // If I lent (Expense originally), Settling means I Get Back (Income).
        const txnType = record.type === 'borrow' ? 'expense' : 'income';

        await Transaction.create({
            userId: record.userId,
            type: txnType,
            amount: record.amount,
            category: 'Debt Settlement',
            description: `Settled: ${record.type === 'borrow' ? 'Paid back' : 'Received from'} ${record.personName}`,
            date: new Date(),
            source: 'manual'
        });

        res.json({ message: 'Settled successfully', record });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Record a payment
router.post('/:id/payment', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) return res.status(404).json({ error: 'Record not found' });
        const { amount, paymentDate, notes } = req.body;
        const record = await Borrow.findByPk(req.params.id);

        if (!record) return res.status(404).json({ error: 'Record not found' });
        if (record.status === 'settled') return res.status(400).json({ error: 'Already settled' });

        const paymentAmount = parseFloat(amount);
        const currentPaid = parseFloat(record.amountPaid) || 0;
        const newAmountPaid = currentPaid + paymentAmount;
        const remainingAmount = parseFloat(record.amount) - newAmountPaid;

        if (paymentAmount <= 0) return res.status(400).json({ error: 'Payment amount must be positive' });
        if (newAmountPaid > parseFloat(record.amount)) {
            return res.status(400).json({ error: 'Payment exceeds remaining amount' });
        }

        // Create payment record
        await BorrowPayment.create({
            borrowId: record.id,
            amount: paymentAmount,
            paymentDate: paymentDate || new Date(),
            notes
        });

        // Update borrow record
        record.amountPaid = newAmountPaid;

        // Update status based on amount paid
        if (remainingAmount === 0) {
            record.status = 'settled';
        } else if (newAmountPaid > 0) {
            record.status = 'partially_paid';
        }

        await record.save();

        // Create transaction for this payment
        const txnType = record.type === 'borrow' ? 'expense' : 'income';
        await Transaction.create({
            userId: record.userId,
            type: txnType,
            amount: paymentAmount,
            category: 'Debt Settlement',
            description: `Payment: ${record.type === 'borrow' ? 'Paid' : 'Received'} ${notes || ''} - ${record.personName}`,
            date: paymentDate || new Date(),
            source: 'manual'
        });

        res.json({
            message: 'Payment recorded successfully',
            record,
            remainingAmount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get payment history for a borrow record
router.get('/:id/payments', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) return res.json([]);
        const payments = await BorrowPayment.findAll({
            where: { borrowId: req.params.id },
            order: [['paymentDate', 'DESC']]
        });
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a borrow record
router.delete('/:id', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) return res.status(404).json({ error: 'Record not found' });
        const record = await Borrow.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Record not found' });

        // Optional: Delete associated payments? 
        // For now, let's keep it simple and just delete the record. 
        // Sequelize CASCADE should handle related payments if configured, otherwise we might leave orphans.
        // Assuming simple deletion is what's requested.
        await record.destroy();
        res.json({ message: 'Record deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
