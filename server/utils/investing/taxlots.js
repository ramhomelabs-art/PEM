const { fifoLots, holdingPeriod } = require('./fifo');
const { mulDiv } = require('./money');

function isBuyLike(type) {
    return type === 'buy' || type === 'sip';
}

function isSell(type) {
    return type === 'sell';
}

function buildOpenLotsFromBuys(buys) {
    return (buys || []).map((t) => ({
        id: t.id,
        openDate: t.txDate,
        quantity: Number(t.units || 0),
        costPerUnit: Number(t.units) > 0 ? Number(t.amount) / Number(t.units) : 0
    }));
}

/**
 * Compute gains summary for a sell txn using FIFO allocations.
 * sell: { txDate, nav, amount? }
 * allocations: from fifoLots({quantity, proceedsPaise, date}, lots)
 */
function computeTaxOnSell(sell, allocations, opts = {}) {
    let totalGain = 0;
    const details = [];
    const longTermMonths = opts.longTermMonths ?? 12;
    for (const a of allocations || []) {
        const gain = Number(a.gainPaise || 0) / 100;
        const hp = holdingPeriod(a.openDate, sell.txDate || sell.date);
        let type = 'stcg';
        if (hp >= longTermMonths * 30) type = 'ltcg'; // rough, but consistent
        details.push({ lotId: a.lotId, qty: a.quantity, gain, hp, type });
        totalGain += gain;
    }
    return { totalGain, details };
}

module.exports = { isBuyLike, isSell, buildOpenLotsFromBuys, computeTaxOnSell };