/**
 * Mode Identification Engine
 * Detects: Credit Card, Debit Card, UPI, Netbanking, Bank Transfer, Wallet, Cash, and Subscription
 */

module.exports = function detectMode(text) {
    const lower = text.toLowerCase();

    // Check Subscription / Recurring Mandate Flag
    const isSubscription = (
        lower.includes('autopay') ||
        lower.includes('e-mandate') ||
        lower.includes('standing instruction') ||
        lower.includes('si debited') ||
        lower.includes('auto-debit') ||
        lower.includes('auto debited') ||
        lower.includes('subscription') ||
        lower.includes('recurring') ||
        lower.includes('membership renewal') ||
        /\b(netflix|spotify|youtube premium|apple services|apple\.com\/bill|google play|hotstar|prime video)\b/i.test(lower)
    );

    // Priority 1: UPI / INSTANT PAY
    if (
        lower.includes('upi') ||
        lower.includes('vpa') ||
        lower.match(/@(?:oksbi|okhdfc|okaxis|ybl|ibl|paytm|axl|apl|icici|barodampay)/) ||
        lower.includes('gpay') ||
        lower.includes('google pay') ||
        lower.includes('phonepe') ||
        lower.includes('bhim') ||
        lower.includes('cred upi')
    ) {
        return {
            mode: 'UPI',
            paymentMethod: 'UPI',
            isCreditCard: false,
            isUpi: true,
            isNetbanking: false,
            isBank: false,
            isSubscription
        };
    }

    // Priority 2: NETBANKING
    if (
        lower.includes('netbanking') ||
        lower.includes('net banking') ||
        lower.includes('internet banking') ||
        lower.includes('online banking') ||
        lower.includes('inb-')
    ) {
        return {
            mode: 'NETBANKING',
            paymentMethod: 'Netbanking',
            isCreditCard: false,
            isUpi: false,
            isNetbanking: true,
            isBank: false,
            isSubscription
        };
    }

    // Priority 3: CREDIT CARD
    const hasCreditCardKeyword = (
        lower.includes('credit card') ||
        lower.includes('creditcard') ||
        lower.includes('cc spent') ||
        lower.includes('spent on your card') ||
        lower.includes('credit limit') ||
        lower.includes('avl lmt') ||
        lower.includes('available limit') ||
        (lower.includes('card ending') && !lower.includes('debit card') && !lower.includes('atm')) ||
        (lower.match(/card\s+(?:no\.?\s*)?(?:x{2,}|\*{2,})\d{4}/i) && !lower.includes('debit')) ||
        lower.match(/\b(visa|amex|mastercard|diners)\b/)
    );

    if (hasCreditCardKeyword && !lower.includes('debit card') && !lower.includes('atm')) {
        return {
            mode: 'CREDIT_CARD',
            paymentMethod: 'Credit Card',
            isCreditCard: true,
            isUpi: false,
            isNetbanking: false,
            isBank: false,
            isSubscription
        };
    }

    // Priority 4: DEBIT CARD
    if (lower.includes('debit card') || lower.includes('debitcard') || lower.includes('atm card') || lower.includes('dc-')) {
        return {
            mode: 'DEBIT_CARD',
            paymentMethod: 'Debit Card',
            isCreditCard: false,
            isUpi: false,
            isNetbanking: false,
            isBank: false,
            isSubscription
        };
    }

    // Priority 5: WALLET
    if (lower.includes('wallet') || lower.includes('paytm wallet') || lower.includes('amazon pay wallet') || lower.includes('cred wallet') || lower.includes('lazypay')) {
        return {
            mode: 'WALLET',
            paymentMethod: 'Wallet',
            isCreditCard: false,
            isUpi: false,
            isNetbanking: false,
            isBank: false,
            isSubscription
        };
    }

    // Priority 6: BANK ACCOUNT / TRANSFER (NEFT, RTGS, IMPS, A/C Debit)
    if (
        lower.includes('neft') ||
        lower.includes('rtgs') ||
        lower.includes('imps') ||
        lower.includes('transfer') ||
        lower.includes('debited from a/c') ||
        lower.includes('debited from account') ||
        lower.includes('debited from acct') ||
        lower.includes('credited to a/c') ||
        lower.includes('credited to account') ||
        lower.includes('a/c') ||
        lower.includes('acct') ||
        lower.match(/a\/c\s+(?:no\.?\s*)?(?:x{2,}|\*{2,})\d{3,4}/i)
    ) {
        return {
            mode: 'BANK_TRANSFER',
            paymentMethod: 'Bank Transfer',
            isCreditCard: false,
            isUpi: false,
            isNetbanking: false,
            isBank: true,
            isSubscription
        };
    }

    // Priority 7: CASH / ATM
    if (lower.includes('cash') || lower.includes('atm wdl') || lower.includes('atm cash')) {
        return {
            mode: 'CASH',
            paymentMethod: 'Cash',
            isCreditCard: false,
            isUpi: false,
            isNetbanking: false,
            isBank: false,
            isSubscription
        };
    }

    // Fallback
    return {
        mode: isSubscription ? 'SUBSCRIPTION' : 'OTHER',
        paymentMethod: isSubscription ? 'Subscription' : 'Other',
        isCreditCard: false,
        isUpi: false,
        isNetbanking: false,
        isBank: false,
        isSubscription
    };
};
