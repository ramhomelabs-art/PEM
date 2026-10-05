
const express = require('express');
const router = express.Router();
const { User } = require('../../models');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../../middleware/auth');

// Admin guard: require a valid token AND the admin role.
const isAdmin = [
    authenticateToken,
    (req, res, next) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    }
];

// --- LOGGING ENDPOINT ---
// --- LOGGING ENDPOINT ---
// --- LOGGING ENDPOINT ---
router.get('/logs', isAdmin, (req, res) => {
    // FIX: Ensure correct path resolution relative to project root
    // __dirname is .../server/routes/personal_expense
    // We want .../server/server.log
    const logPath = path.join(__dirname, '../../server.log');

    if (!fs.existsSync(logPath)) {
        // Try creating it if missing so next writes succeed? 
        // No, the logger handles writing. Just return empty.
        return res.json({ logs: ['[SYSTEM] Log file not found. System might have been cleaned recently.'] });
    }

    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read logs' });

        // Return last 1000 lines, handle empty file
        if (!data) return res.json({ logs: [] });

        const lines = data.split('\n')
            .filter(l => l.trim().length > 0)
            .slice(-1000)
            .reverse();
        res.json({ logs: lines });
    });
});

// --- DATABASE HEALTH ENDPOINT ---
const { sequelize } = require('../../models');

router.get('/db-status', isAdmin, async (req, res) => {
    try {
        // 1. Basic Connection Check
        await sequelize.authenticate();

        const isPostgres = sequelize.options.dialect === 'postgres';
        let sizeResult, processList, statusResult, threadsResult;
        let dbStats = {};

        if (isPostgres) {
            sizeResult = await sequelize.query(`
                SELECT current_database() AS "db_name", 
                ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2) AS "size_mb",
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') AS "table_count"
            `, { type: sequelize.QueryTypes.SELECT });

            const activeConnResult = await sequelize.query('SELECT COUNT(*) AS "connections" FROM pg_stat_activity', { type: sequelize.QueryTypes.SELECT });
            const activeProcResult = await sequelize.query("SELECT COUNT(*) AS \"active_processes\" FROM pg_stat_activity WHERE state = 'active'", { type: sequelize.QueryTypes.SELECT });
            const uptimeResult = await sequelize.query('SELECT ROUND(EXTRACT(epoch FROM (now() - pg_postmaster_start_time()))) AS uptime', { type: sequelize.QueryTypes.SELECT });

            dbStats = {
                status: 'online',
                database: sizeResult[0]?.db_name || 'unknown',
                sizeMb: parseFloat(sizeResult[0]?.size_mb) || 0,
                tables: parseInt(sizeResult[0]?.table_count) || 0,
                connections: parseInt(activeConnResult[0]?.connections) || 0,
                uptime: parseInt(uptimeResult[0]?.uptime) || 0,
                activeProcesses: parseInt(activeProcResult[0]?.active_processes) || 0
            };
        } else {
            sizeResult = await sequelize.query(`
                SELECT table_schema AS \`db_name\`, 
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS \`size_mb\`,
                COUNT(*) as \`table_count\` 
                FROM information_schema.tables 
                WHERE table_schema = (SELECT DATABASE()) 
                GROUP BY table_schema
            `, { type: sequelize.QueryTypes.SELECT });

            processList = await sequelize.query('SHOW PROCESSLIST', { type: sequelize.QueryTypes.SELECT });
            statusResult = await sequelize.query("SHOW GLOBAL STATUS LIKE 'Uptime'", { type: sequelize.QueryTypes.SELECT });
            threadsResult = await sequelize.query("SHOW GLOBAL STATUS LIKE 'Threads_connected'", { type: sequelize.QueryTypes.SELECT });

            dbStats = {
                status: 'online',
                database: sizeResult[0]?.db_name || 'unknown',
                sizeMb: parseFloat(sizeResult[0]?.size_mb) || 0,
                tables: parseInt(sizeResult[0]?.table_count) || 0,
                connections: parseInt(threadsResult[0]?.Value) || 0,
                uptime: parseInt(statusResult[0]?.Value) || 0,
                activeProcesses: processList.length
            };
        }

        res.json(dbStats);

    } catch (error) {
        console.error("DB Status Check Failed:", error);
        res.json({
            status: 'offline',
            error: error.message,
            database: 'unknown',
            sizeMb: 0,
            tables: 0,
            connections: 0,
            uptime: 0,
            activeProcesses: 0
        });
    }
});

// Get all users
router.get('/users', isAdmin, async (req, res) => {
    try {
        const users = await User.findAll({ attributes: { exclude: ['password'] } });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Approve user with optional role assignment
router.post('/approve/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body; // Optional role parameter

        const updateData = { status: 'active' };
        if (role && (role === 'user' || role === 'admin')) {
            updateData.role = role;
        }

        await User.update(updateData, { where: { id } });
        res.json({ message: 'User approved', role: updateData.role });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete user
router.delete('/users/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await User.destroy({ where: { id } });
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset Password (Admin manual)
const bcrypt = require('bcryptjs');
router.post('/reset-password/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.update({ password: hashedPassword }, { where: { id } });
        res.json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create User Manually
router.post('/users', isAdmin, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            role: role || 'user',
            status: 'active'
        });
        res.json({ id: user.id, username: user.username, email: user.email, role: user.role, status: user.status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const { saveSettings } = require('../../utils/settings');

// Toggle Signup Lock
router.post('/lock-signup', isAdmin, async (req, res) => {
    try {
        const { locked } = req.body; // boolean
        saveSettings({ signupLocked: locked });
        res.json({ message: `Signup Lock is now ${locked ? 'ON' : 'OFF'}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
