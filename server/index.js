

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
    max: 1000, // increased limit for dev
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
});

const smsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300, // 300 SMS per minute
    message: { error: "API limit reached. Slow down." }
});


// Trust Cloudflare/Nginx Proxy
app.set('trust proxy', 1);

// --- LOGGING SYSTEM ---
const logFile = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });
const logStdout = process.stdout;
const logStderr = process.stderr;

// In production: log to file only. In dev: log to both console and file
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
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        // if (!origin) return callback(null, true);

        // Permissive Global CORS (User Request: Localhost-style)
        callback(null, true);
    },
    credentials: true
};
app.use(cors(corsOptions));
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
    console.log(`[DEBUG] INCOMING: ${req.method} ${req.originalUrl}`);
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
        } else {
            // PostgreSQL: uses IF NOT EXISTS so the migration is idempotent.
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "emiDay" INTEGER DEFAULT 1;');
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "lastPaymentDate" DATE;');
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "interestType" VARCHAR(50) DEFAULT \'Reducing Balance\';');
            await safeRun('ALTER TABLE loans ADD COLUMN IF NOT EXISTS "terms" TEXT;');
            await safeRun('ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS "rewardRate" INTEGER NOT NULL DEFAULT 1;');
            await safeRun('ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS apr DECIMAL(5,2) NOT NULL DEFAULT 42.00;');
            await safeRun('ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS "interestFreeDays" INTEGER NOT NULL DEFAULT 45;');
            await safeRun('ALTER TABLE goals ADD COLUMN IF NOT EXISTS "color" VARCHAR(50) DEFAULT \'#3b82f6\';');
            await safeRun('ALTER TABLE goals ADD COLUMN IF NOT EXISTS "icon" VARCHAR(50) DEFAULT \'Target\';');
            await safeRun('UPDATE legacy_investments SET "goalId" = NULL WHERE "goalId" IS NOT NULL AND "goalId" NOT IN (SELECT id FROM goals);');
            await safeRun('ALTER TABLE legacy_investments DROP CONSTRAINT IF EXISTS "investments_goalId_fkey";');
            await safeRun('ALTER TABLE legacy_investments DROP CONSTRAINT IF EXISTS "investments_goalid_fkey";');
            await safeRun('ALTER TABLE legacy_investments ADD CONSTRAINT "investments_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES goals(id) ON UPDATE CASCADE ON DELETE SET NULL;');
        }
    } catch (err) {
        console.error('Migration Error (Non-fatal):', err.message);
    }

    // Auto-Sync and Seed Admin & Categories (DEV ONLY)
    if (process.env.NODE_ENV !== 'production') {
        const { User, Category } = require('./models');
        try {
            await sequelize.sync(); // Sync without alter to avoid key limit errors

            // Seed Admin (Updated to single user rampaiyyan@gmail.com)
            const adminKey = require('crypto').randomBytes(16).toString('hex');
            const existingAdmin = await User.findOne({ where: { email: 'rampaiyyan@gmail.com' } });

            if (!existingAdmin) {
                const bcrypt = require('bcryptjs');
                const hashedPassword = await bcrypt.hash('password123', 10);
                await User.create({
                    email: 'rampaiyyan@gmail.com',
                    username: 'admin',
                    fullName: 'Ram Paiyyan',
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
                console.log('Admin account auto-seeded: rampaiyyan@gmail.com');
            } else {
                if (!existingAdmin.smsApiKey) {
                    await existingAdmin.update({ smsApiKey: adminKey });
                    console.log('Admin account updated: Added missing smsApiKey');
                } else {
                    console.log('Admin account already exists: rampaiyyan@gmail.com');
                }
            }

            // Seed Categories
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
            console.log('Categories seeded.');

        } catch (seedErr) {
            console.error('Seeding Error: ' + seedErr);
        }
    } else {
        // Production: Just sync tables without altering or seeding
        await sequelize.sync();
        console.log('Database & tables synced (production mode).');
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
        let pricesRoutes;
        let casRoutes;
        let invAssetsRoutes, invTxnsRoutes, invSipsRoutes, invGoalsRoutes, invDashRoutes, invTaxRoutes, investmentsRoutes;

        console.log('Loading routes...');
        // Safe Route Loader Helper
        const safeLoad = (name, path) => {
            try {
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
        pricesRoutes = safeLoad('Investing Prices', './routes/investing/prices');
        casRoutes = safeLoad('Investing CAS', './routes/investing/cas');
        invAssetsRoutes = safeLoad('Investing Assets', './routes/investing/assets');
        invTxnsRoutes = safeLoad('Investing Txns', './routes/investing/txns');
        invSipsRoutes = safeLoad('Investing SIPs', './routes/investing/sips');
        invGoalsRoutes = safeLoad('Investing Goals', './routes/investing/goals');
        invDashRoutes = safeLoad('Investing Dash', './routes/investing/dashboard');
        invTaxRoutes = safeLoad('Investing Tax', './routes/investing/tax');
        investmentsRoutes = safeLoad('Investments', './routes/investment');



        // Serve uploaded photos with CORS headers
        app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
            setHeaders: (res, path, stat) => {
                res.set('Cross-Origin-Resource-Policy', 'cross-origin');
                res.set('Access-Control-Allow-Origin', '*');
                res.set('Access-Control-Allow-Methods', 'GET');
            }
        }));

        // Mount Routes Conditionally
        if (mfaAdminRoutes) app.use('/api/admin/mfa', mfaAdminRoutes);
        if (adminRoutes) app.use('/api/admin', adminRoutes);
        if (mfaRoutes) app.use('/api/mfa', mfaRoutes);
        if (authRoutes) app.use('/api/auth', authRoutes);
        if (apiRoutes) app.use('/api/data', apiRoutes);
        if (userRoutes) app.use('/api/user', userRoutes);
        if (transactionRoutes) app.use('/api/transactions', transactionRoutes);
        if (billRoutes) app.use('/api/bills', billRoutes);
        if (loanRoutes) app.use('/api/loans', loanRoutes);
        if (borrowRoutes) app.use('/api/borrow', borrowRoutes);
        if (bankRoutes) app.use('/api/banks', bankRoutes);
        if (cardRoutes) app.use('/api/cards', cardRoutes);
        if (budgetRoutes) app.use('/api/budgets', budgetRoutes);
        if (serverRoutes) app.use('/api/server', serverRoutes);
        if (statementRoutes) app.use('/api/statements', statementRoutes);
        if (documentsRoutes) app.use('/api/documents', documentsRoutes);
        if (creditCardRoutes) app.use('/api/credit-cards', creditCardRoutes);
        if (metalsRoutes) app.use('/api/metals', metalsRoutes);
        if (newsRoutes) app.use('/api/news', newsRoutes);
        if (marketRoutes) app.use('/api/market', marketRoutes);
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
        if (investmentsRoutes) app.use('/api/investments', investmentsRoutes);
        if (invDashRoutes) {
            app.use('/api/investing/dashboard', authenticateToken, invDashRoutes);
        }
        if (invTaxRoutes) app.use('/api/investing/tax', authenticateToken, invTaxRoutes);


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
            res.status(status).json({ error: status === 500 ? "Internal Server Error" : "Request Error", detail: err.message });
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

    } catch (error) {
        console.error('FATAL SERVER STARTUP ERROR:', error);
        process.exit(1);
    }
})();

module.exports = { app, sequelize };

