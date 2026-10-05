const express = require('express');
const router = express.Router();
const { Investment, InvestmentTransaction, InvestmentSnapshot } = require('../../models');
const { Op } = require('sequelize');
const { num, computeRealizedGains } = require('../../utils/investmentLedger');
const xirr = require('../../utils/xirr');

const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

// Snapshots use DATEONLY, but normalise defensively so grouping never splits a
// single day across two points.
const asDateKey = (value) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
};

const handleDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const investments = await Investment.findAll({ where: { userId } });

        let totalInvested = 0;
        let currentValue = 0;
        const allocationMap = {};

        investments.forEach((inv) => {
            totalInvested += num(inv.totalInvested);
            currentValue += num(inv.currentValue);

            const cat = inv.category || 'Other';
            allocationMap[cat] = (allocationMap[cat] || 0) + num(inv.currentValue);
        });

        // --- Day change ---
        // Value of the portfolio at the last snapshot before today. Fetched in a
        // single query and reduced in memory instead of one query per holding.
        const yesterdayValue = await (async () => {
            if (!investments.length) return 0;
            const snapshots = await InvestmentSnapshot.findAll({
                where: { userId, date: { [Op.lt]: startOfToday() } },
                order: [['date', 'DESC']]
            });

            const latestByInvestment = new Map();
            snapshots.forEach((snap) => {
                if (!latestByInvestment.has(snap.investmentId)) {
                    latestByInvestment.set(snap.investmentId, num(snap.value));
                }
            });

            // Holdings with no history fall back to their cost basis.
            return investments.reduce(
                (sum, inv) => sum + (latestByInvestment.get(inv.id) ?? num(inv.totalInvested)),
                0
            );
        })();

        const dayChange = currentValue - yesterdayValue;
        const dayChangePerc = yesterdayValue > 0 ? (dayChange / yesterdayValue) * 100 : 0;

        const unrealizedGains = currentValue - totalInvested;
        const returnsPercentage = totalInvested > 0 ? (unrealizedGains / totalInvested) * 100 : 0;

        const allocation = Object.entries(allocationMap).map(([name, value]) => ({ name, value }));

        // --- Portfolio value history (drives the dashboard sparkline) ---
        const history = await (async () => {
            if (!investments.length) return [];
            const snapshots = await InvestmentSnapshot.findAll({
                where: { userId },
                order: [['date', 'ASC']]
            });

            const byDate = new Map();
            snapshots.forEach((snap) => {
                const key = asDateKey(snap.date);
                byDate.set(key, (byDate.get(key) || 0) + num(snap.value));
            });

            const points = [...byDate.entries()]
                .map(([date, value]) => ({ date, value }))
                .sort((a, b) => a.date.localeCompare(b.date));

            // Anchor the series on today's live value so the chart always reaches
            // the number shown in the headline stat.
            const today = asDateKey(new Date());
            const last = points[points.length - 1];
            if (!last || last.date !== today) {
                points.push({ date: today, value: currentValue });
            } else {
                last.value = currentValue;
            }

            return points;
        })();

        // --- Realized + annualized returns ---
        const allTransactions = await InvestmentTransaction.findAll({
            where: { userId }
        });

        const realized = computeRealizedGains(allTransactions);
        const annualised = xirr(allTransactions, currentValue);

        res.json({
            invested: totalInvested,
            current: currentValue,
            unrealized: unrealizedGains,
            realized: realized.totalGains,
            todayChange: dayChange,
            todayChangePerc: dayChangePerc.toFixed(2),
            percentage: returnsPercentage.toFixed(2),
            xirr: annualised.toFixed(2),
            count: investments.length,
            allocation,
            history
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

router.get('/', handleDashboardStats);
router.get('/stats', handleDashboardStats);

module.exports = router;
