// Email delivery for one-time passcodes (OTP) and recovery links.
//
// Config resolution order:
//   1. Admin-configured settings (data/system_settings.json -> mail), set from
//      the Profile UI. The SMTP password is stored encrypted (utils/secretBox).
//   2. Environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM).
//
// When neither is usable the mailer falls back to logging the message to the
// server console so the recovery flow stays testable without credentials.

const nodemailer = require('nodemailer');
const { getMailSettings } = require('./settings');
const secretBox = require('./secretBox');
const templates = require('./emailTemplates');

let transporter = null;
let cachedSignature = null;

// Treat obvious template values as "not configured" so the dev log fallback
// stays active until real credentials are supplied.
function looksLikePlaceholder(value) {
    if (!value) return true;
    return /your_|app_password|example\.com|_here|changeme|placeholder/i.test(value);
}

// Resolve the effective SMTP config. The admin-configured settings file takes
// precedence; otherwise we fall back to environment variables.
function resolveConfig() {
    // 1) Admin-configured settings (stored encrypted).
    let mail;
    try {
        mail = getMailSettings();
    } catch (e) {
        mail = null;
    }

    if (mail && mail.enabled && mail.host && mail.user) {
        let pass = '';
        if (mail.smtpPassEnc) {
            try {
                pass = secretBox.decrypt(mail.smtpPassEnc) || '';
            } catch (e) {
                console.error('[MAILER] Failed to decrypt stored SMTP password:', e.message);
                pass = '';
            }
        }
        return {
            source: 'settings',
            host: mail.host,
            port: parseInt(mail.port, 10) || 587,
            secure: Boolean(mail.secure),
            user: mail.user,
            pass,
            from: mail.from || mail.user
        };
    }

    // 2) Environment fallback.
    const envHost = process.env.SMTP_HOST;
    const envUser = process.env.SMTP_USER;
    const envPass = process.env.SMTP_PASS;
    if (envHost && !looksLikePlaceholder(envHost) && envUser && !looksLikePlaceholder(envUser) && envPass && !looksLikePlaceholder(envPass)) {
        const port = parseInt(process.env.SMTP_PORT, 10) || 587;
        const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
        return {
            source: 'env',
            host: envHost,
            port,
            secure,
            user: envUser,
            pass: envPass,
            from: process.env.MAIL_FROM || envUser
        };
    }

    return null;
}

function isConfigured() {
    return Boolean(resolveConfig());
}

// A description of where mail config comes from (for the admin UI).
function getStatus() {
    const cfg = resolveConfig();
    if (!cfg) return { configured: false, source: null };
    return { configured: true, source: cfg.source, user: cfg.user, host: cfg.host };
}

// Invalidate the cached transporter so the next send picks up new settings.
function invalidate() {
    transporter = null;
    cachedSignature = null;
}

// Surface a message in the server log when real delivery is unavailable.
// In production the body (which may contain an OTP) is redacted — logs are
// readable via admin endpoints and must never accumulate live codes.
function logToConsole(to, subject, body, why) {
    console.log(`\n[MAILER][DEV] --- Outbound email not delivered (${why}) ---`);
    console.log(`[MAILER][DEV] To:      ${to}`);
    console.log(`[MAILER][DEV] Subject: ${subject}`);
    if (process.env.NODE_ENV === 'production') {
        console.log('[MAILER][DEV] Body:    <redacted in production>');
    } else {
        console.log(`[MAILER][DEV] Body:\n${body || ''}`);
    }
    console.log('[MAILER][DEV] ------------------------------------------------\n');
}

function getTransporter() {
    const cfg = resolveConfig();
    if (!cfg) {
        invalidate();
        console.warn('[MAILER] SMTP not configured. OTP emails will be logged to the console (dev mode).');
        return { transporter: null, cfg: null };
    }

    const signature = `${cfg.source}|${cfg.host}|${cfg.port}|${cfg.secure}|${cfg.user}|${cfg.pass}|${cfg.from}`;
    if (!transporter || cachedSignature !== signature) {
        transporter = nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined
        });
        cachedSignature = signature;
    }
    return { transporter, cfg };
}

/**
 * Build a friendly From header. When the configured value already contains a
 * display name ("Name <addr>") it is used verbatim; otherwise the brand name
 * is prepended so recipients see "PEM Pro <addr>" instead of a bare address.
 */
function fromHeader(cfg) {
    const raw = (cfg && cfg.from) || (cfg && cfg.user) || 'no-reply@pem.local';
    if (/<[^>]+>/.test(raw)) return raw;
    return `PEM Pro <${raw}>`;
}

/** Pull the bare email address out of a "Name <addr>" header. */
function extractAddress(value) {
    if (!value) return '';
    const m = String(value).match(/<([^>]+)>/);
    return m ? m[1].trim() : String(value).trim();
}

/**
 * Send an arbitrary email. Never throws on delivery failure; resolves with
 * { delivered: boolean } so callers can keep responses generic.
 *
 * @param {object} opts
 * @param {string} [opts.replyTo]           Reply-To address.
 * @param {string[]} [opts.listUnsubscribe] List-Unsubscribe targets (mailto:/https:).
 * @param {object} [opts.headers]           Extra MIME headers.
 */
async function sendMail({ to, subject, text, html, replyTo, listUnsubscribe, headers }) {
    if (!to) return { delivered: false, reason: 'missing recipient' };

    const { transporter: tx, cfg } = getTransporter();

    if (!tx) {
        // Dev fallback: surface the message in the server log.
        logToConsole(to, subject, text || html, 'SMTP not configured');
        return { delivered: false, reason: 'smtp-not-configured', logged: true };
    }

    const finalHeaders = {
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        ...(headers || {})
    };

    const message = {
        from: fromHeader(cfg),
        to,
        subject,
        text,
        html,
        headers: finalHeaders
    };
    if (replyTo) message.replyTo = replyTo;
    if (listUnsubscribe && listUnsubscribe.length) {
        // nodemailer adds List-Unsubscribe + List-Unsubscribe-Post (one-click).
        message.list = { unsubscribe: listUnsubscribe };
    }

    try {
        const info = await tx.sendMail(message);
        return { delivered: true, messageId: info.messageId, source: cfg.source };
    } catch (error) {
        console.error('[MAILER] Failed to send email:', error.message);
        // Never strand the user: log the body so the OTP is still recoverable.
        logToConsole(to, subject, text || html, `send failed: ${error.message}`);
        return { delivered: false, reason: error.message, logged: true };
    }
}

function purposeLabel(purpose) {
    switch (purpose) {
        case 'username_recovery':
            return 'Account username recovery';
        case 'recovery_check':
            return 'Recovery test';
        case 'password_reset':
        default:
            return 'Password reset';
    }
}

/**
 * Send a 6-digit OTP to the given address.
 */
async function sendOtpEmail(to, code, purpose = 'password_reset', ttlMinutes = 10) {
    const label = purposeLabel(purpose);
    const { subject, html, text } = templates.otpEmail({
        code,
        label,
        ttlMinutes
    });

    return sendMail({
        to,
        subject,
        text,
        html,
        headers: { 'Auto-Submitted': 'auto-generated' }
    });
}

/**
 * Send a login-alert email. Non-blocking callers should attach a .catch().
 * @param {object} opts
 * @param {string} opts.to
 * @param {object} opts.user
 * @param {string} [opts.ip]
 * @param {string} [opts.device]
 * @param {string} [opts.browser]
 * @param {string} [opts.os]
 * @param {string} [opts.method]
 * @param {Date}   [opts.time]
 * @param {boolean}[opts.isNewDevice]
 * @param {string} [opts.appUrl]
 */
async function sendLoginAlert({ to, user, ip, device, browser, os, method, time, isNewDevice, appUrl }) {
    const { subject, html, text } = templates.loginAlertEmail({
        user,
        ip,
        device,
        browser,
        os,
        method,
        time,
        isNewDevice,
        appUrl
    });

    return sendMail({
        to,
        subject,
        text,
        html,
        headers: { 'Auto-Submitted': 'auto-generated' }
    });
}

/**
 * Send the pending-items digest email (Automation inbox transactions +
 * pending notifications). Adds bulk-sender friendly headers to improve inbox
 * placement and provide a one-click unsubscribe.
 *
 * @param {object} opts
 * @param {string} opts.to              Recipient address.
 * @param {object} opts.user            User record (for name + currency).
 * @param {Array}  opts.transactions    Pending transactions.
 * @param {Array}  opts.notifications   Pending alerts.
 * @param {string} [opts.appUrl]        Link to the Automation inbox.
 * @param {string} [opts.unsubscribeTo] Mailto: target for unsubscribe.
 */
async function sendPendingDigest({ to, user, transactions = [], expenses, income, notifications = [], summary, appUrl = '', unsubscribeTo = '' }) {
    const { subject, html, text } = templates.pendingDigestEmail({
        user,
        transactions,
        expenses,
        income,
        notifications,
        summary,
        appUrl
    });

    const cfg = resolveConfig();
    const fromAddr = cfg ? extractAddress(fromHeader(cfg)) : '';
    const listUnsubscribe = unsubscribeTo
        ? [`<mailto:${unsubscribeTo}?subject=unsubscribe>`]
        : (fromAddr ? [`<mailto:${fromAddr}?subject=unsubscribe>`] : undefined);

    return sendMail({
        to,
        subject,
        text,
        html,
        listUnsubscribe,
        headers: {
            'Auto-Submitted': 'auto-generated',
            'X-Entity-Ref-ID': `pem-digest-${Date.now()}`
        }
    });
}

/**
 * Send an outbound test verification email.
 */
async function sendTestEmail(to) {
    const status = getStatus();
    const cfg = resolveConfig();
    const { subject, html, text } = templates.testEmail({
        to,
        host: (cfg && cfg.host) || status.host || '',
        port: (cfg && cfg.port) || 587,
        source: status.source || 'settings'
    });

    return sendMail({
        to,
        subject,
        text,
        html,
        headers: { 'Auto-Submitted': 'auto-generated' }
    });
}

module.exports = {
    sendMail,
    sendOtpEmail,
    sendLoginAlert,
    sendPendingDigest,
    sendTestEmail,
    isConfigured,
    getStatus,
    invalidate
};
