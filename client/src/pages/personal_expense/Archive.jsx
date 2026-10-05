import { useState, useEffect, useCallback } from 'react';
import { API_URL, BASE_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, ReceiptText, Calculator, Handshake, PieChart,
    Settings, CreditCard, LogOut, Wallet, Archive as ArchiveIcon, CheckCircle2, Plus, Trash2, Search, FileDown, Calendar
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmDialog from '../../components/personal_expense/ConfirmDialog';

const Archive = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const [archivedLoans, setArchivedLoans] = useState([]);
    const [settledBorrows, setSettledBorrows] = useState([]);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [timeFilter, setTimeFilter] = useState('all');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });
    const [isExporting, setIsExporting] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, id: null });

    const fetchArchivedData = useCallback(async () => {
        try {
            const loansRes = await fetch(`${API_URL}/loans/user/${user.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (loansRes.ok) {
                const loansData = await loansRes.json();
                const closed = Array.isArray(loansData) ? loansData.filter(l => l.status === 'closed') : [];
                setArchivedLoans(closed);
            }

            const borrowRes = await fetch(`${API_URL}/borrow/user/${user.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (borrowRes.ok) {
                const borrowData = await borrowRes.json();
                const settled = Array.isArray(borrowData) ? borrowData.filter(b => b.status === 'settled') : [];
                setSettledBorrows(settled);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        document.title = "PEM Pro | Archive";
        if (user?.id) fetchArchivedData();
    }, [user, fetchArchivedData]);

    const handleDelete = async (id, type) => {
        const endpoint = type === 'loan' ? `api/loans/${id}` : `api/borrow/${id}`;
        try {
            const res = await fetch(`${BASE_URL}/${endpoint}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                fetchArchivedData();
                setConfirmDialog({ isOpen: false, type: null, id: null });
            } else {
                alert("Delete failed");
            }
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const filteredLoans = archivedLoans.filter(l => {
        const matchesSearch = l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.bankProvider?.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (timeFilter === 'all') return true;

        const date = new Date(l.updatedAt || l.createdAt);
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));

        if (timeFilter === 'day') return date >= startOfDay;
        if (timeFilter === 'week') {
            const lastWeek = new Date(now.setDate(now.getDate() - 7));
            return date >= lastWeek;
        }
        if (timeFilter === 'month') {
            const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
            return date >= lastMonth;
        }
        if (timeFilter === 'year') {
            const lastYear = new Date(now.setFullYear(now.getFullYear() - 1));
            return date >= lastYear;
        }
        if (timeFilter === 'custom' && customDates.start && customDates.end) {
            const start = new Date(customDates.start);
            const end = new Date(customDates.end);
            end.setHours(23, 59, 59, 999);
            return date >= start && date <= end;
        }
        return true;
    });

    const filteredBorrows = settledBorrows.filter(b => {
        const matchesSearch = b.personName?.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (timeFilter === 'all') return true;

        const date = new Date(b.date);
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));

        if (timeFilter === 'day') return date >= startOfDay;
        if (timeFilter === 'week') {
            const lastWeek = new Date(now.setDate(now.getDate() - 7));
            return date >= lastWeek;
        }
        if (timeFilter === 'month') {
            const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
            return date >= lastMonth;
        }
        if (timeFilter === 'year') {
            const lastYear = new Date(now.setFullYear(now.getFullYear() - 1));
            return date >= lastYear;
        }
        if (timeFilter === 'custom' && customDates.start && customDates.end) {
            const start = new Date(customDates.start);
            const end = new Date(customDates.end);
            end.setHours(23, 59, 59, 999);
            return date >= start && date <= end;
        }
        return true;
    });

    const exportToPDF = () => {
        setIsExporting(true);
        const doc = new jsPDF();
        const symbol = user?.currency === 'INR' ? 'Rs.' : '$';

        doc.setFontSize(22);
        doc.setTextColor(16, 185, 129);
        doc.text('PEM PRO - ARCHIVE STATEMENT', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Account Holder: ${user.fullName || user.username}`, 14, 35);
        doc.text(`Report Period: ${timeFilter.toUpperCase()}`, 14, 40);

        let finalY = 50;

        if (filteredLoans.length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('Completed Loans', 14, finalY);

            const loanData = filteredLoans.map(l => [
                new Date(l.updatedAt || l.createdAt).toLocaleDateString(),
                l.name,
                l.bankProvider,
                `${l.tenureMonths} Months`,
                `${symbol}${l.totalAmount}`
            ]);

            autoTable(doc, {
                startY: finalY + 5,
                head: [['Date Closed', 'Loan Name', 'Bank', 'Tenure', 'Total Paid']],
                body: loanData,
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            });
            finalY = doc.lastAutoTable.finalY + 20;
        }

        if (filteredBorrows.length > 0) {
            if (finalY > 250) {
                doc.addPage();
                finalY = 20;
            }
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('Settled Borrow & Lending', 14, finalY);

            const borrowData = filteredBorrows.map(b => [
                new Date(b.date).toLocaleDateString(),
                b.personName,
                b.type.toUpperCase(),
                `${symbol}${b.amount}`,
                'SETTLED'
            ]);

            autoTable(doc, {
                startY: finalY + 5,
                head: [['Date', 'Person', 'Type', 'Amount', 'Status']],
                body: borrowData,
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            });
        }

        doc.save(`PEM_Archive_${new Date().getTime()}.pdf`);
        setIsExporting(false);
    };

    const fetchHistory = async (record) => {
        setHistoryLoading(true);
        setSelectedHistory(record);
        setHistoryModalOpen(true);
        try {
            const res = await fetch(`${API_URL}/borrow/${record.id}/payments`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSelectedHistory(prev => ({ ...prev, payments: data }));
            }
        } catch {
            console.error("History fetch failed");
        } finally {
            setHistoryLoading(false);
        }
    };

    const formatCurrency = (val) => {
        const symbol = user?.currency === 'INR' ? '₹' : '$';
        return `${symbol}${Number(val).toLocaleString()}`;
    };

    return (
        <div className="page-container" style={{ maxWidth: '1200px' }}>
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onConfirm={() => handleDelete(confirmDialog.id, confirmDialog.type)}
                onCancel={() => setConfirmDialog({ isOpen: false, type: null, id: null })}
                title="Delete Archive"
                message={`Are you sure you want to delete this archived ${confirmDialog.type}?`}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '42px', fontWeight: '900', marginBottom: '10px', color: theme.text }}>Archive Data</h1>
                    <p style={{ color: theme.textSecondary, fontWeight: 'bold', margin: 0 }}>History of completed loans and settled liabilities</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '5px 12px', borderRadius: '100px', letterSpacing: '2px' }}>
                        {filteredLoans.length + filteredBorrows.length} RECORDS FOUND
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: theme.textSecondary }} />
                        <input
                            type="text"
                            placeholder="Search by name, bank or person..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                backgroundColor: theme.inputBg,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '16px',
                                padding: '16px 16px 16px 52px',
                                color: theme.text,
                                fontSize: '15px',
                                fontWeight: '700',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <button
                        onClick={exportToPDF}
                        disabled={isExporting || (filteredLoans.length === 0 && filteredBorrows.length === 0)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            padding: '0 25px',
                            fontWeight: '900',
                            cursor: (isExporting || (filteredLoans.length === 0 && filteredBorrows.length === 0)) ? 'not-allowed' : 'pointer',
                            opacity: (isExporting || (filteredLoans.length === 0 && filteredBorrows.length === 0)) ? 0.5 : 1,
                            boxShadow: '0 10px 20px rgba(16,185,129,0.2)'
                        }}
                    >
                        <FileDown size={20} /> {isExporting ? 'Generating...' : 'Export PDF'}
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', backgroundColor: theme.inputBg, borderRadius: '16px', padding: '4px', border: `1px solid ${theme.border}` }}>
                        {['all', 'day', 'week', 'month', 'year', 'custom'].map(p => (
                            <button
                                key={p}
                                onClick={() => setTimeFilter(p)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    fontSize: '11px',
                                    fontWeight: '900',
                                    textTransform: 'uppercase',
                                    cursor: 'pointer',
                                    backgroundColor: timeFilter === p ? '#10b981' : 'transparent',
                                    color: timeFilter === p ? 'white' : theme.textSecondary,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                {timeFilter === 'custom' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '900', color: '#10b981' }}>START:</label>
                            <input type="date" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} style={{ backgroundColor: theme.sidebar, border: `1px solid ${theme.border}`, color: theme.text, padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '900', color: '#10b981' }}>END:</label>
                            <input type="date" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} style={{ backgroundColor: theme.sidebar, border: `1px solid ${theme.border}`, color: theme.text, padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }} />
                        </div>
                    </motion.div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '25px' }}>
                {filteredLoans.length === 0 && filteredBorrows.length === 0 && !loading ? (
                    <div style={{ gridColumn: '1/-1', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${theme.border}`, borderRadius: '32px' }}>
                        <p style={{ color: theme.textSecondary, fontWeight: 'bold' }}>No archived data found.</p>
                    </div>
                ) : (
                    <>
                        {filteredLoans.length > 0 && (
                            <>
                                <div style={{ gridColumn: '1/-1', marginTop: '20px' }}>
                                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: theme.text, marginBottom: '20px' }}>Completed Loans</h2>
                                </div>
                                {filteredLoans.map((loan) => (
                                    <motion.div key={loan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: '24px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: theme.text }}>{loan.name}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(16,185,129,0.1)', padding: '5px 10px', borderRadius: '8px' }}>
                                                <CheckCircle2 size={14} /> COMPLETED
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <p style={{ fontSize: '12px', color: theme.textSecondary, margin: 0 }}>Total Amount Paid</p>
                                                <button onClick={() => setConfirmDialog({ isOpen: true, type: 'loan', id: loan.id })} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '5px', borderRadius: '8px', backgroundColor: 'rgba(244,63,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete Archive">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: theme.text }}>{formatCurrency(loan.totalAmount)}</h2>
                                        </div>
                                        <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                                            Bank: {loan.bankProvider} • Tenure: {loan.tenureMonths} Months
                                        </div>
                                    </motion.div>
                                ))}
                            </>
                        )}

                        {filteredBorrows.length > 0 && (
                            <>
                                <div style={{ gridColumn: '1/-1', marginTop: '20px' }}>
                                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: theme.text, marginBottom: '20px' }}>Settled Borrow & Lending</h2>
                                </div>
                                {filteredBorrows.map((record) => (
                                    <motion.div key={record.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: '24px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: theme.text }}>{record.personName}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(16,185,129,0.1)', padding: '5px 10px', borderRadius: '8px' }}>
                                                <CheckCircle2 size={14} /> SETTLED
                                            </div>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '12px', color: theme.textSecondary, margin: 0 }}>{record.type === 'borrow' ? 'You Borrowed' : 'You Lent'}</p>
                                            <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: theme.text }}>{formatCurrency(record.amount)}</h2>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                                                Date: {new Date(record.date).toLocaleDateString()}
                                            </div>
                                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                                <button onClick={() => fetchHistory(record)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <ReceiptText size={14} /> View History
                                                </button>
                                                <button onClick={() => setConfirmDialog({ isOpen: true, type: 'borrow', id: record.id })} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '5px', borderRadius: '8px', backgroundColor: 'rgba(244,63,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete Archive">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>

            <AnimatePresence>
                {historyModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setHistoryModalOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)' }} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ width: '100%', maxWidth: '500px', backgroundColor: theme.sidebar, borderRadius: '32px', border: `1px solid ${theme.border}`, padding: '40px', position: 'relative', zIndex: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                                <h2 style={{ fontSize: '24px', fontWeight: '900', color: theme.text }}>Payment History & Notes</h2>
                                <button onClick={() => setHistoryModalOpen(false)} style={{ background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}><Plus size={24} style={{ transform: 'rotate(45deg)' }} /></button>
                            </div>

                            {historyLoading ? (
                                <p style={{ color: theme.textSecondary }}>Loading...</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '400px', overflowY: 'auto' }}>
                                    {selectedHistory?.payments?.length > 0 ? (
                                        selectedHistory.payments.map((p, i) => (
                                            <div key={i} style={{ padding: '15px', backgroundColor: theme.inputBg, borderRadius: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(p.amount)}</span>
                                                    <span style={{ fontSize: '12px', color: theme.textSecondary }}>{new Date(p.paymentDate).toLocaleDateString()}</span>
                                                </div>
                                                {p.notes && <p style={{ margin: 0, fontSize: '13px', color: theme.textSecondary }}>&quot;{p.notes}&quot;</p>}
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ color: theme.textSecondary, textAlign: 'center' }}>No recorded payments found.</p>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Archive;



