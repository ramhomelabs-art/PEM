// Newton-Raphson method to calculate XIRR
const calculateXIRR = (transactions, currentValue) => {
    // Transactions: [{ amount: 5000, date: '2023-01-01', type: 'BUY' }]

    // 1. Prepare Cashflows
    // BUY/SIP = Outflow (Negative)
    // SELL/DIVIDEND = Inflow (Positive)
    // Current Value = Inflow (Positive) relative to Today

    const cashflows = transactions.map(t => {
        let amt = parseFloat(t.amount);
        if (t.type === 'BUY' || t.type === 'SIP') {
            amt = -amt;
        }
        return { amount: amt, date: new Date(t.date) };
    });

    // Add Current Value as "Terminal Value"
    if (currentValue > 0) {
        cashflows.push({ amount: parseFloat(currentValue), date: new Date() });
    }

    // Sort by date
    cashflows.sort((a, b) => a.date - b.date);

    // Validate: Need at least one negative and one positive
    if (!cashflows.some(c => c.amount < 0) || !cashflows.some(c => c.amount > 0)) {
        return 0;
    }

    // 2. Calculation
    // XIRR is the rate 'r' such that sum(amount / (1+r)^years) = 0

    const xnpv = (rate) => {
        return cashflows.reduce((acc, cf) => {
            const days = (cf.date - cashflows[0].date) / (1000 * 60 * 60 * 24);
            const years = days / 365.0;
            return acc + (cf.amount / Math.pow(1 + rate, years));
        }, 0);
    };

    const dxnpv = (rate) => {
        return cashflows.reduce((acc, cf) => {
            const days = (cf.date - cashflows[0].date) / (1000 * 60 * 60 * 24);
            const years = days / 365.0;
            return acc - (years * cf.amount / Math.pow(1 + rate, years + 1));
        }, 0);
    };

    let rate = 0.1; // Initial guess 10%
    for (let i = 0; i < 50; i++) { // Max iterations
        const fValue = xnpv(rate);
        const fDerivative = dxnpv(rate);

        if (Math.abs(fValue) < 1e-6) break; // Converged

        const newRate = rate - fValue / fDerivative;
        if (isNaN(newRate) || Math.abs(newRate - rate) < 1e-6) break;

        rate = newRate;
    }

    return rate * 100; // Return as percentage
};

module.exports = calculateXIRR;
