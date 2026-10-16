const { categorize } = require('./smsParser');

/**
 * Extracts raw text from an image or PDF buffer.
 * Supports tesseract.js for image OCR and pdf-parse for PDF text extraction.
 */
async function extractTextFromFile({ buffer, mimetype = '', originalname = '' }) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return '';
    }

    const mime = mimetype.toLowerCase();
    const name = originalname.toLowerCase();

    // 0. Plain text / CSV files
    if (mime.includes('text') || name.endsWith('.txt') || name.endsWith('.csv')) {
        return buffer.toString('utf-8');
    }

    // 1. PDF Handling
    if (mime.includes('pdf') || name.endsWith('.pdf') || buffer.slice(0, 4).toString() === '%PDF') {
        try {
            const pdfParseModule = require('pdf-parse');
            const PDF = pdfParseModule.PDFParse || pdfParseModule;
            const parser = new PDF({ data: buffer });
            const result = await parser.getText();
            if (typeof parser.destroy === 'function') {
                await parser.destroy().catch(() => {});
            }
            return result?.text || '';
        } catch (pdfErr) {
            console.warn('[ReceiptParser] pdf-parse extraction warning:', pdfErr.message);
            return '';
        }
    }

    // 2. Image OCR via Tesseract.js
    try {
        const Tesseract = require('tesseract.js');
        const res = await Tesseract.recognize(buffer, 'eng');
        return res?.data?.text || '';
    } catch (ocrErr) {
        console.warn('[ReceiptParser] Tesseract OCR extraction warning:', ocrErr.message);
        return '';
    }
}

/**
 * Parses receipt text to extract structured receipt data:
 * - merchant
 * - amount
 * - date (YYYY-MM-DD)
 * - category
 * - tax
 */
function parseReceiptText(text) {
    const today = new Date().toISOString().slice(0, 10);
    if (!text || typeof text !== 'string') {
        return {
            merchant: 'Store / Merchant',
            amount: 0,
            date: today,
            category: 'General',
            tax: 0,
            rawText: ''
        };
    }

    const cleanText = text.replace(/\r/g, '').trim();
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Merchant Detection
    let merchant = '';
    const ignoreHeaders = /^(tax invoice|tax bill|invoice|receipt|bill|cash receipt|retail invoice|customer copy|original|duplicate|welcome|welcome to|token|order|table|counter|guest|date|time|gstin|gst|fssai|cin|phone|tel|ph|email|mob|mobile|st no|tin)[\s\:\.\#-]*$/i;

    const knownBrands = [
        'Starbucks', 'McDonald\'s', 'KFC', 'Burger King', 'Subway', 'Domino\'s', 'Pizza Hut',
        'Zomato', 'Swiggy', 'D-Mart', 'DMart', 'Reliance', 'Reliance Fresh', 'Reliance Smart',
        'Reliance Digital', 'BigBasket', 'Blinkit', 'Zepto', 'Apollo Pharmacy', 'MedPlus',
        'Croma', 'Vijay Sales', 'Decathlon', 'IKEA', 'Shell', 'Indian Oil', 'HP Petrol', 'BPCL',
        'Costa Coffee', 'Cafe Coffee Day', 'Chaayos', 'Third Wave Coffee', 'Haldirams', 'Bikanervala',
        'Barbeque Nation', 'PVR', 'INOX', 'Cinepolis', 'Pantaloons', 'Westside', 'Trends', 'Max',
        'Shoppers Stop', 'Lifestyle', 'Zara', 'H&M', 'Uniqlo'
    ];

    for (const brand of knownBrands) {
        const escaped = brand.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const brandRegex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (brandRegex.test(cleanText)) {
            merchant = brand;
            break;
        }
    }

    if (!merchant) {
        for (let i = 0; i < Math.min(lines.length, 6); i++) {
            const line = lines[i].replace(/[^\w\s&'-]/g, ' ').trim();
            if (
                line.length >= 3 &&
                line.length <= 45 &&
                !ignoreHeaders.test(line.toLowerCase()) &&
                !/^[0-9\s:.-]+$/.test(line) &&
                !/gstin|fssai|phone|tel|email|address/i.test(line)
            ) {
                merchant = lines[i].replace(/^[#\*\-\s]+|[#\*\-\s]+$/g, '').trim();
                break;
            }
        }
    }
    if (!merchant) merchant = 'Store / Merchant';

    // 2. Amount & Total Detection
    let amount = 0;
    const totalPatterns = [
        /(?:grand\s*total|net\s*amount|total\s*amount|amount\s*payable|bill\s*total|final\s*amount|total\s*due|balance\s*due|total)[^\d\n\r]*([0-9,]+(?:\.[0-9]+)?)/i,
        /(?:₹|Rs\.?|INR)[^\d\n\r]*([0-9,]+(?:\.[0-9]+)?)/i
    ];

    for (const pat of totalPatterns) {
        const matches = [...cleanText.matchAll(new RegExp(pat.source, 'gi'))];
        if (matches && matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            const rawNum = lastMatch[1].replace(/,/g, '');
            const val = parseFloat(rawNum);
            if (!isNaN(val) && val > 0) {
                amount = val;
                break;
            }
        }
    }

    if (!amount) {
        const numRegex = /\b([0-9]+(?:\.[0-9]{2}))\b/g;
        let highest = 0;
        let match;
        while ((match = numRegex.exec(cleanText)) !== null) {
            const val = parseFloat(match[1]);
            if (val > highest && val < 500000) {
                highest = val;
            }
        }
        if (highest > 0) amount = highest;
    }

    // 3. Tax Detection
    let tax = 0;
    const cgstMatch = cleanText.match(/cgst(?:\s*\(?\s*@?\s*[\d\.]+\s*%\s*\)?)?[^\d\n\r]*([\d\.]+)/i);
    const sgstMatch = cleanText.match(/sgst(?:\s*\(?\s*@?\s*[\d\.]+\s*%\s*\)?)?[^\d\n\r]*([\d\.]+)/i);
    if (cgstMatch && cgstMatch[1]) {
        const val = parseFloat(cgstMatch[1]);
        if (!isNaN(val) && val < (amount || 100000)) tax += val;
    }
    if (sgstMatch && sgstMatch[1]) {
        const val = parseFloat(sgstMatch[1]);
        if (!isNaN(val) && val < (amount || 100000)) tax += val;
    }
    if (tax === 0) {
        const gstMatch = cleanText.match(/(?:gst|tax|vat)(?:\s*\(?\s*@?\s*[\d\.]+\s*%\s*\)?)?[^\d\n\r]*([\d\.]+)/i);
        if (gstMatch && gstMatch[1]) {
            const val = parseFloat(gstMatch[1]);
            if (!isNaN(val) && val < (amount || 100000)) tax = val;
        }
    }

    // 4. Date Detection
    let date = '';
    const dateMatch = cleanText.match(/\b(20\d{2}[-\/.](?:0[1-9]|1[0-2])[-\/.](?:0[1-9]|[12]\d|3[01]))\b/) ||
                      cleanText.match(/\b((?:0[1-9]|[12]\d|3[01])[-\/.](?:0[1-9]|1[0-2])[-\/.](?:20\d{2}|\d{2}))\b/) ||
                      cleanText.match(/\b((?:0[1-9]|[12]\d|3[01])\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:20\d{2}|\d{2}))\b/i);

    if (dateMatch) {
        try {
            const raw = dateMatch[1].replace(/\./g, '/');
            const parts = raw.split(/[\/\-]/);
            if (parts.length === 3) {
                let y, m, d;
                if (parts[0].length === 4) {
                    [y, m, d] = parts;
                } else {
                    [d, m, y] = parts;
                    if (y.length === 2) y = '20' + y;
                }
                const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const testD = new Date(isoDate);
                if (!isNaN(testD.getTime())) {
                    date = isoDate;
                }
            }
        } catch (_) {}
    }
    if (!date) {
        date = today;
    }

    // 5. Category Detection
    let category = categorize(cleanText, merchant, 'debit');
    if (/barbeque|bbq|restaurant|cafe|coffee|burger|pizza|subway|starbucks|mcdonald/i.test(merchant)) {
        category = 'Food';
    }

    return {
        merchant,
        amount: Math.round(amount * 100) / 100,
        date,
        category,
        tax: Math.round(tax * 100) / 100,
        rawText: cleanText.slice(0, 1000)
    };
}

module.exports = {
    extractTextFromFile,
    parseReceiptText
};
