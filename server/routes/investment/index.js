const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');

// Mount sub-routes
const investmentRoutes = require('./investment');
const transactionRoutes = require('./transaction');
const dashboardRoutes = require('./dashboard');
const goalRoutes = require('./goals');
const taxRoutes = require('./tax');
const marketRoutes = require('./market');
const planRoutes = require('./plan');
const alphaRoutes = require('./alphaVantage');

// Protected routes (Specific first)
router.use('/dashboard', authenticateToken, dashboardRoutes);
router.use('/goals', authenticateToken, goalRoutes);
router.use('/tax', authenticateToken, taxRoutes);
router.use('/market', authenticateToken, marketRoutes);
router.use('/plans', authenticateToken, planRoutes);
router.use('/alpha', authenticateToken, alphaRoutes);

// General ID-based routes LAST
router.use('/', authenticateToken, investmentRoutes);
router.use('/', authenticateToken, transactionRoutes);

module.exports = router;
