const express = require('express');
const router = express.Router();
const { sequelize } = require('../../models');
const { Asset, InvestmentTxn } = sequelize.models;

const handleDashboardStats = async (req, res) => {
    try {
        const [assets, txns] = await Promise.all([
            Asset ? Asset.findAll({ where: { userId: req.user.id, status: 'active' } }) : [],
            InvestmentTxn ? InvestmentTxn.findAll({ where: { userId: req.user.id } }) : []
        ]);

        const totalInvested = (txns || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const holdings = (assets || []).length;

        // Current & invested calculations
        const current = (assets || []).reduce(
            (sum, a) => sum + (Number(a.currentValue) || Number(a.investedAmount) || 0),
            0
        );
        const invested =
            totalInvested ||
            (assets || []).reduce((sum, a) => sum + (Number(a.investedAmount) || 0), 0);
        const unrealized = current - invested;
        const percentage = invested > 0 ? (unrealized / invested) * 100 : 0;

        // Group assets by category/type for allocation breakdown
        const allocMap = {};
        for (const a of assets || []) {
            const type = a.type || a.assetType || 'Other';
            const val = Number(a.currentValue) || Number(a.investedAmount) || 0;
            allocMap[type] = (allocMap[type] || 0) + val;
        }
        const allocation = Object.entries(allocMap).map(([name, value]) => ({ name, value }));

        res.json({
            totalInvested,
            holdings,
            count: holdings,
            current,
            invested,
            unrealized,
            percentage,
            allocation,
            assets: assets || [],
            txns: (txns || []).slice(0, 20)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

router.get('/', handleDashboardStats);
router.get('/stats', handleDashboardStats);

module.exports = router;