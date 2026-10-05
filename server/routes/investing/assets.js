const express = require('express');
const router = express.Router();
const { sequelize } = require('../../models');
const { Op } = require('sequelize');

const { Asset, Goal, Sip, InvestmentTxn, Price } = sequelize.models;

router.get('/', async (req, res) => {
    try {
        const assets = await Asset.findAll({ where: { userId: req.user.id }, order: [['name', 'ASC']] });
        res.json(assets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const a = await Asset.create({ ...req.body, userId: req.user.id });
        res.status(201).json(a);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const a = await Asset.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!a) return res.status(404).json({ error: 'Asset not found' });
        await a.update(req.body);
        res.json(a);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const a = await Asset.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!a) return res.status(404).json({ error: 'Asset not found' });
        await a.destroy();
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;