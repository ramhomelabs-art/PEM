const express = require('express');
const router = express.Router();
const { Loan, Transaction } = require('../../models');
const { authenticateToken } = require('../../middleware/auth');

router.use(authenticateToken);

/**
 * Helper to compute loan EMI and breakdown
 */
const computeLoanBreakdown = (loan) => {
    const P = parseFloat(loan.totalAmount) || 0;
    const rate = parseFloat(loan.interestRate) || 0;
    const n = parseInt(loan.tenureMonths, 10) || 1;
    const r = rate / 12 / 100;
    const processingFee = parseFloat(loan.processingFee) || 0;

    let emi = parseFloat(loan.emiAmount) || 0;
    if (!emi && P && rate && n) {
        emi = r > 0 ? Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) : Math.round(P / n);
    }

    const totalPayable = emi * n;
    const totalInterest = Math.max(0, totalPayable - P);
    const totalLoanCost = totalPayable + processingFee;

    const remaining = parseFloat(loan.remainingAmount);
    const principalPaid = Math.max(0, P - remaining);
    const completedEmis = P > 0 ? Math.min(n, Math.max(0, Math.round((principalPaid / P) * n))) : 0;
    const remainingEmis = Math.max(0, n - completedEmis);

    // Date calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let isClosed = loan.status === 'closed' || remaining <= 0;
    let isEmiPaid = false;
    let isEmiGenerated = false;
    let isOverdue = false;
    let nextEmiDateObj = null;

    if (loan.nextEmiDate) {
        nextEmiDateObj = new Date(loan.nextEmiDate);
        nextEmiDateObj.setHours(0, 0, 0, 0);

        if (!isClosed) {
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();

            const nextYear = nextEmiDateObj.getFullYear();
            const nextMonth = nextEmiDateObj.getMonth();

            // Next EMI is in a future month (e.g. November while today is October)
            const isNextEmiInFutureMonth = (nextYear > currentYear) || (nextYear === currentYear && nextMonth > currentMonth);

            if (isNextEmiInFutureMonth) {
                // Current month's EMI has already been paid
                isEmiPaid = true;
                isEmiGenerated = false;
                isOverdue = false;
            } else if (nextYear === currentYear && nextMonth === currentMonth) {
                // Next EMI is in the current month
                // EMI is generated and payable (typically generated 5-7 days before or from 1st of month)
                isEmiGenerated = true;
                isEmiPaid = false;
                isOverdue = today.getTime() > nextEmiDateObj.getTime();
            } else {
                // Next EMI is in a past month and still unpaid -> Overdue!
                isEmiGenerated = true;
                isEmiPaid = false;
                isOverdue = true;
            }
        }
    }

    return {
        P,
        rate,
        n,
        emi,
        processingFee,
        totalInterest,
        totalPayable,
        totalLoanCost,
        principalPaid,
        completedEmis,
        remainingEmis,
        isClosed,
        isEmiPaid,
        isEmiGenerated,
        isOverdue
    };
};

// Get all loans for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const loans = await Loan.findAll({
            where: { userId: req.params.userId },
            order: [['startDate', 'DESC']]
        });

        const enhancedLoans = loans.map((loan) => {
            const data = loan.toJSON();
            const breakdown = computeLoanBreakdown(data);
            return {
                ...data,
                ...breakdown
            };
        });

        res.json(enhancedLoans);
    } catch (err) {
        console.error('[Loans Error]:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

const isValidUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// Get single loan
router.get('/:id', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) return res.status(404).json({ error: 'Loan not found' });

        const loan = await Loan.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });
        if (!loan) return res.status(404).json({ error: 'Loan not found' });

        const data = loan.toJSON();
        const breakdown = computeLoanBreakdown(data);
        res.json({ ...data, ...breakdown });
    } catch (err) {
        console.error('[Loan Error]:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Get detailed Amortization schedule and terms for a loan
router.get('/:id/amortization', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) return res.status(404).json({ error: 'Loan not found' });

        const loan = await Loan.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });
        if (!loan) return res.status(404).json({ error: 'Loan not found' });

        const data = loan.toJSON();
        const breakdown = computeLoanBreakdown(data);

        const P = breakdown.P;
        const r = breakdown.rate / 12 / 100;
        const n = breakdown.n;
        const emi = breakdown.emi;
        const emiDay = data.emiDay || 1;

        // Generate month-by-month amortization schedule
        const schedule = [];
        let balance = P;
        const start = data.startDate ? new Date(data.startDate) : new Date();

        for (let m = 1; m <= n; m++) {
            const interest = r > 0 ? Math.round(balance * r) : 0;
            const principal = m === n ? balance : Math.min(balance, emi - interest);
            const closing = Math.max(0, balance - principal);

            // Compute due date for installment m
            const dueDate = new Date(Date.UTC(
                start.getUTCFullYear(),
                start.getUTCMonth() + m,
                Math.min(emiDay, new Date(start.getUTCFullYear(), start.getUTCMonth() + m + 1, 0).getDate())
            ));

            const isPaid = m <= breakdown.completedEmis;
            const isCurrent = m === breakdown.completedEmis + 1 && !breakdown.isClosed;

            schedule.push({
                installmentNo: m,
                dueDate: dueDate.toISOString().split('T')[0],
                openingBalance: Math.round(balance),
                emi: Math.round(principal + interest),
                principal: Math.round(principal),
                interest: Math.round(interest),
                closingBalance: Math.round(closing),
                status: isPaid ? 'PAID' : (isCurrent ? (breakdown.isOverdue ? 'OVERDUE' : 'DUE') : 'SCHEDULED')
            });

            balance = closing;
            if (balance <= 0) break;
        }

        // Standard Banking & Regulatory Terms and Conditions
        const termsAndConditions = {
            interestType: data.interestType || 'Reducing Balance Method (Monthly Rest)',
            repaymentMode: 'Auto-Debit (NACH / ECS / NetBanking)',
            gracePeriod: '3 days from the scheduled EMI generation/due date',
            prepaymentPolicy: 'Zero penalty on part-prepayment or foreclosure for individual floating-rate retail loans as per RBI Master Directions. For fixed-rate loans, standard 2% - 4% foreclosure charges apply.',
            penalCharges: 'Late payment interest of 2% per month (24% p.a.) applicable on overdue installment for the delayed period, alongside standard ECS/NACH bounce fees.',
            processingFeePolicy: 'One-time administrative processing fee charged upfront. Non-refundable upon loan disbursement.',
            taxDeductions: data.category === 'Home Loan'
                ? 'Eligible for deduction under Section 80C (Principal up to ₹1.5 Lakhs) and Section 24(b) (Interest up to ₹2 Lakhs).'
                : (data.category === 'Student Loan'
                    ? 'Eligible for deduction on total interest paid under Section 80E.'
                    : 'Personal Loans are not tax deductible unless utilized for business assets or home renovation.')
        };

        res.json({
            loan: { ...data, ...breakdown },
            schedule,
            termsAndConditions
        });
    } catch (err) {
        console.error('[Amortization Error]:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Create new loan
router.post('/', async (req, res) => {
    try {
        const {
            name,
            category,
            bankProvider,
            totalAmount,
            interestRate,
            tenureMonths,
            emiAmount,
            startDate,
            emiDay,
            status,
            processingFee,
            interestType,
            terms
        } = req.body;

        const start = startDate ? new Date(startDate) : new Date();
        const startDay = !isNaN(start.getDate()) ? start.getDate() : 1;
        const resolvedEmiDay = parseInt(emiDay, 10) || startDay;

        // Calculate first nextEmiDate: exactly 1 month after start date, on resolvedEmiDay
        const nextMonthYear = start.getMonth() === 11 ? start.getFullYear() + 1 : start.getFullYear();
        const nextMonth = (start.getMonth() + 1) % 12;
        const maxDaysInNextMonth = new Date(nextMonthYear, nextMonth + 1, 0).getDate();
        const day = Math.min(resolvedEmiDay, maxDaysInNextMonth);
        const nextDate = new Date(Date.UTC(nextMonthYear, nextMonth, day));
        const nextEmiDate = nextDate.toISOString().split('T')[0];

        const P = parseFloat(totalAmount) || 0;
        const rate = parseFloat(interestRate) || 0;
        const n = parseInt(tenureMonths, 10) || 1;
        const r = rate / 12 / 100;

        let calculatedEmi = parseFloat(emiAmount);
        if (!calculatedEmi && P && rate && n) {
            calculatedEmi = r > 0 ? Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) : Math.round(P / n);
        }

        const loan = await Loan.create({
            userId: req.user.id,
            name,
            category: category || 'Personal Loan',
            bankProvider,
            totalAmount: P,
            interestRate: rate,
            tenureMonths: n,
            emiAmount: calculatedEmi || 0,
            startDate: startDate || new Date().toISOString().split('T')[0],
            nextEmiDate,
            emiDay: resolvedEmiDay,
            status: status || 'active',
            processingFee: parseFloat(processingFee) || 0,
            remainingAmount: P,
            interestType: interestType || 'Reducing Balance',
            terms: terms || null
        });

        const data = loan.toJSON();
        const breakdown = computeLoanBreakdown(data);
        res.status(201).json({ ...data, ...breakdown });
    } catch (err) {
        console.error('[Create Loan Error]:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Update loan
router.put('/:id', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) return res.status(404).json({ error: 'Loan not found' });

        const loan = await Loan.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!loan) return res.status(404).json({ error: 'Loan not found' });

        const {
            name,
            category,
            bankProvider,
            totalAmount,
            interestRate,
            tenureMonths,
            emiAmount,
            startDate,
            emiDay,
            status,
            processingFee,
            interestType,
            terms
        } = req.body;

        await loan.update({
            name,
            category,
            bankProvider,
            totalAmount: parseFloat(totalAmount) || 0,
            interestRate: parseFloat(interestRate) || 0,
            tenureMonths: parseInt(tenureMonths, 10) || 0,
            emiAmount: parseFloat(emiAmount) || 0,
            startDate,
            emiDay: parseInt(emiDay, 10) || loan.emiDay,
            status,
            processingFee: parseFloat(processingFee) || 0,
            interestType: interestType || loan.interestType,
            terms: terms !== undefined ? terms : loan.terms
        });

        const data = loan.toJSON();
        const breakdown = computeLoanBreakdown(data);
        res.json({ ...data, ...breakdown });
    } catch (err) {
        console.error('[Update Loan Error]:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Record loan EMI payment
router.post('/pay/:id', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) return res.status(404).json({ error: 'Loan not found' });
        const { amount, paymentDate } = req.body;
        const loan = await Loan.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!loan) return res.status(404).json({ error: 'Loan not found' });

        const paymentAmount = parseFloat(amount || loan.emiAmount);
        const effectivePayDate = paymentDate || new Date().toISOString().split('T')[0];

        // Update remainingAmount
        const currentRemaining = parseFloat(loan.remainingAmount) || parseFloat(loan.totalAmount);
        loan.remainingAmount = Math.max(0, currentRemaining - paymentAmount);
        loan.lastPaymentDate = effectivePayDate;

        // Advance nextEmiDate by 1 month, maintaining emiDay
        if (loan.nextEmiDate) {
            const currentNext = new Date(loan.nextEmiDate);
            if (!isNaN(currentNext.getTime())) {
                const targetDay = loan.emiDay || currentNext.getUTCDate() || 1;
                const nextMonthYear = currentNext.getUTCMonth() === 11 ? currentNext.getUTCFullYear() + 1 : currentNext.getUTCFullYear();
                const nextMonth = (currentNext.getUTCMonth() + 1) % 12;
                const maxDaysInNextMonth = new Date(Date.UTC(nextMonthYear, nextMonth + 1, 0)).getUTCDate();
                const day = Math.min(targetDay, maxDaysInNextMonth);
                const nextDate = new Date(Date.UTC(nextMonthYear, nextMonth, day));
                loan.nextEmiDate = nextDate.toISOString().split('T')[0];
                console.log(`[Loans] Paid EMI. Advanced nextEmiDate to: ${loan.nextEmiDate}`);
            }
        }

        // If loan is fully settled
        if (loan.remainingAmount <= 0) {
            loan.remainingAmount = 0;
            loan.status = 'closed';
        }

        await loan.save();

        // Create expense transaction linked to this loan
        await Transaction.create({
            userId: req.user.id,
            loanId: loan.id,
            amount: paymentAmount,
            type: 'expense',
            category: 'Loan EMI',
            description: `EMI Payment: ${loan.name}`,
            date: effectivePayDate,
            paymentMode: 'NetBanking',
            source: 'manual'
        });

        const data = loan.toJSON();
        const breakdown = computeLoanBreakdown(data);

        res.json({
            message: 'EMI Payment recorded successfully',
            loan: { ...data, ...breakdown },
            remainingAmount: loan.remainingAmount
        });
    } catch (err) {
        console.error('[Loan Payment Error]:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Delete loan
router.delete('/:id', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) return res.status(404).json({ error: 'Loan not found' });
        const result = await Loan.destroy({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!result) return res.status(404).json({ error: 'Loan not found' });
        res.json({ message: 'Loan deleted successfully' });
    } catch (err) {
        console.error('[Delete Loan Error]:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

module.exports = router;
