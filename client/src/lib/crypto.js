/**
 * Shared Cryptographic Specification Implementation for PEM Pro (Web Client)
 * Uses AES-256-GCM with PBKDF2 key derivation (SHA-256, 100,000 iterations).
 * Generates a cryptographically random 16-byte salt and 12-byte IV per record.
 * Supports:
 * 1. Versioned string format: gcm1:<salt_b64>:<iv_b64>:<ciphertext_and_tag_b64>:<visible_suffix>
 * 2. Versioned JSON envelope: {"v":1,"alg":"AES-256-GCM","salt":...,"iv":...,"ct":...,"suffix":...}
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getCrypto() {
    if (typeof window !== 'undefined' && window.crypto) return window.crypto;
    if (typeof globalThis !== 'undefined' && globalThis.crypto) return globalThis.crypto;
    throw new Error('Web Crypto API not available');
}

export function toBase64(bytes) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export function fromBase64(str) {
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(str, 'base64'));
    }
    const binary = window.atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Derives an AES-256-GCM key from a passphrase and salt using PBKDF2 (SHA-256, 100,000 iterations).
 */
export async function deriveKey(passphrase, saltBytes) {
    const keyMaterial = await getCrypto().subtle.importKey(
        'raw',
        encoder.encode(passphrase || 'pem-default-vault-key'),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return getCrypto().subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Parses an encrypted payload in either gcm1 string format or JSON envelope format.
 */
export function parseEncryptedPayload(payload) {
    if (!payload || typeof payload !== 'string') return null;
    const str = payload.trim();

    // Check JSON envelope format
    if (str.startsWith('{') && str.endsWith('}')) {
        try {
            const json = JSON.parse(str);
            if (json.v === 1 && json.salt && json.iv && json.ct) {
                return {
                    version: 1,
                    saltB64: json.salt,
                    ivB64: json.iv,
                    cipherB64: json.ct,
                    suffix: json.suffix || ''
                };
            }
        } catch {
            // Not JSON, continue to string parser
        }
    }

    // Check gcm1 string format
    if (str.startsWith('gcm1:')) {
        const parts = str.split(':');
        if (parts.length >= 4) {
            return {
                version: 1,
                saltB64: parts[1],
                ivB64: parts[2],
                cipherB64: parts[3],
                suffix: parts.length >= 5 ? parts[4] : ''
            };
        }
    }

    return null;
}

/**
 * Checks if a value is in ciphertext format.
 */
export function isEncrypted(value) {
    if (typeof value !== 'string') return false;
    const clean = value.trim();
    return clean.startsWith('gcm1:') || clean.startsWith('v2:') || (clean.startsWith('{') && clean.includes('"AES-256-GCM"')) || (clean.includes(':') && clean.length > 40);
}

/**
 * Encrypts a sensitive field (card number, CVV, account number) using AES-256-GCM.
 * Preserves the visible suffix so cards and bank lists can display at least half the number.
 * Returns string in format: gcm1:<salt_b64>:<iv_b64>:<ciphertext_b64>:<visible_suffix>
 */
export async function encryptField(plainText, passphrase) {
    if (plainText === null || plainText === undefined || plainText === '') return '';
    const str = String(plainText).trim();
    if (isEncrypted(str)) return str;

    try {
        const cleanDigits = str.replace(/\s+/g, '');
        // Keep at least half the digits visible as suffix (minimum 4)
        const visibleCount = Math.max(4, Math.ceil(cleanDigits.length / 2));
        const visibleSuffix = cleanDigits.slice(-visibleCount);

        const salt = getCrypto().getRandomValues(new Uint8Array(16));
        const iv = getCrypto().getRandomValues(new Uint8Array(12));
        const key = await deriveKey(passphrase, salt);

        const ciphertextBuffer = await getCrypto().subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(str)
        );

        return `gcm1:${toBase64(salt)}:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertextBuffer))}:${visibleSuffix}`;
    } catch (err) {
        console.error('[Crypto] Encryption error:', err);
        return str;
    }
}

/**
 * Encrypts into canonical JSON envelope format.
 */
export async function encryptFieldJson(plainText, passphrase) {
    if (plainText === null || plainText === undefined || plainText === '') return '';
    const str = String(plainText).trim();
    if (isEncrypted(str)) return str;

    try {
        const cleanDigits = str.replace(/\s+/g, '');
        const visibleCount = Math.max(4, Math.ceil(cleanDigits.length / 2));
        const visibleSuffix = cleanDigits.slice(-visibleCount);

        const salt = getCrypto().getRandomValues(new Uint8Array(16));
        const iv = getCrypto().getRandomValues(new Uint8Array(12));
        const key = await deriveKey(passphrase, salt);

        const ciphertextBuffer = await getCrypto().subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(str)
        );

        return JSON.stringify({
            v: 1,
            alg: 'AES-256-GCM',
            kdf: 'PBKDF2-HMAC-SHA256',
            iter: 100000,
            salt: toBase64(salt),
            iv: toBase64(iv),
            ct: toBase64(new Uint8Array(ciphertextBuffer)),
            suffix: visibleSuffix
        });
    } catch (err) {
        console.error('[Crypto] Encryption error:', err);
        return str;
    }
}

/**
 * Strict Decryption: Returns { success: true, value } or { success: false, error }.
 * Never displays garbage or fake masked dots on authentication failure.
 */
export async function decryptFieldStrict(payload, passphrase) {
    if (!payload || typeof payload !== 'string') {
        return { success: true, value: payload || '' };
    }

    const envelope = parseEncryptedPayload(payload);
    if (!envelope) {
        // Plaintext unencrypted legacy record
        return { success: true, value: payload };
    }

    try {
        const salt = fromBase64(envelope.saltB64);
        const iv = fromBase64(envelope.ivB64);
        const ciphertext = fromBase64(envelope.cipherB64);

        const key = await deriveKey(passphrase, salt);
        const decryptedBuffer = await getCrypto().subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );

        const decrypted = decoder.decode(decryptedBuffer);
        return { success: true, value: decrypted };
    } catch (err) {
        console.warn('[Crypto] Decryption failed or tag mismatch:', err);
        return { success: false, error: "Can't decrypt, re-enter or re-sync" };
    }
}

/**
 * Backward compatible decryptField: returns plaintext, or "••••••••" on error.
 */
export async function decryptField(payload, passphrase) {
    const res = await decryptFieldStrict(payload, passphrase);
    return res.success ? res.value : '••••••••';
}

/**
 * Validates a card number using the Luhn Algorithm (mod 10).
 */
export function validateLuhn(cardNumber) {
    if (!cardNumber) return false;
    const digits = String(cardNumber).replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}

/**
 * Validates card expiry in MM/YY format.
 */
export function validateExpiry(expiry) {
    if (!expiry || typeof expiry !== 'string') return false;
    const match = expiry.trim().match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!match) return false;
    const month = parseInt(match[1], 10);
    const year = parseInt(match[2], 10);
    return month >= 1 && month <= 12 && year >= 20 && year <= 50;
}

/**
 * Validates CVV (3-4 digits).
 */
export function validateCvv(cvv) {
    if (!cvv) return false;
    const clean = String(cvv).trim();
    return /^\d{3,4}$/.test(clean);
}

/**
 * Masking helper for card numbers:
 * Returns "•••• •••• •••• 1234"
 */
export function maskCardNumber(value) {
    if (!value) return '•••• •••• •••• ••••';
    const clean = String(value).trim();
    if (clean.includes('•')) return clean;

    const envelope = parseEncryptedPayload(clean);
    if (envelope) {
        if (envelope.suffix) {
            const last4 = envelope.suffix.slice(-4);
            return `•••• •••• •••• ${last4}`;
        }
        return '•••• •••• •••• ••••';
    }

    const cleanDigits = clean.replace(/\D/g, '');
    const last4 = cleanDigits.slice(-4);
    return `•••• •••• •••• ${last4 || '••••'}`;
}

/**
 * Masking helper for bank account numbers:
 * Shows at least half the account number (e.g., "•••••• 890489" or "•••••• 2038")
 */
export function maskAccountNumber(value) {
    if (!value) return '•••• ••••';
    const clean = String(value).trim();
    if (clean.includes('•')) return clean;

    const envelope = parseEncryptedPayload(clean);
    if (envelope) {
        if (envelope.suffix) {
            const suffix = envelope.suffix.replace(/\s+/g, '');
            const maskedLen = Math.max(4, suffix.length);
            return `${'•'.repeat(maskedLen)} ${suffix}`;
        }
        return '•••••• ••••';
    }

    if (clean.startsWith('v2:') || (clean.includes(':') && clean.length > 30)) {
        return '•••••• ••••';
    }

    const digitsOnly = clean.replace(/\D/g, '');
    const len = digitsOnly.length;
    if (len <= 4) {
        return digitsOnly;
    }

    const visibleCount = Math.max(4, Math.ceil(len / 2));
    const maskedCount = len - visibleCount;
    const masked = '•'.repeat(maskedCount);
    const visible = digitsOnly.slice(-visibleCount);

    return `${masked} ${visible}`;
}

/**
 * Masking helper for CVV:
 */
export function maskCvv() {
    return '•••';
}

/**
 * Formats a revealed card number with spaces every 4 digits:
 * "4532 8901 2345 6789"
 */
export function formatCardNumberSpacing(value) {
    if (!value) return '';
    return String(value).replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim();
}

/**
 * Detects the card network (Visa, Mastercard, RuPay, Amex, Discover, Generic).
 */
export function detectCardNetwork(cardNumber) {
    if (!cardNumber) return 'generic';
    const clean = String(cardNumber).replace(/\D/g, '');
    if (/^4/.test(clean)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
    if (/^(60|65|81|82)/.test(clean)) return 'rupay';
    if (/^3[47]/.test(clean)) return 'amex';
    if (/^6011/.test(clean)) return 'discover';
    return 'generic';
}

/**
 * Clears the clipboard automatically after timeoutMs (default 30 seconds).
 */
export function clearClipboardAfterTimeout(timeoutMs = 30000) {
    if (typeof window === 'undefined' || !window.navigator?.clipboard?.writeText) return;
    setTimeout(() => {
        try {
            window.navigator.clipboard.writeText('');
        } catch {
            // Ignore if page is out of focus
        }
    }, timeoutMs);
}
