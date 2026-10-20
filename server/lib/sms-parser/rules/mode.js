/**
 * Mode Identification Engine
 * Detects: Credit Card, Credit Card Bill, UPI, Netbanking, Bank Transfer, BNPL, Wallet, Debit Card, Subscription
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
        /\b(netflix|spotify|youtube premium|apple services|apple media services|apple\.com\/bill|apple|google play|hotstar|prime video)\b/i.test(lower)
    );

    // Priority 0a: CREDIT CARD STATEMENT / CARD BILL GENERATION
    const isCreditCardBill = (
        /\b(?:credit\s*card|creditcard|card\s*ending|card\s*no\.?\s*[x\*]*\d{4})\b/i.test(lower) &&
        /\b(?:statement(?:\s*(?:is\s*)?generated|:|\s*for)|total\s*due|min(?:imum)?\s*due|due\s*(?:by|on))\b/i.test(lower) &&
        !/\b(?:spent\s+on|used\s+at|debited\s+for|we\s+have\s+received\s+a\s+payment)\b/i.test(lower)
    );

    if (isCreditCardBill) {
        return {
            mode: 'BILL',
            paymentMethod: 'Credit Card Bill',
            isCreditCard: true,
            isCreditCardBill: true,
            isBill: true,
            isUpi: false,
            isNetbanking: false,
            isBank: false,
            isSubscription: false
        };
    }

    // Priority 0b: COMPLETED BILL PAYMENT CONFIRMATION / RECEIPT (Not an unpaid bill!)
    const isBillPaymentReceipt = (
        /\b(?:thank\s*you\s*for\s*making\s*payment|making\s*payment\s*of|receipt\s*on\s*your\s*whatsapp|view\s*and\s*download\s*receipt|billdesk)\b/i.test(lower) ||
        (/\b(?:bill\s*(?:is\s*)?paid|payment\s*received\s*for\s*bill)\b/i.test(lower))
    );

    if (isBillPaymentReceipt) {
        return {
            mode: 'BILL_PAYMENT',
            paymentMethod: 'Bill Payment',
            isCreditCard: false,
            isCreditCardBill: false,
            isUpi: lower.includes('upi'),
            isNetbanking: false,
            isBank: false,
            isSubscription: false,
            isBill: false,
            isBillPaymentReceipt: true
        };
    }

    // Priority 0c: UNPAID BILL / INVOICE / BNPL OUTSTANDING REMINDER
    const isBill = (
        /\b(bill\s*(?:of|for|amount)?|due\s*by|is\s*due|payment\s*due|pay\s*before|last\s*date|outstanding\s*of.*is\s*due)\b/i.test(lower) &&
        !/\b(debited|credited|transferred|successful|spent|paid|making\s*payment|thank\s*you\s*for|receipt)\b/i.test(lower)
    );

    if (isBill) {
        const isBnplBill = lower.includes('lazypay') || lower.includes('simpl');
        return {
            mode: 'BILL',
            paymentMethod: isBnplBill ? 'BNPL / Bill' : 'Bill',
            isCreditCard: false,
            isCreditCardBill: false,
            isUpi: false,
            isNetbanking: false,
            isBank: false,
            isSubscription: false,
            isBill: true
        };
    }

    // Priority 1: UPI / INSTANT PAY (Handles HDFC "SMS BLOCK UPI to...", VPA, GPay, PhonePe, UPI apps)
    if (
        lower.includes('upi') ||
        lower.includes('vpa') ||
        lower.match(/@(?:oksbi|okhdfc|okaxis|ybl|ibl|paytm|axl|apl|icici|barodampay)/) ||
        lower.includes('gpay') ||
        lower.includes('google pay') ||
        lower.includes('phonepe') ||
        lower.includes('bhim') ||
        lower.includes('cred upi') ||
        lower.includes('block upi')
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

    // Priority 2: CREDIT CARD TRANSACTION / SPEND
    const hasCreditCardKeyword = (
        lower.includes('credit card') ||
        lower.includes('creditcard') ||
        lower.includes('cc spent') ||
        lower.includes('spent on your card') ||
        lower.includes('spent on yes bank card') ||
        lower.includes('spent on') && lower.includes('card') ||
        lower.includes('used at') && lower.includes('card') ||
        lower.includes('credit limit') ||
        lower.includes('avl lmt') ||
        lower.includes('avl limit') ||
        lower.includes('available limit') ||
        lower.includes('blkcc') ||
        lower.includes('sbicard') ||
        (lower.includes('card ending') && !lower.includes('debit card') && !lower.includes('atm')) ||
        (lower.match(/card\s+(?:no\.?\s*)?(?:x{1,}|\*{1,})\d{3,4}/i) && !lower.includes('debit')) ||
        lower.match(/\b(visa|amex|mastercard|diners)\b/)
    );

    if (hasCreditCardKeyword && !lower.includes('debit card') && !lower.includes('atm card')) {
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

    // Priority 3: BNPL (LazyPay, Simpl, etc.)
    if (lower.includes('lazypay') || lower.includes('simpl') || lower.includes('postpe')) {
        return {
            mode: 'BNPL',
            paymentMethod: 'BNPL / LazyPay',
            isCreditCard: false,
            isUpi: false,
            isNetbanking: false,
            isBank: false,
            isSubscription
        };
    }

    // Priority 3b: WALLET (CRED wallet, Paytm wallet, Mobikwik, Amazon Pay wallet)
    if (lower.includes('wallet') || lower.includes('cred wallet') || lower.includes('paytm wallet') || lower.includes('wallet balance')) {
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

    // Priority 4: BANK ACCOUNT TRANSFER / NEFT / IMPS / RTGS
    if (
        lower.includes('paid from') && lower.includes('account') ||
        lower.includes('transferred from') ||
        lower.includes('trf to') ||
        lower.includes('imps') ||
        lower.includes('neft') ||
        lower.includes('rtgs') ||
        (lower.includes('account') && lower.includes('with ref'))
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

    // Priority 5: NETBANKING
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

    // Priority 6: DEBIT CARD
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

    return {
        mode: 'OTHER',
        paymentMethod: 'Other',
        isCreditCard: false,
        isUpi: false,
        isNetbanking: false,
        isBank: false,
        isSubscription
    };
};
