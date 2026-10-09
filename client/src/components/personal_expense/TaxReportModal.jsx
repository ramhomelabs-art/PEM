import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Download, TrendingUp, Calendar } from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../../utils/currency';

const TaxReportModal = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchReport();
        }
    }, [isOpen]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/investments/tax/report`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setReport(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        if (!report || !report.details) return;

        const headers = ['Investment', 'Buy Date', 'Sell Date', 'Units', 'Buy Price', 'Sell Price', 'Gain/Loss', 'Type', 'Days Held'];
        const rows = report.details.map(d => [
            d.investmentName,
            new Date(d.buyDate).toLocaleDateString(),
            new Date(d.sellDate).toLocaleDateString(),
            d.units,
            d.buyPrice,
            d.sellPrice,
            d.gain,
            d.type,
            d.daysHeld
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `tax_report_${new Date().getFullYear()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatCurrency = (val) => formatCurrencyUtil(val, user?.currency || 'USD');

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{ backgroundColor: 'var(--pem-surface)', border: '1px solid var(--pem-border)', borderRadius: '24px', width: '90%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
            >
                {/* Header */}
                <div style={{ padding: '25px', borderBottom: '1px solid var(--pem-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, var(--pem-surface), var(--pem-bg-sunken))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderRadius: '12px', color: '#34d399' }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--pem-text)', margin: 0 }}>Tax Report</h2>
                            <p style={{ margin: 0, color: 'var(--pem-text-secondary)', fontSize: '14px' }}>Capital Gains Statement (FIFO Method)</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--pem-text-secondary)', cursor: 'pointer', padding: '5px' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '30px', overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--pem-text-secondary)' }}>Generating Report...</div>
                    ) : report ? (
                        <>
                            {/* Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                                <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                    <span style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: 'bold', textTransform: 'uppercase' }}>Short Term Gains (STCG)</span>
                                    <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--pem-text)', margin: '5px 0 0 0' }}>{formatCurrency(report.stcg)}</h3>
                                    <span style={{ fontSize: '12px', color: 'var(--pem-text-secondary)' }}>Asset held &lt; 1 Year</span>
                                </div>
                                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                    <span style={{ fontSize: '12px', color: '#fcd34d', fontWeight: 'bold', textTransform: 'uppercase' }}>Long Term Gains (LTCG)</span>
                                    <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--pem-text)', margin: '5px 0 0 0' }}>{formatCurrency(report.ltcg)}</h3>
                                    <span style={{ fontSize: '12px', color: 'var(--pem-text-secondary)' }}>Asset held &gt; 1 Year</span>
                                </div>
                                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <span style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Realized P&L</span>
                                    <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--pem-text)', margin: '5px 0 0 0' }}>{formatCurrency(report.totalGains)}</h3>
                                    <span style={{ fontSize: '12px', color: 'var(--pem-text-secondary)' }}>Total Taxable Income</span>
                                </div>
                            </div>

                            {/* Detailed Table */}
                            <div style={{ backgroundColor: 'var(--pem-bg-sunken)', borderRadius: '16px', border: '1px solid var(--pem-border)', overflow: 'hidden' }}>
                                <div style={{ padding: '20px', borderBottom: '1px solid var(--pem-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: 0, color: 'var(--pem-text)' }}>Transaction Breakdown</h4>
                                    <button onClick={downloadCSV} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                                        <Download size={14} /> Download CSV
                                    </button>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: 'var(--pem-text-secondary)' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--pem-border)', backgroundColor: 'var(--pem-surface-raised)' }}>
                                                <th style={{ padding: '15px' }}>Asset</th>
                                                <th style={{ padding: '15px' }}>Type</th>
                                                <th style={{ padding: '15px' }}>Buy Date</th>
                                                <th style={{ padding: '15px' }}>Sell Date</th>
                                                <th style={{ padding: '15px', textAlign: 'right' }}>Gain/Loss</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.details.length === 0 ? (
                                                <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--pem-text-secondary)' }}>No realized gains yet</td></tr>
                                            ) : (
                                                report.details.map((item, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--pem-border)' }}>
                                                        <td style={{ padding: '15px', fontWeight: 'bold' }}>{item.investmentName}</td>
                                                        <td style={{ padding: '15px' }}>
                                                            <span style={{
                                                                padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                                                                backgroundColor: item.type === 'LTCG' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                                                color: item.type === 'LTCG' ? '#fcd34d' : '#a5b4fc'
                                                            }}>{item.type}</span>
                                                        </td>
                                                        <td style={{ padding: '15px' }}>{new Date(item.buyDate).toLocaleDateString()}</td>
                                                        <td style={{ padding: '15px' }}>{new Date(item.sellDate).toLocaleDateString()}</td>
                                                        <td style={{ padding: '15px', textAlign: 'right', color: item.gain >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                                            {formatCurrency(item.gain)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>Failed to load report</div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default TaxReportModal;
