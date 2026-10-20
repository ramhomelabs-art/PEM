const express = require('express');
const router = express.Router();
const { Bank, Card } = require('../../models');
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

        const decryptedBanks = banks.map(b => {
            const plain = b.toJSON();
            plain.accountNumber = safeDecrypt(plain.accountNumber);
            if (Array.isArray(plain.Cards)) {
                plain.Cards = plain.Cards.map(c => {
                    c.cardNumber = safeDecrypt(c.cardNumber);
                    c.cvv = safeDecrypt(c.cvv);
                    return c;
                });
            }
            return plain;
        });

        res.json(decryptedBanks);
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
        const { name, accountNumber, accountHolderName, ifsc, micrCode, branch, balance, type } = req.body;
        const rawAcc = String(accountNumber || '').trim();
        const encAcc = rawAcc ? (rawAcc.startsWith('gcm1:') ? rawAcc : encrypt(rawAcc)) : '';
        const bank = await Bank.create({
            userId,
            name,
            accountNumber: encAcc,
            accountHolderName,
            ifsc,
            micrCode,
            branch,
            balance: balance ? Number(balance) : 0,
            type
        });
        const bankJson = bank.toJSON();
        bankJson.accountNumber = rawAcc;
        res.status(201).json(bankJson);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update a bank (owner or admin)
router.put('/:id', async (req, res) => {
    try {
        const bank = await Bank.findByPk(req.params.id);
        if (!bank) return res.status(404).json({ error: 'Bank not found' });
        if (req.user.role !== 'admin' && Number(req.user.id) !== Number(bank.userId)) {
            return res.status(403).json({ error: 'Unauthorized to update this bank account' });
        }

        // Only accept known fields; balance is explicitly writable so users can
        // correct it, but it is never derived from anything else here.
        const allowed = ['name', 'accountNumber', 'accountHolderName', 'ifsc', 'micrCode', 'branch', 'balance', 'type'];
        const updates = {};
        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(req.body, key) && req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updatable fields provided' });
        }
        if (updates.accountNumber) {
            const rawAcc = String(updates.accountNumber).trim();
            updates.accountNumber = rawAcc.startsWith('gcm1:') ? rawAcc : encrypt(rawAcc);
        }

        await bank.update(updates);
        const updatedJson = bank.toJSON();
        updatedJson.accountNumber = safeDecrypt(updatedJson.accountNumber);
        res.json(updatedJson);
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
        // Preserve bank issuer name on any linked cards so they cleanly become standalone cards
        await Card.update(
            { bankName: bank.name, bankId: null },
            { where: { bankId: bank.id } }
        );
        await bank.destroy();
        res.json({ message: 'Bank deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
