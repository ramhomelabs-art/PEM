const express = require('express');
const router = express.Router();
const { Investment, InvestmentTransaction } = require('../../models');
const { authenticateToken } = require('../../middleware/auth');
const { num, computeRealizedGains } = require('../../utils/investmentLedger');

router.get('/report', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const year = Number(req.query.year) || new Date().getFullYear();
        const from = new Date(year, 0, 1);
        const to = new Date(year + 1, 0, 1);

        const investments = await Investment.findAll({
            where: { userId },
            include: [{
                model: InvestmentTransaction,
                as: 'transactions',
                order: [['date', 'ASC']]
            }]
        });

        const details = [];
        let stcg = 0;
        let ltcg = 0;

        investments.forEach((inv) => {
            const result = computeRealizedGains(inv.transactions || [], {
                from,
                to,
                onMatch: (match) => {
                    details.push({
                        investmentName: inv.name,
                        sellDate: match.sellDate,
                        buyDate: match.buyDate,
                        units: match.units,
                        buyPrice: match.buyPrice,
                        sellPrice: match.sellPrice,
                        gain: match.gain,
                        type: match.isLongTerm ? 'LTCG' : 'STCG',
                        daysHeld: match.daysHeld
                    });
                }
            });

            stcg += result.stcg;
            ltcg += result.ltcg;
        });

        res.json({
            year,
            stcg: num(stcg),
            ltcg: num(ltcg),
            totalGains: num(stcg) + num(ltcg),
            details
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
