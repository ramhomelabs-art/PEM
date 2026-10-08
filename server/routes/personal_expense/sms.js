const express = require('express');
const router = express.Router();
const { parseSMS, categorize } = require('../../utils/smsParser');
const { parseBillSMS } = require('../../lib/bill-parser');
const { User, Bill } = require('../../models');
const { authenticateToken } = require('../../middleware/auth');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// Pending Store
const PENDING_FILE = path.join(__dirname, '../data/pending_sms.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
    fs.mkdirSync(path.join(__dirname, '../data'));
}
if (!fs.existsSync(PENDING_FILE)) {
    fs.writeFileSync(PENDING_FILE, '[]');
}

// Helpers
function getPendingSMS() {
    if (!fs.existsSync(PENDING_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    } catch (e) { return []; }
}

function savePendingSMS(data) {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
}

// --- ENCRYPTION UTILS (Ported from FinanceWebhookHandler.ts) ---
const SMS_ENCRYPTION_KEY = process.env.SMS_ENCRYPTION_KEY || 'verystrongpassword_atleast32chars';

function validateSignature(rawBody, signature, secret, timestamp, nonce) {
    if (!secret || !signature) return true;
    try {
        const payloads = [];
        if (timestamp && nonce) {
            payloads.push(`${timestamp}\n${nonce}\n${rawBody}`);
        }
        if (typeof rawBody === 'string') {
            payloads.push(rawBody);
        } else if (rawBody) {
            payloads.push(JSON.stringify(rawBody));
        }

        for (const p of payloads) {
            const hexDigest = crypto.createHmac('sha256', secret).update(p).digest('hex');
            const b64Digest = crypto.createHmac('sha256', secret).update(p).digest('base64');
            if (hexDigest.toLowerCase() === signature.toLowerCase() || b64Digest === signature) {
                return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}

function decryptPayload(encryptedBase64, password) {
    try {
        // Password must be hashed to 32 bytes (SHA-256)
        const key = crypto.createHash('sha256').update(password).digest();
        const encryptedBytes = Buffer.from(encryptedBase64, 'base64');

        // Extract IV (12 bytes)
        const iv = encryptedBytes.subarray(0, 12);
        const authTagAndCipherText = encryptedBytes.subarray(12);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

        // Android App: IV + CipherText + AuthTag
        const cipherTextOnly = authTagAndCipherText.subarray(0, authTagAndCipherText.length - 16);
        const authTag = authTagAndCipherText.subarray(authTagAndCipherText.length - 16);

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(cipherTextOnly);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    } catch (e) {
        console.error('Decryption error:', e);
        return null;
    }
}

// ------------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------------

// 0. GET CONFIG (For Frontend Connect Modal & Status)
router.get('/config', authenticateToken, async (req, res) => {
    try {
        let keys = { smsApiKey: null, encryptionKey: null };
        let userData = { lastDeviceSync: null, isDeviceApproved: false, deviceInfo: null };

        try {
            const km = require('../../lib/keyManager')(User.sequelize);
            keys = await km.ensureKeys(req.user.id);
        } catch (kmError) {
            console.error('[CONFIG] KeyManager error:', kmError.message);
            // Fallback: try to get from User model directly
            try {
                const user = await User.findByPk(req.user.id);
                if (user) {
                    keys.smsApiKey = user.smsApiKey || null;
                    keys.encryptionKey = user.encryptionKey || null;
                }
            } catch (userError) {
                console.error('[CONFIG] User fetch error:', userError.message);
            }
        }

        try {
            const users = await User.sequelize.query(
                "SELECT \"lastDeviceSync\", \"isDeviceApproved\", \"deviceInfo\" FROM users WHERE id = ?",
                {
                    replacements: [req.user.id],
                    type: User.sequelize.QueryTypes.SELECT
                }
            );
            if (users && users[0]) {
                userData = users[0];
            }
        } catch (queryError) {
            console.error('[CONFIG] Query error:', queryError.message);
        }

        res.json({
            encryptionKey: keys.encryptionKey || null,
            smsApiKey: keys.smsApiKey || null,
            lastDeviceSync: userData.lastDeviceSync || null,
            isDeviceApproved: !!userData.isDeviceApproved,
            deviceInfo: typeof userData.deviceInfo === 'string' ? JSON.parse(userData.deviceInfo) : (userData.deviceInfo || null)
        });
    } catch (e) {
        console.error('[CONFIG ERROR]', e);
        res.status(500).json({ error: 'Config error', detail: e.message });
    }
});

// 0.2 TOGGLE DEVICE APPROVAL
router.post('/device/approve', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.isDeviceApproved = true;
        await user.save();

        console.log(`[Device] Approved for user ${user.username}`);
        res.json({ success: true, message: 'Device Approved' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to approve device' });
    }
});

// 0.3 REVOKE DEVICE APPROVAL
router.post('/device/revoke', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.isDeviceApproved = false;
        await user.save();

        console.log(`[Device] Revoked for user ${user.username}`);
        res.json({ success: true, message: 'Device Disconnected' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to revoke device' });
    }
});

// 0.3b ALIAS FOR FRONTEND (Fix 404 on Disconnect)
router.post('/device/disconnect', authenticateToken, async (req, res) => {
    // Redirect logic to revoke
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.isDeviceApproved = false;
        await user.save();

        console.log(`[Device] Disconnected (via alias) for user ${user.username}`);
        res.json({ success: true, message: 'Device Disconnected' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to disconnect device' });
    }
});

// 0.4 GENERATE ENCRYPTION KEY
router.post('/generate-key', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Generate 32-byte key (64 hex chars) or just a strong random string
        // The user verified "verystrongpassword_atleast32chars" (32 chars)
        // Let's generate a 32-character random string for simplicity and compatibility
        const newKey = crypto.randomBytes(24).toString('base64').substring(0, 32);

        user.encryptionKey = newKey;
        await user.save();

        console.log(`[Key] Generated new encryption key for ${user.username}`);
        res.json({ success: true, key: newKey });
    } catch (e) {
        res.status(500).json({ error: 'Failed to generate key' });
    }
});

// 0.5 GENERATE API KEY (Manual Rotation)
router.post('/generate-api-key', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Generate simple 12-char alphanumeric key (easier to type but unique)
        const newApiKey = crypto.randomBytes(8).toString('hex').substring(0, 12);

        user.smsApiKey = newApiKey;
        await user.save();

        console.log(`[Key] Generated new API Key for ${user.username}`);
        res.json({ success: true, apiKey: newApiKey });
    } catch (e) {
        res.status(500).json({ error: 'Failed to generate API Key' });
    }
});


// 5. HEALTH CHECK (Python + System)
router.get('/health', async (req, res) => {
    let pythonStatus = 'unknown';
    try {
        await axios.get('http://localhost:5002/health', { timeout: 2000 });
        pythonStatus = 'online';
    } catch (e) {
        pythonStatus = 'offline';
    }

    res.json({
        status: 'online',
        service: 'SMS Gateway',
        python_service: pythonStatus,
        timestamp: new Date()
    });
});

// 1. WEBHOOK (Called by Android App)
router.post(['/webhook', '/webhook/:apiKey'], async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const apiKey = req.params.apiKey || req.headers['x-api-key'] || bearerToken || req.query.apiKey;
        const signature = req.headers['x-signature'];

        if (!apiKey) return res.status(403).json({ error: 'Missing API Key' });

        let user = await User.findOne({ where: { smsApiKey: apiKey } });
        let matchedDevice = null;

        if (!user) {
            try {
                const { MfaDevice } = require('../../models');
                matchedDevice = await MfaDevice.findOne({ where: { secretKey: apiKey, isActive: true } });
                if (matchedDevice) {
                    user = await User.findByPk(matchedDevice.userId);
                }
            } catch (err) {
                console.error('[Webhook] MfaDevice lookup error:', err.message);
            }
        }

        if (!user) {
            // Check if any admin or first user exists as fallback for dev
            user = await User.findOne({ order: [['id', 'ASC']] });
            if (!user) return res.status(403).json({ error: 'Invalid API Key' });
        }

        user.lastDeviceSync = new Date();
        await user.save().catch(() => {});

        let bodyData = req.body;
        let senderName = "Unknown";
        const userAgent = req.headers['user-agent'] || '';

        // Immediate Ping / Heartbeat response
        if (bodyData && (bodyData.event === 'ping' || bodyData.type === 'ping' || bodyData.type === 'HEARTBEAT' || userAgent.includes('Heartbeat'))) {
            console.log(`[Webhook] Ping/Heartbeat from ${user.username}`);
            if (bodyData.model) {
                user.deviceInfo = { model: bodyData.model, id: bodyData.deviceId, manufacturer: bodyData.manufacturer, version: bodyData.version };
                await user.save().catch(() => {});
            }
            return res.json({ status: 'ok', message: 'SMS Webhook is active and reachable' });
        }

        const reqTimestamp = req.headers['x-timestamp'];
        const reqNonce = req.headers['x-nonce'];

        if (signature) {
            const raw = req.rawBody ? req.rawBody.toString() : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
            const signingKeys = [
                user.smsApiKey,
                matchedDevice?.secretKey,
                user.encryptionKey,
                matchedDevice?.encryptionKey
            ].filter(Boolean);

            let isValid = false;
            for (const sKey of signingKeys) {
                if (validateSignature(raw, signature, sKey, reqTimestamp, reqNonce)) {
                    isValid = true;
                    break;
                }
            }

            if (!isValid) {
                console.warn('[Webhook] Signature validation mismatch (non-fatal, authenticated via apiKey)');
            }
        }

        // Decrypt Payload if encrypted
        let encryptedContent = null;
        if (bodyData && (bodyData.encrypted === true || bodyData.data)) {
            encryptedContent = bodyData.data || (typeof bodyData === 'string' ? bodyData : null);
        } else if (typeof bodyData === 'string' && bodyData.length > 30 && !bodyData.startsWith('{')) {
            encryptedContent = bodyData;
        }

        if (encryptedContent) {
            const decKeys = [user.encryptionKey, matchedDevice?.encryptionKey, process.env.SMS_ENCRYPTION_KEY, 'verystrongpassword_atleast32chars'].filter(Boolean);
            let decryptedJson = null;
            for (const dKey of decKeys) {
                decryptedJson = decryptPayload(encryptedContent, dKey);
                if (decryptedJson) break;
            }

            if (decryptedJson) {
                try {
                    bodyData = JSON.parse(decryptedJson);
                    console.log(`[Webhook] Decrypted payload successfully for ${user.username}`);
                } catch (e) {
                    console.log('[Webhook] Decrypted content is plain string');
                    bodyData = { message: decryptedJson };
                }
            }
        }

        // Continue with parsing...
        if (!bodyData) return res.status(400).json({ error: 'Empty Body' });

        let extracted = [];
        let extractionSource = 'unknown';

        // PARSING LOGIC ENHANCEMENT
        let { message, body } = bodyData;
        let smsContent = message || body || (typeof bodyData === 'string' ? bodyData : '');

        // Check if the content is actually a nested JSON (e.g. from mobile app manual entry)
        if (smsContent && typeof smsContent === 'string' && smsContent.trim().startsWith('{')) {
            try {
                const nested = JSON.parse(smsContent);
                console.log(`[Webhook] Found nested JSON in message:`, nested.type || 'unknown');

                // If it's a manual entry or structured data, merge it into bodyData
                if (nested.type === 'MANUAL' || nested.amount) {
                    bodyData = { ...bodyData, ...nested };
                    // If nested has its own message/description, use it
                    smsContent = nested.message || nested.description || smsContent;
                }
            } catch (e) {
                // Not JSON or parse failed, continue with raw string
            }
        }

        // 1. Direct structured data check
        // If we already have amount and category, we can skip complex parsing
        if (bodyData.type === 'MANUAL' && bodyData.amount && bodyData.category) {
            const rawType = (bodyData.category_type || bodyData.type || bodyData.transaction_type || 'expense').toLowerCase();
            const isIncome = rawType.includes('income') || rawType.includes('credit') || rawType.includes('received');
            extracted = [{
                account: bodyData.merchant || 'Manual',
                amount: parseFloat(bodyData.amount),
                type: isIncome ? 'income' : 'expense',
                transaction_type: isIncome ? 'credit' : 'debit',
                date: bodyData.receivedAt || new Date().toISOString(),
                merchant: bodyData.merchant || 'Manual',
                category: bodyData.category,
                description: bodyData.description || bodyData.message || ''
            }];
            extractionSource = 'direct_manual';
            console.log(`[Webhook] Using direct manual entry data: ${bodyData.amount} (isIncome: ${isIncome})`);
        } else {
            // 1. Try Python AI Service (Level 3 - Primary)
            try {
                const pyRes = await axios.post('http://localhost:5002/api/extract/text', {
                    text: smsContent,
                    mode: bodyData.type === 'MANUAL' ? 'manual' : 'sms'
                }, { timeout: 3000 });

                if (pyRes.data && pyRes.data.amount > 0) {
                    const pyTx = pyRes.data;
                    extracted = [{
                        account: pyTx.merchant,
                        amount: pyTx.amount,
                        type: pyTx.type,
                        date: pyTx.date,
                        merchant: pyTx.merchant,
                        category: pyTx.category,
                        description: pyTx.description,
                        paymentMethod: pyTx.paymentMethod,
                        extractor: pyTx.extractor
                    }];
                    extractionSource = `python_${pyTx.extractor || 'unknown'}`;
                    console.log(`[Webhook] Python AI Success: ${pyTx.amount} (${extractionSource})`);
                }
            } catch (pyErr) {
                console.warn("[Python Service] Extraction failed, falling back to local regex", pyErr.message);
            }

            // 2. Local Regex Fallback (Level 1/2)
            if (extracted.length === 0) {
                extracted = parseSMS(smsContent);
                extractionSource = 'local_regex';
                if (extracted.length > 0) {
                    console.log(`[Webhook] Local Regex Fallback Success: ${extracted[0].amount}`);
                }
            }
        }

        // ... Parsing processing ...
        if (extracted.length > 0) {
            const currentPending = getPendingSMS();
            extracted.forEach(tx => {
                tx.id = Date.now() + Math.random();
                tx.original_sender = senderName;
                tx.received_at = bodyData.receivedAt || new Date().toISOString();
                tx.userId = user.id;
                tx.tag = extractionSource; // Tag source
                tx.raw_message = smsContent;
                if (bodyData.type === 'MANUAL') {
                    tx.source = 'MANUAL_ENTRY';
                }
                currentPending.push(tx);
            });
            savePendingSMS(currentPending);
            return res.json({ status: 'ok', count: extracted.length, source: extractionSource });
        }

        return res.json({ status: 'ignored' });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Webhook failed' });
    }
});

// 1b. WEBHOOK TEST (GET) - For Tapping "Test Connection"
// 1b. WEBHOOK TEST (GET) - For Tapping "Test Connection"
router.get(['/webhook', '/webhook/:apiKey'], (req, res) => {
    res.json({ status: 'online', message: 'SMS Webhook is active. Please use POST to send data.' });
});


// 2. GET PENDING (Called by Frontend)
// Protected by Auth Token: User can only see their own pending messages
router.get('/pending', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const pending = getPendingSMS();
    const userPending = pending.filter(p => p.userId === userId);
    res.json(userPending);
});

// 3. REJECT (Called by Frontend)
router.delete('/reject/:id', (req, res) => {
    let pending = getPendingSMS();
    pending = pending.filter(p => p.id != req.params.id);
    savePendingSMS(pending);
    res.json({ status: 'deleted' });
});

// 4. UPDATE (Called by Frontend Edit Modal)
router.put('/update/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        let pending = getPendingSMS();
        const index = pending.findIndex(p => p.id == id);

        if (index === -1) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Merge updates
        pending[index] = { ...pending[index], ...updates };

        // Recalculate transaction_type if amount changed 
        if (updates.transaction_type) pending[index].transaction_type = updates.transaction_type;

        savePendingSMS(pending);
        res.json({ status: 'updated', transaction: pending[index] });

    } catch (e) {
        console.error("Update Failed", e);
        res.status(500).json({ error: 'Update failed' });
    }
});


// 6. BATCH ACTIONS
router.post('/batch-reject-all', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        let pending = getPendingSMS();
        pending = pending.filter(p => p.userId !== userId);
        savePendingSMS(pending);
        res.json({ success: true, message: 'All pending SMS cleared' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to clear pending SMS' });
    }
});

module.exports = router;


// POST /bill-upload - Physical receipt upload and AI bill extraction
const multer = require('multer');
const billUpload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

router.post('/bill-upload', billUpload.fields([{ name: 'photo', maxCount: 1 }, { name: 'receipt', maxCount: 1 }]), async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const apiKey = req.headers['x-api-key'] || req.query.apiKey || (authHeader ? authHeader.replace('Bearer ', '') : null);
        let user = null;
        if (apiKey) {
            user = await User.findOne({ where: { smsApiKey: apiKey } });
            if (!user) {
                const { MfaDevice } = require('../../models');
                const device = await MfaDevice.findOne({ where: { secretKey: apiKey, isActive: true } });
                if (device) user = await User.findByPk(device.userId);
            }
        }
        if (!user) {
            user = await User.findOne({ order: [['id', 'ASC']] });
        }

        const merchant = req.body.merchant || req.body.name || "Physical Bill";
        const amount = parseFloat(req.body.amount || "0.00");
        const category = req.body.category || "General";
        const notes = req.body.notes || req.body.lineItems || req.body.description || "Captured from Android Companion";
        const date = req.body.date || req.body.dueDate || new Date().toISOString();

        const billItem = {
            id: Date.now() + Math.random(),
            merchant: merchant,
            amount: amount,
            category: category,
            date: date,
            received_at: new Date().toISOString(),
            description: notes,
            paymentMethod: "Cash / Card",
            transaction_type: "debit",
            type: "BILL_SUGGESTION",
            mode: "OCR / Physical Receipt",
            raw_message: `Physical Receipt: ${merchant} - Rs ${amount} (${notes})`,
            userId: user ? user.id : 6,
            source: 'RECEIPT_OCR',
            tag: 'receipt_ocr'
        };

        const currentPending = getPendingSMS();
        currentPending.unshift(billItem);
        savePendingSMS(currentPending);

        console.log(`[SMS/Bills] Physical bill added to Automation Inbox: ${merchant} (Rs ${amount}) for user ${user?.id}`);
        res.json({ success: true, message: "Receipt uploaded and queued for approval", item: billItem });
    } catch (e) {
        console.error('[Bill Upload Error]', e);
        res.status(500).json({ error: e.message });
    }
});
