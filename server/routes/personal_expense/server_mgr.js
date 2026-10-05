const express = require('express');
// console.log('LOADING SERVER ROUTES FILE...');
const router = express.Router();
const axios = require('axios'); // For Python Service Communication

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5002';
const os = require('os');
const { Category, Transaction, User, sequelize, Bill, Budget, Goal, Loan } = require('../../models'); // Check path
const { Op } = require('sequelize');
const { authenticateToken } = require('../../middleware/auth');

// --- SERVER STATS ---
// --- SERVER STATS ---
router.get('/ping', (req, res) => res.json({ message: 'PONG from server_mgr' }));

router.get('/stats', async (req, res) => {
    console.log("Stats route hit - VERIFYING FILE IDENTITY");
    try {
        const cpus = os.cpus();
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total);
        }, 0) / cpus.length;

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // DB Health Check
        let dbStatus = 'unknown';
        let dbError = null;
        try {
            await User.findOne({ attributes: ['id'], limit: 1 });
            dbStatus = 'healthy';
        } catch (e) {
            dbStatus = 'error';
            dbError = e.message;
            console.error('[STATS] Database health check failed:', e.message);
        }

        res.json({
            source: 'ACTIVE_SERVER_MGR_FILE',
            cpu: (cpuUsage * 100).toFixed(1),
            ram: ((usedMem / totalMem) * 100).toFixed(1),
            totalMem: (totalMem / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
            freeMem: (freeMem / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
            uptime: (os.uptime() / 3600).toFixed(1) + ' hrs',
            platform: os.platform() + ' ' + os.release(),
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
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create category
router.post('/categories', async (req, res) => {
    try {
        const { name, type, color } = req.body;
        const category = await Category.create({ name, type, color });
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update category (Just visual properties)
router.put('/categories/:id', async (req, res) => {
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
router.put('/categories/rename/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { newName } = req.body;

        const category = await Category.findByPk(id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        const oldName = category.name;

        // 1. Update Category Name
        await Category.update({ name: newName }, { where: { id } });

        // 2. Bulk Update Transactions
        const result = await Transaction.update(
            { category: newName },
            { where: { category: oldName } }
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
router.delete('/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByPk(id);

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
router.put('/users/:id/group', async (req, res) => {
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
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// DB Path (Relative to this route file: routes/personal_expense/server.js -> ../../database.sqlite)
const DB_PATH = path.join(__dirname, '../../database.sqlite');

// Encrypt and Stream Backup
router.get('/backup', (req, res) => {
    try {
        const { password } = req.query;
        if (!password) return res.status(400).json({ error: 'Password required' });

        // 1. Read Database File
        if (!fs.existsSync(DB_PATH)) return res.status(404).json({ error: 'Database not found' });
        const fileData = fs.readFileSync(DB_PATH);

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
        res.setHeader('Content-Disposition', `attachment; filename = finance_backup_${dateStr}.pemdb`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(output);

    } catch (err) {
        console.error("Backup Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Restore Database
router.post('/restore', upload.single('backupFile'), (req, res) => {
    try {
        const { password } = req.body;
        const file = req.file;

        if (!file || !password) return res.status(400).json({ error: 'File and password required' });

        // 1. Read Uploaded File
        const input = fs.readFileSync(file.path);

        // Cleanup temp file immediately
        fs.unlinkSync(file.path);

        if (input.length < 44) return res.status(400).json({ error: 'Invalid file format' });

        // 2. Parse Components
        const salt = input.slice(0, 16);
        const iv = input.slice(16, 28); // 16+12 = 28
        const tag = input.slice(28, 44); // 28+16 = 44
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
            return res.status(401).json({ error: 'Decryption Incorrect Password or Corrupted File' });
        }

        // 5. Validate SQLite Header (First 16 bytes: "SQLite format 3\0")
        const header = decrypted.slice(0, 16).toString();
        if (!header.startsWith('SQLite format 3')) {
            return res.status(400).json({ error: 'Invalid Database File (Not SQLite)' });
        }

        // 6. Overwrite Database
        // We need to release the file lock if possible, but in SQLite + Node, just writing might fail if busy.
        // We will try.
        fs.writeFileSync(DB_PATH, decrypted);

        // 7. Restart Trigger
        // We send success, then exit process to force reload.
        res.json({ message: 'Restore Successful. Server restarting...' });

        setTimeout(() => {
            console.log("RESTORING DATABASE - TRIGGERING RESTART...");
            process.exit(0);
        }, 1000);

    } catch (err) {
        console.error("Restore Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- API DISCOVERY ---

router.get('/endpoints', (req, res) => {
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
        const path = require('path');

        // CORRECTION: 'server/routes/personal_expense' -> '../../..' -> root
        const scriptPath = path.join(__dirname, '../../../python-extraction-service/app.py');
        console.log('Spawning Python script at:', scriptPath);

        // Create log stream
        const fs = require('fs');
        const logStream = fs.createWriteStream(path.join(__dirname, '../../../python-extraction-service/python_stdout.log'), { flags: 'a' });

        const pythonProcess = spawn('python', [scriptPath], {
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
        await axios.post(`${PYTHON_SERVICE_URL}/restart`, {}, { timeout: 3000 });
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

module.exports = router;

