const express = require('express');
const router = express.Router();
const { Document, User } = require('../../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `doc-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|pdf|doc|docx|txt|csv|xls|xlsx|ppt|pptx|zip|rar|7z|odt|ods|odp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

        // Accept common document mimetypes
        const allowedMimeTypes = [
            // Images
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
            // PDFs
            'application/pdf',
            // Microsoft Office
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            // Text files
            'text/plain',
            'text/csv',
            // Archives
            'application/zip',
            'application/x-zip-compressed',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            // OpenDocument
            'application/vnd.oasis.opendocument.text',
            'application/vnd.oasis.opendocument.spreadsheet',
            'application/vnd.oasis.opendocument.presentation'
        ];

        const mimetypeValid = allowedMimeTypes.includes(file.mimetype);

        if (mimetypeValid || extname) {
            return cb(null, true);
        } else {
            cb(new Error('File type not supported. Please upload images, PDFs, or documents.'));
        }
    }
});

// GET all documents for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const documents = await Document.findAll({
            where: { userId: req.params.userId },
            order: [['uploadedAt', 'DESC']]
        });
        res.json(documents);
    } catch (err) {
        console.error('[Documents] Fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// POST upload new document
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { documentName, documentType, userId } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const document = await Document.create({
            userId,
            documentName,
            documentType,
            filePath: `uploads/documents/${req.file.filename}`,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            source: 'upload',
            uploadedAt: new Date()
        });

        res.status(201).json(document);
    } catch (err) {
        console.error('[Documents] Upload error:', err);
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

// DELETE document
router.delete('/:id', async (req, res) => {
    try {
        const document = await Document.findByPk(req.params.id);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Delete file from filesystem
        if (document.filePath) {
            const fullPath = path.join(__dirname, '../..', document.filePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        await document.destroy();
        res.json({ message: 'Document deleted successfully' });
    } catch (err) {
        console.error('[Documents] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

module.exports = router;
