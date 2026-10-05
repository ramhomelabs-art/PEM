const express = require('express');
const router = express.Router();
const { Bill, Transaction, User } = require('../../models');
const { authenticateToken: authenticate } = require('../../middleware/auth');

// Get all bills for the authenticated user
router.get('/', authenticate, async (req, res) => {
    try {
        const bills = await Bill.findAll({
            where: { userId: req.user.id },
            order: [['dueDate', 'ASC']]
        });

        // AUTO-UPDATE STATUS based on Due Date
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const updatedBills = await Promise.all(bills.map(async (bill) => {
            let changed = false;
            const due = new Date(bill.dueDate);
            due.setHours(0, 0, 0, 0);
            const diffTime = due - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // 1. If 'paid' but Next Due Date is approaching (within 7 days), reset to 'unpaid'
            // This "generates" the next cycle's requirement
            if (bill.status === 'paid' && diffDays <= 7 && diffDays > 0) {
                bill.status = 'unpaid';
                changed = true;
            }
            // 2. If Due Date passed and not already marked paid for a future cycle, mark as 'overdue'
            else if (today > due && bill.status !== 'overdue' && bill.status !== 'paid') {
                bill.status = 'overdue';
                changed = true;
            }

            if (changed) await bill.save();
            return bill;
        }));

        res.json(updatedBills);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all bills for a specific user (Used by Dashboard)
router.get('/user/:userId', authenticate, async (req, res) => {
    try {
        // Security check: Only allow users to see their own bills unless they are admin
        if (req.user.role !== 'admin' && req.user.id != req.params.userId) {
            return res.status(403).json({ error: 'Unauthorized access to user bills' });
        }

        const bills = await Bill.findAll({
            where: { userId: req.params.userId },
            order: [['dueDate', 'ASC']]
        });

        // AUTO-UPDATE STATUS based on Due Date
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const updatedBills = await Promise.all(bills.map(async (bill) => {
            let changed = false;
            const due = new Date(bill.dueDate);
            due.setHours(0, 0, 0, 0);
            const diffTime = due - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (bill.status === 'paid' && diffDays <= 7 && diffDays > 0) {
                bill.status = 'unpaid';
                changed = true;
            } else if (today > due && bill.status !== 'overdue' && bill.status !== 'paid') {
                bill.status = 'overdue';
                changed = true;
            }

            if (changed) await bill.save();
            return bill;
        }));

        res.json(updatedBills);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new bill
router.post('/', authenticate, async (req, res) => {
    try {
        const bill = await Bill.create({
            ...req.body,
            userId: req.user.id
        });
        res.status(201).json(bill);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Pay a bill
router.post('/:billId/pay', authenticate, async (req, res) => {
    try {
        const bill = await Bill.findOne({
            where: { id: req.params.billId, userId: req.user.id }
        });
        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        console.log(`Paying bill: ${bill.name} (ID: ${bill.id})`);
        console.log(`Bill UserID: ${bill.userId}, Amount: ${bill.amount}`);

        let payerId = bill.userId;

        // Robustness: If bill has no owner, or we want to force the payer to be the current user
        if (req.body.userId) {
            // If bill had no user, claim it
            if (!payerId) {
                payerId = req.body.userId;
                bill.userId = payerId;
                console.log(`Repaired Bill ${bill.id} with UserID ${payerId}`);
            }
        }

        if (!payerId) {
            console.error("CRITICAL ERROR: Bill has no userId associated and none provided!");
            return res.status(500).json({ error: 'Bill data corrupted: Missing User ID' });
        }

        // Update bill status and due date if recurring
        bill.lastPaidDate = new Date();

        if (bill.isRecurring && ['monthly', 'quarterly', 'yearly'].includes(bill.frequency)) {
            const nextDue = new Date(bill.dueDate);
            if (bill.frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
            else if (bill.frequency === 'quarterly') nextDue.setMonth(nextDue.getMonth() + 3);
            else if (bill.frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);

            bill.dueDate = nextDue;
            // bill.status = 'unpaid'; // OLD: immediately unpaid
            bill.status = 'paid'; // NEW: show paid until cycle passes
        } else {
            bill.status = 'paid';
        }

        await bill.save();

        // Create a transaction record
        const rawUserId = req.body.userId || bill.userId;
        const transactionUserId = parseInt(rawUserId, 10);

        if (isNaN(transactionUserId)) {
            console.error(`Invalid User ID for transaction: ${rawUserId}`);
            // Proceeding might be risky, but let's try to proceed if we can, or maybe error out?
            // If we error out here, the bill is already "paid".
            // We should probably allow it but log error.
        }

        const txn = await Transaction.create({
            userId: transactionUserId,
            type: 'expense',
            amount: parseFloat(bill.amount),
            category: bill.category,
            description: `Payment for bill: ${bill.name}`,
            paymentMode: req.body.paymentMode || 'NetBanking',
            date: new Date(),
            source: 'manual',
            billId: bill.id
        });

        console.log("Transaction created:", txn.toJSON());

        res.json({ message: 'Bill paid and transaction recorded', bill });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a bill
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const result = await Bill.destroy({ where: { id: req.params.id, userId: req.user.id } });
        if (result === 0) return res.status(404).json({ error: 'Bill not found' });
        res.json({ message: 'Bill deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
