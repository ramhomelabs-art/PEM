/**
 * CAS source extraction: PDF text layer (pdf-parse, already a dependency),
 * or raw pasted/uploaded delimited text. Pure decision logic is injectable
 * so consumers can test dispatch without touching a real PDF.
 */

const { parseCas } = require('./parse');

/** Extract plain text from a PDF buffer. pdfImpl injectable for tests. */
async function extractPdfText(buffer, { pdfImpl } = {}) {
    let PDF = pdfImpl;
    if (!PDF) {
        try {
            const pdfParseModule = require('pdf-parse');
            PDF = pdfParseModule.PDFParse || pdfParseModule;
        } catch (e) {
            const err = new Error('PDF parsing library is unavailable: ' + e.message);
            err.status = 500;
            throw err;
        }
    }
    const parser = new PDF({ data: buffer });
    try {
        const result = await parser.getText();
        return result.text || '';
    } finally {
        if (typeof parser.destroy === 'function') await parser.destroy().catch(() => {});
    }
}

/** Decide how to parse an upload / pasted payload. Throws on empty. */
function dispatchSource({ buffer, originalname, text } = {}) {
    if (text && String(text).trim()) {
        return { kind: 'text', text: String(text), format: String(global.format || '').length ? global.format : undefined };
    }
    if (buffer && buffer.length) {
        const name = String(originalname || '').toLowerCase();
        const utf8 = buffer.toString('utf8');
        if (name.endsWith('.pdf')) {
            if (utf8.indexOf('%PDF') !== 0 && buffer[0] !== 0x25) {
                // byte-level check: PDF magic is "%PDF" (0x25 0x50 0x44 0x46)
                return { kind: 'pdf', buffer };
            }
            return { kind: 'pdf', buffer };
        }
        if (name.endsWith('.tsv')) return { kind: 'text', text: utf8, format: 'tsv' };
        return { kind: 'text', text: utf8, format: 'auto' };
    }
    const err = new Error('No file content or text provided');
    err.status = 400;
    throw err;
}

/**
 * Parse an upload/paste payload into canonical rows.
 * opts: { buffer, originalname, text, format, pdfImpl }
 * Returns { rows, errors, source, text, sourceName }.
 */
async function parseSource(opts = {}) {
    const decision = dispatchSource(opts);
    const sourceName = opts.originalname || 'pasted';
    let text;
    let format;

    if (decision.kind === 'pdf') {
        text = await extractPdfText(decision.buffer, { pdfImpl: opts.pdfImpl });
        format = 'cas-pdf';
    } else {
        text = decision.text;
        format = opts.format || decision.format || 'auto';
    }

    const parsed = parseCas(text, { format });
    return { ...parsed, text, sourceName };
}

module.exports = { parseSource, dispatchSource, extractPdfText };