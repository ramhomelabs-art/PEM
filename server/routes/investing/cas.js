const express = require('express');
const router = express.Router();
const multer = require('multer');
const { sequelize } = require('../../models');
const { prepareImport, commitImport } = require('../../utils/investing/cas/import');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// POST /api/investing/cas/preview  (JSON with { text } OR multipart file 'cas')
router.post('/preview', (req, res, next) => {
    if (req.is('multipart/form-data')) {
        upload.single('cas')(req, res, (err) => {
            if (err) return res.status(413).json({ error: 'Upload failed', detail: err.message });
            next();
        });
    } else {
        next();
    }
}, async (req, res) => {
    try {
        const body = req.body || {};
        const opts = {
            buffer: req.file ? req.file.buffer : null,
            originalname: req.file ? req.file.originalname : (body.filename || 'pasted.txt'),
            text: body.text || null,
            format: body.format || undefined
        };
        const preview = await prepareImport(sequelize, req.user.id, opts);
        res.json(preview);
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: 'CAS preview failed', detail: err.message });
    }
});

// POST /api/investing/cas/commit  - commit a previously parsed/approved batch
router.post('/commit', async (req, res) => {
    try {
        const { rows } = req.body || {};
        if (!rows || !Array.isArray(rows)) {
            return res.status(400).json({ error: 'rows (canonical array) is required' });
        }
        const result = await commitImport(sequelize, req.user.id, { rows });
        res.json(result);
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: 'CAS commit failed', detail: err.message });
    }
});

module.exports = router;