const parser = require('transaction-sms-parser');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Parse SMS endpoint
app.post('/parse', (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Missing text field' });
        }

        // Get all parsed data
        const transactionInfo = parser.getTransactionInfo(text);
        const transactionType = parser.getTransactionType(text);
        const merchantInfo = parser.getMerchantInfo(text);
        const accountInfo = parser.getAccountInfo(text);

        // Detect payment mode from SMS text
        const textUpper = text.toUpperCase();
        let paymentMode = null;

        if (textUpper.includes('UPI') || textUpper.includes('VPA')) {
            paymentMode = 'UPI';
        } else if (textUpper.includes('NEFT') || textUpper.includes('RTGS') || textUpper.includes('IMPS')) {
            paymentMode = 'Bank Transfer';
        } else if (textUpper.includes('CREDIT CARD') || textUpper.includes('CC-')) {
            paymentMode = 'Credit Card';
        } else if (textUpper.includes('DEBIT CARD') || textUpper.includes('DC-') || textUpper.includes('ATM')) {
            paymentMode = 'Debit Card';
        } else if (textUpper.includes('CASH')) {
            paymentMode = 'Cash';
        } else if (textUpper.includes('A/C') || textUpper.includes('ACCOUNT')) {
            paymentMode = transactionType === 'credit' ? 'Bank Transfer' : 'Card';
        } else {
            paymentMode = transactionType === 'credit' ? 'Bank Transfer' : 'Card';
        }

        // Build response
        const result = {
            success: true,
            data: {
                amount: parseFloat(transactionInfo?.transaction?.amount || 0),
                type: transactionType || 'debit', // 'credit' or 'debit'
                merchant: transactionInfo?.transaction?.merchant || merchantInfo?.name || 'Unknown',
                paymentMethod: paymentMode,
                account: accountInfo?.number || transactionInfo?.account?.number,
                accountType: accountInfo?.type || transactionInfo?.account?.type,
                referenceNo: transactionInfo?.transaction?.referenceNo,
                balance: transactionInfo?.balance,
                raw_message: text
            }
        };

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'SMS Parser Service' });
});

const PORT = 5003;
app.listen(PORT, () => {
    console.log(`SMS Parser Service running on port ${PORT}`);
});
