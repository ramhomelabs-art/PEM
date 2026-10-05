const express = require('express');
const router = express.Router();
const { sequelize } = require('../../models');
const { Sip } = sequelize.models;

router.get('/', async (req, res) => {
    try {
        const sips = await Sip.findAll({ where: { userId: req.user.id }, order: [['startDate', 'DESC']] });
        res.json(sips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const s = await Sip.create({ ...req.body, userId: req.user.id });
        res.status(201).json(s);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const s = await Sip.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!s) return res.status(404).json({ error: 'SIP not found' });
        await s.update(req.body);
        res.json(s);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;