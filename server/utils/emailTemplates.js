// Branded, email-client-safe HTML templates for PEM Pro.
//
// Built with nested tables, inline styles, and email-client-safe CSS to render
// beautifully across Gmail, Apple Mail, Outlook, Yahoo, and mobile clients.

const APP_NAME = 'PEM Pro';

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAmount(amount, currency = 'INR') {
    const n = Number(amount);
    if (!Number.isFinite(n)) return String(amount || '');
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 2
        }).format(n);
    } catch (e) {
        return `${currency || ''} ${n.toFixed(2)}`.trim();
    }
}

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    try {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return d.toISOString().slice(0, 10);
    }
}

/**
 * Wrap body content in an executive fintech shell.
 * @param {object} opts
 * @param {string} opts.heading
 * @param {string} [opts.subtitle]
 * @param {string} opts.contentHtml
 * @param {string} [opts.categoryTag]  Optional pill tag in header (e.g. 'Security Alert')
 * @param {string} [opts.accent]       Primary brand color (default #10b981)
 * @param {string} [opts.footerNote]
 */
function renderLayout({ heading, subtitle = '', contentHtml, categoryTag = '', accent = '#10b981', footerNote = '' }) {
    const year = new Date().getFullYear();
    const tagHtml = categoryTag
        ? `<div style="padding-bottom:12px;">
             <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;background:rgba(255,255,255,0.14);color:#ffffff;border:1px solid rgba(255,255,255,0.22);">${escapeHtml(categoryTag)}</span>
           </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(heading)}</title>
<!--[if mso]>
<style>
  table, td, p, a, span { font-family: Arial, sans-serif !important; }
</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:32px 14px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(15,23,42,0.06),0 0 1px 1px rgba(15,23,42,0.03);">
          
          <!-- Gradient Brand Accent Line -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#10b981 0%,#06b6d4 50%,#6366f1 100%);"></td>
          </tr>

          <!-- Header Banner -->
          <tr>
            <td style="background-color:#060b18;background-image:linear-gradient(145deg,#060b18 0%,#0c1427 60%,#09261f 100%);padding:28px 32px 30px 32px;border-bottom:1px solid rgba(255,255,255,0.08);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Brand Wordmark + Icon -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          <div style="width:36px;height:36px;line-height:36px;text-align:center;border-radius:10px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);box-shadow:0 2px 10px rgba(16,185,129,0.4);color:#ffffff;font-weight:900;font-size:17px;">&#9889;</div>
                        </td>
                        <td style="vertical-align:middle;padding-left:12px;">
                          <div style="font-size:18px;font-weight:900;letter-spacing:-0.4px;color:#ffffff;line-height:1;">
                            PEM <span style="color:#10b981;">PRO</span>
                          </div>
                          <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;padding-top:3px;">
                            Financial Intelligence
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top:22px;">
                    ${tagHtml}
                    <div style="font-size:22px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;line-height:1.25;">
                      ${escapeHtml(heading)}
                    </div>
                    ${subtitle ? `<div style="font-size:13px;color:#94a3b8;line-height:1.5;padding-top:6px;">${escapeHtml(subtitle)}</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content Area -->
          <tr>
            <td style="padding:32px 32px 16px 32px;color:#0f172a;font-size:14px;line-height:1.65;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="padding:20px 32px 32px 32px;background-color:#ffffff;">
              <div style="height:1px;background-color:#e2e8f0;margin-bottom:20px;"></div>
              
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;color:#64748b;line-height:1.6;">
                    ${footerNote ? `<div style="margin-bottom:6px;">${escapeHtml(footerNote)}</div>` : ''}
                    <div>This is an automated security &amp; financial notification from ${escapeHtml(APP_NAME)}. Please do not reply directly to this email.</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:14px;font-size:11px;color:#94a3b8;">
                    &copy; ${year} ${escapeHtml(APP_NAME)} &middot; Enterprise Personal Expense Management &middot; All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// A transaction is income when any of the common income markers are present.
function isIncomeTransaction(tx) {
    if (!tx) return false;
    return (
        tx.transaction_type === 'credit' ||
        tx.transaction_type === 'income' ||
        tx.type === 'income' ||
        tx.type === 'credit' ||
        tx.category_type === 'income'
    );
}

// Category Style Map with tailored executive color schemes
const CATEGORY_STYLES = {
    'Groceries': { color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
    'Food': { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    'Travel': { color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
    'Shopping': { color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
    'Utility': { color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
    'Subscription': { color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
    'Investment': { color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
    'Wallet': { color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
    'Medical': { color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
    'Insurance': { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    'Education': { color: '#713f12', bg: '#fefce8', border: '#fef08a' },
    'Fees & Charges': { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
    'Salary': { color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
    'Refund': { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
    'Bill Payment': { color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
    'General': { color: '#475569', bg: '#f8fafc', border: '#e2e8f0' }
};

function categoryBadge(category) {
    const norm = category || 'General';
    const style = CATEGORY_STYLES[norm] || CATEGORY_STYLES['General'];
    return `<span style="display:inline-block;background-color:${style.bg};color:${style.color};border:1px solid ${style.border};font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(norm)}</span>`;
}

function modeBadge(mode, paymentMethod) {
    const raw = String(paymentMethod || mode || 'OTHER').toUpperCase();
    let label = 'Payment';
    let bg = '#f1f5f9';
    let color = '#475569';
    let border = '#cbd5e1';

    if (raw.includes('UPI')) {
        label = 'UPI'; bg = '#f5f3ff'; color = '#6d28d9'; border = '#ddd6fe';
    } else if (raw.includes('CREDIT') || raw.includes('CARD')) {
        label = raw.includes('CREDIT') ? 'Credit Card' : 'Card'; bg = '#eef2ff'; color = '#4338ca'; border = '#c7d2fe';
    } else if (raw.includes('BANK') || raw.includes('TRANSFER') || raw.includes('NEFT') || raw.includes('IMPS')) {
        label = 'Bank Transfer'; bg = '#f0f9ff'; color = '#0369a1'; border = '#bae6fd';
    } else if (raw.includes('WALLET')) {
        label = 'Wallet'; bg = '#ecfeff'; color = '#0e7490'; border = '#a5f3fc';
    } else if (raw.includes('AUTOPAY') || raw.includes('MANDATE') || raw.includes('SUBSCRIPTION')) {
        label = 'AutoPay'; bg = '#fdf4ff'; color = '#a21caf'; border = '#f5d0fe';
    } else if (raw.includes('BILL')) {
        label = 'Bill'; bg = '#fff7ed'; color = '#c2410c'; border = '#fed7aa';
    }

    return `<span style="display:inline-block;background-color:${bg};color:${color};border:1px solid ${border};font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;letter-spacing:0.02em;">${escapeHtml(label)}</span>`;
}

// Telemetry Status Ribbon (matching Automation Inbox telemetry bar)
function telemetryStatusBar(pendingCount) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#090f1d;background-image:linear-gradient(135deg,#090f1d 0%,#0e172a 100%);border:1px solid rgba(255,255,255,0.1);border-radius:12px;margin:0 0 18px 0;box-shadow:0 3px 8px rgba(0,0,0,0.12);">
      <tr>
        <td style="padding:9px 14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:11px;color:#94a3b8;font-weight:600;line-height:1.4;">
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;margin-right:5px;vertical-align:middle;"></span>
                <span style="color:#ffffff;font-weight:700;">Node Gateway:</span> <span style="color:#10b981;font-weight:800;">ONLINE</span>
                &nbsp;&nbsp;&middot;&nbsp;&nbsp;
                <span style="color:#ffffff;font-weight:700;">Companion:</span> <span style="color:#38bdf8;font-weight:800;">SYNCED</span>
                &nbsp;&nbsp;&middot;&nbsp;&nbsp;
                <span style="color:#ffffff;font-weight:700;">AI Extractor:</span> <span style="color:#c084fc;font-weight:800;">ACTIVE</span>
              </td>
              <td align="right" style="font-size:11px;font-weight:800;color:#f59e0b;white-space:nowrap;padding-left:10px;">
                <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;">
                  ${pendingCount} Pending Review
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

// Executive KPI Summary Card
function kpiCard(label, value, countText, accentColor, bgTint, borderTint) {
    return `<td width="25%" valign="top" style="padding:0 3px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${bgTint};border:1px solid ${borderTint};border-radius:14px;box-shadow:0 2px 5px rgba(15,23,42,0.03);overflow:hidden;">
        <tr>
          <td style="height:3px;background-color:${accentColor};"></td>
        </tr>
        <tr>
          <td style="padding:12px 10px 11px 10px;">
            <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(label)}</div>
            <div style="font-size:16px;font-weight:900;color:${accentColor};padding-top:4px;line-height:1.2;font-feature-settings:'tnum';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(value)}</div>
            <div style="font-size:10px;font-weight:700;color:#94a3b8;padding-top:3px;white-space:nowrap;">${escapeHtml(countText)}</div>
          </td>
        </tr>
      </table>
    </td>`;
}

// Group Accordion Header (mirroring Automation Inbox groups)
function groupHeader(icon, title, count, totalFormatted, accentColor = '#334155') {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 10px 0;">
      <tr>
        <td style="font-size:13px;font-weight:800;color:#0f172a;letter-spacing:-0.2px;">
          <span style="font-size:14px;margin-right:6px;vertical-align:middle;">${icon}</span>
          <span style="vertical-align:middle;">${escapeHtml(title)}</span>
          <span style="display:inline-block;margin-left:8px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:800;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;vertical-align:middle;">
            ${count} ${count === 1 ? 'item' : 'items'}
          </span>
        </td>
        <td align="right" style="font-size:13px;font-weight:900;color:${accentColor};white-space:nowrap;font-feature-settings:'tnum';">
          ${totalFormatted ? escapeHtml(totalFormatted) : ''}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="height:2px;background:linear-gradient(90deg,${accentColor} 0%,#cbd5e1 70%,transparent 100%);opacity:0.35;padding-top:4px;"></td>
      </tr>
    </table>`;
}

function formatDateTime(value, timeValue) {
    if (!value) return '';
    const dateStr = formatDate(value);
    if (timeValue) {
        return `${dateStr} &middot; ${escapeHtml(timeValue)}`;
    }
    return dateStr;
}

// Rich Transaction Card matching SmsInboxRow in Automation.jsx
function txInboxCard(tx, currency, appUrl) {
    const isCredit = isIncomeTransaction(tx);
    const title = tx.merchant || tx.provider || tx.account || 'Unknown Merchant';
    const amountFormatted = `${isCredit ? '+' : '-'} ${formatAmount(tx.amount, currency)}`;
    const amountColor = isCredit ? '#059669' : '#e11d48';

    const accountPart = tx.accountMasked ? `A/c: ${escapeHtml(tx.accountMasked)}` : (tx.cardLast4 ? `Card ending ${escapeHtml(tx.cardLast4)}` : '');
    const bankPart = tx.bank ? `🏦 ${escapeHtml(tx.bank)}` : '';
    const refPart = tx.reference ? `Ref: ${escapeHtml(tx.reference)}` : '';
    const metaBadges = [bankPart, accountPart, refPart].filter(Boolean);

    const dateStr = formatDateTime(tx.date || tx.received_at, tx.time);
    const rawMessage = (tx.raw_message || '').trim();
    const rawPreview = rawMessage.length > 200 ? rawMessage.substring(0, 200) + '...' : rawMessage;

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(15,23,42,0.03);overflow:hidden;">
      <tr>
        <td style="padding:14px 16px;">
          <!-- Top Row: Title + Amount -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:15px;font-weight:800;color:#0f172a;line-height:1.25;">
                ${escapeHtml(title)}
              </td>
              <td align="right" style="font-size:16px;font-weight:900;color:${amountColor};white-space:nowrap;font-feature-settings:'tnum';">
                ${escapeHtml(amountFormatted)}
              </td>
            </tr>
          </table>

          <!-- Second Row: Badges Strip -->
          <div style="padding-top:8px;">
            ${categoryBadge(tx.category)}
            <span style="margin-left:5px;">${modeBadge(tx.mode, tx.paymentMethod)}</span>
            ${dateStr ? `<span style="font-size:11px;color:#64748b;font-weight:600;padding-left:8px;">📅 ${dateStr}</span>` : ''}
          </div>

          <!-- Third Row: Bank / Account / Reference Meta -->
          ${metaBadges.length > 0 ? `
          <div style="padding-top:6px;font-size:11px;color:#475569;font-weight:600;">
            ${metaBadges.join(' &nbsp;&middot;&nbsp; ')}
          </div>` : ''}

          <!-- Description if distinct -->
          ${tx.description && tx.description !== title && !tx.description.startsWith(title) ? `
          <div style="padding-top:4px;font-size:12px;color:#64748b;line-height:1.4;">
            ${escapeHtml(tx.description)}
          </div>` : ''}

          <!-- Fourth Row: Raw SMS Telemetry Box (like Automation Modal) -->
          ${rawPreview ? `
          <div style="margin-top:10px;padding:8px 10px;background-color:#f8fafc;border-left:3px solid #10b981;border-radius:6px;font-family:Consolas,Menlo,Monaco,monospace;font-size:11px;color:#475569;line-height:1.45;word-break:break-word;">
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:0.06em;margin-bottom:2px;">Original SMS Telemetry</div>
            &ldquo;${escapeHtml(rawPreview)}&rdquo;
          </div>` : ''}

          <!-- Action Link -->
          ${appUrl ? `
          <div style="padding-top:10px;text-align:right;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:5px 12px;border-radius:8px;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;font-size:11px;font-weight:800;text-decoration:none;letter-spacing:0.02em;">
              Review in Inbox &rarr;
            </a>
          </div>` : ''}
        </td>
      </tr>
    </table>`;
}

// Rich Bill / Scheduled AutoPay Card
function billInboxCard(b, currency, appUrl) {
    const title = b.merchant || b.providerName || b.provider || 'Scheduled Bill / Mandate';
    const due = formatDate(b.dueDate || b.date);
    const isAutoPay = b.isScheduledMandate || /autopay/i.test(b.description || b.raw_message || '');
    const badgeText = isAutoPay ? 'SCHEDULED AUTOPAY' : 'UPCOMING BILL DUE';
    const badgeBg = isAutoPay ? '#fdf4ff' : '#fff7ed';
    const badgeColor = isAutoPay ? '#a21caf' : '#c2410c';
    const badgeBorder = isAutoPay ? '#f5d0fe' : '#fed7aa';

    const accountPart = b.accountMasked ? `A/c: ${escapeHtml(b.accountMasked)}` : (b.cardLast4 ? `Card ending ${escapeHtml(b.cardLast4)}` : '');
    const bankPart = b.bank ? `🏦 ${escapeHtml(b.bank)}` : '';
    const refPart = b.reference ? `Ref: ${escapeHtml(b.reference)}` : '';
    const metaParts = [bankPart, accountPart, refPart].filter(Boolean).join(' &nbsp;&middot;&nbsp; ');

    const rawMessage = (b.raw_message || '').trim();
    const rawPreview = rawMessage.length > 200 ? rawMessage.substring(0, 200) + '...' : rawMessage;

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #fed7aa;border-left:4px solid ${isAutoPay ? '#a855f7' : '#f59e0b'};border-radius:14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(15,23,42,0.03);overflow:hidden;">
      <tr>
        <td style="padding:14px 16px;">
          <!-- Top Row: Title + Amount -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:15px;font-weight:800;color:#0f172a;line-height:1.25;">
                ${escapeHtml(title)}
              </td>
              <td align="right" style="font-size:16px;font-weight:900;color:${isAutoPay ? '#7e22ce' : '#d97706'};white-space:nowrap;font-feature-settings:'tnum';">
                ${escapeHtml(formatAmount(b.amount, currency))}
              </td>
            </tr>
          </table>

          <!-- Second Row: AutoPay / Bill Badges + Due Date -->
          <div style="padding-top:8px;">
            <span style="display:inline-block;background-color:${badgeBg};color:${badgeColor};border:1px solid ${badgeBorder};font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;letter-spacing:0.04em;">${badgeText}</span>
            ${due ? `<span style="display:inline-block;padding-left:8px;font-size:12px;font-weight:800;color:#0f172a;">📅 Due ${escapeHtml(due)}</span>` : ''}
          </div>

          <!-- Third Row: Account / Mandate Meta -->
          ${metaParts ? `
          <div style="padding-top:6px;font-size:11px;color:#475569;font-weight:600;">
            ${metaParts}
          </div>` : ''}

          <!-- Description -->
          ${b.description && b.description !== title ? `
          <div style="padding-top:4px;font-size:12px;color:#64748b;line-height:1.4;">
            ${escapeHtml(b.description)}
          </div>` : ''}

          <!-- Raw SMS Excerpt -->
          ${rawPreview ? `
          <div style="margin-top:10px;padding:8px 10px;background-color:#fffbeb;border-left:3px solid #f59e0b;border-radius:6px;font-family:Consolas,Menlo,Monaco,monospace;font-size:11px;color:#78350f;line-height:1.45;word-break:break-word;">
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#b45309;letter-spacing:0.06em;margin-bottom:2px;">Scheduled Mandate Telemetry</div>
            &ldquo;${escapeHtml(rawPreview)}&rdquo;
          </div>` : ''}

          <!-- Action Footer -->
          ${appUrl ? `
          <div style="padding-top:10px;text-align:right;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:5px 12px;border-radius:8px;background:#fef3c7;border:1px solid #fde68a;color:#92400e;font-size:11px;font-weight:800;text-decoration:none;letter-spacing:0.02em;">
              Manage Bill in Inbox &rarr;
            </a>
          </div>` : ''}
        </td>
      </tr>
    </table>`;
}

function alertInboxCard(n, appUrl) {
    const sevColour = n.severity === 'critical' ? '#be123c' : n.severity === 'warning' ? '#b45309' : '#4338ca';
    const sevBg = n.severity === 'critical' ? '#fff1f2' : n.severity === 'warning' ? '#fef3c7' : '#eef2ff';
    const sevBorder = n.severity === 'critical' ? '#fecdd3' : n.severity === 'warning' ? '#fde68a' : '#c7d2fe';
    const sevLabel = (n.severity || 'info').toUpperCase();

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-left:4px solid ${sevColour};border-radius:14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(15,23,42,0.03);overflow:hidden;">
      <tr>
        <td style="padding:14px 16px;">
          <div>
            <span style="display:inline-block;background-color:${sevBg};color:${sevColour};border:1px solid ${sevBorder};font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;letter-spacing:0.05em;">${escapeHtml(sevLabel)}</span>
            ${n.type ? `<span style="font-size:11px;font-weight:700;color:#64748b;padding-left:8px;">${escapeHtml(n.type)}</span>` : ''}
          </div>
          <div style="font-size:14px;font-weight:800;color:#0f172a;padding-top:6px;">${escapeHtml(n.title || 'Notification')}</div>
          ${n.body ? `<div style="font-size:12px;color:#64748b;padding-top:4px;line-height:1.5;">${escapeHtml(n.body)}</div>` : ''}
          ${appUrl ? `
          <div style="padding-top:8px;text-align:right;">
            <a href="${escapeHtml(appUrl)}" style="font-size:11px;font-weight:800;color:${sevColour};text-decoration:none;">
              View Alert &rarr;
            </a>
          </div>` : ''}
        </td>
      </tr>
    </table>`;
}

function emptyState(text) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:14px;margin-top:6px;">
      <tr><td style="padding:22px;text-align:center;font-size:13px;font-weight:600;color:#64748b;">${escapeHtml(text)}</td></tr>
    </table>`;
}

/**
 * Daily pending-items digest: unreviewed Automation inbox transactions
 * (split into upcoming bills/autopay, expenses & income) plus pending notifications.
 */
function pendingDigestEmail({ user = {}, transactions = [], notifications = [], expenses, income, summary, appUrl = '' }) {
    const currency = user.currency || 'INR';
    const name = user.fullName || user.username || 'there';

    // Grouping transactions chronologically (matching Automation.jsx groups)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000);

    const billList = [];
    const todayList = [];
    const weekList = [];
    const olderList = [];

    let totalExpense = 0;
    let totalIncome = 0;
    let totalBill = 0;

    for (const t of transactions) {
        const amt = Number(t.amount) || 0;
        if ((t.isBill === true || t.isScheduledMandate === true) && !t.isBillPaymentReceipt) {
            billList.push(t);
            totalBill += amt;
            continue;
        }

        if (isIncomeTransaction(t)) {
            totalIncome += amt;
        } else {
            totalExpense += amt;
        }

        const d = t.date ? new Date(t.date) : (t.received_at ? new Date(t.received_at) : null);
        if (!d || isNaN(d.getTime())) {
            olderList.push(t);
            continue;
        }
        if (d >= startOfToday) {
            todayList.push(t);
            continue;
        }
        if (d >= startOfWeek) {
            weekList.push(t);
            continue;
        }
        olderList.push(t);
    }

    const sum = (arr) => arr.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalPendingCount = transactions.length + notifications.length;

    const subject = totalPendingCount > 0
        ? `[${APP_NAME}] ${transactions.length} SMS pending approval &bull; ${billList.length} bills due`
        : `[${APP_NAME}] Your daily financial digest`;

    // 4 KPI Summary Cards
    const kpiSection = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 6px 0;">
      <tr>
        ${kpiCard('Expenses', formatAmount(totalExpense, currency), `${transactions.length - billList.length} unapproved`, '#e11d48', '#fff1f2', '#fecdd3')}
        ${kpiCard('Bills & AutoPay', formatAmount(totalBill, currency), `${billList.length} scheduled`, '#d97706', '#fffbeb', '#fde68a')}
        ${kpiCard('Income', formatAmount(totalIncome, currency), `${totalIncome > 0 ? formatAmount(totalIncome, currency) : '0 pending'}`, '#059669', '#ecfdf5', '#a7f3d0')}
        ${kpiCard('Alerts', String(notifications.length), 'Action needed', '#4f46e5', '#eef2ff', '#c7d2fe')}
      </tr>
    </table>`;

    // Group Sections
    const billSection = billList.length > 0
        ? `${groupHeader('📅', 'Bills & Scheduled AutoPay', billList.length, formatAmount(totalBill, currency), '#d97706')}
           ${billList.map(b => billInboxCard(b, currency, appUrl)).join('')}`
        : '';

    const todaySection = todayList.length > 0
        ? `${groupHeader('⚡', "Today's SMS Inbox Activity", todayList.length, formatAmount(sum(todayList), currency), '#059669')}
           ${todayList.map(t => txInboxCard(t, currency, appUrl)).join('')}`
        : '';

    const weekSection = weekList.length > 0
        ? `${groupHeader('🗓️', 'Past 7 Days Transactions', weekList.length, formatAmount(sum(weekList), currency), '#0284c7')}
           ${weekList.map(t => txInboxCard(t, currency, appUrl)).join('')}`
        : '';

    const olderSection = olderList.length > 0
        ? `${groupHeader('📦', 'Older Unreviewed Transactions', olderList.length, formatAmount(sum(olderList), currency), '#64748b')}
           ${olderList.map(t => txInboxCard(t, currency, appUrl)).join('')}`
        : '';

    const notificationSection = notifications.length > 0
        ? `${groupHeader('🔔', 'Important System Alerts', notifications.length, '', '#4f46e5')}
           ${notifications.map(n => alertInboxCard(n, appUrl)).join('')}`
        : '';

    const noItemsBlock = transactions.length === 0 && notifications.length === 0
        ? `${groupHeader('✨', 'Ledger Status', 0, '', '#10b981')}${emptyState('Inbox zero! No pending SMS transactions or alerts — your ledger is completely up to date.')}`
        : '';

    const ctaButton = appUrl ? `
      <div style="text-align:center;margin:32px 0 10px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr>
            <td style="border-radius:12px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);box-shadow:0 4px 14px rgba(16,185,129,0.35);">
              <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:14px 34px;color:#ffffff;font-size:14px;font-weight:900;text-decoration:none;letter-spacing:0.02em;">
                ⚡ Open SMS Approval Inbox (${transactions.length} Items) &rarr;
              </a>
            </td>
          </tr>
        </table>
        <div style="font-size:11px;color:#94a3b8;font-weight:600;padding-top:8px;">
          Review merchant details, edit categories, or approve all with 1-click
        </div>
      </div>` : '';

    const contentHtml = `
      ${telemetryStatusBar(transactions.length)}
      
      <p style="margin:0 0 16px 0;font-size:15px;color:#1e293b;line-height:1.6;">
        Hi <strong>${escapeHtml(name)}</strong>, here is your real-time approval digest for transactions received via your automated companion feed:
      </p>

      ${kpiSection}
      ${billSection}
      ${todaySection}
      ${weekSection}
      ${olderSection}
      ${notificationSection}
      ${noItemsBlock}
      ${ctaButton}

      <p style="margin:26px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
        You are receiving this summary because automated email digests are enabled. You can adjust frequency or notification preferences under Automation &rarr; Email Digest.
      </p>
    `;

    const html = renderLayout({
        heading: 'SMS Approval Inbox Digest',
        subtitle: `${transactions.length} transaction(s) awaiting review &middot; ${billList.length} bill(s) scheduled &middot; Real-time companion sync`,
        categoryTag: 'Inbox Digest',
        contentHtml,
        accent: '#10b981'
    });

    const textLines = [
        `Hi ${name},`,
        '',
        `SMS Approval Inbox Digest (${transactions.length} items awaiting review):`,
        '',
        billList.length ? `Upcoming Bills & AutoPay (${billList.length}): ${formatAmount(totalBill, currency)}` : '',
        ...billList.map((b) => `  - [${b.isScheduledMandate ? 'AUTOPAY' : 'BILL'}] ${b.merchant || b.providerName || 'Unknown'}  ${formatAmount(b.amount, currency)}  (Due: ${formatDate(b.dueDate || b.date)})`),
        '',
        todayList.length ? `Today's SMS Transactions (${todayList.length}): ${formatAmount(sum(todayList), currency)}` : '',
        ...todayList.map((t) => `  - ${t.merchant || t.provider || 'Unknown'}  ${formatAmount(t.amount, currency)}  (${t.category || 'General'} | ${t.paymentMethod || t.mode || 'UPI'})  ${formatDateTime(t.date || t.received_at, t.time)}`),
        '',
        weekList.length ? `Past 7 Days Transactions (${weekList.length}): ${formatAmount(sum(weekList), currency)}` : '',
        ...weekList.map((t) => `  - ${t.merchant || t.provider || 'Unknown'}  ${formatAmount(t.amount, currency)}  (${t.category || 'General'} | ${t.paymentMethod || t.mode || 'UPI'})  ${formatDateTime(t.date || t.received_at, t.time)}`),
        '',
        olderList.length ? `Older Transactions (${olderList.length}): ${formatAmount(sum(olderList), currency)}` : '',
        ...olderList.map((t) => `  - ${t.merchant || t.provider || 'Unknown'}  ${formatAmount(t.amount, currency)}  (${t.category || 'General'})  ${formatDateTime(t.date || t.received_at, t.time)}`),
        '',
        notifications.length ? `System Notifications (${notifications.length}):` : '',
        ...notifications.map((n) => `  - [${(n.severity || 'info').toUpperCase()}] ${n.title || 'Notification'}${n.body ? ': ' + n.body : ''}`),
        '',
        appUrl ? `Open SMS Approval Inbox: ${appUrl}` : ''
    ].filter(Boolean);

    return { subject, html, text: textLines.join('\n') };
}

/**
 * OTP / recovery code email.
 */
function otpEmail({ code, label, ttlMinutes = 10 }) {
    const subject = `${APP_NAME} — Verification Code for ${label}`;
    const contentHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;color:#1e293b;line-height:1.6;">
        A request was made to perform <strong>${escapeHtml(label)}</strong> on your ${escapeHtml(APP_NAME)} account.
      </p>

      <div style="text-align:center;margin:24px 0 24px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;background-color:#f0fdf4;border:2px solid #86efac;border-radius:16px;box-shadow:0 4px 16px rgba(16,185,129,0.12);">
          <tr>
            <td style="padding:20px 36px;text-align:center;">
              <div style="font-size:10px;font-weight:800;color:#047857;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">One-Time Verification Passcode</div>
              <div style="font-size:38px;font-weight:900;letter-spacing:10px;color:#064e3b;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,Courier,monospace;line-height:1;">
                ${escapeHtml(code)}
              </div>
            </td>
          </tr>
        </table>
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:20px 0 20px 0;">
        <tr>
          <td style="padding:14px 16px;font-size:13px;color:#475569;line-height:1.5;">
            <strong style="color:#0f172a;">Time-sensitive:</strong> This code is valid for <strong>${escapeHtml(ttlMinutes)} minutes</strong> and can only be used once. Never share this code with anyone.
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
        If you did not request this verification code, please ignore this email. No changes will be applied to your account without this passcode.
      </p>
    `;

    const html = renderLayout({
        heading: `Your ${label} Code`,
        subtitle: 'Security verification requested for your account',
        categoryTag: 'Verification Code',
        contentHtml,
        accent: '#10b981'
    });

    const text = [
        `Your ${APP_NAME} ${label.toLowerCase()} code is: ${code}`,
        '',
        `This code expires in ${ttlMinutes} minutes.`,
        'Keep this code secret. Never share it with anyone.',
        'If you did not request this, you can safely ignore this email.'
    ].join('\n');

    return { subject, html, text };
}

function infoRow(label, value) {
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:700;color:#64748b;width:140px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;text-align:right;">${escapeHtml(value || '—')}</td>
    </tr>`;
}

/**
 * Login-alert email: sent on every successful sign-in, with an emphasised
 * warning when the device/browser has never signed in before.
 */
function loginAlertEmail({ user = {}, ip = '', device = '', browser = '', os = '', method = 'password', time = new Date(), isNewDevice = false, appUrl = '' }) {
    const name = user.fullName || user.username || 'there';
    let when = String(time);
    try {
        when = new Date(time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { /* keep raw */ }

    const sevColour = isNewDevice ? '#be123c' : '#047857';
    const sevBg = isNewDevice ? '#fff1f2' : '#f0fdf4';
    const sevBorder = isNewDevice ? '#fecdd3' : '#86efac';

    const subject = isNewDevice
        ? `[Security Alert] New device sign-in to your ${APP_NAME} account`
        : `[Security Notice] New sign-in to your ${APP_NAME} account`;

    const badge = `<div style="margin:0 0 20px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${sevBg};border:1px solid ${sevBorder};border-radius:12px;">
          <tr>
            <td style="padding:12px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:18px;vertical-align:middle;padding-right:10px;">${isNewDevice ? '&#9888;&#65039;' : '&#9989;'}</td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:12px;font-weight:800;color:${sevColour};text-transform:uppercase;letter-spacing:0.06em;">
                      ${isNewDevice ? 'New / Unrecognized Device Detected' : 'Recognized Device Sign-in'}
                    </div>
                    <div style="font-size:12px;color:#334155;padding-top:2px;">
                      ${isNewDevice ? 'A sign-in occurred from a device that hasn’t accessed your account before.' : 'A successful sign-in was verified for your account.'}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`;

    const infoTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin:16px 0 22px 0;">
        ${infoRow('Sign-in Time', when)}
        ${infoRow('Device & Model', device || `${browser || 'Browser'} on ${os || 'OS'}`)}
        ${infoRow('Web Browser', browser)}
        ${infoRow('Operating System', os)}
        ${infoRow('IP Address', ip)}
        ${infoRow('Authentication', method)}
      </table>`;

    const warning = isNewDevice
        ? `<div style="background-color:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;padding:12px 14px;margin-bottom:18px;">
             <p style="margin:0 0 4px 0;font-size:13px;color:#991b1b;font-weight:800;">Don't recognize this activity?</p>
             <p style="margin:0;font-size:12px;color:#7f1d1d;line-height:1.5;">
               If this wasn't you, someone may know your credentials. Reset your password immediately and review active sessions in Profile Settings.
             </p>
           </div>`
        : `<p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">
             If this sign-in was initiated by you, no further action is required.
           </p>`;

    const cta = appUrl
        ? `<div style="text-align:center;margin:28px 0 8px 0;">
             <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
               <tr>
                 <td style="border-radius:12px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);box-shadow:0 4px 14px rgba(15,23,42,0.25);">
                   <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:13px 30px;color:#ffffff;font-size:13px;font-weight:800;text-decoration:none;letter-spacing:0.02em;">
                     Review Account Security &rarr;
                   </a>
                 </td>
               </tr>
             </table>
           </div>`
        : '';

    const contentHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;color:#1e293b;line-height:1.6;">
        Hi <strong>${escapeHtml(name)}</strong>, a new sign-in was recorded for your account.
      </p>

      ${badge}
      ${infoTable}
      ${warning}
      ${cta}
    `;

    const html = renderLayout({
        heading: isNewDevice ? 'New Device Sign-in Alert' : 'Successful Sign-in Notice',
        subtitle: `Security notification for ${name}`,
        categoryTag: 'Security Alert',
        contentHtml,
        accent: isNewDevice ? '#e11d48' : '#10b981'
    });

    const text = [
        `Hi ${name},`,
        '',
        `A sign-in to your ${APP_NAME} account just succeeded.`,
        `Status:  ${isNewDevice ? 'New device' : 'Recognized device'}`,
        `Time:    ${when}`,
        `Device:  ${device || 'Unknown'}`,
        `Browser: ${browser || 'Unknown'}`,
        `OS:      ${os || 'Unknown'}`,
        `IP:      ${ip || 'Unknown'}`,
        `Method:  ${method}`,
        '',
        isNewDevice ? "If this wasn't you, reset your password immediately." : 'If this was you, no action is needed.',
        appUrl ? `Review Security: ${appUrl}` : ''
    ].join('\n');

    return { subject, html, text };
}

/**
 * Test email confirming SMTP configuration works.
 */
function testEmail({ to, host = '', port = '', source = 'settings' }) {
    const subject = `[${APP_NAME}] SMTP Outbound Email Verified`;
    const now = new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' });

    const contentHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;color:#1e293b;line-height:1.6;">
        Congratulations! Your outbound email service is successfully configured and communicating with ${escapeHtml(APP_NAME)}.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0fdf4;border:1px solid #86efac;border-radius:14px;margin:16px 0 20px 0;">
        <tr>
          <td style="padding:16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:24px;vertical-align:middle;padding-right:12px;">&#9989;</td>
                <td style="vertical-align:middle;">
                  <div style="font-size:13px;font-weight:800;color:#047857;text-transform:uppercase;letter-spacing:0.06em;">
                    SMTP Outbound Channel Active
                  </div>
                  <div style="font-size:12px;color:#14532d;padding-top:2px;">
                    Password reset OTPs, security login alerts, and pending digests can now be delivered directly to user inboxes.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin:16px 0 22px 0;">
        ${infoRow('Recipient', to)}
        ${infoRow('SMTP Host', host || 'Active')}
        ${infoRow('SMTP Port', String(port || '587'))}
        ${infoRow('Configuration Source', source === 'settings' ? 'Admin Profile Settings' : 'Environment')}
        ${infoRow('Verification Timestamp', now)}
      </table>

      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
        This test message confirms end-to-end transport encryption, credentials validation, and template rendering.
      </p>
    `;

    const html = renderLayout({
        heading: 'Outbound Email Operational',
        subtitle: 'System test message confirming mail service status',
        categoryTag: 'System Test',
        contentHtml,
        accent: '#10b981'
    });

    const text = [
        `[${APP_NAME}] SMTP Outbound Email Verified`,
        '',
        `Recipient: ${to}`,
        `Host: ${host}:${port}`,
        `Verified at: ${now}`,
        '',
        'Your outbound mail delivery is operational.'
    ].join('\n');

    return { subject, html, text };
}

module.exports = {
    escapeHtml,
    formatAmount,
    formatDate,
    isIncomeTransaction,
    renderLayout,
    otpEmail,
    pendingDigestEmail,
    loginAlertEmail,
    testEmail
};
