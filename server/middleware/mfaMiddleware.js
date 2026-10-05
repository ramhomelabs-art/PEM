const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { MfaDevice, User } = require('../models');

// 1. Rate Limiting Strategy

// Strict limiter for MFA verification endpoints (prevent brute force)
const mfaRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Increased for testing
    message: {
        status: 'error',
        message: 'Too many unsuccessful attempts, please try again after 15 minutes',
        error: 'Too many requests'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Moderate limiter for setup endpoints
const setupRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 60 minutes
    max: 100, // Increased limit for smoother onboarding/testing
    message: {
        status: 'error',
        message: 'Too many setup attempts, please try again later',
        error: 'Too many requests'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 2. Admin Exemption Check
const checkMFAExemption = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);

        if (user && user.mfaExempt) {
            // User is exempt, attach flag to request
            req.mfaExempt = true;
        } else {
            req.mfaExempt = false;
        }
        next();
    } catch (error) {
        console.error('Error checking MFA exemption:', error);
        next(error);
    }
};

// 3. Request Signature Validation (HMAC-SHA256)
const validatePushSignature = async (req, res, next) => {
    try {
        const { requestId, response, deviceId } = req.body;
        const signature = req.headers['x-mfa-signature'];
        const timestamp = req.headers['x-mfa-timestamp'];

        if (!signature || !timestamp || !deviceId) {
            return res.status(400).json({ status: 'error', error: 'Missing signature, timestamp, or deviceId' });
        }

        // Verify timestamp (allow 1 minute drift)
        const now = Date.now();
        const reqTime = parseInt(timestamp, 10);
        if (Math.abs(now - reqTime) > 60000) {
            return res.status(401).json({ status: 'error', error: 'Request timestamp invalid (clock drift or replay)' });
        }

        // Retrieve device to get secret key
        const device = await MfaDevice.findOne({ where: { id: deviceId } });
        if (!device || !device.secretKey) {
            return res.status(404).json({ status: 'error', error: 'Device not found or invalid' });
        }

        // Reconstruct payload: requestId + response + timestamp
        const payload = `${requestId}${response}${timestamp}`;

        // Compute HMAC
        const computedSignature = crypto
            .createHmac('sha256', device.secretKey)
            .update(payload)
            .digest('hex');

        // Constant-time comparison
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature))) {
            return res.status(401).json({ status: 'error', error: 'Invalid request signature' });
        }

        next();
    } catch (error) {
        console.error('Error validating signature:', error);
        return res.status(500).json({ status: 'error', error: 'Signature validation failed' });
    }
};

module.exports = {
    mfaRateLimiter,
    setupRateLimiter,
    checkMFAExemption,
    validatePushSignature
};
