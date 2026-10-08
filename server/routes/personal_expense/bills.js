const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });
const { Bill, Transaction, User } = require('../../models');
const { authenticateToken: authenticate } = require('../../middleware/auth');
const fs = require('fs');
const path = require('path');

// Pending Store for Automation Inbox
const PENDING_FILE = path.join(__dirname, '../data/pending_sms.json');
function getPendingSMS() {
    if (!fs.existsSync(PENDING_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    } catch (e) { return []; }
}
function savePendingSMS(data) {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
}

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

// Get all bills for a specific user (Used by Dashboard)
router.get('/user/:userId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.id != req.params.userId) {
            return res.status(403).json({ error: 'Unauthorized access to user bills' });
        }

        const bills = await Bill.findAll({
            where: { userId: req.params.userId },
            order: [['dueDate', 'ASC']]
        });

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

// Add a new bill / manual expense upload from Mobile or Web
router.post('/', authenticate, upload.single('receipt'), async (req, res) => {
    try {
        const name = req.body.name || req.body.merchant || "Manual Expense";
        const category = req.body.category || "General";
        const amount = parseFloat(req.body.amount || 0);
        const dueDate = req.body.dueDate || req.body.date || new Date();
        const provider = req.body.provider || req.body.merchant || null;
        const status = req.body.status || 'unpaid';
        const isRecurring = req.body.isRecurring !== undefined ? (req.body.isRecurring === 'true' || req.body.isRecurring === true) : false;
        const frequency = req.body.frequency || 'monthly';
        const notes = req.body.notes || req.body.description || req.body.lineItems || '';

        const bill = await Bill.create({
            name,
            category,
            amount,
            dueDate,
            provider,
            status,
            isRecurring,
            frequency,
            userId: req.user.id
        });

        // Also queue into pending SMS / Automation Inbox for instant expense matching
        try {
            const billItem = {
                id: Date.now() + Math.random(),
                merchant: name,
                amount: amount,
                category: category,
                date: new Date().toISOString(),
                description: notes,
                paymentMethod: "Manual",
                transaction_type: "expense",
                type: "MANUAL",
                source: "MANUAL_ENTRY",
                userId: req.user.id,
                raw_message: `Manual Entry: ${name} - Rs ${amount} (${category})`
            };
            const currentPending = getPendingSMS();
            currentPending.unshift(billItem);
            savePendingSMS(currentPending);
        } catch (queueErr) {
            console.warn('[Bills] Could not add to pending inbox:', queueErr.message);
        }

        console.log(`[Bills] Added new bill/expense for user ${req.user.username}: ${name} (Rs ${amount})`);
        res.status(201).json({ success: true, bill });
    } catch (err) {
        console.error('[Bills Error]', err);
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

        let payerId = bill.userId;

        if (req.body.userId) {
            if (!payerId) {
                payerId = req.body.userId;
                bill.userId = payerId;
            }
        }

        if (!payerId) {
            return res.status(500).json({ error: 'Bill data corrupted: Missing User ID' });
        }

        bill.lastPaidDate = new Date();

        if (bill.isRecurring && ['monthly', 'quarterly', 'yearly'].includes(bill.frequency)) {
            const nextDue = new Date(bill.dueDate);
            if (bill.frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
            else if (bill.frequency === 'quarterly') nextDue.setMonth(nextDue.getMonth() + 3);
            else if (bill.frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);

            bill.dueDate = nextDue;
            bill.status = 'paid';
        } else {
            bill.status = 'paid';
        }

        await bill.save();

        const rawUserId = req.body.userId || bill.userId;
        const transactionUserId = parseInt(rawUserId, 10);

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
