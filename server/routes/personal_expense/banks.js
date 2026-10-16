const express = require('express');
const router = express.Router();
const { Bank, Card } = require('../../models');

// Get all banks for a user (with cards)
router.get('/user/:userId', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && Number(req.user.id) !== Number(req.params.userId)) {
            return res.status(403).json({ error: 'Unauthorized access to user bank accounts' });
        }
        const targetUserId = req.user.role === 'admin' ? req.params.userId : req.user.id;
        const banks = await Bank.findAll({
            where: { userId: targetUserId },
            include: [{ model: Card }],
            order: [['name', 'ASC']]
        });
        res.json(banks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new bank
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const { name, accountNumber, ifsc, branch, balance, type } = req.body;
        const bank = await Bank.create({
            userId,
            name,
            accountNumber,
            ifsc,
            branch,
            balance,
            type
        });
        res.status(201).json(bank);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete bank
router.delete('/:id', async (req, res) => {
    try {
        const bank = await Bank.findByPk(req.params.id);
        if (!bank) return res.status(404).json({ error: 'Bank not found' });
        if (req.user.role !== 'admin' && Number(req.user.id) !== Number(bank.userId)) {
            return res.status(403).json({ error: 'Unauthorized to delete this bank account' });
        }
        await bank.destroy();
        res.json({ message: 'Bank deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
