import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './currency';

const BRAND = [124, 58, 237]; // violet-600

const money = (value, currency) =>
    formatCurrency(value, currency).replace(/\u20b9/g, 'Rs.');

const statusLabel = (bill) =>
    (bill.status || 'unpaid').toUpperCase();

/**
 * Build and download a credit-card statement PDF for a single card.
 *
 * Purely client-side (jspdf + autotable, both already bundled) so it needs no
 * backend round-trip beyond the card/bill/transaction data already loaded.
 */
export function downloadCreditCardStatement({ card, bills = [], transactions = [], currency = 'INR', user }) {
    if (!card) return;

    const doc = new jsPDF();
    const last4 = (card.number || card.cardNumber || '').toString().replace(/\s/g, '').slice(-4) || 'XXXX';

    doc.setFontSize(20);
    doc.setTextColor(...BRAND);
    doc.text('CREDIT CARD STATEMENT', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`${card.bankName || 'Bank'} - ${card.name || card.cardName || 'Card'}`, 14, 28);
    doc.text(`Card Number: **** **** **** ${last4}`, 14, 34);

    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Card Holder: ${user?.fullName || user?.username || 'Account Holder'}`, 14, 41);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 46);
    doc.text(
        `APR: ${card.apr ?? 42}% p.a.  |  Interest-free period: ${card.interestFreeDays ?? 45} days`,
        14,
        51
    );

    const summary = [
        ['Credit Limit', money(card.limit ?? card.creditLimit, currency)],
        ['Available Credit', money(card.available ?? 0, currency)],
        ['Billed Amount (Total Due)', money(card.totalDue ?? 0, currency)],
        ['Minimum Amount Due', money(card.minPayment ?? 0, currency)],
        ['Unbilled Amount', money(card.unbilled ?? 0, currency)],
        ['Reward Points', String(card.rewardPoints ?? 0)]
    ];

    autoTable(doc, {
        startY: 58,
        head: [['Summary', '']],
        body: summary,
        theme: 'striped',
        headStyles: { fillColor: BRAND, textColor: 255 },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });

    const afterSummary = doc.lastAutoTable?.finalY ?? 58;

    if (bills.length > 0) {
        autoTable(doc, {
            startY: afterSummary + 8,
            head: [['Bill Date', 'Due Date', 'Total', 'Min Due', 'Paid', 'Status']],
            body: bills.map((b) => [
                b.billDate ? new Date(b.billDate).toLocaleDateString() : '-',
                b.dueDate ? new Date(b.dueDate).toLocaleDateString() : '-',
                money(b.totalAmount, currency),
                money(b.minDueAmount, currency),
                money(b.paidAmount, currency),
                statusLabel(b)
            ]),
            theme: 'grid',
            headStyles: { fillColor: BRAND, textColor: 255 },
            alternateRowStyles: { fillColor: [245, 243, 255] },
            margin: { left: 14, right: 14 }
        });
    }

    if (transactions.length > 0) {
        const afterBills = doc.lastAutoTable?.finalY ?? afterSummary;

        autoTable(doc, {
            startY: afterBills + 8,
            head: [['Date', 'Merchant', 'Category', 'Type', 'Amount']],
            body: transactions.map((t) => [
                t.transactionDate || t.date ? new Date(t.transactionDate || t.date).toLocaleDateString() : '-',
                t.merchant || t.description || '-',
                t.category || 'Others',
                (t.type || 'debit').toUpperCase(),
                money(t.amount, currency)
            ]),
            theme: 'grid',
            headStyles: { fillColor: BRAND, textColor: 255 },
            alternateRowStyles: { fillColor: [245, 243, 255] },
            margin: { left: 14, right: 14 }
        });
    }

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(
        'Finance charges (if any) are levied on the revolving balance at the stated APR plus 18% GST. ' +
            'Pay the total amount due before the due date to avoid interest.',
        14,
        pageHeight - 12,
        { maxWidth: 180 }
    );

    doc.save(`credit-card-statement-${last4}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
