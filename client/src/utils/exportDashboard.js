/**
 * Dashboard export helpers. CSV is generated client-side with no dependency;
 * PDF uses the browser's native print-to-PDF against the `@media print` rules
 * in index.css, so no extra package needs installing.
 */

function download(filename, contents, mime) {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

const escapeCell = (value) => {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function exportTransactionsCsv(transactions = [], filename = 'pem-dashboard.csv') {
    const header = ['Date', 'Type', 'Category', 'Description', 'Payment Mode', 'Amount'];
    const rows = transactions.map((t) => [
        t.date,
        t.type,
        t.category,
        t.description,
        t.paymentMode,
        t.amount,
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
    // BOM keeps Excel from mangling the ₹ symbol.
    download(filename, `\uFEFF${csv}`, 'text/csv;charset=utf-8;');
}

/** Opens the browser print dialog (user chooses "Save as PDF"). */
export function printDashboard() {
    window.print();
}
