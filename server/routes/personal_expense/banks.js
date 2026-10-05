const express = require('express');
const router = express.Router();
const { Bank, Card } = require('../../models');

// Get all banks for a user (with cards)
router.get('/user/:userId', async (req, res) => {
    try {
        const banks = await Bank.findAll({
            where: { userId: req.params.userId },
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
        const { userId, name, accountNumber, ifsc, branch, balance, type } = req.body;
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
        await bank.destroy();
        res.json({ message: 'Bank deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
