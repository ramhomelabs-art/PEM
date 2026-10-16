// Branded, email-client-safe HTML templates.
//
// Emails are built with nested tables and inline styles (no <style> blocks,
// flexbox or grid) so they render consistently across Gmail, Outlook and
// mobile clients. A solid background colour is paired with a CSS gradient so
// clients that strip gradients still show a clean brand colour.

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
 * Wrap body content in the branded gradient shell.
 * @param {object} opts
 * @param {string} opts.heading
 * @param {string} [opts.subtitle]
 * @param {string} opts.contentHtml
 * @param {string} [opts.accent]   Accent colour for the header gradient.
 * @param {string} [opts.footerNote]
 */
function renderLayout({ heading, subtitle = '', contentHtml, accent = '#10b981', footerNote = '' }) {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:${accent};background-image:linear-gradient(135deg,${accent} 0%,#4f46e5 100%);padding:26px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#ffffff;">
                    <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:9px;background:rgba(255,255,255,0.18);margin-right:10px;font-size:16px;">&#128176;</span>
                    ${escapeHtml(APP_NAME)}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:14px;font-size:22px;font-weight:800;color:#ffffff;line-height:1.25;">${escapeHtml(heading)}</td>
                </tr>
                ${subtitle ? `<tr><td style="padding-top:6px;font-size:13px;color:rgba(255,255,255,0.85);line-height:1.5;">${escapeHtml(subtitle)}</td></tr>` : ''}
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 30px 8px 30px;color:#0f172a;font-size:14px;line-height:1.6;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:18px 30px 28px 30px;">
              <div style="height:1px;background-color:#e2e8f0;margin-bottom:16px;"></div>
              <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
                ${footerNote ? escapeHtml(footerNote) + '<br/>' : ''}
                This is an automated message from ${escapeHtml(APP_NAME)}. Please do not reply directly to this address.
              </p>
              <p style="margin:10px 0 0 0;font-size:11px;color:#94a3b8;">
                &copy; ${year} ${escapeHtml(APP_NAME)} &middot; Personal Expense Manager
              </p>
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

// A summary card used in the digest header (Expenses / Income / Notifications).
function statCard(label, value, colour, sub) {
    return `<td width="33%" valign="top" style="padding:0 5px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
        <tr>
          <td style="padding:14px 14px 12px 14px;">
            <div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(label)}</div>
            <div style="font-size:19px;font-weight:800;color:${colour};padding-top:5px;line-height:1.2;">${escapeHtml(value)}</div>
            ${sub ? `<div style="font-size:11px;color:#94a3b8;padding-top:3px;">${escapeHtml(sub)}</div>` : ''}
          </td>
        </tr>
      </table>
    </td>`;
}

function txRow(tx, currency, income) {
    const title = tx.merchant || tx.provider || tx.account || 'Unknown merchant';
    const metaBits = [tx.category || 'General', tx.paymentMethod || tx.mode, formatDate(tx.date || tx.received_at)]
        .filter(Boolean)
        .map((v) => escapeHtml(v))
        .join(' &nbsp;&middot;&nbsp; ');
    const colour = income ? '#059669' : '#dc2626';
    const pill = income ? '#dcfce7' : '#fee2e2';
    return `<tr>
      <td style="padding:11px 0;border-bottom:1px solid #eef2f7;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(title)}</td>
            <td align="right" style="font-size:14px;font-weight:800;color:${colour};white-space:nowrap;">${income ? '+' : '-'} ${escapeHtml(formatAmount(tx.amount, currency))}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:3px;">
              <span style="display:inline-block;background-color:${pill};color:${colour};font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;">${income ? 'INCOME' : 'EXPENSE'}</span>
              <span style="font-size:12px;color:#64748b;padding-left:6px;">${metaBits}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function notificationRow(n) {
    const sevColour = n.severity === 'critical' ? '#dc2626' : n.severity === 'warning' ? '#d97706' : '#4f46e5';
    const sevBg = n.severity === 'critical' ? '#fee2e2' : n.severity === 'warning' ? '#fef3c7' : '#e0e7ff';
    const sevLabel = (n.severity || 'info').toUpperCase();
    const body = n.body ? `<div style="font-size:12px;color:#64748b;padding-top:3px;line-height:1.5;">${escapeHtml(n.body)}</div>` : '';
    return `<tr>
      <td style="padding:11px 0;border-bottom:1px solid #eef2f7;">
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(n.title || 'Notification')}</div>
        <div style="padding-top:3px;">
          <span style="display:inline-block;background-color:${sevBg};color:${sevColour};font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;">${escapeHtml(sevLabel)}</span>
          ${n.type ? `<span style="font-size:11px;color:#94a3b8;padding-left:6px;">${escapeHtml(n.type)}</span>` : ''}
        </div>
        ${body}
      </td>
    </tr>`;
}

function sectionTitle(text, colour = '#334155', trailing = '') {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 2px 0;">
      <tr>
        <td style="font-size:12px;font-weight:800;color:${colour};text-transform:uppercase;letter-spacing:0.07em;border-bottom:2px solid ${colour};padding-bottom:6px;">${escapeHtml(text)}</td>
        <td align="right" style="font-size:12px;font-weight:800;color:${colour};border-bottom:2px solid ${colour};padding-bottom:6px;white-space:nowrap;">${trailing ? escapeHtml(trailing) : ''}</td>
      </tr>
    </table>`;
}

function emptyState(text) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;">
      <tr><td style="padding:18px;text-align:center;font-size:13px;color:#94a3b8;">${escapeHtml(text)}</td></tr>
    </table>`;
}

/**
 * OTP / recovery code email.
 */
function otpEmail({ code, label, ttlMinutes = 10 }) {
    const subject = `${APP_NAME} – Your ${label} code`;
    const contentHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;color:#334155;">Use the verification code below to continue with <strong>${escapeHtml(label)}</strong>:</p>
      <div style="text-align:center;margin:8px 0 20px 0;">
        <div style="display:inline-block;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px 26px;">
          <span style="font-size:34px;font-weight:800;letter-spacing:8px;color:#0f172a;font-family:'Courier New',Courier,monospace;">${escapeHtml(code)}</span>
        </div>
      </div>
      <p style="margin:0 0 8px 0;font-size:13px;color:#334155;">This code expires in <strong>${escapeHtml(ttlMinutes)} minutes</strong>.</p>
      <p style="margin:0;font-size:12px;color:#94a3b8;">If you did not request this code you can safely ignore this email — no action is required and your account remains secure.</p>
    `;
    const html = renderLayout({
        heading: `Your ${label} code`,
        subtitle: 'Keep this code private. Never share it with anyone.',
        contentHtml,
        accent: '#059669'
    });
    const text = [
        `Your ${APP_NAME} ${label.toLowerCase()} code is: ${code}`,
        '',
        `This code expires in ${ttlMinutes} minutes.`,
        'If you did not request this, you can safely ignore this email.'
    ].join('\n');
    return { subject, html, text };
}

/**
 * Daily pending-items digest: unreviewed Automation inbox transactions
 * (split into expenses & income) plus pending notifications.
 */
function pendingDigestEmail({ user = {}, transactions = [], notifications = [], expenses, income, summary, appUrl = '' }) {
    const currency = user.currency || 'INR';
    const name = user.fullName || user.username || 'there';

    // Allow callers to pass pre-split arrays; otherwise derive them here.
    const expenseList = Array.isArray(expenses) ? expenses : transactions.filter((t) => !isIncomeTransaction(t));
    const incomeList = Array.isArray(income) ? income : transactions.filter(isIncomeTransaction);
    const sum = (arr) => arr.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expenseTotal = summary && Number.isFinite(summary.expenseTotal) ? summary.expenseTotal : sum(expenseList);
    const incomeTotal = summary && Number.isFinite(summary.incomeTotal) ? summary.incomeTotal : sum(incomeList);

    const total = transactions.length + notifications.length;
    const subject = total > 0
        ? `You have ${total} pending item(s) to review`
        : 'Your pending items summary';

    const summaryCards = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 2px 0;">
      <tr>
        ${statCard('Pending expenses', formatAmount(expenseTotal, currency), '#dc2626', `${expenseList.length} item(s)`)}
        ${statCard('Pending income', formatAmount(incomeTotal, currency), '#059669', `${incomeList.length} item(s)`)}
        ${statCard('Notifications', String(notifications.length), '#4f46e5', 'awaiting review')}
      </tr>
    </table>`;

    const expenseSection = expenseList.length
        ? `${sectionTitle(`Expenses (${expenseList.length})`, '#dc2626', formatAmount(expenseTotal, currency))}
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${expenseList.map((t) => txRow(t, currency, false)).join('')}</table>`
        : '';

    const incomeSection = incomeList.length
        ? `${sectionTitle(`Income (${incomeList.length})`, '#059669', formatAmount(incomeTotal, currency))}
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${incomeList.map((t) => txRow(t, currency, true)).join('')}</table>`
        : '';

    const notificationSection = notifications.length
        ? `${sectionTitle(`Notifications (${notifications.length})`, '#4f46e5')}
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${notifications.map(notificationRow).join('')}</table>`
        : '';

    const noTransactionsBlock = transactions.length === 0
        ? `${sectionTitle('Transactions', '#334155')}${emptyState('No pending transactions — nice work!')}`
        : '';

    const cta = appUrl
        ? `<div style="text-align:center;margin:30px 0 4px 0;">
             <a href="${escapeHtml(appUrl)}" style="display:inline-block;background-color:#10b981;background-image:linear-gradient(135deg,#10b981 0%,#4f46e5 100%);color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:14px 30px;border-radius:12px;">Open Automation Inbox</a>
           </div>`
        : '';

    const contentHtml = `
      <p style="margin:0 0 18px 0;font-size:15px;color:#334155;line-height:1.6;">Hi ${escapeHtml(name)}, here is everything still waiting for your review. Approve or dismiss these items to keep your ledger in sync.</p>
      ${summaryCards}
      ${expenseSection}
      ${incomeSection}
      ${noTransactionsBlock}
      ${notificationSection}
      ${cta}
      <p style="margin:22px 0 0 0;font-size:12px;color:#94a3b8;">You are receiving this digest because email summaries are enabled for your account. Turn them off any time from the Automation page.</p>
    `;

    const html = renderLayout({
        heading: 'Your pending items summary',
        subtitle: `${transactions.length} pending transaction(s) · ${notifications.length} notification(s)`,
        contentHtml,
        accent: '#4f46e5'
    });

    const textLines = [
        `Hi ${name},`,
        '',
        'Items waiting for your review:',
        '',
        `Pending expenses (${expenseList.length}): ${formatAmount(expenseTotal, currency)}`,
        ...expenseList.map((t) => `  - ${t.merchant || t.provider || 'Unknown'}  ${formatAmount(t.amount, currency)}  (${t.category || 'General'})  ${formatDate(t.date || t.received_at)}`),
        '',
        `Pending income (${incomeList.length}): ${formatAmount(incomeTotal, currency)}`,
        ...incomeList.map((t) => `  - ${t.merchant || t.provider || 'Unknown'}  ${formatAmount(t.amount, currency)}  (${t.category || 'General'})  ${formatDate(t.date || t.received_at)}`),
        '',
        `Notifications (${notifications.length}):`,
        ...notifications.map((n) => `  - [${(n.severity || 'info').toUpperCase()}] ${n.title || 'Notification'}${n.body ? ': ' + n.body : ''}`),
        '',
        appUrl ? `Open the Automation Inbox: ${appUrl}` : ''
    ];
    return { subject, html, text: textLines.join('\n') };
}

module.exports = {
    escapeHtml,
    formatAmount,
    formatDate,
    isIncomeTransaction,
    renderLayout,
    otpEmail,
    pendingDigestEmail
};
