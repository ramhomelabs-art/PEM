const express = require('express');
const router = express.Router();
const { User } = require('../../models');
const multer = require('multer');
const path = require('path');

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
router.post('/upload-photo/:userId', upload.single('photo'), async (req, res) => {
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
router.put('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { fullName, mobile, email, country, currency, timezone, role, profilePhoto, dob } = req.body;

        console.log('[PROFILE UPDATE] User ID:', userId);
        console.log('[PROFILE UPDATE] Request body:', req.body);

        // Sanitize dob to null if it's empty or invalid to prevent PostgreSQL schema crashes
        const sanitizedDob = (!dob || dob === '' || dob === 'Invalid date') ? null : dob;

        await User.update({ fullName, mobile, email, country, currency, timezone, role, profilePhoto, dob: sanitizedDob }, { where: { id: userId } });
        res.json({ message: 'Profile updated' });
    } catch (error) {
        console.error('[PROFILE UPDATE ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Profile Details
router.get('/profile/:userId', async (req, res) => {
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
