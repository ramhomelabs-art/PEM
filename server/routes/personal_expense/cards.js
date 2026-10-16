const express = require('express');
const router = express.Router();
const { Card } = require('../../models');
const { authenticateToken } = require('../../middleware/auth');

// Get all cards for user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const cards = await Card.findAll({
            where: { userId: req.user.id },
            attributes: { exclude: ['cvv'] }
        });
        res.json(cards);
    } catch (err) {
        console.error("Error fetching cards:", err);
        res.status(500).json({ error: err.message });
    }
});

// Add new card
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { bankId, cardNumber, cardHolder, expiry, type, limit } = req.body;

        // Validate required fields
        if (!bankId || !cardNumber || !cardHolder) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const card = await Card.create({
            userId: req.user.id, // Securely get from token
            bankId,
            cardNumber,
            cardHolder,
            expiry,
            cvv: '***', // Never persist actual CVV in plaintext (PCI-DSS compliance)
            type,
            limit
        });
        const cardJson = card.toJSON();
        delete cardJson.cvv;
        res.status(201).json(cardJson);
    } catch (err) {
        console.error("Error adding card:", err);
        res.status(400).json({ error: err.message });
    }
});

// Delete card
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const card = await Card.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!card) return res.status(404).json({ error: 'Card not found or access denied' });

        await card.destroy();
        res.json({ message: 'Card deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
