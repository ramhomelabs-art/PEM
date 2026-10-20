const express = require('express');
const router = express.Router();
const axios = require('axios');
const os = require('os');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { 
    Category, Transaction, User, sequelize, Bill, Budget, Goal, Loan,
    MfaDevice, MfaPushRequest, MfaTotpSecret 
} = require('../../models');
const dbModels = require('../../models');
const { authenticateToken } = require('../../middleware/auth');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5002';

// --- PING TEST ---
router.get('/ping', (req, res) => res.json({ message: 'PONG from server_mgr' }));

// --- SERVER SETUP STATUS (Public for Setup Detection) ---
// Stays public so the login page can detect whether initial setup is required,
// but admin PII is only returned to an authenticated admin caller.
router.get('/setup-status', async (req, res) => {
    try {
        const admin = await User.findOne({ where: { role: 'admin' } });
        const totalUsers = await User.count().catch(() => 0);

        let isAdminCaller = false;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const jwt = require('jsonwebtoken');
                const { JWT_SECRET } = require('../../config/auth');
                const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
                isAdminCaller = decoded && (decoded.role === 'admin' || decoded.role === 'administrator');
            } catch {
                isAdminCaller = false;
            }
        }

        res.json({
            isInitialized: !!admin,
            adminExists: !!admin,
            adminUser: (admin && isAdminCaller) ? {
                username: admin.username,
                email: admin.email,
                fullName: admin.fullName
            } : null,
            totalUsers,
            dbConnected: true,
            nodeEnv: process.env.NODE_ENV || 'development'
        });
    } catch (err) {
        res.status(500).json({ error: err.message, dbConnected: false });
    }
});

// --- INITIAL SETUP & SERVER MANAGEMENT ROOT ACCOUNT CREATION (WITHOUT MFA) ---
router.post('/initial-setup', async (req, res) => {
    try {
        const { username, email, fullName, password, currency = 'INR', timezone = 'IST (UTC+5:30)', country = 'India' } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Bootstrap is only permitted on a truly empty database (zero users).
        // If ANY user exists, admin credentials are required — otherwise deleting
        // the last admin would let an unauthenticated attacker mint a new root admin.
        const userCount = await User.count();
        const existingAdmin = await User.findOne({ where: { role: 'admin' } });

        if (userCount > 0) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) {
                return res.status(403).json({ error: 'Server is already initialized. Please log in with existing admin credentials to modify the server management account.' });
            }
            const jwt = require('jsonwebtoken');
            const { JWT_SECRET } = require('../../config/auth');
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded.role !== 'admin') {
                    return res.status(403).json({ error: 'Admin privileges required' });
                }
            } catch (tokErr) {
                return res.status(403).json({ error: 'Invalid or expired authentication token' });
            }
        } else if (existingAdmin) {
            // Defensive: no users counted but an admin row somehow exists.
            return res.status(409).json({ error: 'Server already has an administrator. Please sign in as admin.' });
        }

        const hashedPassword = await bcrypt.hash(password.trim(), 10);
        const smsApiKey = crypto.randomBytes(16).toString('hex');

        let user = await User.findOne({
            where: {
                [Op.or]: [
                    { email: email.trim().toLowerCase() },
                    { username: username.trim() }
                ]
            }
        });

        if (user) {
            // Update existing account to be the root admin without MFA
            await user.update({
                username: username.trim(),
                email: email.trim().toLowerCase(),
                fullName: fullName ? fullName.trim() : (user.fullName || 'Server Administrator'),
                password: hashedPassword,
                role: 'admin',
                status: 'active',
                mfaExempt: true,
                mfaEnabled: false,
                mfaConfigured: false,
                mfaMethod: 'none',
                currency: currency || user.currency || 'INR',
                timezone: timezone || user.timezone || 'IST (UTC+5:30)',
                country: country || user.country || 'India',
                smsApiKey: user.smsApiKey || smsApiKey
            });
        } else {
            // Create brand new root admin
            user = await User.create({
                username: username.trim(),
                email: email.trim().toLowerCase(),
                fullName: fullName ? fullName.trim() : 'Server Administrator',
                password: hashedPassword,
                role: 'admin',
                status: 'active',
                mfaExempt: true,
                mfaEnabled: false,
                mfaConfigured: false,
                mfaMethod: 'none',
                country: country || 'India',
                currency: currency || 'INR',
                timezone: timezone || 'IST (UTC+5:30)',
                mobile: '+91 98765 43210',
                smsApiKey: smsApiKey
            });
        }

        // Clean out any leftover MFA device or secret records for this root account
        try {
            if (MfaTotpSecret) await MfaTotpSecret.destroy({ where: { userId: user.id } });
            if (MfaDevice) await MfaDevice.destroy({ where: { userId: user.id } });
            if (MfaPushRequest) await MfaPushRequest.destroy({ where: { userId: user.id } });
        } catch (mfaErr) {
            console.warn('[Server Mgr] Could not prune old MFA records:', mfaErr.message);
        }

        // Generate immediate JWT token for seamless continuation in setup wizard
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../../config/auth');
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            message: 'Server Management Root Account configured successfully.',
            token,
            smsApiKey: user.smsApiKey,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                status: user.status,
                currency: user.currency,
                timezone: user.timezone,
                country: user.country,
                smsApiKey: user.smsApiKey,
                mfaExempt: true,
                mfaEnabled: false
            }
        });
    } catch (err) {
        console.error('[Server Mgr] Initial setup error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ANDROID COMPANION APK DIRECT DOWNLOAD & QR ENDPOINTS ---
const resolveApkPath = () => {
    const candidates = [
        'D:/Project/sms-forwarder-app/app/build/outputs/apk/debug/app-debug.apk',
        'D:/Project/sms-forwarder-app/app/release/app-release.apk',
        path.join(__dirname, '../../uploads/pem-companion.apk')
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
};

router.get('/apk-download', (req, res) => {
    const apkPath = resolveApkPath();
    if (!apkPath) {
        return res.status(404).json({ error: 'APK build not found on server.' });
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.download(apkPath, 'pem-companion.apk');
});

router.get('/apk-qr', async (req, res) => {
    try {
        const qrcode = require('qrcode');
        const host = req.get('host');
        const protocol = req.protocol;
        const downloadUrl = `${protocol}://${host}/api/server/apk-download`;
        const qrCodeUrl = await qrcode.toDataURL(downloadUrl, {
            width: 320,
            margin: 2,
            color: { dark: '#020617', light: '#ffffff' }
        });
        res.json({
            downloadUrl,
            qrCodeUrl,
            apkAvailable: Boolean(resolveApkPath())
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- COMPLETE SERVICES & EXTERNAL APIS CATALOG ---
router.get('/external-services-catalog', async (req, res) => {
    try {
        const pyUrl = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5002';
        let pythonHealth = 'offline';
        try {
            const pyRes = await axios.get(`${pyUrl}/health`, { timeout: 1500 });
            pythonHealth = pyRes.data?.status || 'online';
        } catch {
            pythonHealth = 'offline';
        }

        const host = req.get('host') || 'localhost:5005';
        const protocol = req.protocol || 'http';
        const baseUrl = `${protocol}://${host}`;

        const catalog = [
            {
                id: 'sms-webhook',
                category: 'Mobile & Ingestion',
                name: 'SMS Forwarder Webhook Gateway',
                type: 'Inbound Webhook',
                status: 'active',
                endpoint: `${baseUrl}/api/sms/ingest`,
                secondaryEndpoint: `${baseUrl}/api/sms/webhook`,
                authMethod: 'X-API-Key Header or URL Parameter',
                description: 'Receives encrypted AES-GCM SMS payloads from the Android companion app. Auto-extracts bank debits, credits, UPI handles, merchants, and balances.'
            },
            {
                id: 'mfa-push-fcm',
                category: 'Mobile & Ingestion',
                name: 'Mobile Push MFA & Device Gateway',
                type: 'Hybrid (FCM + Long Polling)',
                status: process.env.FIREBASE_PROJECT_ID ? 'configured' : 'long-polling-active',
                endpoint: `${baseUrl}/api/mfa/mobile/pending-requests`,
                authMethod: 'smsApiKey Header / Device Secret',
                description: 'Delivers real-time 1-tap push approval prompts to the Android companion app with fallback to local polling.'
            },
            {
                id: 'python-ai-ocr',
                category: 'AI & Document Microservice',
                name: 'Python AI OCR & Passbook Extractor',
                type: 'Microservice (FastAPI/Flask Port 5002)',
                status: pythonHealth,
                endpoint: pyUrl,
                authMethod: 'Internal Service Network',
                description: 'Computer vision OCR for bank passbook scans, credit card statements, and receipt image parsing.'
            },
            {
                id: 'yahoo-finance',
                category: 'Market & Investment APIs',
                name: 'Yahoo Finance Market Engine',
                type: 'External Financial API (yahoo-finance2)',
                status: 'active',
                endpoint: `${baseUrl}/api/market/quote/:ticker`,
                authMethod: 'Pre-configured (Zero-Config)',
                description: 'Real-time quotes, historical price charts, and forex rates for NSE/BSE stocks, US Equities, Currencies (USD/INR), and Crypto.'
            },
            {
                id: 'alpha-vantage',
                category: 'Market & Investment APIs',
                name: 'Alpha Vantage Intelligence',
                type: 'External Market API',
                status: process.env.ALPHA_VANTAGE_API_KEY ? 'configured' : 'optional',
                endpoint: 'https://www.alphavantage.co/query',
                envVar: 'ALPHA_VANTAGE_API_KEY',
                isConfigured: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
                description: 'Institutional-grade technical indicators (RSI, MACD, SMA), balance sheet fundamentals, and company news sentiment.'
            },
            {
                id: 'twelve-data',
                category: 'Market & Investment APIs',
                name: 'Twelve Data Market Streaming',
                type: 'External Financial Stream',
                status: process.env.TWELVE_DATA_API_KEY ? 'configured' : 'optional',
                endpoint: 'https://api.twelvedata.com',
                envVar: 'TWELVE_DATA_API_KEY',
                isConfigured: Boolean(process.env.TWELVE_DATA_API_KEY),
                description: 'Low-latency intraday market time series and currency exchange data.'
            },
            {
                id: 'amfi-nav',
                category: 'Market & Investment APIs',
                name: 'AMFI India Mutual Funds Daily NAV Feed',
                type: 'Public Government/Regulatory Feed',
                status: 'active',
                endpoint: 'https://www.amfiindia.com/spages/NAVAll.txt',
                authMethod: 'Public Unauthenticated Feed',
                description: 'Nightly automated synchronization of daily Net Asset Values (NAV) for all Indian mutual fund schemes.'
            },
            {
                id: 'cas-parser',
                category: 'Market & Investment APIs',
                name: 'CAMS & KFintech CAS Statement Decryptor',
                type: 'Internal PDF Engine',
                status: 'active',
                endpoint: `${baseUrl}/api/investing/cas/upload`,
                authMethod: 'Bearer JWT',
                description: 'Decrypts password-protected Consolidated Account Statement (CAS) PDFs and maps folios, units, and transactions.'
            },
            {
                id: 'metals-api',
                category: 'Market & Investment APIs',
                name: 'Gold & Silver Live Spot Prices',
                type: 'Commodities Price Tracker',
                status: 'active',
                endpoint: `${baseUrl}/api/metals/live`,
                authMethod: 'Internal Service',
                description: '24 Karat and 22 Karat Gold and Silver spot prices in INR per gram/10g.'
            },
            {
                id: 'google-gmail',
                category: 'Automated Bill & Statement Ingestion',
                name: 'Google OAuth & Gmail Statement Harvester',
                type: 'Google Workspace API',
                status: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'optional',
                envVar: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET',
                isConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
                scopes: 'gmail.readonly',
                description: 'Automatically detects and downloads credit card e-statements from bank emails (HDFC, SBI, ICICI, Axis, Amex).'
            },
            {
                id: 'smtp-email',
                category: 'Outbound Notifications & Alerts',
                name: 'SMTP Outbound Email Gateway',
                type: 'SMTP Relay',
                status: process.env.SMTP_HOST ? 'configured' : 'console-mode',
                envVar: 'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS',
                isConfigured: Boolean(process.env.SMTP_HOST),
                description: 'Sends password recovery OTPs, login anomaly alerts, and daily pending transaction digest emails.'
            },
            {
                id: 'developer-rest-api',
                category: 'Developer & Third-Party Integrations',
                name: 'Core REST Developer Gateway (30+ Endpoints)',
                type: 'Internal OpenAPI/REST',
                status: 'active',
                endpoint: `${baseUrl}/api`,
                authMethod: 'Authorization: Bearer <JWT_TOKEN>',
                description: 'Full REST API coverage for Home Assistant, Node-RED, Shortcuts, scripts, and webhook automations.'
            }
        ];

        res.json({
            success: true,
            totalServices: catalog.length,
            catalog
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- RESET MFA LOCKOUT FOR ROOT SERVER ADMIN ---
router.post('/admin-account/reset-mfa', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const targetId = req.body.userId || req.user.id;
        const targetUser = await User.findByPk(targetId);
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        await targetUser.update({
            mfaExempt: true,
            mfaEnabled: false,
            mfaConfigured: false,
            mfaMethod: 'none'
        });

        if (MfaTotpSecret) await MfaTotpSecret.destroy({ where: { userId: targetId } }).catch(() => {});
        if (MfaDevice) await MfaDevice.destroy({ where: { userId: targetId } }).catch(() => {});
        if (MfaPushRequest) await MfaPushRequest.destroy({ where: { userId: targetId } }).catch(() => {});

        res.json({
            success: true,
            message: `MFA permanently disabled and exemption activated for root manager '${targetUser.username}'. No 2FA required.`,
            user: {
                username: targetUser.username,
                mfaExempt: true,
                mfaEnabled: false
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REAL SERVER TELEMETRY & HARDWARE METRICS (NO SIMULATOR) ---
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;
        cpus.forEach((cpu) => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        const cpuUsagePercent = totalTick > 0 
            ? Math.min(100, Math.max(0, (((totalTick - totalIdle) / totalTick) * 100))) 
            : 0;

        const totalMemBytes = os.totalmem();
        const freeMemBytes = os.freemem();
        const usedMemBytes = totalMemBytes - freeMemBytes;
        const memUsagePercent = totalMemBytes > 0 
            ? ((usedMemBytes / totalMemBytes) * 100).toFixed(1) 
            : 0;

        // Live Database Connection Ping & Table Row Counts
        let dbStatus = 'healthy';
        let dbLatency = 0;
        let dbError = null;
        let counts = { users: 0, transactions: 0, budgets: 0, loans: 0, bills: 0, categories: 0 };
        const dbStart = Date.now();
        try {
            await sequelize.authenticate();
            dbLatency = Date.now() - dbStart;
            const [u, t, b, l, bi, c] = await Promise.all([
                User.count().catch(() => 0),
                Transaction.count().catch(() => 0),
                Budget.count().catch(() => 0),
                Loan.count().catch(() => 0),
                sequelize.models.Bill ? sequelize.models.Bill.count().catch(() => 0) : 0,
                Category.count().catch(() => 0)
            ]);
            counts = { users: u, transactions: t, budgets: b, loans: l, bills: bi, categories: c };
        } catch (e) {
            dbStatus = 'error';
            dbError = e.message;
        }

        // Live Python Service Health Check
        let pythonStatus = 'unknown';
        let pythonLatency = 0;
        let pythonVersion = 'unknown';
        try {
            const pyStart = Date.now();
            const pyRes = await axios.get(`${PYTHON_SERVICE_URL}/health`, { timeout: 2000 });
            pythonLatency = Date.now() - pyStart;
            pythonStatus = pyRes.data?.status || 'online';
            pythonVersion = pyRes.data?.version || '1.0.0';
        } catch (pyErr) {
            pythonStatus = 'offline';
        }

        const uptimeSec = Math.floor(os.uptime());
        const days = Math.floor(uptimeSec / 86400);
        const hours = Math.floor((uptimeSec % 86400) / 3600);
        const minutes = Math.floor((uptimeSec % 3600) / 60);
        const uptimeFormatted = `${days > 0 ? days + 'd ' : ''}${hours}h ${minutes}m`;

        res.json({
            cpu: {
                usage: `${cpuUsagePercent.toFixed(1)}%`,
                usagePercent: parseFloat(cpuUsagePercent.toFixed(1)),
                cores: cpus.length,
                model: cpus[0]?.model || 'Processor'
            },
            memory: {
                used: `${(usedMemBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
                total: `${(totalMemBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
                free: `${(freeMemBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
                usagePercent: parseFloat(memUsagePercent)
            },
            uptime: uptimeFormatted,
            uptimeSeconds: uptimeSec,
            system: {
                platform: os.platform(),
                release: os.release(),
                arch: os.arch(),
                hostname: os.hostname(),
                nodeVersion: process.version,
                pid: process.pid,
                env: process.env.NODE_ENV || 'development'
            },
            database: {
                status: dbStatus,
                latencyMs: dbLatency,
                dialect: sequelize.getDialect ? sequelize.getDialect() : 'postgres',
                totalRows: Object.values(counts).reduce((a, b) => a + b, 0),
                counts,
                error: dbError
            },
            services: {
                backend: 'online',
                python: pythonStatus,
                pythonLatencyMs: pythonLatency,
                pythonVersion
            },
            // Flat backwards-compatible keys
            source: 'ACTIVE_SERVER_MGR_FILE',
            cpuRaw: cpuUsagePercent.toFixed(1),
            ramRaw: memUsagePercent,
            totalMem: `${(totalMemBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
            freeMem: `${(freeMemBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
            dbStatus,
            dbError
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- DIAGNOSTIC TOOL ---
router.post('/diagnose', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    const logs = [];
    const addLog = (msg, status = 'INFO') => logs.push(`[${new Date().toISOString().split('T')[1].split('.')[0]}] [${status}] ${msg}`);

    addLog('🚀 STARTING DEEP DIAGNOSIS...', 'START');

    try {
        // 1. SYSTEM RESOURCES
        const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
        const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
        const cpuLoad = os.loadavg()[0];
        addLog(`System Resources: RAM ${freeMem}/${totalMem} GB | CPU Load: ${cpuLoad}`, 'SYS');

        // 2. DATABASE CHECK & STATISTICS
        addLog('Checking Database Integrity & Statistics...', 'DB');
        const startDb = Date.now();
        try {
            await User.findOne({ attributes: ['id'] });
            const dbLatency = Date.now() - startDb;
            addLog(`✓ Database Connected (Latency: ${dbLatency}ms)`, 'PASS');

            // Parallel Count Checks
            try {
                const [userCount, txCount, budgetCount, loanCount, billCount] = await Promise.all([
                    User.count(),
                    Transaction.count(),
                    Budget.count(),
                    Loan.count(),
                    sequelize.models.Bill.count()
                ]);

                addLog(`   • Users: ${userCount}`, 'INFO');
                addLog(`   • Transactions: ${txCount}`, 'INFO');
                addLog(`   • Budgets: ${budgetCount}`, 'INFO');
                addLog(`   • Active Loans: ${loanCount}`, 'INFO');
                addLog(`   • Bills: ${billCount}`, 'INFO');

                if (dbLatency > 100) addLog(`⚠ High Database Latency detected: ${dbLatency}ms`, 'WARN');

            } catch (countErr) {
                addLog(`⚠ Failed to fetch table statistics: ${countErr.message}`, 'WARN');
            }

        } catch (e) {
            addLog(`✗ Database Connection FAILED: ${e.message}`, 'FAIL');
        }

        // 3. PYTHON SERVICE CHECK
        addLog('Checking Python Extraction Service...', 'PY');
        const startPy = Date.now();
        try {
            const pyRes = await axios.get(`${PYTHON_SERVICE_URL}/health`, { timeout: 2000 });
            addLog(`✓ Python Service UP (${Date.now() - startPy}ms) | Version: ${pyRes.data.version}`, 'PASS');
        } catch (e) {
            addLog(`✗ Python Service DOWN: ${e.message}`, 'FAIL');
            addLog('-> Hint: Check "pm2 logs pem-python" on server', 'HINT');
        }

        // 4. ENVIRONMENT CHECK
        addLog('Checking Environment Variables...', 'ENV');
        addLog(`NODE_ENV: ${process.env.NODE_ENV}`, 'INFO');
        addLog(`DB_HOST: ${process.env.DB_HOST}`, 'INFO');
        addLog(`PYTHON_URL: ${PYTHON_SERVICE_URL}`, 'INFO');

        addLog('🏁 DIAGNOSIS COMPLETE', 'END');
        res.json({ logs });

    } catch (err) {
        addLog(`CRITICAL ERROR DURING DIAGNOSIS: ${err.message}`, 'FATAL');
        res.status(500).json({ logs });
    }
});

// --- CATEGORY MANAGEMENT ---

// Get all categories
router.get('/categories', authenticateToken, async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create category
router.post('/categories', authenticateToken, async (req, res) => {
    try {
        let name, type, color;
        if (typeof req.body === 'string') {
            name = req.body;
            type = 'expense';
            color = '#94a3b8';
        } else if (req.body && typeof req.body === 'object') {
            name = req.body.name;
            type = req.body.type || 'expense';
            color = req.body.color || '#94a3b8';
        }

        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const trimmedName = String(name).trim();

        const validTypes = ['income', 'expense', 'both'];
        const normalizedType = validTypes.includes(type) ? type : 'expense';

        // Check if category already exists for this type (or 'both')
        const { Op } = require('sequelize');
        const existing = await Category.findOne({
            where: {
                [Op.and]: [
                    sequelize.where(
                        sequelize.fn('lower', sequelize.col('name')),
                        trimmedName.toLowerCase()
                    ),
                    {
                        type: { [Op.in]: [normalizedType, 'both'] }
                    }
                ]
            }
        });
        if (existing) {
            return res.status(409).json({ error: `Category '${trimmedName}' already exists for ${normalizedType}` });
        }

        const category = await Category.create({
            name: trimmedName,
            type: normalizedType,
            color: color || '#94a3b8'
        });
        res.status(201).json(category);
    } catch (err) {
        console.error('[Categories] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update category (Just visual properties)
router.put('/categories/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { color, type } = req.body; // Name handled by rename endpoint
        await Category.update({ color, type }, { where: { id } });
        res.json({ message: 'Category updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rename Category (BULK ACTION)
router.put('/categories/rename/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { newName } = req.body;

        const category = await Category.findByPk(id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        const oldName = category.name;

        // 1. Update Category Name
        await Category.update({ name: newName }, { where: { id } });

        // 2. Bulk Update Transactions (scoped to the requesting user)
        const result = await Transaction.update(
            { category: newName },
            { where: { category: oldName, userId: req.user.id } }
        );

        res.json({
            message: `Renamed '${oldName}' to '${newName}'`,
            affectedTransactions: result[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Category
router.delete('/categories/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByPk(id);

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        if (category.isSystem) {
            return res.status(403).json({ error: 'Cannot delete system category' });
        }

        await Category.destroy({ where: { id } });
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- USER GROUP MANAGEMENT ---
router.put('/users/:id/group', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    try {
        const { id } = req.params;
        const { group, role } = req.body;

        const updateData = {};
        if (group !== undefined) updateData.group = group;
        if (role !== undefined) updateData.role = role;

        await User.update(updateData, { where: { id } });
        res.json({ message: 'User updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- BACKUP & RESTORE SYSTEM ---
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// DB Path (Relative to this route file: routes/personal_expense/server.js -> ../../database.sqlite)
const DB_PATH = path.join(__dirname, '../../database.sqlite');

// Encrypt and Stream Backup
router.get('/backup', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    try {
        const { password } = req.query;
        if (!password) return res.status(400).json({ error: 'Password required' });

        let fileData;
        const dialect = sequelize.getDialect();

        if (dialect === 'sqlite' && fs.existsSync(DB_PATH)) {
            fileData = fs.readFileSync(DB_PATH);
        } else {
            // PostgreSQL, MySQL or generic Sequelize dump
            const allModelKeys = Object.keys(dbModels).filter(
                (k) => k !== 'sequelize' && k !== 'Sequelize' && typeof dbModels[k]?.findAll === 'function'
            );

            const dump = {
                type: 'PEM_BACKUP_V2',
                version: '2.0.0',
                dialect,
                timestamp: new Date().toISOString(),
                tables: {}
            };

            for (const modelName of allModelKeys) {
                try {
                    dump.tables[modelName] = await dbModels[modelName].findAll({ raw: true });
                } catch (e) {
                    console.warn(`[BACKUP] Table ${modelName} fetch skipped:`, e.message);
                }
            }
            fileData = Buffer.from(JSON.stringify(dump), 'utf8');
        }

        // 2. Derive Key
        const salt = crypto.randomBytes(16);
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
        const iv = crypto.randomBytes(12);

        // 3. Encrypt
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(fileData), cipher.final()]);
        const tag = cipher.getAuthTag();

        // 4. Construct Output: Salt(16) + IV(12) + Tag(16) + EncryptedData
        const output = Buffer.concat([salt, iv, tag, encrypted]);

        // 5. Send File
        const dateStr = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Disposition', `attachment; filename=finance_backup_${dateStr}.pemdb`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(output);

    } catch (err) {
        console.error("Backup Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Restore Database
router.post('/restore', authenticateToken, upload.single('backupFile'), async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    try {
        const { password } = req.body;
        const file = req.file;

        if (!file || !password) return res.status(400).json({ error: 'File and password required' });

        // 1. Read Uploaded File
        const input = fs.readFileSync(file.path);
        fs.unlinkSync(file.path);

        if (input.length < 44) return res.status(400).json({ error: 'Invalid file format' });

        // 2. Parse Components
        const salt = input.slice(0, 16);
        const iv = input.slice(16, 28);
        const tag = input.slice(28, 44);
        const encryptedData = input.slice(44);

        // 3. Derive Key
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');

        // 4. Decrypt
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);

        let decrypted;
        try {
            decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
        } catch (authErr) {
            return res.status(401).json({ error: 'Decryption failed: Incorrect Password or Corrupted File' });
        }

        // 5. Detect payload format
        const header = decrypted.slice(0, 16).toString();
        const isSqlite = header.startsWith('SQLite format 3');
        const dialect = sequelize.getDialect();

        if (isSqlite) {
            if (dialect === 'sqlite') {
                fs.writeFileSync(DB_PATH, decrypted);
            } else {
                return res.status(400).json({
                    error: `Uploaded file is a legacy SQLite binary, but the server is running PostgreSQL (${dialect}). Please restore using a PEM_BACKUP_V2 archive or migrate tables.`
                });
            }
        } else {
            // Attempt to parse JSON payload
            let dump;
            try {
                dump = JSON.parse(decrypted.toString('utf8'));
            } catch (parseErr) {
                return res.status(400).json({ error: 'Invalid backup file payload: unrecognized format' });
            }

            if (!dump || dump.type !== 'PEM_BACKUP_V2' || !dump.tables) {
                return res.status(400).json({ error: 'Invalid backup signature or missing tables' });
            }

            // Restore tables in transaction
            const t = await sequelize.transaction();
            try {
                for (const [modelName, rows] of Object.entries(dump.tables)) {
                    if (dbModels[modelName] && Array.isArray(rows) && rows.length > 0) {
                        for (const row of rows) {
                            await dbModels[modelName].upsert(row, { transaction: t });
                        }
                    }
                }
                await t.commit();
            } catch (restoreTxErr) {
                await t.rollback();
                console.error('Restore transaction failed:', restoreTxErr);
                return res.status(500).json({ error: 'Database restore failed: ' + restoreTxErr.message });
            }
        }

        res.json({ message: 'Restore Successful. Database updated successfully.' });

    } catch (err) {
        console.error("Restore Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- API DISCOVERY ---

router.get('/endpoints', authenticateToken, (req, res) => {
    // Static list generated from scan (Dynamic discovery is fragile on some environments)
    const endpoints = [
        { method: 'POST', path: '/api/auth/login', group: 'auth' },
        { method: 'POST', path: '/api/auth/signup', group: 'auth' },
        { method: 'GET', path: '/api/auth/me', group: 'auth' },
        { method: 'GET', path: '/api/admin/users', group: 'admin' },
        { method: 'GET', path: '/api/admin/logs', group: 'admin' },
        { method: 'GET', path: '/api/data/dashboard/:userId', group: 'data' },
        { method: 'POST', path: '/api/transactions/manual', group: 'transactions' },
        { method: 'GET', path: '/api/transactions/user/:userId', group: 'transactions' },
        { method: 'GET', path: '/api/bills/user/:userId', group: 'bills' },
        { method: 'GET', path: '/api/loans/user/:userId', group: 'loans' },
        { method: 'GET', path: '/api/credit-cards', group: 'credit-cards' },
        { method: 'GET', path: '/api/credit-cards/:id/transactions', group: 'credit-cards' },
        { method: 'POST', path: '/api/credit-cards/generate-bills', group: 'credit-cards' },
        { method: 'GET', path: '/api/investments', group: 'investments' },
        { method: 'GET', path: '/api/investments/dashboard/stats', group: 'investments' },
        { method: 'GET', path: '/api/investments/market/search', group: 'investments' },
        { method: 'GET', path: '/api/friends', group: 'friends' },
        { method: 'GET', path: '/api/messages/conversations', group: 'messages' },
        { method: 'GET', path: '/api/groups', group: 'groups' },
        { method: 'POST', path: '/api/sms/webhook', group: 'sms' },
        { method: 'GET', path: '/api/server/stats', group: 'server' },
        { method: 'POST', path: '/api/server/restart/backend', group: 'server' },
        { method: 'POST', path: '/api/server/restart/python', group: 'server' }
    ];

    res.json(endpoints);
});

// --- SYSTEM LOGS ENDPOINT ---
router.get('/admin/logs', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    try {
        if (global.logBuffer && global.logBuffer.length > 0) { return res.json({ logs: global.logBuffer }); } const logPath = path.join(__dirname, '../../server.log');

        if (!fs.existsSync(logPath)) {
            return res.json({ logs: ['[INFO] No log file found. Server may be running without file logging.'] });
        }

        // Read last 500 lines of log file
        const logContent = fs.readFileSync(logPath, 'utf-8');
        const lines = logContent.split('\n').filter(line => line.trim().length > 0);
        const recentLogs = lines.slice(-500); // Last 500 lines

        res.json({ logs: recentLogs });
    } catch (err) {
        console.error('Error reading logs:', err);
        res.status(500).json({ error: err.message, logs: [] });
    }
});

// --- SERVICE CONTROL ENDPOINTS ---

// Restart Backend Server
router.post('/restart/backend', authenticateToken, (req, res) => {
    // Only Admin
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    console.log(`[ADMIN] Backend restart requested by ${req.user.username} `);
    res.json({ message: 'Backend restarting in 1 second...' });

    setTimeout(() => {
        process.exit(0); // Exit code 0 so process managers can restart it
    }, 1000);
});

// Restart Python Service
router.post('/restart/python', authenticateToken, async (req, res) => {
    // Only Admin
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    console.log('Restarting Python Service...');

    // Helper to spawn process
    const spawnPython = () => {
        const { spawn } = require('child_process');

        // CORRECTION: 'server/routes/personal_expense' -> '../../..' -> root
        const scriptPath = path.join(__dirname, '../../../python-extraction-service/app.py');
        console.log('Spawning Python script at:', scriptPath);

        // Create log stream
        const logStream = fs.createWriteStream(path.join(__dirname, '../../../python-extraction-service/python_stdout.log'), { flags: 'a' });

        const venvWin = path.join(__dirname, '../../../python-extraction-service/venv_win/Scripts/python.exe');
        const venvLinux = path.join(__dirname, '../../../python-extraction-service/venv/bin/python');
        const pythonCmd = fs.existsSync(venvWin) ? venvWin : (fs.existsSync(venvLinux) ? venvLinux : 'python');

        const pythonProcess = spawn(pythonCmd, [scriptPath], {
            cwd: path.dirname(scriptPath),
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'] // Pipe stdout/stderr
        });

        pythonProcess.stdout.on('data', (data) => {
            console.log(`[PYTHON] ${data}`);
            logStream.write(`[STDOUT] ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[PYTHON ERR] ${data}`);
            logStream.write(`[STDERR] ${data}`);
        });

        pythonProcess.on('error', (err) => {
            console.error('Failed to start python process:', err);
            logStream.write(`[SPAWN ERROR] ${err.message}\n`);
        });

        pythonProcess.unref();
    };

    try {
        // 1. Try Graceful HTTP Restart
        const apiKey = process.env.PYTHON_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'PYTHON_API_KEY is not configured.' });
        }
        await axios.post(`${PYTHON_SERVICE_URL}/restart`, {}, {
            headers: { 'x-api-key': apiKey },
            timeout: 3000
        });
        res.json({ message: 'Python service restart triggered via API' });
    } catch (error) {
        console.warn('Python API unreachable, attempting manual process spawn...', error.message);

        try {
            // 2. Fallback: Spawn new process
            // Note: This might create duplicates if the port is hogged by a zombie process.
            // Ideally we kill port 5002 first, but on Windows 'npx kill-port 5002' or similar is needed.
            // For now, we assume it's dead or will die.

            // Attempt to kill ANY process on 5002 first (Windows/Linux compat)
            try {
                const { execSync } = require('child_process');
                if (os.platform() === 'win32') {
                    // Windows: Find PID and Taskkill
                    try {
                        const output = execSync('netstat -ano | findstr :5002').toString();
                        const pid = output.trim().split(/\s+/).pop();
                        if (pid && parseInt(pid) > 0) execSync(`taskkill /PID ${pid} /F`);
                    } catch (e) { }
                } else {
                    execSync('fuser -k 5002/tcp || true');
                }
            } catch (e) {
                console.log('No process found on 5002 or kill failed, proceeding to spawn.');
            }

            spawnPython();
            res.json({ message: 'Python service process respawned manually' });

        } catch (spawnError) {
            console.error('Manual spawn failed:', spawnError);
            res.status(500).json({ error: 'Failed to restart Python service: ' + spawnError.message });
        }
    }
});

// Proxy Health Check for Python Service
router.get('/health/python', async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_SERVICE_URL}/health`, { timeout: 2000 });
        res.json(response.data);
    } catch (error) {
        res.status(503).json({ status: 'offline', error: error.message });
    }
});

// --- SYSTEM MAINTENANCE & OPERATIONS ENDPOINTS ---

// Re-Seed System Categories (Income & Expense)
router.post('/maintenance/seed-categories', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const defaultCategories = [
            { name: 'Food', type: 'expense', color: '#f59e0b' },
            { name: 'Travel', type: 'expense', color: '#3b82f6' },
            { name: 'Shopping', type: 'expense', color: '#ec4899' },
            { name: 'Medical', type: 'expense', color: '#ef4444' },
            { name: 'Utility', type: 'expense', color: '#eab308' },
            { name: 'Entertainment', type: 'expense', color: '#8b5cf6' },
            { name: 'General', type: 'expense', color: '#64748b' },
            { name: 'Salary', type: 'income', color: '#10b981' },
            { name: 'Freelance', type: 'income', color: '#06b6d4' },
            { name: 'Investment', type: 'income', color: '#84cc16' },
            { name: 'Business', type: 'income', color: '#6366f1' },
            { name: 'Gift', type: 'income', color: '#d946ef' },
            { name: 'Other', type: 'income', color: '#94a3b8' }
        ];

        let createdCount = 0;
        for (const cat of defaultCategories) {
            const [instance, created] = await Category.findOrCreate({
                where: { name: cat.name, type: cat.type },
                defaults: cat
            });
            if (created) createdCount++;
        }

        const allCategories = await Category.findAll();
        res.json({
            success: true,
            message: `Categories verified. ${createdCount} new categories seeded. Total categories: ${allCategories.length}`,
            createdCount,
            totalCategories: allCategories.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rotate & Prune Server Logs
router.post('/maintenance/prune-logs', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const logCandidates = [
            path.join(__dirname, '../../server.log'),
            path.join(__dirname, '../../combined.log'),
            path.join(__dirname, '../../error.log'),
            path.join(__dirname, '../../../python-extraction-service/python_stdout.log')
        ];

        const pruned = [];
        let totalFreed = 0;

        logCandidates.forEach((filePath) => {
            if (fs.existsSync(filePath)) {
                try {
                    const stats = fs.statSync(filePath);
                    const size = stats.size;
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const lines = content.split('\n');
                    const retained = lines.slice(-200).join('\n');
                    fs.writeFileSync(filePath, retained, 'utf-8');
                    const newSize = fs.statSync(filePath).size;
                    const freed = size - newSize;
                    totalFreed += Math.max(0, freed);
                    pruned.push({ file: path.basename(filePath), originalSize: size, newSize, freed: Math.max(0, freed) });
                } catch (fErr) {
                    console.warn('Log prune error for', filePath, fErr.message);
                }
            }
        });

        res.json({
            success: true,
            message: `Pruning completed. Reclaimed ${(totalFreed / 1024).toFixed(1)} KB of disk space.`,
            freedBytes: totalFreed,
            pruned
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// System Environment Metadata
router.get('/maintenance/system-info', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    res.json({
        nodeEnv: process.env.NODE_ENV || 'development',
        dbHost: process.env.DB_HOST || 'localhost',
        dbPort: process.env.DB_PORT || 5432,
        pythonUrl: PYTHON_SERVICE_URL,
        platform: os.platform(),
        hostname: os.hostname(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptimeSeconds: os.uptime(),
        memoryUsageMb: (process.memoryUsage().rss / (1024 * 1024)).toFixed(1),
        pid: process.pid
    });
});

module.exports = router;

