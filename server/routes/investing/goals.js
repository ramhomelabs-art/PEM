const express = require('express');
const router = express.Router();
const { sequelize } = require('../../models');
const { Goal } = sequelize.models;

router.get('/', async (req, res) => {
    try {
        const goals = await Goal.findAll({ where: { userId: req.user.id }, order: [['name', 'ASC']] });
        res.json(goals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const g = await Goal.create({ ...req.body, userId: req.user.id });
        res.status(201).json(g);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;