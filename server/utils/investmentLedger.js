/**
 * Shared ledger maths for investment transactions.
 *
 * Cached stats on the Investment row (totalInvested / unitsHeld) are derived
 * from the transaction ledger, so they are always recomputed as a replay
 * instead of being incremented. That way an edited or deleted transaction
 * cannot leave the cached values drifting away from the ledger.
 */

// Types that add to the cost basis and unit count
const ACQUISITIONS = ['BUY', 'SIP'];

const SELL = 'SELL';

// Equity/debt long-term threshold. Simplified 1-year rule; not asset-class aware.
const LONG_TERM_DAYS = 365;

const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const asDate = (value) => (value instanceof Date ? value : new Date(value));

const compareDates = (a, b) => asDate(a.date).getTime() - asDate(b.date).getTime();

const daysBetween = (from, to) => Math.ceil((asDate(to) - asDate(from)) / 86400000);

/**
 * Replay the ledger to get the cost basis and units held.
 * Sells reduce the basis proportionally, using the average cost of the units
 * held at the time of the sale.
 */
const computeLedgerStats = (transactions) => {
    let totalInvested = 0;
    let unitsHeld = 0;

    [...transactions].sort(compareDates).forEach((txn) => {
        const amount = num(txn.amount);
        const units = num(txn.units);

        if (ACQUISITIONS.includes(txn.type)) {
            totalInvested += amount;
            unitsHeld += units;
        } else if (txn.type === SELL) {
            const avgCost = unitsHeld > 0 ? totalInvested / unitsHeld : 0;
            totalInvested -= avgCost * units;
            unitsHeld -= units;
        }
    });

    return {
        totalInvested: Math.max(0, totalInvested),
        unitsHeld: Math.max(0, unitsHeld)
    };
};

/**
 * How a single transaction moves the current market value.
 * Market value is never derived from the ledger, so a BUY/SELL only shifts the
 * existing value by the amount traded.
 */
const valueDelta = (txn) => {
    const amount = num(txn && txn.amount);
    if (ACQUISITIONS.includes(txn.type)) return amount;
    if (txn.type === SELL) return -amount;
    return 0;
};

/**
 * FIFO capital gains.
 *
 * The cost-basis queue is always built from the full history, because a sale in
 * the reporting window may be matched against a much older purchase. `from`/`to`
 * only control which sales get reported.
 */
const computeRealizedGains = (transactions, { from, to, onMatch } = {}) => {
    let shortTerm = 0;
    let longTerm = 0;

    const ordered = [...transactions].sort(compareDates);
    const queue = [];

    ordered.forEach((txn) => {
        if (ACQUISITIONS.includes(txn.type)) {
            queue.push({ units: num(txn.units), price: num(txn.pricePerUnit), date: txn.date });
            return;
        }

        if (txn.type !== SELL) return;

        const sellDate = asDate(txn.date);
        const inWindow = (!from || sellDate >= asDate(from)) && (!to || sellDate < asDate(to));
        let unitsToSell = num(txn.units);
        const sellPrice = num(txn.pricePerUnit);

        while (unitsToSell > 0 && queue.length > 0) {
            const batch = queue[0];
            const matchUnits = Math.min(unitsToSell, batch.units);

            const gain = matchUnits * sellPrice - matchUnits * batch.price;
            const daysHeld = daysBetween(batch.date, sellDate);
            const isLongTerm = daysHeld > LONG_TERM_DAYS;

            if (inWindow) {
                if (isLongTerm) {
                    longTerm += gain;
                } else {
                    shortTerm += gain;
                }

                if (onMatch) {
                    onMatch({
                        buyDate: batch.date,
                        sellDate,
                        units: matchUnits,
                        buyPrice: batch.price,
                        sellPrice,
                        gain,
                        daysHeld,
                        isLongTerm
                    });
                }
            }

            unitsToSell -= matchUnits;
            batch.units -= matchUnits;

            if (batch.units <= 0.0001) queue.shift();
        }
    });

    return {
        stcg: shortTerm,
        ltcg: longTerm,
        totalGains: shortTerm + longTerm
    };
};

module.exports = {
    ACQUISITIONS,
    num,
    computeLedgerStats,
    valueDelta,
    computeRealizedGains
};
