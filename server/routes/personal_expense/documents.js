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

// Metadata arrives as a JSON string from the mobile multipart upload.
const safeJsonParse = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (e) {
        return null;
    }
};

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
        const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|pdf|doc|docx|txt|csv|xls|xlsx|ppt|pptx|odt|ods|odp/;
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
            // OpenDocument
            'application/vnd.oasis.opendocument.text',
            'application/vnd.oasis.opendocument.spreadsheet',
            'application/vnd.oasis.opendocument.presentation'
        ];

        const mimetypeValid = allowedMimeTypes.includes(file.mimetype);

        if (mimetypeValid && extname) {
            return cb(null, true);
        } else {
            cb(new Error('File type not supported. Please upload images, PDFs, or documents.'));
        }
    }
});

// GET all documents for a user
router.get('/user/:userId', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (req.user.role !== 'admin' && Number(req.user.id) !== Number(req.params.userId)) {
            return res.status(403).json({ error: 'Unauthorized access to user documents' });
        }
        const targetUserId = req.user.role === 'admin' ? req.params.userId : req.user.id;
        const documents = await Document.findAll({
            where: { userId: targetUserId },
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
        const { documentName, documentType } = req.body;

        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Documents always belong to the authenticated user (admins may target another user).
        const userId = req.user.role === 'admin' && req.body.userId ? req.body.userId : req.user.id;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // 'scan' is used when the mobile app converts camera captures to a PDF.
        const source = ['upload', 'scan', 'digilocker'].includes(req.body.source)
            ? req.body.source
            : 'upload';

        // Normalise type against the ENUM (the mobile app may send 'aadhaar').
        const ALLOWED_TYPES = ['pan', 'aadhar', 'passport', 'driving_license', 'bank_statement', 'tax_return', 'invoice', 'receipt', 'other'];
        const typeAlias = { aadhaar: 'aadhar', adhaar: 'aadhar', pan_card: 'pan', bank_passbook: 'bank_statement', passbook: 'bank_statement', id: 'other' };
        const requestedType = String(documentType || '').toLowerCase().trim();
        const normalizedType = typeAlias[requestedType] || requestedType;
        const docType = ALLOWED_TYPES.includes(normalizedType) ? normalizedType : 'other';

        const parsedName = documentName && String(documentName).trim();
        const fallbackName = path.parse(req.file.originalname || '').name;
        const finalName = parsedName || fallbackName || 'Document';

        const document = await Document.create({
            userId,
            documentName: finalName,
            documentType: docType,
            filePath: `uploads/documents/${req.file.filename}`,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            source,
            metadata: req.body.metadata ? safeJsonParse(req.body.metadata) : null,
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
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const document = await Document.findByPk(req.params.id);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (req.user.role !== 'admin' && Number(req.user.id) !== Number(document.userId)) {
            return res.status(403).json({ error: 'Unauthorized to delete this document' });
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
