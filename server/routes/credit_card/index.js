const express = require('express');
const router = express.Router();
const { CreditCard, CreditCardTransaction, CreditCardEMI, CreditCardBill, CreditCardSetting, User } = require('../../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

console.log('🔧 [STARTUP] Credit Card routes loaded at:', new Date().toISOString());


// Import sub-routes




// Encryption helpers
const INSECURE_KEY = 'your-32-character-secret-key!!';
const RAW_KEY = process.env.ENCRYPTION_KEY;

if (!RAW_KEY || RAW_KEY === INSECURE_KEY) {
    if (process.env.NODE_ENV === 'production') {
        // Previously a public fallback key silently protected PAN/CVV. Fail closed instead.
        throw new Error('[SECURITY] ENCRYPTION_KEY must be set to a strong value in production (card PAN/CVV encryption).');
    }
    console.warn('⚠️ [SECURITY] Using insecure development ENCRYPTION_KEY for card data. Set ENCRYPTION_KEY before storing real card data.');
}

// Normalize to exactly 32 bytes. A supplied 32-byte key is used as-is so existing
// ciphertext remains decryptable; other lengths are hashed to 32 bytes.
const ENCRYPTION_KEY = (() => {
    const buf = Buffer.from(RAW_KEY || INSECURE_KEY, 'utf8');
    return buf.length === 32 ? buf : crypto.createHash('sha256').update(buf).digest();
})();
const IV_LENGTH = 16;
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

// Sensitive card data is encrypted with authenticated AES-256-GCM.
// Format: "v2:" + base64(iv || ciphertext || tag). Legacy values stored with the
// old AES-256-CBC format ("ivHex:cipherHex") are still decryptable for existing rows.
function encrypt(text) {
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return 'v2:' + Buffer.concat([iv, encrypted, tag]).toString('base64');
}

function decrypt(text) {
    if (typeof text === 'string' && text.startsWith('v2:')) {
        const combined = Buffer.from(text.slice(3), 'base64');
        if (combined.length < GCM_IV_LENGTH + GCM_TAG_LENGTH) {
            throw new Error('Invalid encrypted payload');
        }
        const iv = combined.subarray(0, GCM_IV_LENGTH);
        const tag = combined.subarray(combined.length - GCM_TAG_LENGTH);
        const ciphertext = combined.subarray(GCM_IV_LENGTH, combined.length - GCM_TAG_LENGTH);
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    }

    // Legacy AES-256-CBC format: ivHex:cipherHex
    const parts = String(text).split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');
const { authenticateToken: authenticate } = require('../../middleware/auth');

// Short-lived, scope-limited token issued only after re-entering the account
// password. Required before any sensitive card data (PAN / CVV) is returned.
const CARD_SESSION_TTL = '15m';
const CARD_SESSION_TTL_SECONDS = 15 * 60;

const issueCardSession = (userId) =>
    jwt.sign({ id: userId, scope: 'credit-cards' }, JWT_SECRET, { expiresIn: CARD_SESSION_TTL });

// Middleware: requires a valid card-session token bound to the same user.
const requireCardSession = (req, res, next) => {
    const token = req.headers['x-card-session'];
    if (!token) {
        return res.status(403).json({ error: 'Card session required', code: 'CARD_SESSION_REQUIRED' });
    }

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) {
            return res.status(403).json({ error: 'Card session expired', code: 'CARD_SESSION_EXPIRED' });
        }
        if (payload.scope !== 'credit-cards' || !req.user || payload.id !== req.user.id) {
            return res.status(403).json({ error: 'Invalid card session', code: 'CARD_SESSION_INVALID' });
        }
        req.cardSession = payload;
        next();
    });
};

// ------------------------------------------------------------------
// Indian credit-card finance helpers
// ------------------------------------------------------------------

const GST_RATE = 0.18;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Resolve the next occurrence of a billing-style day-of-month (1-28 clamp).
function nextDayOfMonth(day, from = new Date()) {
    const target = Math.min(Math.max(parseInt(day, 10) || 1, 1), 28);
    const d = new Date(from.getFullYear(), from.getMonth(), target);
    const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    if (d < today) d.setMonth(d.getMonth() + 1);
    return d;
}

// Interest-free period: days remaining until the next payment due date.
function buildInterestFreeInfo(card, from = new Date()) {
    const due = nextDayOfMonth(card.dueDate, from);
    const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    return {
        interestFreeDays: parseInt(card.interestFreeDays, 10) || 45,
        nextDueDate: due.toISOString().slice(0, 10),
        daysUntilDue: Math.round((due - today) / 86400000)
    };
}

// Finance (interest) charges on the revolving (unpaid billed) balance.
// Simplified average-daily-balance method: the unpaid statement balance is
// treated as constant from the statement date, accruing APR/365 per day,
// plus 18% GST. Interest only applies once a statement is not paid.
async function computeFinanceChargeReport(card, { asOf = new Date() } = {}) {
    const apr = parseFloat(card.apr) || 42;
    const info = buildInterestFreeInfo(card, asOf);

    const base = {
        apr,
        interestFreeDays: info.interestFreeDays,
        nextDueDate: info.nextDueDate,
        daysUntilDue: info.daysUntilDue,
        revolving: false,
        statementDate: null,
        dueDate: null,
        billedAmount: 0,
        paidAmount: 0,
        revolvingBalance: 0,
        daysCharged: 0,
        averageDailyBalance: 0,
        monthlyInterestRate: round2(apr / 12),
        dailyInterestRate: round2(apr / 365),
        interest: 0,
        gst: 0,
        totalCharges: 0
    };

    const latestBill = await CreditCardBill.findOne({
        where: { creditCardId: card.id, userId: card.userId },
        order: [['billDate', 'DESC']]
    });

    if (!latestBill) return base;

    const billedAmount = parseFloat(latestBill.totalAmount) || 0;
    const paidAmount = parseFloat(latestBill.paidAmount) || 0;
    const revolvingBalance = Math.max(0, billedAmount - paidAmount);
    const isRevolving =
        revolvingBalance > 0.5 && ['unpaid', 'partial', 'overdue'].includes(latestBill.status);

    const billDate = new Date(latestBill.billDate);
    const daysCharged = isRevolving
        ? Math.max(0, Math.ceil((asOf.getTime() - billDate.getTime()) / 86400000))
        : 0;

    const dailyRate = apr / 100 / 365;
    const interest = isRevolving ? revolvingBalance * dailyRate * daysCharged : 0;
    const gst = interest * GST_RATE;

    return {
        ...base,
        revolving: isRevolving,
        statementDate: latestBill.billDate,
        dueDate: latestBill.dueDate,
        billedAmount: round2(billedAmount),
        paidAmount: round2(paidAmount),
        revolvingBalance: round2(revolvingBalance),
        daysCharged,
        averageDailyBalance: round2(revolvingBalance),
        interest: round2(interest),
        gst: round2(gst),
        totalCharges: round2(interest + gst)
    };
}

// Helper: Check and Apply Overdues (Late Payment Fees & Status transition after 3 days grace period)
async function checkAndApplyOverdues(userId) {
    try {
        const cards = await CreditCard.findAll({ where: { userId, isActive: true } });
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        for (const card of cards) {
            const unpaidBills = await CreditCardBill.findAll({
                where: {
                    creditCardId: card.id,
                    status: ['unpaid', 'partial']
                }
            });

            for (const bill of unpaidBills) {
                const billDueDate = new Date(bill.dueDate);
                const billDueDateStart = new Date(billDueDate.getFullYear(), billDueDate.getMonth(), billDueDate.getDate());
                
                const diffTime = todayStart.getTime() - billDueDateStart.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                // RBI rule: If past 3-day grace period (diffDays > 3)
                if (diffDays > 3) {
                    const outstanding = parseFloat(bill.totalAmount) - parseFloat(bill.paidAmount);
                    if (outstanding <= 0) {
                        await bill.update({ status: 'paid' });
                        continue;
                    }

                    // RBI Compliant Tiered Late Payment Fee
                    let lateFee = 0;
                    if (outstanding <= 500) {
                        lateFee = 0;
                    } else if (outstanding <= 1000) {
                        lateFee = 100;
                    } else if (outstanding <= 10000) {
                        lateFee = 500;
                    } else if (outstanding <= 25000) {
                        lateFee = 750;
                    } else {
                        lateFee = 1000;
                    }

                    const gstAmount = lateFee * 0.18;
                    const totalCharges = lateFee + gstAmount;

                    if (lateFee > 0) {
                        // Create Late Fee Transaction
                        await CreditCardTransaction.create({
                            creditCardId: card.id,
                            userId: card.userId,
                            merchant: 'Late Payment Fee',
                            amount: lateFee,
                            transactionDate: today,
                            category: 'Fees',
                            type: 'debit',
                            description: `Late payment fee for bill due on ${bill.dueDate}`
                        });

                        // Create GST Transaction
                        await CreditCardTransaction.create({
                            creditCardId: card.id,
                            userId: card.userId,
                            merchant: 'GST on Late Fee',
                            amount: gstAmount,
                            transactionDate: today,
                            category: 'Taxes',
                            type: 'debit',
                            description: `18% GST on late payment fee`
                        });

                        // Update Card usedAmount
                        await card.update({
                            usedAmount: parseFloat(card.usedAmount) + totalCharges
                        });
                    }

                    // Update bill status to overdue
                    await bill.update({ status: 'overdue' });
                    console.log(`[Overdue Fee] Applied late fee of ₹${lateFee} + GST ₹${gstAmount} to card ${card.cardName} for bill due on ${bill.dueDate}`);
                }
            }
        }
    } catch (e) {
        console.error('[Overdue Fee Check] Error:', e);
    }
}

// Helper: Check and Generate Bills
async function checkAndGenerateBills(userId, force = false) {
    try {
        const cards = await CreditCard.findAll({ where: { userId, isActive: true } });
        const today = new Date();
        const currentMonth = today.getMonth(); // 0-11
        const currentYear = today.getFullYear();

        for (const card of cards) {
            const billDay = card.billingDate;
            const usedAmount = parseFloat(card.usedAmount) || 0;
            const totalDue = parseFloat(card.totalDue) || 0;
            const unbilledAmount = usedAmount - totalDue;

            console.log(`[Bill Gen] Checking ${card.cardName}:`);
            console.log(`  - BillDay: ${billDay}, Today: ${today.getDate()}`);
            console.log(`  - UsedAmount: ${usedAmount}, TotalDue: ${totalDue}, Unbilled: ${unbilledAmount}`);

            // Check if today's date >= billing date (e.g., if billing is on 31st and today is 31st)
            if (today.getDate() >= billDay) {
                console.log(`  ✓ Today (${today.getDate()}) >= BillDay (${billDay})`);

                // Check if bill already generated for this month
                const existingBill = await CreditCardBill.findOne({
                    where: {
                        creditCardId: card.id,
                    },
                    order: [['billDate', 'DESC']]
                });

                let shouldGenerate = false;

                if (!existingBill) {
                    console.log(`  ✓ No bills exist for this card - will generate`);
                    shouldGenerate = true;
                } else {
                    const lastBillDate = new Date(existingBill.billDate);
                    const lastBillMonth = lastBillDate.getMonth();
                    const lastBillYear = lastBillDate.getFullYear();

                    console.log(`  - Last bill: ${lastBillDate.toDateString()} (Month: ${lastBillMonth}, Year: ${lastBillYear})`);
                    console.log(`  - Current: Month ${currentMonth}, Year ${currentYear}`);

                    if (lastBillMonth !== currentMonth || lastBillYear !== currentYear) {
                        console.log(`  ✓ No bill for current month - will generate`);
                        shouldGenerate = true;
                    } else if (force && existingBill.status === 'unpaid') {
                        console.log(`  ✓ Force regeneration requested - deleting existing unpaid bill`);
                        await existingBill.destroy();
                        shouldGenerate = true;
                    } else {
                        console.log(`  ✗ Bill already exists for this month - skipping`);
                    }
                }

                if (shouldGenerate) {
                    // GENERATE BILL
                    console.log(`[Bill Gen] 🔄 Generating bill for ${card.cardName} (Day ${billDay})`);

                    // SMART LOGIC: 
                    // 1. Get all active EMIs for this card
                    const activeEmis = await CreditCardEMI.findAll({
                        where: { creditCardId: card.id, userId: card.userId, isActive: true }
                    });

                    // 2. Calculate remaining principal blocked on the card
                    const totalRemainingPrincipal = activeEmis.reduce((sum, emi) => {
                        // Estimate remaining principal: (Tenure - Paid) * (Principal / Tenure)
                        const principalPerMonth = parseFloat(emi.principalAmount) / emi.tenure;
                        const remaining = parseFloat(emi.principalAmount) - (emi.paidInstallments * principalPerMonth);
                        return sum + remaining;
                    }, 0);

                    // 3. Calculate this month's installments
                    const totalMonthlyInstallments = activeEmis.reduce((sum, emi) => sum + parseFloat(emi.monthlyPayment), 0);

                    // 4. Regular spending = Total Used - Remaining EMI Principal
                    // This includes new spends and any previous unpaid regular balance
                    const regularBalance = Math.max(0, parseFloat(card.usedAmount) - totalRemainingPrincipal);

                    // 5. Total Bill = Regular Balance + Monthly Installments
                    const billAmount = regularBalance + totalMonthlyInstallments;

                    // Due Date: Bill Date + 20 days (Standard)
                    const dueDate = new Date(today.getFullYear(), today.getMonth(), billDay + 20);

                    // 6. Find previous unpaid/partial/overdue bills to extract unpaidOverdues
                    const previousUnpaidBills = await CreditCardBill.findAll({
                        where: {
                            creditCardId: card.id,
                            status: ['unpaid', 'partial', 'overdue']
                        }
                    });
                    const unpaidOverdues = previousUnpaidBills.reduce((sum, b) => {
                        return sum + (parseFloat(b.totalAmount) - parseFloat(b.paidAmount));
                    }, 0);

                    // 7. Find last bill to get cycle start date
                    const lastBill = await CreditCardBill.findOne({
                        where: { creditCardId: card.id },
                        order: [['billDate', 'DESC']]
                    });
                    const billingCycleStart = lastBill ? new Date(lastBill.billDate) : new Date(0);

                    // 8. Find all debit transactions in the current cycle
                    const currentTransactions = await CreditCardTransaction.findAll({
                        where: {
                            creditCardId: card.id,
                            type: 'debit',
                            transactionDate: {
                                [require('sequelize').Op.gt]: billingCycleStart
                            }
                        }
                    });

                    let cycleInterestAndFees = 0;
                    let cycleTaxes = 0;

                    for (const tx of currentTransactions) {
                        const desc = (tx.description || '').toLowerCase();
                        const merc = (tx.merchant || '').toLowerCase();
                        const cat = (tx.category || '').toLowerCase();

                        if (cat === 'fees' || cat === 'interest' || merc.includes('late fee') || merc.includes('interest') || desc.includes('late fee') || desc.includes('interest')) {
                            cycleInterestAndFees += parseFloat(tx.amount) || 0;
                        } else if (cat === 'taxes' || merc.includes('gst') || merc.includes('tax') || desc.includes('gst') || desc.includes('tax')) {
                            cycleTaxes += parseFloat(tx.amount) || 0;
                        }
                    }

                    // Apportion against regular balance to ensure exact balance partition
                    const interestAndFees = Math.min(regularBalance, cycleInterestAndFees);
                    const taxes = Math.min(Math.max(0, regularBalance - interestAndFees), cycleTaxes);
                    const spendsPrincipal = Math.max(0, regularBalance - unpaidOverdues - interestAndFees - taxes);

                    // Calculate RBI MAD: Spends Principal 5% + 100% of EMIs/overdues/taxes/fees
                    const calculatedMinDue = (spendsPrincipal * 0.05) + totalMonthlyInstallments + unpaidOverdues + interestAndFees + taxes;
                    
                    let minDueAmount = 0;
                    if (billAmount < 500) {
                        minDueAmount = billAmount;
                    } else {
                        minDueAmount = Math.min(billAmount, Math.max(500, calculatedMinDue));
                    }
                    minDueAmount = Math.ceil(minDueAmount);

                    const metadata = {
                        spendsPrincipal: parseFloat(spendsPrincipal.toFixed(2)),
                        emiPortion: parseFloat(totalMonthlyInstallments.toFixed(2)),
                        unpaidOverdues: parseFloat(unpaidOverdues.toFixed(2)),
                        interestAndFees: parseFloat(interestAndFees.toFixed(2)),
                        taxes: parseFloat(taxes.toFixed(2)),
                        calculationFormula: "Max(500, spendsPrincipal * 0.05 + emiPortion + unpaidOverdues + interestAndFees + taxes)"
                    };

                    console.log(`[Bill Gen] Calculation for ${card.cardName}:`);
                    console.log(`  - Regular Balance: ${regularBalance}`);
                    console.log(`  - EMI Installments: ${totalMonthlyInstallments}`);
                    console.log(`  - Total Bill: ${billAmount}`);
                    console.log(`  - RBI Compliant MAD: ${minDueAmount} (Breakdown: SpendsPrincipal=${spendsPrincipal}, EMIs=${totalMonthlyInstallments}, Overdues=${unpaidOverdues}, Fees=${interestAndFees}, Taxes=${taxes})`);

                    await CreditCardBill.create({
                        creditCardId: card.id,
                        userId: card.userId,
                        billDate: new Date(today.getFullYear(), today.getMonth(), billDay),
                        dueDate: dueDate,
                        totalAmount: billAmount,
                        minDueAmount: minDueAmount,
                        paidAmount: 0,
                        status: billAmount > 0 ? 'unpaid' : 'paid',
                        metadata: metadata
                    });

                    // Update Card: Set TotalDue and minPayment
                    await card.update({
                        totalDue: billAmount,
                        minPayment: minDueAmount
                    });

                    console.log(`[Bill Gen] ✅ Bill generated successfully for ${card.cardName}`);
                }
            }
        }

        // Cleanup: Delete bills older than 1 year
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        await CreditCardBill.destroy({
            where: {
                userId,
                billDate: {
                    [require('sequelize').Op.lt]: oneYearAgo
                }
            }
        });

    } catch (e) {
        console.error('[Bill Gen] Error:', e);
    }
}

// Request logging middleware
router.use(async (req, res, next) => {
    console.log(`[Credit Card Route] ${req.method} ${req.path}`);
    if (req.method === 'GET' && req.path === '/' && req.user) {
        // Lazy check on listing: first apply overdues, then generate bills
        await checkAndApplyOverdues(req.user.id);
        await checkAndGenerateBills(req.user.id);
    }
    next();
});

// ==================== CARD SESSION (step-up unlock) ====================

// POST /session - verify the account password and issue a scoped card token.
router.post('/session', authenticate, async (req, res) => {
    try {
        const { password } = req.body || {};
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const token = issueCardSession(user.id);
        res.json({
            token,
            expiresIn: CARD_SESSION_TTL_SECONDS,
            scope: 'credit-cards'
        });
    } catch (error) {
        console.error('[Card Session] Unlock error:', error);
        res.status(500).json({ error: 'Failed to unlock credit cards' });
    }
});

// GET /session - validate the current card token (used on app load / refresh).
router.get('/session', authenticate, requireCardSession, (req, res) => {
    res.json({
        valid: true,
        scope: 'credit-cards',
        expiresAt: req.cardSession.exp ? req.cardSession.exp * 1000 : null
    });
});

// GET /summary - non-sensitive card metadata for the dashboard / automation.
// Never returns the full card number, CVV, transactions or EMIs.
router.get('/summary', authenticate, async (req, res) => {
    try {
        const cards = await CreditCard.findAll({
            where: { userId: req.user.id, isActive: true },
            order: [['createdAt', 'DESC']],
            attributes: [
                'id', 'bankName', 'cardName', 'cardType', 'expiryMonth', 'expiryYear',
                'creditLimit', 'usedAmount', 'minPayment', 'totalDue', 'billingDate',
                'dueDate', 'rewardPoints', 'cashback', 'annualFee', 'joiningFee',
                'benefits', 'color', 'isActive', 'cardNumber'
            ]
        });

        const summary = cards.map(card => {
            const data = card.toJSON();
            let last4 = '';
            try {
                last4 = decrypt(data.cardNumber).slice(-4);
            } catch (e) {
                last4 = (data.cardNumber || '').toString().slice(-4);
            }
            delete data.cardNumber;
            return {
                ...data,
                last4,
                cardNumber: `•••• •••• •••• ${last4}`,
                cvv: null
            };
        });

        res.json(summary);
    } catch (error) {
        console.error('Error fetching card summary:', error);
        res.status(500).json({ error: 'Failed to fetch credit cards' });
    }
});

// ==================== SETTINGS (persisted preferences) ====================

// GET /settings - stored credit-card preferences (defaults to an empty object).
router.get('/settings', authenticate, async (req, res) => {
    try {
        const [row] = await CreditCardSetting.findOrCreate({
            where: { userId: req.user.id },
            defaults: { settings: {} }
        });
        res.json(row.settings || {});
    } catch (error) {
        console.error('[Card Settings] Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch credit card settings' });
    }
});

// PUT /settings - shallow-merge and persist preference updates.
router.put('/settings', authenticate, async (req, res) => {
    try {
        const [row] = await CreditCardSetting.findOrCreate({
            where: { userId: req.user.id },
            defaults: { settings: {} }
        });
        const merged = { ...(row.settings || {}), ...(req.body || {}) };
        await row.update({ settings: merged });
        res.json(row.settings);
    } catch (error) {
        console.error('[Card Settings] Update error:', error);
        res.status(500).json({ error: 'Failed to update credit card settings' });
    }
});

// ==================== CREDIT CARD ROUTES ====================

// POST manually trigger bill generation (FORCE REGENERATE)
router.post('/generate-bills', authenticate, async (req, res) => {
    try {
        console.log('[Manual Bill Gen] Triggering FRESH regeneration for user:', req.user.id);
        await checkAndGenerateBills(req.user.id, true); // force = true

        res.json({
            success: true,
            message: 'Bills regenerated freshly. Check server logs for details.'
        });
    } catch (error) {
        console.error('Error generating bills:', error);
        res.status(500).json({ error: 'Failed to generate bills' });
    }
});

// POST /apply-overdues - manually trigger overdue checking
router.post('/apply-overdues', authenticate, async (req, res) => {
    try {
        console.log('[Manual Overdue Check] Triggering overdue fee application for user:', req.user.id);
        await checkAndApplyOverdues(req.user.id);
        res.json({
            success: true,
            message: 'Overdue fee check completed.'
        });
    } catch (error) {
        console.error('Error applying overdues:', error);
        res.status(500).json({ error: 'Failed to apply overdues' });
    }
});

// POST clear all generated bills (Only unpaid/current ones)
router.post('/clear-bills', authenticate, async (req, res) => {
    try {
        console.log('[Clear Bills] Clearing current unpaid bills for user:', req.user.id);

        const cards = await CreditCard.findAll({ where: { userId: req.user.id } });
        for (const card of cards) {
            // Find current month's unpaid bill
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            await CreditCardBill.destroy({
                where: {
                    creditCardId: card.id,
                    status: 'unpaid',
                    billDate: {
                        [require('sequelize').Op.gte]: startOfMonth
                    }
                }
            });

            // Reset card totalDue
            await card.update({ totalDue: 0 });
        }

        res.json({
            success: true,
            message: 'All current unpaid bills have been cleared.'
        });
    } catch (error) {
        console.error('Error clearing bills:', error);
        res.status(500).json({ error: 'Failed to clear bills' });
    }
});

// GET all credit cards for user (sensitive: requires card session)
router.get('/', authenticate, requireCardSession, async (req, res) => {
    try {
        const cards = await CreditCard.findAll({
            where: { userId: req.user.id, isActive: true },
            include: [
                {
                    model: CreditCardTransaction,
                    as: 'transactions',
                    limit: 10,
                    order: [['transactionDate', 'DESC']]
                },
                {
                    model: CreditCardEMI,
                    as: 'emis',
                    where: { isActive: true },
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Decrypt sensitive data
        const decryptedCards = cards.map(card => {
            const cardData = card.toJSON();
            cardData.cardNumber = decrypt(cardData.cardNumber);
            cardData.cvv = decrypt(cardData.cvv);
            cardData.apr = parseFloat(cardData.apr) || 42;
            cardData.interestFreeDays = parseInt(cardData.interestFreeDays, 10) || 45;
            cardData.rewardRate = parseInt(cardData.rewardRate, 10) || 1;
            cardData.interestFree = buildInterestFreeInfo(cardData);
            return cardData;
        });

        res.json(decryptedCards);
    } catch (error) {
        console.error('Error fetching credit cards:', error);
        res.status(500).json({ error: 'Failed to fetch credit cards' });
    }
});

// GET finance-charge breakdown for a card (sensitive: requires card session)
router.get('/:id/finance-charges', authenticate, requireCardSession, async (req, res) => {
    try {
        const card = await CreditCard.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!card) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        const report = await computeFinanceChargeReport(card);
        res.json(report);
    } catch (error) {
        console.error('Error computing finance charges:', error);
        res.status(500).json({ error: 'Failed to compute finance charges' });
    }
});

// GET specific credit card (sensitive: requires card session)
router.get('/:id', authenticate, requireCardSession, async (req, res) => {
    try {
        const card = await CreditCard.findOne({
            where: { id: req.params.id, userId: req.user.id },
            include: [
                { model: CreditCardTransaction, as: 'transactions' },
                { model: CreditCardEMI, as: 'emis', where: { isActive: true }, required: false }
            ]
        });

        if (!card) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        const cardData = card.toJSON();
        cardData.cardNumber = decrypt(cardData.cardNumber);
        cardData.cvv = decrypt(cardData.cvv);
        cardData.apr = parseFloat(cardData.apr) || 42;
        cardData.interestFreeDays = parseInt(cardData.interestFreeDays, 10) || 45;
        cardData.rewardRate = parseInt(cardData.rewardRate, 10) || 1;
        cardData.interestFree = buildInterestFreeInfo(cardData);

        res.json(cardData);
    } catch (error) {
        console.error('Error fetching credit card:', error);
        res.status(500).json({ error: 'Failed to fetch credit card' });
    }
});

// POST create new credit card
router.post('/', authenticate, async (req, res) => {
    try {
        const {
            bankName, cardName, cardType, cardNumber, cvv,
            expiryMonth, expiryYear, creditLimit, billingDate, dueDate,
            annualFee, joiningFee, benefits, color,
            apr, interestFreeDays, rewardRate
        } = req.body;

        // Validate required fields
        if (!bankName || !cardName || !cardNumber || !cvv || !expiryMonth || !expiryYear || !creditLimit || !billingDate || !dueDate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Encrypt sensitive data
        const encryptedCardNumber = encrypt(cardNumber);
        const encryptedCVV = encrypt(cvv);

        // More robust helper for bank colors
        const getBankTheme = (bank = '', name = '') => {
            if (color) return color;
            const b = bank.toLowerCase();
            const n = name.toLowerCase();

            // Mapping substrings to gradients
            if (b.includes('hdfc')) return 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
            if (b.includes('icici')) return 'linear-gradient(135deg, #f97316 0%, #2563eb 100%)';
            if (b.includes('sbi')) return 'linear-gradient(135deg, #075985 0%, #0ea5e9 100%)';
            if (b.includes('axis')) return 'linear-gradient(135deg, #9f1239 0%, #e11d48 100%)';
            if (b.includes('kotak')) return 'linear-gradient(135deg, #be123c 0%, #fb7185 100%)';
            if (b.includes('amex') || b.includes('american express')) return 'linear-gradient(135deg, #064e3b 0%, #059669 100%)';
            if (b.includes('standard chartered') || b.includes('scb')) return 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)';
            if (b.includes('citi')) return 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)';
            if (b.includes('rbl')) return 'linear-gradient(135deg, #4338ca 0%, #818cf8 100%)';
            if (b.includes('yes bank') || b.includes('yesbank')) return 'linear-gradient(135deg, #1e40af 0%, #60a5fa 100%)';
            if (b.includes('idfc')) return 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)';
            if (b.includes('hsbc')) return 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)';

            // Variant based
            if (n.includes('platinum')) return 'linear-gradient(135deg, #475569 0%, #94a3b8 100%)';
            if (n.includes('gold')) return 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)';
            if (n.includes('black') || n.includes('infinia')) return 'linear-gradient(135deg, #000000 0%, #333333 100%)';

            // Defaults
            const defaults = [
                'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
                'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)'
            ];
            return defaults[bank.length % defaults.length];
        };

        const finalColor = getBankTheme(bankName, cardName || '');

        const card = await CreditCard.create({
            userId: req.user.id,
            bankName,
            cardName,
            cardType: cardType || 'Visa',
            cardNumber: encryptedCardNumber,
            cvv: encryptedCVV,
            expiryMonth,
            expiryYear,
            creditLimit,
            billingDate,
            dueDate,
            annualFee: annualFee || 0,
            joiningFee: joiningFee || 0,
            benefits: benefits || [],
            color: finalColor,
            apr: apr !== undefined && apr !== '' ? parseFloat(apr) : 42.00,
            interestFreeDays: interestFreeDays !== undefined && interestFreeDays !== '' ? parseInt(interestFreeDays, 10) : 45,
            rewardRate: rewardRate !== undefined && rewardRate !== '' ? parseInt(rewardRate, 10) : 1
        });

        const cardData = card.toJSON();
        cardData.cardNumber = decrypt(cardData.cardNumber);
        cardData.cvv = decrypt(cardData.cvv);

        res.status(201).json(cardData);
    } catch (error) {
        console.error('Error creating credit card:', error);
        res.status(500).json({ error: 'Failed to create credit card' });
    }
});

// DELETE TRANSACTION
router.delete('/transactions/:transactionId', authenticate, async (req, res) => {
    try {
        const transaction = await CreditCardTransaction.findOne({
            where: { id: req.params.transactionId, userId: req.user.id }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const card = await CreditCard.findByPk(transaction.creditCardId);

        // Update card balance (revert amount)
        if (card) {
            const amount = parseFloat(transaction.amount);
            if (transaction.type === 'debit') {
                await card.update({
                    usedAmount: parseFloat(card.usedAmount) - amount,
                    totalDue: parseFloat(card.totalDue) - amount
                });
            } else {
                await card.update({
                    usedAmount: parseFloat(card.usedAmount) + amount,
                    totalDue: parseFloat(card.totalDue) + amount
                });
            }
        }

        await transaction.destroy();
        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// PUT update transaction
router.put('/transactions/:transactionId', authenticate, async (req, res) => {
    try {
        const { merchant, amount, transactionDate, category, type, description } = req.body;

        const transaction = await CreditCardTransaction.findOne({
            where: { id: req.params.transactionId, userId: req.user.id }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const card = await CreditCard.findOne({
            where: { id: transaction.creditCardId, userId: req.user.id }
        });

        if (!card) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        const oldAmount = parseFloat(transaction.amount);
        const oldType = transaction.type;
        const newAmount = amount !== undefined ? parseFloat(amount) : oldAmount;
        const rawType = (type || oldType || 'debit').toString().toLowerCase();
        const newType = (rawType === 'credit' || rawType === 'income' || rawType === 'refund') ? 'credit' : 'debit';

        // Step 1: Revert the old transaction from card utilization
        if (oldType === 'debit') {
            card.usedAmount = Math.max(0, parseFloat(card.usedAmount) - oldAmount);
        } else {
            // credit
            card.usedAmount = parseFloat(card.usedAmount) + oldAmount;
            card.totalDue = parseFloat(card.totalDue) + oldAmount;
        }

        // Step 2: Apply the new transaction to card utilization
        if (newType === 'debit') {
            card.usedAmount = parseFloat(card.usedAmount) + newAmount;
        } else {
            // credit
            card.usedAmount = Math.max(0, parseFloat(card.usedAmount) - newAmount);
            card.totalDue = Math.max(0, parseFloat(card.totalDue) - newAmount);
        }

        // Save card balances
        await card.save();

        // Step 3: Update transaction fields
        await transaction.update({
            merchant: merchant || transaction.merchant,
            amount: newAmount,
            transactionDate: transactionDate || transaction.transactionDate,
            category: category || transaction.category,
            type: newType,
            description: description !== undefined ? description : transaction.description
        });

        res.json(transaction);
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// PUT update credit card
router.put('/:id', authenticate, async (req, res) => {
    try {
        const card = await CreditCard.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!card) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        const updates = { ...req.body };

        // Re-encrypt if card number or CVV is being updated
        if (updates.cardNumber) {
            updates.cardNumber = encrypt(updates.cardNumber);
        }
        if (updates.cvv) {
            updates.cvv = encrypt(updates.cvv);
        }
        if (updates.apr !== undefined) updates.apr = parseFloat(updates.apr) || 42;
        if (updates.interestFreeDays !== undefined) {
            updates.interestFreeDays = parseInt(updates.interestFreeDays, 10) || 45;
        }
        if (updates.rewardRate !== undefined) {
            updates.rewardRate = parseInt(updates.rewardRate, 10) || 1;
        }

        await card.update(updates);

        const cardData = card.toJSON();
        cardData.cardNumber = decrypt(cardData.cardNumber);
        cardData.cvv = decrypt(cardData.cvv);

        res.json(cardData);
    } catch (error) {
        console.error('Error updating credit card:', error);
        res.status(500).json({ error: 'Failed to update credit card' });
    }
});

// DELETE credit card (soft delete)
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const card = await CreditCard.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!card) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        await card.update({ isActive: false });

        res.json({ message: 'Credit card deleted successfully' });
    } catch (error) {
        console.error('Error deleting credit card:', error);
        res.status(500).json({ error: 'Failed to delete credit card' });
    }
});

// POST /:id/reset - Reset card utilization (MUST be before /:id/transactions)
router.post('/:id/reset', authenticate, async (req, res) => {
    try {
        const card = await CreditCard.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!card) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        // Delete all transactions for this card
        await CreditCardTransaction.destroy({
            where: { creditCardId: req.params.id, userId: req.user.id }
        });

        // Delete all EMIs for this card
        await CreditCardEMI.destroy({
            where: { creditCardId: req.params.id, userId: req.user.id }
        });

        // Reset card balance
        await card.update({
            usedAmount: 0,
            totalDue: 0,
            updatedAt: new Date()
        });

        console.log(`[Reset] Card ${req.params.id} utilization reset successfully`);

        res.json({
            message: 'Card utilization reset successfully',
            card
        });
    } catch (error) {
        console.error('Reset card utilization error:', error);
        res.status(500).json({ error: 'Failed to reset card utilization: ' + error.message });
    }
});

// ==================== TRANSACTION ROUTES ====================

// GET all transactions for a card
router.get('/:id/transactions', authenticate, async (req, res) => {
    try {
        const transactions = await CreditCardTransaction.findAll({
            where: { creditCardId: req.params.id, userId: req.user.id },
            order: [['transactionDate', 'DESC']]
        });

        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// GET all transactions across all cards
router.get('/transactions/all', authenticate, async (req, res) => {
    try {
        const transactions = await CreditCardTransaction.findAll({
            where: { userId: req.user.id },
            include: [{ model: CreditCard, attributes: ['cardName', 'bankName'] }],
            order: [['transactionDate', 'DESC']]
        });

        res.json(transactions);
    } catch (error) {
        console.error('Error fetching all transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// POST add transaction
router.post('/:id/transactions', authenticate, async (req, res) => {
    try {
        const { merchant, amount, transactionDate, category, type, description } = req.body;

        if (!merchant || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const card = await CreditCard.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!card) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        const rawType = (type || 'debit').toString().toLowerCase();
        const normalizedType = (rawType === 'credit' || rawType === 'income' || rawType === 'refund') ? 'credit' : 'debit';

        const transaction = await CreditCardTransaction.create({
            creditCardId: req.params.id,
            userId: req.user.id,
            merchant,
            amount,
            transactionDate: transactionDate || new Date(),
            category: category || 'Others',
            type: normalizedType,
            description
        });

        // Update card balance
        // New Logic: 'totalDue' represents the Statement Balance (Billed Amount).
        // It should ONLY be updated when a Bill is generated (moved from Unbilled to Billed) or when Paid.
        // New Purchases (Unbilled) only increase 'usedAmount'.

        if (normalizedType === 'debit') {
            // Reward accrual: `rewardRate` points per ₹100 spent. Fees, interest
            // and taxes do not earn rewards.
            const cat = (category || '').toLowerCase();
            const earnsRewards = !['fees', 'interest', 'taxes'].includes(cat);
            const rewardRate = parseInt(card.rewardRate, 10) || 1;
            const pointsEarned = earnsRewards
                ? Math.floor((parseFloat(amount) || 0) / 100) * rewardRate
                : 0;

            await card.update({
                usedAmount: parseFloat(card.usedAmount) + parseFloat(amount),
                rewardPoints: (parseInt(card.rewardPoints, 10) || 0) + pointsEarned
                // totalDue is FROZEN until Statement Generation
            });
        } else {
            // Credit (Payment)
            // Reduce Billed Amount (totalDue) first, then Used Amount
            // Credit (Payment)
            // Reduce Billed Amount (totalDue) first, then Used Amount
            await card.update({
                usedAmount: Math.max(0, parseFloat(card.usedAmount) - parseFloat(amount)),
                totalDue: Math.max(0, parseFloat(card.totalDue) - parseFloat(amount))
            });

            // SMART LOGIC: If this is a Bill Payment, progress the EMIs
            if (merchant === 'Bill Payment') {
                const activeEmis = await CreditCardEMI.findAll({
                    where: { creditCardId: card.id, userId: card.userId, isActive: true }
                });

                for (const emi of activeEmis) {
                    // Progress the EMI: Mark one installment as paid
                    const newPaidInstallments = emi.paidInstallments + 1;
                    const newTotalPaid = parseFloat(emi.totalPaid) + parseFloat(emi.monthlyPayment);
                    const nextDueDate = new Date(emi.nextDueDate);
                    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

                    const isFinished = newPaidInstallments >= emi.tenure;

                    await emi.update({
                        paidInstallments: newPaidInstallments,
                        totalPaid: newTotalPaid,
                        nextDueDate: isFinished ? emi.nextDueDate : nextDueDate,
                        isActive: !isFinished
                    });

                    // Note: We don't need to update card.usedAmount here because 
                    // the main 'card.update' above already reduced it by the full 'amount'.
                    // The Interest adjustment is handled implicitly because 'usedAmount' 
                    // tracks the actual debt balance.
                }
            }

            // Update specific Bill record if exists (for History)
            const latestBill = await CreditCardBill.findOne({
                where: {
                    creditCardId: card.id,
                    status: ['unpaid', 'partial']
                },
                order: [['billDate', 'DESC']]
            });

            if (latestBill) {
                const newPaid = parseFloat(latestBill.paidAmount) + parseFloat(amount);
                const isFullyPaid = newPaid >= parseFloat(latestBill.totalAmount);

                await latestBill.update({
                    paidAmount: newPaid,
                    status: isFullyPaid ? 'paid' : 'partial',
                    paymentDate: new Date()
                });
            }
        }

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ error: 'Failed to add transaction' });
    }
});

// DELETE transaction
router.delete('/transactions/:transactionId', authenticate, async (req, res) => {
    try {
        const transaction = await CreditCardTransaction.findOne({
            where: { id: req.params.transactionId, userId: req.user.id }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const card = await CreditCard.findByPk(transaction.creditCardId);

        // Revert card balance
        if (transaction.type === 'debit') {
            await card.update({
                usedAmount: Math.max(0, parseFloat(card.usedAmount) - parseFloat(transaction.amount)),
                totalDue: Math.max(0, parseFloat(card.totalDue) - parseFloat(transaction.amount))
            });
        } else {
            await card.update({
                usedAmount: parseFloat(card.usedAmount) + parseFloat(transaction.amount),
                totalDue: parseFloat(card.totalDue) + parseFloat(transaction.amount)
            });
        }

        await transaction.destroy();

        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// ==================== EMI ROUTES ====================

// GET bill history for a card
router.get('/:id/bills', authenticate, async (req, res) => {
    try {
        // Only fetch bills from the last 1 year
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const bills = await CreditCardBill.findAll({
            where: {
                creditCardId: req.params.id,
                userId: req.user.id,
                billDate: {
                    [require('sequelize').Op.gte]: oneYearAgo
                }
            },
            order: [['billDate', 'DESC']]
        });
        res.json(bills);
    } catch (error) {
        console.error('Error fetching bills:', error);
        res.status(500).json({ error: 'Failed to fetch bills' });
    }
});



// GET all EMIs for a card
router.get('/:id/emis', authenticate, async (req, res) => {
    try {
        const emis = await CreditCardEMI.findAll({
            where: { creditCardId: req.params.id, userId: req.user.id, isActive: true },
            order: [['nextDueDate', 'ASC']]
        });

        res.json(emis);
    } catch (error) {
        console.error('Error fetching EMIs:', error);
        res.status(500).json({ error: 'Failed to fetch EMIs' });
    }
});

// POST create EMI
router.post('/:id/emis', authenticate, async (req, res) => {
    try {
        const { merchant, principalAmount, monthlyPayment, tenure, interestRate } = req.body;

        if (!merchant || !principalAmount || !monthlyPayment || !tenure) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const card = await CreditCard.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!card) {
            return res.status(404).json({ error: 'Credit card not found' });
        }

        const startDate = new Date();
        const nextDueDate = new Date(startDate);
        const cardDueDay = parseInt(card.dueDate);

        // Set to card's due date in the next month
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        nextDueDate.setDate(cardDueDay);

        // Ensure it hasn't rolled over to another month (e.g., Feb 31st)
        if (nextDueDate.getDate() !== cardDueDay) {
            nextDueDate.setDate(0); // Last day of target month
        }


        const emi = await CreditCardEMI.create({
            creditCardId: req.params.id,
            userId: req.user.id,
            merchant,
            principalAmount,
            monthlyPayment,
            interestRate: interestRate || 0,
            tenure,
            startDate,
            nextDueDate
        });

        // Update card balance
        await card.update({
            usedAmount: parseFloat(card.usedAmount) + parseFloat(principalAmount)
        });

        res.status(201).json(emi);
    } catch (error) {
        console.error('Error creating EMI:', error);
        res.status(500).json({ error: 'Failed to create EMI' });
    }
});

// POST pay EMI installment
router.post('/emis/:emiId/pay', authenticate, async (req, res) => {
    try {
        const emi = await CreditCardEMI.findOne({
            where: { id: req.params.emiId, userId: req.user.id, isActive: true }
        });

        if (!emi) {
            return res.status(404).json({ error: 'EMI not found' });
        }

        const card = await CreditCard.findOne({
            where: { id: emi.creditCardId, userId: req.user.id }
        });

        if (!card) {
            return res.status(404).json({ error: 'Card not found' });
        }

        // Update EMI
        const newPaidInstallments = emi.paidInstallments + 1;
        const newTotalPaid = parseFloat(emi.totalPaid) + parseFloat(emi.monthlyPayment);
        const nextDueDate = new Date(emi.nextDueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);

        const isFinished = newPaidInstallments >= emi.tenure;

        await emi.update({
            paidInstallments: newPaidInstallments,
            totalPaid: newTotalPaid,
            nextDueDate: isFinished ? emi.nextDueDate : nextDueDate,
            isActive: !isFinished
        });

        // Create Transaction
        try {
            const { transactionDate } = req.body;
            await CreditCardTransaction.create({
                creditCardId: emi.creditCardId,
                userId: req.user.id,
                merchant: `EMI Payment: ${emi.merchant}`,
                amount: emi.monthlyPayment,
                // Use frontend provided date or default to server date (full ISO string to preserve time)
                transactionDate: transactionDate ? transactionDate : new Date().toISOString(),
                type: 'debit',
                status: 'completed'
            });
        } catch (txError) {
            console.error('[EMI Payment] Transaction creation failed:', txError.message);
        }

        // Update card balance
        // Update card balance
        // Reduce Principal from Used Amount.
        // The Interest part is effectively "New Spending" which creates "Unbilled Amount".
        // Since we are NOT increasing 'totalDue' here, and 'usedAmount' reduces only by principal...
        // Wait, if Used=1000. EMI=100 (Principal 80, Interest 20).
        // New Used Should be: 1000 - 80 + 20? No.
        // Paying EMI means: You pay the BANK.
        // User pays 100.
        // Loan balance reduces by 80.
        // Card Balance? 
        // EMI is a "Debit" on the card every month.
        // So it INCREASES `usedAmount` by `monthlyPayment`?
        // Ah, `payEMI` in this context means "Process the Monthly Installment".
        // It creates a DEBIT transaction.
        // So `usedAmount` should INCREASE by `interest`?
        // Principal is already "blocked" in `usedAmount` when EMI created!
        // So we REDUCE `usedAmount` by `principal` (unblocking it) and INCREASE `usedAmount` by `monthlyPayment` (billing it).
        // Net Change = `monthlyPayment - principal` = Interest.
        // So `usedAmount` increases by Interest.
        // `totalDue` (Statement) should NOT change until bill gen.

        const principalPortion = parseFloat(emi.principalAmount) / emi.tenure;

        await card.update({
            usedAmount: Math.max(0, parseFloat(card.usedAmount) - principalPortion + parseFloat(emi.monthlyPayment)),
            // totalDue is FROZEN until Statement Generation
        });

        res.json(emi);

    } catch (error) {
        console.error('[EMI Payment] Error:', error);
        res.status(500).json({ error: 'Failed to pay EMI', details: error.message });
    }
});




// DELETE EMI
router.delete('/emis/:emiId', authenticate, async (req, res) => {
    try {
        const emi = await CreditCardEMI.findOne({
            where: { id: req.params.emiId, userId: req.user.id }
        });

        if (!emi) {
            return res.status(404).json({ error: 'EMI not found' });
        }

        // Only subtract if it was active (prevent double-subtraction on retry)
        if (emi.isActive) {
            const card = await CreditCard.findOne({
                where: { id: emi.creditCardId, userId: req.user.id }
            });

            if (card) {
                const principalToRevert = parseFloat(emi.principalAmount || 0);
                const currentUsed = parseFloat(card.usedAmount || 0);

                await card.update({
                    usedAmount: Math.max(0, currentUsed - principalToRevert)
                });
            }
        }

        await emi.update({ isActive: false });

        res.json({ message: 'EMI deleted successfully' });
    } catch (error) {
        console.error('Error deleting EMI:', error);
        res.status(500).json({ error: 'Failed to delete EMI' });
    }
});

// Register sub-routes




// ------------------------------------------------------------------
// GMAIL SMART STATEMENT SYNC (CRED STYLE)
// ------------------------------------------------------------------
const gmailService = require('../../services/gmailStatementService');

// 1a. Save Custom Google OAuth Configuration
router.post('/gmail/config', authenticate, async (req, res) => {
    try {
        const { clientId, clientSecret, redirectUri } = req.body;
        if (!clientId || !clientSecret) {
            return res.status(400).json({ error: 'Both Google Client ID and Client Secret are required' });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const prefs = user.preferences || {};
        prefs.gmailSync = {
            ...(prefs.gmailSync || {}),
            customConfig: {
                clientId: clientId.trim(),
                clientSecret: clientSecret.trim(),
                redirectUri: (redirectUri || 'http://localhost:5174/credit-cards/auto-statement').trim()
            }
        };

        user.preferences = prefs;
        await user.save();

        res.json({ success: true, message: 'Google OAuth configuration saved successfully!' });
    } catch (e) {
        console.error('[Gmail Save Config Error]', e);
        res.status(500).json({ error: e.message });
    }
});

// 1. Get connection & configuration status
router.get('/gmail/status', authenticate, async (req, res) => {
    try {
        const status = await gmailService.getStatus(req.user.id);
        res.json(status);
    } catch (e) {
        console.error('[Gmail Status Error]', e);
        res.status(500).json({ error: e.message });
    }
});

// 2. Generate Google OAuth URL
router.post('/gmail/auth-url', authenticate, async (req, res) => {
    try {
        const url = await gmailService.getAuthUrl(req.user.id, req.body || {});
        res.json({ url });
    } catch (e) {
        console.error('[Gmail Auth URL Error]', e);
        res.status(400).json({ error: e.message });
    }
});

// 3. Exchange OAuth Code for Tokens
router.post('/gmail/callback', authenticate, async (req, res) => {
    try {
        const { code, customConfig } = req.body;
        if (!code) return res.status(400).json({ error: 'Authorization code is required' });
        const result = await gmailService.handleCallback(code, req.user.id, customConfig || {});
        res.json(result);
    } catch (e) {
        console.error('[Gmail Callback Error]', e);
        res.status(500).json({ error: e.message });
    }
});

// 4. Sync Statements from Gmail
router.post('/gmail/sync', authenticate, async (req, res) => {
    try {
        const result = await gmailService.syncStatements(req.user.id);
        res.json(result);
    } catch (e) {
        console.error('[Gmail Sync Error]', e);
        res.status(500).json({ error: e.message });
    }
});

// 5. Disconnect Gmail
router.post('/gmail/disconnect', authenticate, async (req, res) => {
    try {
        const result = await gmailService.disconnect(req.user.id);
        res.json(result);
    } catch (e) {
        console.error('[Gmail Disconnect Error]', e);
        res.status(500).json({ error: e.message });
    }
});

// 6. 1-Click Apply Statement to Card
router.post('/gmail/apply-statement', authenticate, async (req, res) => {
    try {
        const { cardId, totalDue, minDue, dueDate, billDate, statementDetails } = req.body;
        if (!cardId || !totalDue) {
            return res.status(400).json({ error: 'cardId and totalDue are required' });
        }

        const card = await CreditCard.findOne({ where: { id: cardId, userId: req.user.id } });
        if (!card) return res.status(404).json({ error: 'Credit card not found' });

        const bDate = billDate || new Date().toISOString().slice(0, 10);
        const dDate = dueDate || new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        // Create or update CreditCardBill
        const bill = await CreditCardBill.create({
            creditCardId: card.id,
            userId: req.user.id,
            billDate: bDate,
            dueDate: dDate,
            totalAmount: totalDue,
            minDueAmount: minDue || Math.round(totalDue * 0.05),
            paidAmount: 0,
            status: 'unpaid',
            metadata: statementDetails || { source: 'gmail_smart_sync' }
        });

        // Update card dues
        await card.update({
            totalDue: totalDue,
            minPayment: minDue || Math.round(totalDue * 0.05)
        });

        res.json({
            success: true,
            message: `Statement for ${card.cardName} applied successfully!`,
            bill
        });
    } catch (e) {
        console.error('[Apply Statement Error]', e);
        res.status(500).json({ error: e.message });
    }
});


module.exports = router;
