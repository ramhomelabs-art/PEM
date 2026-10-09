const express = require('express');
const router = express.Router();
const { User } = require('../../models');
const { authenticateToken } = require('../../middleware/auth');
const multer = require('multer');
const path = require('path');

// Only the owner of the profile (or an admin) may read/modify it.
const isSelfOrAdmin = (req, res, next) => {
    const paramId = Number(req.params.userId);
    const authId = Number(req.user.id);
    const isAdmin = req.user.role === 'admin' || req.user.role === 'administrator';
    if (!Number.isFinite(paramId) || (!isAdmin && paramId !== authId)) {
        return res.status(403).json({ error: 'Forbidden: you can only access your own profile' });
    }
    next();
};

// Configure Multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dest = path.join(__dirname, '../../uploads/');
        console.log('MULTER DESTINATION:', dest);
        if (!fs.existsSync(dest)) {
            console.log('CREATING DIR:', dest);
            fs.mkdirSync(dest, { recursive: true });
        }
        cb(null, dest)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // Append extension
    }
});

const upload = multer({ storage: storage });

const fs = require('fs');

// Update Profile Photo
router.post('/upload-photo/:userId', authenticateToken, isSelfOrAdmin, upload.single('photo'), async (req, res) => {
    try {
        const { userId } = req.params;
        const photoPath = req.file.path; // Absolute path from multer

        // Find user to get old photo
        const user = await User.findByPk(userId);
        if (user && user.profilePhoto) {
            // Construct old absolute path
            // user.profilePhoto is stored as 'uploads/filename.jpg'
            // We need to resolve it relative to server root
            const oldPath = path.join(__dirname, '../../', user.profilePhoto);
            if (fs.existsSync(oldPath)) {
                try {
                    fs.unlinkSync(oldPath);
                } catch (e) {
                    console.error("Failed to delete old photo:", e);
                }
            }
        }

        // Normalize path for serving (Cross-platform compatibility)
        const normalizedPath = 'uploads/' + req.file.filename;

        await User.update({ profilePhoto: normalizedPath }, { where: { id: userId } });
        res.json({ message: 'Photo uploaded successfully', photoPath: normalizedPath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Profile Details (Currency, Timezone etc mostly handled on signup but editable)
router.put('/profile/:userId', authenticateToken, isSelfOrAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { fullName, mobile, email, country, currency, timezone, profilePhoto, dob } = req.body;

        console.log('[PROFILE UPDATE] User ID:', userId);
        console.log('[PROFILE UPDATE] Request body:', req.body);

        // Sanitize dob to null if it's empty or invalid to prevent PostgreSQL schema crashes
        const sanitizedDob = (!dob || dob === '' || dob === 'Invalid date') ? null : dob;

        // NOTE: `role` is intentionally NOT updatable here. Role changes must go
        // through the admin-only endpoint to prevent privilege escalation.
        await User.update({ fullName, mobile, email, country, currency, timezone, profilePhoto, dob: sanitizedDob }, { where: { id: userId } });
        res.json({ message: 'Profile updated' });
    } catch (error) {
        console.error('[PROFILE UPDATE ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Profile Details
router.get('/profile/:userId', authenticateToken, isSelfOrAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            mobile: user.mobile,
            dob: user.dob,
            country: user.country,
            currency: user.currency,
            timezone: user.timezone,
            role: user.role,
            profilePhoto: user.profilePhoto,
            status: user.status,
            mfaEnabled: user.mfaEnabled,
            mfaMethod: user.mfaMethod,
            mfaConfigured: user.mfaConfigured
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
