const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Python Service URL
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5002';

// Configure multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit matching Python service
});

// ------------------------------------------------------------------
// MANUAL PDF PARSE ENDPOINT (Proxies to Python AI Service)
// ------------------------------------------------------------------

router.post('/parse', upload.single('statement'), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // console.log(`[Proxy] Forwarding ${file.originalname} to Python Service...`);

        // Create FormData for Python Service
        const form = new FormData();
        form.append('file', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype
        });

        const password = req.body.password;

        // Forward password if provided
        if (password) {
            form.append('password', password);
        }

        // Call Python Service
        let pythonResponse;
        try {
            pythonResponse = await axios.post(
                `${PYTHON_SERVICE_URL}/api/extract/statement`,
                form,
                {
                    headers: {
                        ...form.getHeaders()
                    },
                    timeout: 300000 // 300s (5 min) timeout for slow AI processing
                }
            );
        } catch (pyError) {
            console.error('Python Service Error:', pyError.message);
            if (pyError.response) {
                console.error('Python Response:', pyError.response.data);
                return res.status(pyError.response.status).json(pyError.response.data);
            }
            throw new Error('Failed to connect to AI Extraction Service');
        }

        const data = pythonResponse.data;
        // console.log('[Proxy] AI Extraction Success:', data.metadata);

        // Map Python Response to Frontend Format
        const responseData = {
            transactions: data.transactions.map(t => ({
                id: Date.now() + Math.random(),
                date: t.date,
                description: t.raw_description, // Use raw for description
                merchant: t.merchant,
                amount: t.amount,
                type: t.type,
                category: t.category,
                status: 'Completed',
                source: 'AI_PYTHON',
                confidence: t.confidence
            })),
            cardEnding: data.metadata.account_number ? data.metadata.account_number.slice(-4) : null,
            statementData: {
                bank: data.metadata.bank_name,
                statement_period: data.metadata.statement_period,
                totalDue: data.metadata.total_due,
                minPayment: data.metadata.minimum_due,
                dueDate: data.metadata.payment_due_date,
                credit_limit: data.metadata.credit_limit
            },
            rawText: "Processed by Python AI Service", // Placeholder or fetch if needed
            meta: {
                method: 'python_ai',
                confidence: data.confidence
            }
        };

        res.json(responseData);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({
            error: 'AI Extraction Failed',
            details: error.message
        });
    }
});

module.exports = router;
