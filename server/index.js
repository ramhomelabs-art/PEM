

require('dotenv').config();
// Initialize log capture FIRST to catch all console output
require('./utils/logCapture');
console.log('🚀 [STARTUP] index.js is being loaded...');
const express = require('express'); // Server Restart Triggered - News Route Added
const cors = require('cors');
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const util = require('util');

const app = express();
const helmet = require('helmet');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const PORT = process.env.PORT || 5000;
const { authenticateToken } = require('./middleware/auth');


// GLOBAL ERROR HANDLERS
process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
    const fs = require('fs');
    fs.appendFileSync('emi-CRITICAL.log', `\n[${new Date().toISOString()}] UNCAUGHT: ${error.stack}\n`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
    const fs = require('fs');
    fs.appendFileSync('emi-CRITICAL.log', `\n[${new Date().toISOString()}] REJECTION: ${reason}\n`);
});


// --- PRODUCTION SECURITY HARDENING ---
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5174';
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            frameAncestors: ["'self'", CLIENT_URL, "http://localhost:5173", "http://localhost:5174", "https://finance.ramhomelab.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "*"],
        }
    }
})); // Basic security headers with relaxed CSP for PDF Viewing
app.use(hpp());    // HTTP Parameter Pollution protection

// Rate Limiting (Applied globally, stricter on auth/sms)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.API_RATE_LIMIT ? parseInt(process.env.API_RATE_LIMIT, 10) : 10000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip general rate-limiting for local loopback (dev / self-hosted single tenant)
        const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '';
        return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
    },
    message: { error: "Too many requests, please try again later." }
});

const smsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300, // 300 SMS per minute
    message: { error: "API limit reached. Slow down." }
});


// Trust Cloudflare/Nginx Proxy
app.set('trust proxy', 1);

// --- LOGGING SYSTEM WITH ROTATION (Max 10MB) ---
const LOG_FILE_PATH = path.join(__dirname, 'server.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB cap
let logFile = fs.createWriteStream(LOG_FILE_PATH, { flags: 'a' });
const logStdout = process.stdout;
const logStderr = process.stderr;

function checkLogRotation() {
    try {
        if (fs.existsSync(LOG_FILE_PATH)) {
            const stats = fs.statSync(LOG_FILE_PATH);
            if (stats.size > MAX_LOG_SIZE) {
                logFile.end();
                const backupPath = path.join(__dirname, 'server.log.old');
                if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
                fs.renameSync(LOG_FILE_PATH, backupPath);
                logFile = fs.createWriteStream(LOG_FILE_PATH, { flags: 'a' });
            }
        }
    } catch {
        // Non-fatal
    }
}
setInterval(checkLogRotation, 300000); // Every 5 minutes

console.log = function (...args) {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
    const msg = `[${timestamp}] [INFO] ${args.map(a => util.format(a)).join(' ')}\n`;
    logFile.write(msg);
    logStdout.write(msg);
};
console.error = function (...args) {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
    const msg = `[${timestamp}] [ERROR] ${args.map(a => util.format(a)).join(' ')}\n`;
    logFile.write(msg);
    logStderr.write(msg);
};


// Middleware
const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:5174')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

// Permit localhost + private LAN / Tailscale origins (self-hosted app) without
// reflecting arbitrary public origins with credentials.
const isPrivateLanOrigin = (origin) => {
    try {
        const { hostname } = new URL(origin);
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
        if (/^10\./.test(hostname)) return true;
        if (/^192\.168\./.test(hostname)) return true;
        if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
        if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname)) return true; // CGNAT / Tailscale
        if (/\.ts\.net$/.test(hostname)) return true; // Tailscale MagicDNS
        return false;
    } catch {
        return false;
    }
};

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (configuredOrigins.includes(origin) || isPrivateLanOrigin(origin)) {
            return callback(null, true);
        }
        console.warn(`[CORS] Blocked origin: ${origin}`);
        return callback(null, false);
    },
    credentials: true
};
app.use(cors(corsOptions));

// Container & Monitor Health Check (Unthrottled)
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api', apiLimiter); // Apply general rate limit to all API routes
app.use('/api/sms', smsLimiter); // Apply stricter limit to SMS webhook


// Capture Raw Body for Webhook Signature Verification
app.use((req, res, next) => {
    // Special handling for SMS Webhook which can be Raw (Encrypted) or JSON (Heartbeat)
    if (req.originalUrl.includes('/api/sms') && (!req.headers['content-type'] || !req.headers['content-type'].includes('application/json'))) {
        // Skip JSON parsing for raw encrypted strings
        next();
    } else {
        express.json({
            verify: (req, res, buf) => {
                req.rawBody = buf;
            }
        })(req, res, next);
    }
});

// Redact secrets from logged URLs: query-string params AND path segments that
// carry credentials (e.g. /api/sms/webhook/<apiKey>).
const redactUrl = (url) => {
    let out = url || '';
    // Query params: apiKey/password/token/secret/key
    out = out.replace(/([?&](?:apiKey|apikey|password|pass|token|secret|key)=)[^&]*/gi, '$1[REDACTED]');
    // Path fragment right after the SMS webhook base: /webhook/<key>
    out = out.replace(/(\/webhook\/)[^\/?\s]+/gi, '$1[REDACTED]');
    return out;
};
app.use(express.urlencoded({
    extended: true,
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
// Capture text/plain for raw encrypted strings
app.use(express.text({
    type: ['text/plain', 'text/html'],
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));



// DEBUG LOGGING
app.use((req, res, next) => {
    console.log(`[DEBUG] INCOMING: ${req.method} ${redactUrl(req.originalUrl)}`);
    next();
});

// Database Setup
const { sequelize } = require('./models');

// Test DB Connection & Auto-Seed
const initializeDatabase = async () => {
    console.log('Database connected...');

    // Safe Migration Helper
    const safeRun = async (query) => {
        try {
            await sequelize.query(query);
        } catch (e) {
            console.log(`[Migration] Skipped (likely already exists): ${e.message}`);
        }
    };

    // Run Migrations (Safe for both Dev & Prod)
    try {
        if (process.env.DB_DIALECT !== 'postgres') {
            // Users Table Migrations
            await safeRun("ALTER TABLE Users ADD COLUMN dob DATE;");
            await safeRun("ALTER TABLE Users ADD COLUMN smsApiKey TEXT;");
            await safeRun("ALTER TABLE Users ADD COLUMN lastDeviceSync DATETIME;");
            await safeRun("ALTER TABLE Users ADD COLUMN isDeviceApproved BOOLEAN DEFAULT 0;");
            await safeRun("ALTER TABLE Users ADD COLUMN deviceInfo TEXT;");
            await safeRun("ALTER TABLE Users ADD COLUMN lastHeartbeat DATETIME;");
            await safeRun("ALTER TABLE Users ADD COLUMN encryptionKey TEXT;");
            await safeRun("ALTER TABLE Users ADD COLUMN failedLoginAttempts INTEGER DEFAULT 0;");
            await safeRun("ALTER TABLE Users ADD COLUMN lockoutUntil DATETIME;");
            await safeRun("ALTER TABLE users ADD COLUMN recoveryMethod VARCHAR(10) DEFAULT 'email';");
            await safeRun("ALTER TABLE recovery_tokens MODIFY purpose ENUM('password_reset','username_recovery','recovery_check') NOT NULL DEFAULT 'password_reset';");

            // Bills Table Migrations
            await safeRun("ALTER TABLE bills ADD COLUMN status ENUM('generated', 'unpaid', 'paid', 'overdue') DEFAULT 'unpaid';");
            await safeRun("ALTER TABLE bills ADD COLUMN provider VARCHAR(255);");
            await safeRun("ALTER TABLE bills ADD COLUMN identifiers JSON;");
            await safeRun("ALTER TABLE bills ADD COLUMN frequency ENUM('monthly', 'yearly', 'quarterly') DEFAULT 'monthly';");

            // Loans Table Migrations
            await safeRun("ALTER TABLE loans ADD COLUMN processingFee FLOAT DEFAULT 0;");
            await safeRun("ALTER TABLE loans ADD COLUMN interestRate FLOAT;");
            await safeRun("ALTER TABLE loans ADD COLUMN tenureMonths INTEGER;");
            await safeRun("ALTER TABLE loans ADD COLUMN nextEmiDate DATE;");
            await safeRun("ALTER TABLE loans ADD COLUMN status ENUM('active', 'closed') DEFAULT 'active';");
            await safeRun("ALTER TABLE loans ADD COLUMN bankProvider VARCHAR(255);");

            await safeRun("ALTER TABLE loans ADD COLUMN emiDay INTEGER DEFAULT 1;");
            await safeRun("ALTER TABLE loans ADD COLUMN lastPaymentDate DATE;");
            await safeRun("ALTER TABLE loans ADD COLUMN interestType VARCHAR(50) DEFAULT 'Reducing Balance';");
            await safeRun("ALTER TABLE loans ADD COLUMN terms TEXT;");

            // Credit Cards Table Migrations (APR / interest-free / rewards)
            await safeRun("ALTER TABLE credit_cards ADD COLUMN rewardRate INTEGER NOT NULL DEFAULT 1;");
            await safeRun("ALTER TABLE credit_cards ADD COLUMN apr DECIMAL(5,2) NOT NULL DEFAULT 42.00;");
            await safeRun("ALTER TABLE credit_cards ADD COLUMN interestFreeDays INTEGER NOT NULL DEFAULT 45;");
            await safeRun("ALTER TABLE goals ADD COLUMN color VARCHAR(50) DEFAULT '#3b82f6';");
            await safeRun("ALTER TABLE goals ADD COLUMN icon VARCHAR(50) DEFAULT 'Target';");

            // Banks Table Migrations (passbook-scan details)
            await safeRun("ALTER TABLE banks ADD COLUMN accountHolderName VARCHAR(255);");
            await safeRun("ALTER TABLE banks ADD COLUMN micrCode VARCHAR(255);");
        } else {
            // PostgreSQL: uses IF NOT EXISTS so the migration is idempotent.
            await safeRun('ALTER TABLE users ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER DEFAULT 0;');
            await safeRun('ALTER TABLE users ADD COLUMN IF NOT EXISTS "lockoutUntil" TIMESTAMP WITH TIME ZONE;');
            await safeRun(`DO $$ BEGIN CREATE TYPE "enum_users_recoveryMethod" AS ENUM('email', 'mfa'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
            await safeRun(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "recoveryMethod" "enum_users_recoveryMethod" NOT NULL DEFAULT 'email';`);
            // Profile "test recovery" flow uses a dedicated token purpose.
            await safeRun(`ALTER TYPE "enum_recovery_tokens_purpose" ADD VALUE IF NOT EXISTS 'recovery_check';`);
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "emiDay" INTEGER DEFAULT 1;');
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "lastPaymentDate" DATE;');
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "interestType" VARCHAR(50) DEFAULT \'Reducing Balance\';');
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "terms" TEXT;');
            await safeRun('ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS "rewardRate" INTEGER NOT NULL DEFAULT 1;');
            await safeRun('ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS apr DECIMAL(5,2) NOT NULL DEFAULT 42.00;');
            await safeRun('ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS "interestFreeDays" INTEGER NOT NULL DEFAULT 45;');
            await safeRun('ALTER TABLE goals ADD COLUMN IF NOT EXISTS "color" VARCHAR(50) DEFAULT \'#3b82f6\';');
            await safeRun('ALTER TABLE goals ADD COLUMN IF NOT EXISTS "icon" VARCHAR(50) DEFAULT \'Target\';');
            // Banks Table Migrations (passbook-scan details)
            await safeRun('ALTER TABLE banks ADD COLUMN IF NOT EXISTS "accountHolderName" VARCHAR(255);');
            await safeRun('ALTER TABLE banks ADD COLUMN IF NOT EXISTS "micrCode" VARCHAR(255);');
            await safeRun('UPDATE legacy_investments SET "goalId" = NULL WHERE "goalId" IS NOT NULL AND "goalId" NOT IN (SELECT id FROM goals);');
            await safeRun('ALTER TABLE legacy_investments DROP CONSTRAINT IF EXISTS "investments_goalId_fkey";');
            await safeRun('ALTER TABLE legacy_investments DROP CONSTRAINT IF EXISTS "investments_goalid_fkey";');
            await safeRun('ALTER TABLE legacy_investments ADD CONSTRAINT "investments_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES goals(id) ON UPDATE CASCADE ON DELETE SET NULL;');

            // Cards: allow standalone cards (bankId nullable), preserve bankName, enforce FKs
            await safeRun('ALTER TABLE cards ALTER COLUMN "bankId" DROP NOT NULL;');
            await safeRun('ALTER TABLE cards ADD COLUMN IF NOT EXISTS "bankName" VARCHAR(255);');
            await safeRun('UPDATE cards SET "bankId" = NULL WHERE "bankId" IS NOT NULL AND "bankId" NOT IN (SELECT id FROM banks);');
            await safeRun('ALTER TABLE cards DROP CONSTRAINT IF EXISTS "cards_bankId_fkey";');
            await safeRun('ALTER TABLE cards ADD CONSTRAINT "cards_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES banks(id) ON UPDATE CASCADE ON DELETE SET NULL;');
            await safeRun('ALTER TABLE cards DROP CONSTRAINT IF EXISTS "cards_userId_fkey";');
            await safeRun('ALTER TABLE cards ADD CONSTRAINT "cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;');

            // Bills Table Migrations
            await safeRun('ALTER TABLE bills ADD COLUMN IF NOT EXISTS "provider" VARCHAR(255);');
            await safeRun('ALTER TABLE bills ADD COLUMN IF NOT EXISTS "identifiers" JSONB;');

            // Loans Table Migrations
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "processingFee" FLOAT DEFAULT 0;');
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "interestRate" FLOAT;');
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "tenureMonths" INTEGER;');
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "nextEmiDate" DATE;');
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "bankProvider" VARCHAR(255);');
        }
    } catch (err) {
        console.error('Migration Error (Non-fatal):', err.message);
    }

    // Auto-Sync and Seed Admin & Categories
    const { User, Category } = require('./models');
    try {
        await sequelize.sync(); // Sync without alter to avoid key limit errors
        console.log(`Database & tables synced (${process.env.NODE_ENV || 'development'} mode).`);

        // Seed Admin ONLY if explicit ADMIN_PASSWORD is provided in environment
        const adminKey = require('crypto').randomBytes(16).toString('hex');
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        const providedPassword = process.env.ADMIN_PASSWORD;
        const bootstrapFile = path.join(__dirname, 'data', 'admin-bootstrap-password.txt');
        const { isSetupCompleted, markSetupCompleted } = require('./utils/settings');

        if (providedPassword && providedPassword.trim() !== '') {
            const existingAdmin = await User.findOne({ where: { email: adminEmail } });
            if (!existingAdmin) {
                const bcrypt = require('bcryptjs');
                const hashedPassword = await bcrypt.hash(providedPassword.trim(), 10);
                await User.create({
                    email: adminEmail,
                    username: process.env.ADMIN_USERNAME || 'admin',
                    fullName: 'Server Administrator',
                    password: hashedPassword,
                    role: 'admin',
                    status: 'active',
                    mfaExempt: true,
                    country: 'India',
                    currency: 'INR',
                    timezone: 'IST (UTC+5:30)',
                    mobile: '+91 98765 43210',
                    dob: '1995-12-23',
                    smsApiKey: adminKey
                });
                markSetupCompleted(true);
                console.log(`Admin account auto-seeded with provided ADMIN_PASSWORD: ${adminEmail}`);
            } else {
                markSetupCompleted(true);
                if (!existingAdmin.smsApiKey) {
                    await existingAdmin.update({ smsApiKey: adminKey });
                }
                console.log(`Admin account already exists: ${adminEmail}`);
            }
        } else {
            // No ADMIN_PASSWORD provided: server operates in Setup Wizard mode
            // Prune any legacy bootstrap dummy admin that was auto-created with unknown temp password
            if (fs.existsSync(bootstrapFile)) {
                try {
                    await User.destroy({ where: { email: adminEmail } });
                    fs.unlinkSync(bootstrapFile);
                    console.log(`[Setup] Cleaned up temporary bootstrap admin (${adminEmail}) to allow Setup Wizard at /setup.`);
                } catch (bErr) {
                    console.warn('[Setup] Could not prune bootstrap admin:', bErr.message);
                }
            } else {
                console.log('[Setup] No ADMIN_PASSWORD provided. Initial Setup Wizard active at /setup.');
            }
        }

        // Seed Default Categories (Required in all environments for dropdowns & budgeting)
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

        for (const cat of defaultCategories) {
            await Category.findOrCreate({
                where: { name: cat.name, type: cat.type },
                defaults: cat
            });
        }
        console.log('Default categories verified/seeded.');

    } catch (seedErr) {
        console.error('Database Sync / Seeding Error: ' + seedErr.message);
    }
};


const connectWithRetry = async (retries = 10, delay = 3000) => {
    try {
        await sequelize.authenticate();
        await initializeDatabase();
    } catch (err) {
        if (retries === 0) {
            console.error('CRITICAL: DB Connection Failed after multiple retries:', err);
            process.exit(1);
        } else {
            console.log(`[DB] Connection Failed. Retrying in ${delay / 1000}s... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return connectWithRetry(retries - 1, delay);
        }
    }
};

// Wrap everything in async IIFE to ensure proper startup sequence
(async () => {
    try {
        // Wait for database connection
        await connectWithRetry();

        console.log('🔍 [DEBUG] After DB connection setup, about to load routes...');

        // Routes - Declare variables first
        let authRoutes, adminRoutes, apiRoutes, userRoutes, transactionRoutes, billRoutes;
        let loanRoutes, borrowRoutes, bankRoutes, cardRoutes, budgetRoutes;
        let serverRoutes, statementRoutes, smsRoutes, documentsRoutes, creditCardRoutes, metalsRoutes, newsRoutes, marketRoutes;
        let friendsRoutes, messagesRoutes, shareRoutes, groupsRoutes, mfaRoutes, mfaAdminRoutes;
        let notificationsRoutes;
        let reconciliationRoutes;
        let anomaliesRoutes;
        let subscriptionsRoutes;
        let pricesRoutes;
        let casRoutes;
        let invAssetsRoutes, invTxnsRoutes, invSipsRoutes, invGoalsRoutes, invDashRoutes, invTaxRoutes, investmentsRoutes;

        console.log('Loading routes...');
        // Safe Route Loader Helper
        const safeLoad = (name, path) => {
            try {
                console.log(`[STARTUP] Loading ${name} routes...`);
                const route = require(path);
                console.log(`✓ ${name} routes loaded`);
                return route;
            } catch (err) {
                console.error(`❌ FAILED TO LOAD ${name} ROUTES:`, err.message);
                return null;
            }
        };

        authRoutes = safeLoad('Auth', './routes/personal_expense/auth');
        adminRoutes = safeLoad('Admin', './routes/personal_expense/admin');
        apiRoutes = safeLoad('API', './routes/personal_expense/api');
        userRoutes = safeLoad('User', './routes/personal_expense/user');
        transactionRoutes = safeLoad('Transaction', './routes/personal_expense/transactions');
        billRoutes = safeLoad('Bill', './routes/personal_expense/bills');
        loanRoutes = safeLoad('Loan', './routes/personal_expense/loan');
        borrowRoutes = safeLoad('Borrow', './routes/personal_expense/borrow');
        bankRoutes = safeLoad('Bank', './routes/personal_expense/banks');
        cardRoutes = safeLoad('Card', './routes/personal_expense/cards');
        budgetRoutes = safeLoad('Budget', './routes/personal_expense/budgets');

        // Server Mgr Special Handling
        try {
            serverRoutes = require('./routes/personal_expense/server_mgr');
            console.log('✓ Server Manager routes loaded');
        } catch (err) {
            console.error('❌ SERVER MGR LOAD FAILED:', err.message);
        }

        statementRoutes = safeLoad('Statement', './routes/personal_expense/statements');
        smsRoutes = safeLoad('SMS', './routes/personal_expense/sms');
        documentsRoutes = safeLoad('Documents', './routes/personal_expense/documents');
        creditCardRoutes = safeLoad('Credit Card', './routes/credit_card');
        metalsRoutes = safeLoad('Metals', './routes/personal_expense/metals');
        newsRoutes = safeLoad('News', './routes/personal_expense/news');
        marketRoutes = safeLoad('Market', './routes/personal_expense/market');
        friendsRoutes = safeLoad('Friends', './routes/personal_expense/friends');
        messagesRoutes = safeLoad('Messages', './routes/personal_expense/messages');
        shareRoutes = safeLoad('Share', './routes/personal_expense/share');
        groupsRoutes = safeLoad('Groups', './routes/personal_expense/groups');
        mfaRoutes = safeLoad('MFA', './routes/mfa');
        mfaAdminRoutes = safeLoad('MFA Admin', './routes/admin/mfaAdmin');
        notificationsRoutes = safeLoad('Notifications', './routes/personal_expense/notifications');
        reconciliationRoutes = safeLoad('Reconciliation', './routes/personal_expense/reconciliation');
        anomaliesRoutes = safeLoad('Anomalies', './routes/personal_expense/anomalies');
        subscriptionsRoutes = safeLoad('Subscriptions', './routes/personal_expense/subscriptions');
        pricesRoutes = safeLoad('Investing Prices', './routes/investing/prices');
        casRoutes = safeLoad('Investing CAS', './routes/investing/cas');
        invAssetsRoutes = safeLoad('Investing Assets', './routes/investing/assets');
        invTxnsRoutes = safeLoad('Investing Txns', './routes/investing/txns');
        invSipsRoutes = safeLoad('Investing SIPs', './routes/investing/sips');
        invGoalsRoutes = safeLoad('Investing Goals', './routes/investing/goals');
        invDashRoutes = safeLoad('Investing Dash', './routes/investing/dashboard');
        invTaxRoutes = safeLoad('Investing Tax', './routes/investing/tax');
        investmentsRoutes = safeLoad('Investments', './routes/investment');



        // --- SECURE DOCUMENT STREAMING & ACCESS CONTROL ---
        // Confidential documents (PAN, Aadhaar, Bank Statements) require authentication & ownership check.
        app.get('/uploads/documents/:filename', authenticateToken, async (req, res) => {
            try {
                const rawFilename = req.params.filename;
                const safeFilename = path.basename(rawFilename);
                const targetFilePath = `uploads/documents/${safeFilename}`;

                const { Document } = require('./models');
                const document = await Document.findOne({
                    where: { filePath: targetFilePath }
                });

                const diskPath = path.join(__dirname, 'uploads', 'documents', safeFilename);
                if (!fs.existsSync(diskPath)) {
                    return res.status(404).json({ error: 'Document file not found' });
                }

                if (document) {
                    if (req.user.role !== 'admin' && Number(document.userId) !== Number(req.user.id)) {
                        return res.status(403).json({ error: 'Unauthorized access to document' });
                    }
                } else if (req.user.role !== 'admin') {
                    return res.status(403).json({ error: 'Unauthorized access to document' });
                }

                res.set('Cross-Origin-Resource-Policy', 'cross-origin');
                res.set('Access-Control-Allow-Origin', '*');
                if (req.query.download === '1') {
                    return res.download(diskPath, document?.documentName || safeFilename);
                }
                return res.sendFile(diskPath);
            } catch (err) {
                console.error('[Document Secure Serve] Error:', err);
                return res.status(500).json({ error: 'Failed to retrieve document' });
            }
        });

        // Explicitly block unauthenticated access to any file inside /uploads/documents
        app.use('/uploads/documents', (req, res) => {
            return res.status(401).json({ error: 'Authentication required for document access' });
        });

        // Serve uploaded photos/assets with CORS headers
        app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
            setHeaders: (res, path, stat) => {
                res.set('Cross-Origin-Resource-Policy', 'cross-origin');
                res.set('Access-Control-Allow-Origin', '*');
                res.set('Access-Control-Allow-Methods', 'GET');
            }
        }));

        // Serve public assets (e.g. companion APK)
        app.use('/public', express.static(path.join(__dirname, 'public'), {
            setHeaders: (res, path, stat) => {
                res.set('Cross-Origin-Resource-Policy', 'cross-origin');
                res.set('Access-Control-Allow-Origin', '*');
                res.set('Access-Control-Allow-Methods', 'GET');
            }
        }));

        // Ensure bundled APK is synced to persistent uploads volume
        try {
            const pubApk = path.join(__dirname, 'public', 'pem-companion.apk');
            const uplApk = path.join(__dirname, 'uploads', 'pem-companion.apk');
            if (fs.existsSync(pubApk) && !fs.existsSync(uplApk)) {
                fs.mkdirSync(path.dirname(uplApk), { recursive: true });
                fs.copyFileSync(pubApk, uplApk);
                console.log('✓ Synced pem-companion.apk from public to uploads volume.');
            }
        } catch (apkSyncErr) {
            console.warn('[APK Sync] Warning:', apkSyncErr.message);
        }

        // Graceful fallback for missing profile photos/uploads to prevent browser 404 errors
        app.use('/uploads', (req, res) => {
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="64" r="64" fill="#1e293b"/><circle cx="64" cy="50" r="24" fill="#64748b"/><ellipse cx="64" cy="100" rx="36" ry="24" fill="#64748b"/></svg>');
        });

        // Mount Routes Conditionally
        if (mfaAdminRoutes) app.use('/api/admin/mfa', mfaAdminRoutes);
        if (adminRoutes) app.use('/api/admin', adminRoutes);
        if (mfaRoutes) app.use('/api/mfa', mfaRoutes);
        if (notificationsRoutes) app.use('/api/notifications', notificationsRoutes);
        if (reconciliationRoutes) app.use('/api/reconciliation', reconciliationRoutes);
        if (anomaliesRoutes) app.use('/api/anomalies', anomaliesRoutes);
        if (subscriptionsRoutes) app.use('/api/subscriptions', subscriptionsRoutes);
        if (authRoutes) app.use('/api/auth', authRoutes);
        if (apiRoutes) app.use('/api/data', authenticateToken, apiRoutes);
        if (userRoutes) app.use('/api/user', userRoutes);
        if (transactionRoutes) app.use('/api/transactions', authenticateToken, transactionRoutes);
        if (billRoutes) app.use('/api/bills', billRoutes);
        if (loanRoutes) app.use('/api/loans', loanRoutes);
        if (borrowRoutes) app.use('/api/borrow', authenticateToken, borrowRoutes);
        if (bankRoutes) app.use('/api/banks', authenticateToken, bankRoutes);
        if (cardRoutes) app.use('/api/cards', cardRoutes);
        if (budgetRoutes) app.use('/api/budgets', authenticateToken, budgetRoutes);
        if (serverRoutes) app.use('/api/server', serverRoutes);
        if (statementRoutes) app.use('/api/statements', authenticateToken, statementRoutes);
        if (documentsRoutes) app.use('/api/documents', authenticateToken, documentsRoutes);
        if (creditCardRoutes) app.use('/api/credit-cards', creditCardRoutes);
        if (metalsRoutes) app.use('/api/metals', authenticateToken, metalsRoutes);
        if (newsRoutes) app.use('/api/news', authenticateToken, newsRoutes);
        if (marketRoutes) app.use('/api/market', authenticateToken, marketRoutes);
        if (friendsRoutes) app.use('/api/friends', authenticateToken, friendsRoutes);
        if (messagesRoutes) app.use('/api/messages', authenticateToken, messagesRoutes);
        if (shareRoutes) app.use('/api/share', authenticateToken, shareRoutes);
        if (groupsRoutes) app.use('/api/groups', authenticateToken, groupsRoutes);
        if (smsRoutes) app.use('/api/sms', smsRoutes);
        if (pricesRoutes) app.use('/api/investing/prices', authenticateToken, pricesRoutes);
        if (casRoutes) app.use('/api/investing/cas', authenticateToken, casRoutes);
        if (invAssetsRoutes) app.use('/api/investing/assets', authenticateToken, invAssetsRoutes);
        if (invTxnsRoutes) app.use('/api/investing/txns', authenticateToken, invTxnsRoutes);
        if (invSipsRoutes) app.use('/api/investing/sips', authenticateToken, invSipsRoutes);
        if (invGoalsRoutes) app.use('/api/investing/goals', authenticateToken, invGoalsRoutes);
        if (investmentsRoutes) app.use('/api/investments', authenticateToken, investmentsRoutes);
        if (invDashRoutes) {
            app.use('/api/investing/dashboard', authenticateToken, invDashRoutes);
        }
        if (invTaxRoutes) app.use('/api/investing/tax', authenticateToken, invTaxRoutes);


        app.get('/api/health', (req, res) => {
            res.status(200).json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
        });

        app.get('/', (req, res) => {
            res.send('Personal Expense Manager API Running');
        });

        // JSON-based 404 safety handler
        app.use((req, res) => {
            res.status(404).json({ error: "Route not found. Ensure the API endpoint is correct." });
        });

        // JSON-based Error safety handler
        app.use((err, req, res, next) => {
            console.error(err.stack);
            const status = err.status || 500;
            const body = { error: status === 500 ? "Internal Server Error" : "Request Error" };
            // Never leak internal error messages/stack details on 5xx responses.
            if (status !== 500 && err.message) body.detail = err.message;
            res.status(status).json(body);
        });

        // Start Server
        console.log('About to start server on port:', PORT);
        app.listen(PORT, () => {
            console.log(`✅ Server started successfully on port ${PORT}`);
            console.log(`🌐 API URL: http://localhost:${PORT}`);
        });

        // Start the investments price sync scheduler (AMFI daily NAV + Yahoo)
        // after the HTTP server is up; never blocks boot.
        try {
            const { startPriceSync } = require('./utils/investing/scheduler');
            startPriceSync(sequelize);
        } catch (err) {
            console.error('[PriceSync] scheduler start failed:', err.message);
        }

        // Start the pending-items email digest scheduler (Automation inbox
        // transactions + pending notifications). Never blocks boot.
        try {
            const { startPendingDigestScheduler } = require('./services/pendingDigestService');
            startPendingDigestScheduler();
        } catch (err) {
            console.error('[PendingDigest] scheduler start failed:', err.message);
        }

        // Ensure Python AI Extraction Service is running
        (async () => {
            const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5002';
            try {
                const axios = require('axios');
                await axios.get(`${pythonUrl}/health`, { timeout: 2000 });
                console.log('[AI Extractor] Python AI Service is active and responding on port 5002.');
            } catch (e) {
                console.log('[AI Extractor] Python AI Service offline. Launching background worker...');
                const { spawn } = require('child_process');
                const rootDir = path.resolve(__dirname, '..');
                const venvWin = path.join(rootDir, 'python-extraction-service/venv_win/Scripts/python.exe');
                const venvLinux = path.join(rootDir, 'python-extraction-service/venv/bin/python');
                const pyCmd = fs.existsSync(venvWin) ? venvWin : (fs.existsSync(venvLinux) ? venvLinux : 'python');
                const scriptPath = path.join(rootDir, 'python-extraction-service/app.py');

                if (fs.existsSync(scriptPath)) {
                    const proc = spawn(pyCmd, [scriptPath], {
                        cwd: path.dirname(scriptPath),
                        detached: true,
                        stdio: 'ignore',
                        env: { ...process.env, PORT: '5002', PYTHON_PORT: '5002' }
                    });
                    proc.unref();
                    console.log(`[AI Extractor] Auto-started Python AI Extraction Service via ${pyCmd} on port 5002`);
                }
            }
        })().catch(err => console.error('[AI Extractor] Auto-supervision error:', err.message));

    } catch (error) {
        console.error('FATAL SERVER STARTUP ERROR:', error);
        process.exit(1);
    }
})();

module.exports = { app, sequelize };

