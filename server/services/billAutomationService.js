/**
 * Bill Automation Service
 * Handles:
 * 1. "Same Bill" Identification & Multi-Tier Deduplication
 * 2. Automated Reconciliation of Bill Payments to Bills
 * 3. Recurring Billing Cycle Progression
 * 4. Synchronization between SMS Ingestion, Pending Automation Inbox, and Database Bills
 */

const { Op } = require('sequelize');
const { Bill, Transaction } = require('../models');
const { getPendingSMS, savePendingSMS } = require('../utils/pendingStore');

// Common Utility / Biller Canonical Aliases
const PROVIDER_CANONICAL_MAP = [
    { regex: /\b(bsnl|bharat\s*sanchar)\b/i, name: 'BSNL', category: 'Broadband' },
    { regex: /\b(bescom|bangalore\s*electricity)\b/i, name: 'BESCOM', category: 'Electricity' },
    { regex: /\b(tneb|tangedco)\b/i, name: 'TNEB', category: 'Electricity' },
    { regex: /\b(tsspdcl|tssedcl)\b/i, name: 'TSSPDCL', category: 'Electricity' },
    { regex: /\b(mahadiscom|msedcl)\b/i, name: 'MAHADISCOM', category: 'Electricity' },
    { regex: /\b(tata\s*power)\b/i, name: 'Tata Power', category: 'Electricity' },
    { regex: /\b(torrent\s*power)\b/i, name: 'Torrent Power', category: 'Electricity' },
    { regex: /\b(airtel|bharti\s*airtel)\b/i, name: 'Airtel', category: 'Mobile' },
    { regex: /\b(jio|reliance\s*jio)\b/i, name: 'Jio', category: 'Mobile' },
    { regex: /\b(vodafone|idea|vi)\b/i, name: 'Vodafone Idea', category: 'Mobile' },
    { regex: /\b(act\s*(?:corp|fibernet)?)\b/i, name: 'ACT Fibernet', category: 'Broadband' },
    { regex: /\b(tata\s*play|tata\s*sky)\b/i, name: 'Tata Play', category: 'Utility' },
    { regex: /\b(dish\s*tv)\b/i, name: 'Dish TV', category: 'Utility' },
    { regex: /\b(apple|apple\s*media|apple\.com)\b/i, name: 'Apple', category: 'Subscription' },
    { regex: /\b(netflix)\b/i, name: 'Netflix', category: 'Subscription' },
    { regex: /\b(amazon\s*prime|prime\s*video)\b/i, name: 'Amazon Prime', category: 'Subscription' },
    { regex: /\b(spotify)\b/i, name: 'Spotify', category: 'Subscription' },
    { regex: /\b(swiggy\s*one|swiggy\s*super)\b/i, name: 'Swiggy One', category: 'Subscription' },
    { regex: /\b(zomato\s*gold)\b/i, name: 'Zomato Gold', category: 'Subscription' },
    { regex: /\b(cred|dreamplug)\b/i, name: 'CRED', category: 'Utility' },
    { regex: /\b(billdesk)\b/i, name: 'BillDesk', category: 'Utility' }
];

/**
 * Normalizes provider name to canonical string
 */
function normalizeProvider(name) {
    if (!name || typeof name !== 'string') return '';
    const clean = name.trim();
    for (const item of PROVIDER_CANONICAL_MAP) {
        if (item.regex.test(clean)) return item.name;
    }
    // Clean trailing Ltd/Pvt/Services/Bill
    return clean
        .replace(/\b(private|pvt|limited|ltd|services|service|india|telecom|corporation|board|bill|recharge|payment)\b/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extracts unique identifying numbers (Account No, Phone/Landline, Consumer No, Card Last 4)
 */
function extractIdentifier(item) {
    if (!item) return null;
    const candidates = [];

    // 1. Explicit properties
    if (item.identifiers) {
        const ids = typeof item.identifiers === 'string' ? JSON.parse(item.identifiers) : item.identifiers;
        if (ids.account) candidates.push(String(ids.account));
        if (ids.phone) candidates.push(String(ids.phone));
        if (ids.consumerNumber) candidates.push(String(ids.consumerNumber));
        if (ids.value) candidates.push(String(ids.value));
    }
    if (item.accountMasked) candidates.push(String(item.accountMasked));
    if (item.referenceNo) candidates.push(String(item.referenceNo));
    if (item.cardLast4) candidates.push(String(item.cardLast4));

    // 2. Scan raw_message or description if not found
    const text = (item.raw_message || item.description || '') + ' ' + (item.reference || '');
    if (text) {
        // STD Landline / Phone with hyphen (e.g. 04256-299148 or 044-24351234)
        const stdMatch = text.match(/\b(0\d{2,4}-\d{6,8})\b/);
        if (stdMatch) candidates.push(stdMatch[1].replace(/[^0-9]/g, ''));

        // Phone / Landline with keyword
        const phoneMatch = text.match(/(?:phone|tel|landline|mobile|contact|telephone)(?:\s*(?:no|num|id|#|bill|for|of))*[\s.:#-]*([0-9-]{6,15})/i);
        if (phoneMatch) candidates.push(phoneMatch[1].replace(/[^0-9]/g, ''));

        // Consumer / Account ID
        const accMatch = text.match(/(?:a\/c|account|acct|consumer|cons|ca|consumer\s*id)[\s.:#-]*(?:no|num)?[\s.:#-]*([A-Za-z0-9•\*-]{4,20})/i);
        if (accMatch && !/^(?:credited|debited|balance|transfer)$/i.test(accMatch[1])) {
            candidates.push(accMatch[1]);
        }
    }

    // Filter out generic short strings
    const valid = candidates.map(c => c.trim()).filter(c => c.length >= 3 && !/^[•\*]+$/.test(c));
    return valid.length > 0 ? valid[0] : null;
}

/**
 * Checks if two amounts match (within 2% tolerance or 1 Rupee for utility fluctuations)
 */
function amountsMatch(amountA, amountB, tolerancePercent = 0.02) {
    const a = Math.abs(Number(amountA) || 0);
    const b = Math.abs(Number(amountB) || 0);
    if (a === 0 || b === 0) return false;
    const diff = Math.abs(a - b);
    const tolerance = Math.max(1, Math.max(a, b) * tolerancePercent);
    return diff <= tolerance;
}

/**
 * Checks if two due dates fall within the same monthly billing cycle
 */
function isSameBillingCycle(dateA, dateB) {
    if (!dateA || !dateB) return false;
    const dA = new Date(dateA);
    const dB = new Date(dateB);
    if (isNaN(dA.getTime()) || isNaN(dB.getTime())) return false;

    // Check same calendar year and month
    if (dA.getFullYear() === dB.getFullYear() && dA.getMonth() === dB.getMonth()) {
        return true;
    }

    // Check within 18 days of each other (handles cycles spanning end-of-month e.g. 28th to 5th)
    const diffDays = Math.abs(dA.getTime() - dB.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 18;
}

/**
 * Multi-Tier "Same Bill" Identification Engine
 * Evaluates whether Bill A and Bill B are the exact same bill.
 * 
 * Returns {
 *   isSame: boolean,
 *   isNextCycle: boolean,
 *   reason: string,
 *   confidence: number
 * }
 */
function identifySameBill(billA, billB) {
    if (!billA || !billB) return { isSame: false, reason: 'INVALID_INPUT', confidence: 0 };

    const provA = normalizeProvider(billA.provider || billA.merchant || billA.name);
    const provB = normalizeProvider(billB.provider || billB.merchant || billB.name);
    const providerMatches = provA && provB && (provA.toLowerCase() === provB.toLowerCase() || provA.toLowerCase().includes(provB.toLowerCase()) || provB.toLowerCase().includes(provA.toLowerCase()));

    const idA = extractIdentifier(billA);
    const idB = extractIdentifier(billB);
    const idMatches = idA && idB && (idA === idB || idA.includes(idB) || idB.includes(idA));

    // GUARD: If both bills provide explicit unmasked identifiers and they DIFFER,
    // they are distinctly different accounts/phone lines even if provider and amount match!
    const isExplicitId = (id) => id && !/^[•\*]+$/.test(id) && id.length >= 5;
    if (isExplicitId(idA) && isExplicitId(idB) && idA !== idB && !idA.includes(idB) && !idB.includes(idA)) {
        return {
            isSame: false,
            isNextCycle: false,
            reason: 'DIFFERENT_ACCOUNT_IDENTIFIER',
            confidence: 1.0
        };
    }

    const cycleMatches = isSameBillingCycle(billA.dueDate || billA.date, billB.dueDate || billB.date);
    const amtMatches = amountsMatch(billA.amount, billB.amount);

    // Tier 1: Strongest Identity (Same Provider + Same Account/Phone Identifier)
    if (providerMatches && idMatches) {
        if (cycleMatches) {
            return {
                isSame: true,
                isNextCycle: false,
                reason: 'SAME_PROVIDER_ACCOUNT_AND_CYCLE',
                confidence: 1.0
            };
        }
        // Same provider & account, but different cycle -> Consecutive Recurring Cycle
        return {
            isSame: false,
            isNextCycle: true,
            reason: 'NEW_RECURRING_BILLING_CYCLE',
            confidence: 0.95
        };
    }

    // Tier 2: Account Identifier Match with Same Due Date / Cycle
    if (idMatches && cycleMatches) {
        return {
            isSame: true,
            isNextCycle: false,
            reason: 'SAME_ACCOUNT_AND_CYCLE',
            confidence: 0.95
        };
    }

    // Tier 3: Same Provider + Same Due Date + Same Amount (e.g. when account is masked)
    if (providerMatches && cycleMatches && amtMatches) {
        return {
            isSame: true,
            isNextCycle: false,
            reason: 'SAME_PROVIDER_CYCLE_AND_AMOUNT',
            confidence: 0.9
        };
    }

    // Tier 4: Exact Due Date + Same Amount + Compatible Category
    const toDateStr = (d) => {
        if (!d) return '';
        if (typeof d === 'string') return d.slice(0, 10);
        if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        return '';
    };
    const dueDateA = toDateStr(billA.dueDate);
    const dueDateB = toDateStr(billB.dueDate);
    if (dueDateA && dueDateB && dueDateA === dueDateB && amtMatches && providerMatches) {
        return {
            isSame: true,
            isNextCycle: false,
            reason: 'EXACT_DUEDATE_AND_AMOUNT',
            confidence: 0.9
        };
    }

    return { isSame: false, isNextCycle: false, reason: 'NO_MATCH', confidence: 0 };
}

/**
 * Processes an incoming Bill from SMS:
 * 1. Checks if the bill is already marked PAID in DB (suppresses redundant alert)
 * 2. Checks if an unpaid bill for this cycle exists (updates in place, avoids duplicate)
 * 3. Links to or creates DB Bill
 */
async function handleIncomingBillSMS(tx, userId) {
    if (!userId) return { action: 'SKIPPED', reason: 'NO_USER' };

    try {
        const bills = await Bill.findAll({ where: { userId } });

        for (const existingBill of bills) {
            const check = identifySameBill(tx, existingBill);

            if (check.isSame) {
                // Case A: Bill is already PAID for this cycle!
                if (existingBill.status === 'paid') {
                    console.log(`[BillAutomation] Suppressing incoming bill reminder for "${existingBill.name}" - already paid on ${existingBill.lastPaidDate || 'previous payment'}`);
                    return {
                        action: 'SUPPRESS_ALREADY_PAID',
                        billId: existingBill.id,
                        reason: `Bill "${existingBill.name}" is already paid for this cycle.`,
                        isBill: false,
                        isRedundantReminder: true
                    };
                }

                // Case B: Bill exists and is UNPAID / OVERDUE -> Update in place
                console.log(`[BillAutomation] Updating existing unpaid bill "${existingBill.name}" (ID: ${existingBill.id}) with latest SMS details`);
                existingBill.amount = Number(tx.amount) || existingBill.amount;
                if (tx.dueDate) existingBill.dueDate = tx.dueDate;
                await existingBill.save();

                return {
                    action: 'UPDATED_EXISTING',
                    billId: existingBill.id,
                    bill: existingBill,
                    reason: 'Updated existing unpaid bill'
                };
            }
        }

        return { action: 'NEW_BILL' };
    } catch (err) {
        console.error('[BillAutomation handleIncomingBillSMS Error]', err.message);
        return { action: 'ERROR', error: err.message };
    }
}

/**
 * Automatically reconciles a payment (from Bank debit, BillDesk receipt, or approved transaction)
 * with open unpaid bills in the database.
 * 
 * If matched:
 * - Marks Bill as 'paid'
 * - Sets lastPaidDate
 * - Advances recurring due date to next month
 * - Links billId to transaction
 * - Clears pending unpaid reminder from pending_sms.json
 */
async function autoReconcilePayment(payment, userId) {
    if (!userId || !payment) return { matched: false };

    try {
        const paymentAmount = Number(payment.amount) || 0;
        if (paymentAmount <= 0) return { matched: false };

        const paymentDate = payment.date ? new Date(payment.date) : new Date();

        // Find active/unpaid bills for this user
        const openBills = await Bill.findAll({
            where: {
                userId,
                status: { [Op.in]: ['unpaid', 'generated', 'overdue'] }
            }
        });

        if (openBills.length === 0) return { matched: false };

        for (const bill of openBills) {
            // 1. Amount match check (within 2%)
            if (!amountsMatch(bill.amount, paymentAmount)) continue;

            // 2. Date proximity check (payment happened within -15 to +35 days of bill due date)
            const due = new Date(bill.dueDate);
            const diffDays = Math.abs(paymentDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 45) continue;

            // 3. Provider / Account Match check
            const billProvider = normalizeProvider(bill.provider || bill.name);
            const paymentText = `${payment.merchant || ''} ${payment.description || ''} ${payment.raw_message || ''}`.toLowerCase();
            const providerMatched = billProvider && paymentText.includes(billProvider.toLowerCase());

            const billId = extractIdentifier(bill);
            const paymentId = extractIdentifier(payment);
            const identifierMatched = billId && paymentId && (billId === paymentId || paymentId.includes(billId));

            // If either provider matches or identifier matches:
            if (providerMatched || identifierMatched || (diffDays <= 7 && amountsMatch(bill.amount, paymentAmount, 0.001))) {
                console.log(`[BillAutomation AUTO-RECONCILE] Matched payment ₹${paymentAmount} to bill "${bill.name}" (ID: ${bill.id})`);

                bill.lastPaidDate = paymentDate;
                bill.status = 'paid';

                // If recurring monthly/quarterly/yearly, advance due date to next cycle
                if (bill.isRecurring && ['monthly', 'quarterly', 'yearly'].includes(bill.frequency)) {
                    const nextDue = new Date(bill.dueDate);
                    if (bill.frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
                    else if (bill.frequency === 'quarterly') nextDue.setMonth(nextDue.getMonth() + 3);
                    else if (bill.frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);

                    bill.dueDate = nextDue;
                }

                await bill.save();

                // If payment is a Transaction model instance, link billId
                if (payment.update && typeof payment.update === 'function') {
                    await payment.update({ billId: bill.id });
                }

                // Clean pending unpaid reminders from Automation Inbox
                try {
                    let pending = getPendingSMS();
                    const beforeLen = pending.length;
                    pending = pending.filter(p => {
                        if (String(p.userId) !== String(userId)) return true;
                        // Drop unpaid bills matching this biller
                        if (p.isBill && !p.isBillPaymentReceipt) {
                            const pMatch = identifySameBill(p, bill);
                            if (pMatch.isSame) return false;
                        }
                        return true;
                    });
                    if (pending.length !== beforeLen) {
                        savePendingSMS(pending);
                        console.log(`[BillAutomation] Cleared ${beforeLen - pending.length} stale bill reminder(s) from pending store.`);
                    }
                } catch (storeErr) {
                    console.warn('[BillAutomation] Store cleanup warning:', storeErr.message);
                }

                return {
                    matched: true,
                    billId: bill.id,
                    billName: bill.name,
                    amount: bill.amount,
                    nextDueDate: bill.dueDate
                };
            }
        }

        return { matched: false };
    } catch (err) {
        console.error('[BillAutomation autoReconcilePayment Error]', err.message);
        return { matched: false, error: err.message };
    }
}

module.exports = {
    normalizeProvider,
    extractIdentifier,
    amountsMatch,
    isSameBillingCycle,
    identifySameBill,
    handleIncomingBillSMS,
    autoReconcilePayment
};
