const { google } = require('googleapis');
const { User, CreditCard, CreditCardBill } = require('../models');

// Default fallback credentials if not provided in environment or user config
const DEFAULT_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const DEFAULT_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const DEFAULT_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5174/credit-cards/auto-statement';

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Creates an OAuth2 client configured with either User-specific or Environment credentials.
 */
function createOAuth2Client(customConfig = {}) {
    const clientId = customConfig.clientId || process.env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;
    const clientSecret = customConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;
    const redirectUri = customConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI;

    if (!clientId || !clientSecret) {
        return null;
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Returns Google Auth URL for the user to authorize Gmail statement access.
 */
async function getAuthUrl(userId, customConfig = {}) {
    const user = await User.findByPk(userId);
    const prefs = user?.preferences || {};
    const savedConfig = prefs.gmailSync?.customConfig || {};

    const effectiveConfig = {
        clientId: customConfig.clientId || savedConfig.clientId || process.env.GOOGLE_CLIENT_ID,
        clientSecret: customConfig.clientSecret || savedConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: customConfig.redirectUri || savedConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI
    };

    const oauth2Client = createOAuth2Client(effectiveConfig);
    if (!oauth2Client) {
        throw new Error('Google OAuth is not configured. Please enter your Google Client ID & Secret in API Config.');
    }

    const state = JSON.stringify({ userId, timestamp: Date.now() });
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: GMAIL_SCOPES,
        prompt: 'consent',
        state: Buffer.from(state).toString('base64')
    });

    return url;
}

/**
 * Exchanges authorization code for tokens and saves them in the user profile.
 */
async function handleCallback(code, userId, customConfig = {}) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const prefs = user.preferences || {};
    const savedConfig = prefs.gmailSync?.customConfig || {};

    const effectiveConfig = {
        clientId: customConfig.clientId || savedConfig.clientId || process.env.GOOGLE_CLIENT_ID,
        clientSecret: customConfig.clientSecret || savedConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: customConfig.redirectUri || savedConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI
    };

    const oauth2Client = createOAuth2Client(effectiveConfig);
    if (!oauth2Client) {
        throw new Error('Google OAuth credentials not configured');
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user's Google email address
    let userEmail = 'Connected Gmail';
    try {
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        if (userInfo.data && userInfo.data.email) {
            userEmail = userInfo.data.email;
        }
    } catch (e) {
        console.warn('[Gmail OAuth] Could not get user email:', e.message);
    }

    prefs.gmailSync = {
        connected: true,
        email: userEmail,
        tokens: tokens,
        lastSync: null,
        autoSync: true,
        customConfig: effectiveConfig
    };

    user.preferences = { ...prefs };
    user.changed('preferences', true);
    await user.save();

    console.log(`[Gmail OAuth] Successfully linked ${userEmail} for user ${user.username}`);

    return {
        success: true,
        email: userEmail,
        message: `Successfully connected ${userEmail} for smart credit card statement tracking!`
    };
}

/**
 * Disconnects Gmail Sync for a user.
 */
async function disconnect(userId) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const prefs = user.preferences || {};
    if (prefs.gmailSync) {
        prefs.gmailSync.connected = false;
        delete prefs.gmailSync.tokens;
        user.preferences = prefs;
        await user.save();
    }

    return { success: true, message: 'Gmail statement sync disconnected' };
}

/**
 * Retrieves the current connection and configuration status.
 */
async function getStatus(userId) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const prefs = user.preferences || {};
    const sync = prefs.gmailSync || {};

    const hasEnvConfig = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    const hasCustomConfig = !!(sync.customConfig && sync.customConfig.clientId);

    return {
        isConfigured: hasEnvConfig || hasCustomConfig,
        connected: !!sync.connected && !!sync.tokens,
        email: sync.email || null,
        lastSync: sync.lastSync || null,
        autoSync: sync.autoSync !== false,
        customConfig: sync.customConfig ? {
            clientId: sync.customConfig.clientId,
            redirectUri: sync.customConfig.redirectUri
        } : null
    };
}

/**
 * Helper to decode base64url email content
 */
function decodeBase64Url(data) {
    if (!data) return '';
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Recursively extracts plain text and HTML from Gmail message payload
 */
function extractEmailContent(payload) {
    let text = '';
    let html = '';

    if (payload.body && payload.body.data) {
        const decoded = decodeBase64Url(payload.body.data);
        if (payload.mimeType === 'text/html') html += decoded;
        else text += decoded;
    }

    if (payload.parts && Array.isArray(payload.parts)) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                text += decodeBase64Url(part.body.data);
            } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
                html += decodeBase64Url(part.body.data);
            } else if (part.parts) {
                const nested = extractEmailContent(part);
                text += nested.text;
                html += nested.html;
            }
        }
    }

    return { text, html };
}

/**
 * Cleans currency strings (e.g. "Rs. 45,210.50" -> 45210.50)
 */
function parseAmount(val) {
    if (!val) return 0;
    const cleaned = val.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/**
 * Normalizes date strings from statements into ISO date (YYYY-MM-DD)
 */
function parseStatementDate(dateStr) {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

        // Try DD/MM/YYYY or DD-MMM-YYYY
        const parts = dateStr.trim().split(/[\/\-\s]+/);
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            let month = parts[1];
            const year = parseInt(parts[2].length === 2 ? '20' + parts[2] : parts[2], 10);

            const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const monthIdx = monthNames.findIndex(m => month.toLowerCase().startsWith(m));
            if (monthIdx !== -1) {
                const parsedDate = new Date(year, monthIdx, day);
                if (!isNaN(parsedDate.getTime())) return parsedDate.toISOString().slice(0, 10);
            }
        }
    } catch (e) {}
    return null;
}

/**
 * Intelligent regex and NLP statement parser for Indian & International Banks
 */
function parseCreditCardStatementEmail(subject, sender, bodyText, bodyHtml) {
    const fullText = (subject + '\n' + bodyText + '\n' + bodyHtml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

    let bankName = 'Unknown Bank';
    let cardName = 'Credit Card';

    // 1. Identify Bank
    const bankSignatures = [
        { name: 'HDFC Bank', patterns: [/hdfc/i, /hdfcbank/i] },
        { name: 'SBI Card', patterns: [/sbi\s*card/i, /sbicard/i, /state bank/i] },
        { name: 'ICICI Bank', patterns: [/icici/i, /icicibank/i] },
        { name: 'Axis Bank', patterns: [/axis/i, /axisbank/i] },
        { name: 'OneCard', patterns: [/onecard/i, /fpl technologies/i] },
        { name: 'American Express', patterns: [/american express/i, /amex/i] },
        { name: 'Kotak Bank', patterns: [/kotak/i, /kotak mahindra/i] },
        { name: 'RBL Bank', patterns: [/rbl/i, /rblbank/i, /ratnakar/i] },
        { name: 'IndusInd Bank', patterns: [/indusind/i] },
        { name: 'Standard Chartered', patterns: [/standard chartered/i, /sc\.com/i, /stanchart/i] },
        { name: 'Citi Bank', patterns: [/citi/i, /citibank/i] },
        { name: 'Federal Bank', patterns: [/federal bank/i, /scapia/i] },
        { name: 'AU Small Finance', patterns: [/au small/i, /aubank/i] },
        { name: 'HSBC', patterns: [/hsbc/i] }
    ];

    for (const b of bankSignatures) {
        if (b.patterns.some(p => p.test(sender) || p.test(subject))) {
            bankName = b.name;
            break;
        }
    }

    // 2. Identify Card Last 4 Digits
    let last4 = null;
    const cardPatterns = [
        /(?:card\s*(?:no\.?|number|ending)?|ending\s*in|ending\s*with|xx|x{4})\s*[:\-]?\s*x*(\d{4})\b/i,
        /card\s*(?:ending)?\s*[:\-]?\s*(\d{4})\b/i,
        /account\s*number\s*[:\-]?\s*x*(\d{4})\b/i
    ];
    for (const cp of cardPatterns) {
        const m = fullText.match(cp);
        if (m && m[1]) {
            last4 = m[1];
            break;
        }
    }

    // 3. Identify Total Amount Due
    let totalDue = 0;
    const totalDuePatterns = [
        /Total\s*(?:Amount\s*)?Due\s*[:\-]?\s*(?:Rs\.?|INR|₹|USD|\$)?\s*([0-9,]+\.?[0-9]{0,2})/i,
        /Amount\s*Payable\s*[:\-]?\s*(?:Rs\.?|INR|₹|USD|\$)?\s*([0-9,]+\.?[0-9]{0,2})/i,
        /Total\s*Dues\s*[:\-]?\s*(?:Rs\.?|INR|₹|USD|\$)?\s*([0-9,]+\.?[0-9]{0,2})/i,
        /Statement\s*Balance\s*[:\-]?\s*(?:Rs\.?|INR|₹|USD|\$)?\s*([0-9,]+\.?[0-9]{0,2})/i,
        /New\s*Balance\s*[:\-]?\s*(?:Rs\.?|INR|₹|USD|\$)?\s*([0-9,]+\.?[0-9]{0,2})/i
    ];
    for (const tp of totalDuePatterns) {
        const m = fullText.match(tp);
        if (m && m[1]) {
            const amt = parseAmount(m[1]);
            if (amt > 0) {
                totalDue = amt;
                break;
            }
        }
    }

    // 4. Identify Minimum Amount Due
    let minDue = 0;
    const minDuePatterns = [
        /Min(?:imum)?\s*(?:Amount\s*)?Due\s*[:\-]?\s*(?:Rs\.?|INR|₹|USD|\$)?\s*([0-9,]+\.?[0-9]{0,2})/i,
        /Minimum\s*Payment\s*[:\-]?\s*(?:Rs\.?|INR|₹|USD|\$)?\s*([0-9,]+\.?[0-9]{0,2})/i
    ];
    for (const mp of minDuePatterns) {
        const m = fullText.match(mp);
        if (m && m[1]) {
            const amt = parseAmount(m[1]);
            if (amt >= 0) {
                minDue = amt;
                break;
            }
        }
    }

    // 5. Identify Payment Due Date
    let dueDate = null;
    const dueDatePatterns = [
        /(?:Payment\s*)?Due\s*Date\s*[:\-]?\s*([0-9]{1,2}[\/\-\s][A-Za-z0-9]{2,4}[\/\-\s][0-9]{2,4})/i,
        /Pay\s*By\s*[:\-]?\s*([0-9]{1,2}[\/\-\s][A-Za-z0-9]{2,4}[\/\-\s][0-9]{2,4})/i,
        /Payment\s*by\s*[:\-]?\s*([0-9]{1,2}[\/\-\s][A-Za-z0-9]{2,4}[\/\-\s][0-9]{2,4})/i
    ];
    for (const dp of dueDatePatterns) {
        const m = fullText.match(dp);
        if (m && m[1]) {
            const parsed = parseStatementDate(m[1]);
            if (parsed) {
                dueDate = parsed;
                break;
            }
        }
    }

    // 6. Identify Available Credit Limit / Total Limit
    let creditLimit = 0;
    const limitPatterns = [
        /(?:Total\s*)?Credit\s*Limit\s*[:\-]?\s*(?:Rs\.?|INR|₹|USD|\$)?\s*([0-9,]+\.?[0-9]{0,2})/i,
        /Available\s*(?:Credit\s*)?Limit\s*[:\-]?\s*(?:Rs\.?|INR|₹|USD|\$)?\s*([0-9,]+\.?[0-9]{0,2})/i
    ];
    for (const lp of limitPatterns) {
        const m = fullText.match(lp);
        if (m && m[1]) {
            const amt = parseAmount(m[1]);
            if (amt > 0) {
                creditLimit = amt;
                break;
            }
        }
    }

    return {
        bankName,
        cardName: `${bankName} ${last4 ? '•••• ' + last4 : 'Card'}`,
        last4,
        totalDue,
        minDue,
        dueDate: dueDate || new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        creditLimit: creditLimit || null,
        confidence: totalDue > 0 ? (last4 && dueDate ? 'HIGH' : 'MEDIUM') : 'LOW'
    };
}

/**
 * Searches and syncs credit card statements from user's connected Gmail account.
 */
async function syncStatements(userId) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const prefs = user.preferences || {};
    const sync = prefs.gmailSync;

    if (!sync || !sync.connected || !sync.tokens) {
        throw new Error('Gmail is not connected. Please connect your Google account first.');
    }

    const oauth2Client = createOAuth2Client(sync.customConfig);
    if (!oauth2Client) throw new Error('OAuth configuration missing');

    oauth2Client.setCredentials(sync.tokens);

    // Auto-refresh token if needed
    oauth2Client.on('tokens', async (newTokens) => {
        sync.tokens = { ...sync.tokens, ...newTokens };
        prefs.gmailSync = sync;
        user.preferences = prefs;
        await user.save();
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Targeted query for Indian and global bank credit card statements
    const query = 'from:(hdfcbank OR icicibank OR sbicard OR axisbank OR amex OR americanexpress OR onecard OR kotak OR rbl OR indusind OR standardchartered OR citi OR federal OR aubank OR hsbc) (statement OR "e-statement" OR "card statement" OR "credit card bill" OR "Total Amount Due")';

    const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 20
    });

    const messages = listRes.data.messages || [];
    const discoveredStatements = [];

    // Fetch existing credit cards to match
    const existingCards = await CreditCard.findAll({ where: { userId, isActive: true } });

    for (const msg of messages) {
        try {
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full'
            });

            const headers = detail.data.payload.headers || [];
            const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

            const subject = getHeader('Subject');
            const sender = getHeader('From');
            const dateStr = getHeader('Date');
            const emailDate = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

            const { text, html } = extractEmailContent(detail.data.payload);
            const parsed = parseCreditCardStatementEmail(subject, sender, text, html);

            if (parsed.totalDue > 0) {
                // Find matching card by last 4 or bank name
                let matchedCard = null;
                if (parsed.last4) {
                    matchedCard = existingCards.find(c => {
                        const num = c.cardNumber || '';
                        return num.endsWith(parsed.last4) || c.cardName.includes(parsed.last4);
                    });
                }
                if (!matchedCard) {
                    matchedCard = existingCards.find(c =>
                        c.bankName.toLowerCase().includes(parsed.bankName.toLowerCase()) ||
                        parsed.bankName.toLowerCase().includes(c.bankName.toLowerCase())
                    );
                }

                discoveredStatements.push({
                    messageId: msg.id,
                    subject,
                    sender,
                    emailDate,
                    bankName: parsed.bankName,
                    cardName: parsed.cardName,
                    last4: parsed.last4,
                    totalDue: parsed.totalDue,
                    minDue: parsed.minDue,
                    dueDate: parsed.dueDate,
                    creditLimit: parsed.creditLimit,
                    confidence: parsed.confidence,
                    matchedCardId: matchedCard ? matchedCard.id : null,
                    matchedCardName: matchedCard ? matchedCard.cardName : null,
                    matchedBankName: matchedCard ? matchedCard.bankName : null,
                    snippet: detail.data.snippet || ''
                });
            }
        } catch (msgErr) {
            console.warn(`[Gmail Sync] Failed to parse message ${msg.id}:`, msgErr.message);
        }
    }

    // Update last sync timestamp
    sync.lastSync = new Date().toISOString();
    prefs.gmailSync = sync;
    user.preferences = prefs;
    await user.save();

    console.log(`[Gmail Sync] Successfully synced ${discoveredStatements.length} statement emails for user ${user.username}`);

    return {
        success: true,
        count: discoveredStatements.length,
        statements: discoveredStatements,
        lastSync: sync.lastSync
    };
}

module.exports = {
    getAuthUrl,
    handleCallback,
    disconnect,
    getStatus,
    syncStatements
};
