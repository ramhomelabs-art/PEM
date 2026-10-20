const express = require('express');
const router = express.Router();
const { Card, Bank } = require('../../models');
const { authenticateToken } = require('../../middleware/auth');
const { encrypt, decrypt } = require('../../utils/cardCrypto');

function safeDecrypt(val) {
    if (!val) return val;
    if (typeof val === 'string' && val.startsWith('gcm1:')) {
        return val;
    }
    if (typeof val === 'string' && (val.startsWith('v2:') || val.includes(':'))) {
        try {
            return decrypt(val);
        } catch (e) {
            return val;
        }
    }
    return val;
}

// Get all cards for user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const cards = await Card.findAll({
            where: { userId: req.user.id },
            include: [{ model: Bank, attributes: ['id', 'name'], required: false }]
        });
        const decryptedCards = cards.map(c => {
            const plain = c.toJSON();
            plain.bankName = plain.bankName || (plain.Bank ? plain.Bank.name : null);
            plain.cardNumber = safeDecrypt(plain.cardNumber);
            plain.cvv = safeDecrypt(plain.cvv);
            return plain;
        });
        res.json(decryptedCards);
    } catch (err) {
        console.error("Error fetching cards:", err);
        res.status(500).json({ error: err.message });
    }
});

// Add new card
// Accepts either bankId (existing) or bankName (used by the mobile card scan):
// the bank is matched by name for this user, and created as a shell record when
// no bank has been added yet, so a scanned card always lands in the right section.
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { bankId, bankName, cardNumber, cardHolder, expiry, cvv, type, limit } = req.body;

        // Validate required fields
        if (!cardNumber || !cardHolder) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        let resolvedBankId = bankId;
        const trimmedName = String(bankName || '').trim();
        if (!resolvedBankId && trimmedName) {
            const banks = await Bank.findAll({ where: { userId: req.user.id } });
            const match = banks.find(
                (b) => String(b.name).trim().toLowerCase() === trimmedName.toLowerCase()
            );
            if (match) {
                resolvedBankId = match.id;
            }
        }

        // Normalise card type to the model's enum casing (Credit/Debit/Virtual).
        const rawType = String(type || '').toLowerCase();
        const cardType = rawType === 'credit' ? 'Credit'
            : rawType === 'virtual' ? 'Virtual'
                : 'Debit';

        const rawCardNumber = String(cardNumber).trim();
        const encryptedCardNumber = rawCardNumber.startsWith('gcm1:') ? rawCardNumber : encrypt(rawCardNumber);
        const rawCvv = cvv && String(cvv).trim() && String(cvv).trim() !== '***' ? String(cvv).trim() : null;
        const encryptedCvv = rawCvv ? (rawCvv.startsWith('gcm1:') ? rawCvv : encrypt(rawCvv)) : '***';

        const rawLimit = limit;
        const parsedLimit = (rawLimit !== '' && rawLimit !== null && rawLimit !== undefined && !isNaN(Number(rawLimit)))
            ? Number(rawLimit)
            : null;

        const card = await Card.create({
            userId: req.user.id, // Securely get from token
            bankId: resolvedBankId || null,
            bankName: trimmedName || null,
            cardNumber: encryptedCardNumber,
            cardHolder,
            expiry: expiry || '',
            cvv: encryptedCvv,
            type: cardType,
            limit: parsedLimit
        });
        const cardJson = card.toJSON();
        cardJson.bankName = card.bankName || trimmedName || null;
        cardJson.cardNumber = rawCardNumber;
        cardJson.cvv = rawCvv || '***';
        res.status(201).json(cardJson);
    } catch (err) {
        console.error("Error adding card:", err);
        res.status(400).json({ error: err.message });
    }
});

// Update card
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const card = await Card.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!card) return res.status(404).json({ error: 'Card not found or access denied' });

        const { bankId, bankName, cardNumber, cardHolder, expiry, cvv, type, limit } = req.body;

        let resolvedBankId = bankId !== undefined ? bankId : card.bankId;
        const trimmedName = bankName !== undefined ? String(bankName || '').trim() : card.bankName;
        if (!resolvedBankId && trimmedName) {
            const banks = await Bank.findAll({ where: { userId: req.user.id } });
            const match = banks.find(
                (b) => String(b.name).trim().toLowerCase() === trimmedName.toLowerCase()
            );
            if (match) {
                resolvedBankId = match.id;
            }
        }

        const updatedData = {};
        if (cardHolder !== undefined) updatedData.cardHolder = cardHolder;
        if (expiry !== undefined) updatedData.expiry = expiry || '';
        if (type !== undefined) {
            const rawType = String(type || '').toLowerCase();
            updatedData.type = rawType === 'credit' ? 'Credit' : rawType === 'virtual' ? 'Virtual' : 'Debit';
        }
        if (limit !== undefined) {
            updatedData.limit = (limit !== '' && limit !== null && !isNaN(Number(limit))) ? Number(limit) : null;
        }
        if (bankId !== undefined || bankName !== undefined) {
            updatedData.bankId = resolvedBankId || null;
            updatedData.bankName = trimmedName || null;
        }

        if (cardNumber) {
            const rawCardNumber = String(cardNumber).trim();
            updatedData.cardNumber = rawCardNumber.startsWith('gcm1:') ? rawCardNumber : encrypt(rawCardNumber);
        }

        if (cvv !== undefined) {
            const rawCvv = cvv && String(cvv).trim() && String(cvv).trim() !== '***' ? String(cvv).trim() : null;
            if (rawCvv) {
                updatedData.cvv = rawCvv.startsWith('gcm1:') ? rawCvv : encrypt(rawCvv);
            }
        }

        await card.update(updatedData);

        const cardJson = card.toJSON();
        cardJson.bankName = card.bankName || trimmedName || null;
        cardJson.cardNumber = safeDecrypt(card.cardNumber);
        cardJson.cvv = safeDecrypt(card.cvv);

        res.json(cardJson);
    } catch (err) {
        console.error("Error updating card:", err);
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

