const express = require('express');
const router = express.Router();
const { sequelize } = require('../../models');
const { Op } = require('sequelize');
const { fifoLots, holdingPeriod } = require('../../utils/investing/fifo');
const { toPaise } = require('../../utils/investing/money');

const { InvestmentTxn, Asset, TaxLot } = sequelize.models;

router.get('/report', async (req, res) => {
    try {
        const year = Number(req.query.year) || new Date().getUTCFullYear();
        const from = `${year}-01-01`;
        const to = `${year}-12-31`;

        const txns = await InvestmentTxn.findAll({
            where: { userId: req.user.id, txDate: { [Op.between]: [from, to] } },
            order: [['assetId', 'ASC'], ['txDate', 'ASC']]
        });

        let stcg = 0;
        let ltcg = 0;
        const details = [];

        const byAsset = new Map();
        for (const t of txns) {
            const aid = t.assetId;
            if (!byAsset.has(aid)) byAsset.set(aid, []);
            byAsset.get(aid).push(t);
        }

        for (const [aid, list] of byAsset) {
            const buys = list.filter((x) => (x.type === 'buy' || x.type === 'sip') && Number(x.units) > 0);
            const sells = list.filter((x) => x.type === 'sell' && Number(x.units) > 0);
            const lots = buys.map((b) => ({
                id: b.id,
                openDate: b.txDate,
                quantity: Number(b.units),
                costPerUnit: Number(b.units) > 0 ? Number(b.amount) / Number(b.units) : 0
            }));
            for (const s of sells) {
                const qty = Number(s.units);
                const nav = Number(s.nav || 0);
                const proceeds = toPaise(qty * nav);
                const result = fifoLots({ quantity: qty, proceedsPaise: proceeds, date: s.txDate }, lots);
                for (const a of result.allocations) {
                    const gain = Number(a.gainPaise) / 100;
                    const hp = holdingPeriod(a.openDate, s.txDate);
                    const type = hp >= 365 ? 'LTCG' : 'STCG';
                    if (type === 'LTCG') ltcg += gain; else stcg += gain;
                    details.push({ assetId: aid, sellDate: s.txDate, buyDate: a.openDate, units: a.quantity, gain, type, hp });
                }
                // lots consumed by allocations: reduce remaining quantities conceptually (simplified)
            }
        }

        res.json({ year, stcg, ltcg, totalGains: stcg + ltcg, details });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;