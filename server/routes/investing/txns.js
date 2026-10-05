const express = require('express');
const router = express.Router();
const { sequelize } = require('../../models');
const { InvestmentTxn } = sequelize.models;

router.get('/', async (req, res) => {
    try {
        const txns = await InvestmentTxn.findAll({ where: { userId: req.user.id }, order: [['txDate', 'DESC']] });
        res.json(txns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const t = await InvestmentTxn.create({ ...req.body, userId: req.user.id });
        res.status(201).json(t);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;