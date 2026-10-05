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

function validateSignature(payload, signature, secret) {
    if (!secret) return true; // Debug safety
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('base64');
    return digest === signature;
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
        // ... (Existing Auth Logic remains same) ...
        // Support both Path Param (Direct), Header (Direct) and Query Param
        const apiKey = req.params.apiKey || req.headers['x-api-key'] || req.query.apiKey;
        const signature = req.headers['x-signature'];

        if (!apiKey) return res.status(403).json({ error: 'Missing API Key' });

        const user = await User.findOne({ where: { smsApiKey: apiKey } });
        if (!user) return res.status(403).json({ error: 'Invalid API Key' });

        user.lastDeviceSync = new Date();
        await user.save();

        if (!user.isDeviceApproved && user.deviceInfo) {
            console.warn(`[Webhook] Device pending for ${user.username}`);
            return res.status(403).json({ error: 'Device Pending Approval' });
        } else if (!user.isDeviceApproved && !user.deviceInfo) {
            console.log(`[Webhook] First connection. Auto-approving.`);
            user.isDeviceApproved = true;
            await user.save();
        }

        let bodyData = req.body;
        let senderName = "Unknown";
        const userAgent = req.headers['user-agent'] || '';

        // Heartbeat
        if (userAgent.includes('Heartbeat') || (bodyData && bodyData.type === 'HEARTBEAT')) {
            console.log(`[Webhook] Heartbeat from ${user.username}`);
            if (bodyData && bodyData.model) {
                user.deviceInfo = { model: bodyData.model, id: bodyData.deviceId, manufacturer: bodyData.manufacturer, version: bodyData.version };
                await user.save();
            }
            return res.json({ status: 'ok', type: 'heartbeat' });
        }

        if (signature) {
            // Validate Signature
            console.log(`[Webhook] API Key: ${apiKey} matched to User: ${user.username}`);
            console.log(`[Webhook] Received Signature: ${signature}`);
            console.log(`[Webhook] User SMS API Key for signing: ${user.smsApiKey}`);

            // Check if user has an API Key
            if (!user.smsApiKey) {
                console.error('[Webhook] User has no SMS API Key set!');
                return res.status(403).json({ error: 'Server Config Error: Missing Signing Key' });
            }

            const isValid = validateSignature(req.rawBody, signature, user.smsApiKey);
            console.log(`[Webhook] Signature Valid: ${isValid}`);

            if (!isValid) {
                console.error('[Webhook] Invalid Signature Mismatch');
                // Debug: Calculate what we expected
                const hmac = crypto.createHmac('sha256', user.smsApiKey);
                const digest = hmac.update(req.rawBody || '').digest('base64');
                console.log(`[Webhook] Expected: ${digest}`);
                return res.status(403).json({ error: 'Invalid Signature' });
            }

            // Decrypt Payload (Support both JSON {data: ...} and Raw String)
            let encryptedContent = null;

            if (bodyData && bodyData.data) {
                encryptedContent = bodyData.data;
            } else if (typeof bodyData === 'string') {
                encryptedContent = bodyData; // Android app sends raw string (Text/Plain)
            } else if (req.rawBody) {
                encryptedContent = req.rawBody.toString();
            }

            if (encryptedContent) {
                const decryptedJson = decryptPayload(encryptedContent, user.encryptionKey);
                if (decryptedJson) {
                    try {
                        bodyData = JSON.parse(decryptedJson);
                        console.log(`[Webhook] Decrypted payload for ${user.username}`);
                    } catch (e) {
                        // Fallback: If not JSON, use as raw string
                        console.log('[Webhook] Decrypted content is not JSON, using as raw string');
                        bodyData = { message: decryptedJson };
                    }
                } else {
                    console.error('[Webhook] Decryption Failed');
                    return res.status(400).json({ error: 'Decryption Failed' });
                }
            }
        }

        // Continue with parsing...
        if (!bodyData) return res.status(400).json({ error: 'Empty Body' });

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
            extracted = [{
                account: bodyData.merchant || 'Manual',
                amount: parseFloat(bodyData.amount),
                type: (bodyData.category_type || bodyData.transaction_type || 'expense').toLowerCase(),
                date: bodyData.receivedAt || new Date().toISOString(),
                merchant: bodyData.merchant || 'Manual',
                category: bodyData.category,
                description: bodyData.description || bodyData.message || ''
            }];
            extractionSource = 'direct_manual';
            console.log(`[Webhook] Using direct manual entry data: ${bodyData.amount}`);
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

module.exports = router;
