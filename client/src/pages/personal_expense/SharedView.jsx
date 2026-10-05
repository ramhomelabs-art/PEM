import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL, BASE_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    PieChart,
    CreditCard,
    Clock,
    Plus,
    TrendingUp,
    IndianRupee,
    AlertCircle
} from 'lucide-react';
import LiveMarketTicker from '../../components/personal_expense/LiveMarketTicker';

let sharedCurrency = 'INR';

const formatCurrency = (amount) => {
    const locale = sharedCurrency === 'INR' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: sharedCurrency,
        maximumFractionDigits: 0
    }).format(amount);
};

const DetailRow = ({ label, value }) => (
    <div style={{
        padding: '15px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.05)'
    }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>{label}</p>
        <p style={{ margin: '5px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: 'white' }}>{value}</p>
    </div>
);

const StatCard = ({ label, value, color }) => (
    <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>{label}</p>
        <p style={{ margin: '10px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: color }}>{formatCurrency(value)}</p>
    </div>
);

const SharedInvestmentCard = ({ data }) => {
    if (!data) return null;
    const { invested, current, percentage } = data;
    return (
        <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: '10px', color: '#818cf8' }}>
                        <IndianRupee size={18} />
                    </div>
                    <span style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '13px' }}>Investment Portfolio</span>
                </div>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={12} /> +{percentage}%
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '24px', fontWeight: '900', color: 'white' }}>{formatCurrency(current)}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>
                    Invested: <span style={{ color: '#cbd5e1' }}>{formatCurrency(invested)}</span>
                </span>
            </div>
        </div>
    );
};

const SimpleLoanCard = ({ loan }) => {
    const progress = loan.totalAmount > 0 ? (loan.amountPaid / loan.totalAmount) * 100 : 0;
    const remaining = loan.totalAmount - loan.amountPaid;

    return (
        <div style={{ display: 'grid', gap: '20px' }}>
            {/* Loan Overview Card */}
            <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                borderRadius: '20px',
                padding: '30px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
                    {loan.loanName || 'Loan Details'}
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                    <StatCard label="Total Amount" value={loan.totalAmount} color="#3b82f6" />
                    <StatCard label="Amount Paid" value={loan.amountPaid} color="#10b981" />
                    <StatCard label="Remaining" value={remaining} color="#ef4444" />
                    <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>Interest Rate</p>
                        <p style={{ margin: '10px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                            {loan.interestRate}%
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#94a3b8' }}>Repayment Progress</span>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#10b981' }}>{progress.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.min(100, progress)}%`,
                            background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                            transition: 'width 0.3s'
                        }} />
                    </div>
                </div>
            </div>

            {/* Loan Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <DetailRow label="Lender" value={loan.lender || loan.bankProvider || 'N/A'} />
                <DetailRow label="Start Date" value={loan.startDate ? new Date(loan.startDate).toLocaleDateString() : 'N/A'} />
                <DetailRow label="End Date" value={loan.endDate ? new Date(loan.endDate).toLocaleDateString() : 'N/A'} />
                <DetailRow label="EMI Amount" value={loan.emiAmount ? formatCurrency(loan.emiAmount) : 'N/A'} />
                <DetailRow label="Payment Frequency" value={loan.paymentFrequency || 'Monthly'} />
                <DetailRow label="Status" value={loan.status || 'Active'} />
            </div>
        </div>
    );
};

const SimpleLoanView = ({ content }) => {
    if (!content || (content.message && !Array.isArray(content))) {
        return (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                <p>{content?.message || 'No loan data available'}</p>
            </div>
        );
    }

    if (Array.isArray(content)) {
        if (content.length === 0) return <div style={{ textAlign: 'center', color: '#64748b' }}>No loans found</div>;
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
                {content.map(loan => <SimpleLoanCard key={loan.id} loan={loan} />)}
            </div>
        );
    }

    return <SimpleLoanCard loan={content} />;
};

const SimpleCreditCardItem = ({ card }) => {
    const utilization = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
    const available = card.creditLimit - card.currentBalance;

    return (
        <div style={{ display: 'grid', gap: '20px' }}>
            {/* Credit Card Visual */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '20px',
                padding: '30px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p style={{ fontSize: '14px', opacity: 0.8, margin: 0 }}>{card.bankName || 'Credit Card'}</p>
                    <h2 style={{ fontSize: '24px', margin: '10px 0' }}>{card.cardName || 'Card'}</h2>
                    <p style={{ fontSize: '18px', letterSpacing: '2px', margin: '20px 0' }}>
                        •••• •••• •••• {card.lastFourDigits || '****'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                        <div>
                            <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>Available Credit</p>
                            <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '5px 0 0 0' }}>
                                {formatCurrency(available)}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>Due Date</p>
                            <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '5px 0 0 0' }}>
                                {card.dueDate ? new Date(card.dueDate).toLocaleDateString() : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>
                {/* Decorative circle */}
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)'
                }} />
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                <StatCard label="Credit Limit" value={card.creditLimit} color="#3b82f6" />
                <StatCard label="Current Balance" value={card.currentBalance} color="#ef4444" />
                <StatCard label="Minimum Payment" value={card.minimumPayment || 0} color="#f59e0b" />
                <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>Utilization</p>
                    <p style={{
                        margin: '10px 0 0 0', fontSize: '24px', fontWeight: 'bold',
                        color: utilization > 70 ? '#ef4444' : utilization > 30 ? '#f59e0b' : '#10b981'
                    }}>
                        {utilization.toFixed(1)}%
                    </p>
                </div>
            </div>
        </div>
    );
};

const SimpleCreditCardView = ({ content }) => {
    if (!content || (content.message && !Array.isArray(content))) {
        return (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                <p>{content?.message || 'No credit card data available'}</p>
            </div>
        );
    }

    if (Array.isArray(content)) {
        if (content.length === 0) return <div style={{ textAlign: 'center', color: '#64748b' }}>No credit cards found</div>;
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
                {content.map(card => <SimpleCreditCardItem key={card.id} card={card} />)}
            </div>
        );
    }

    return <SimpleCreditCardItem card={content} />;
};

const SimpleInvestmentItem = ({ investment }) => {
    const returns = investment.currentValue - investment.totalInvested;
    const returnsPercentage = investment.totalInvested > 0 ? (returns / investment.totalInvested) * 100 : 0;

    return (
        <div style={{ display: 'grid', gap: '20px' }}>
            {/* Investment Overview */}
            <div style={{
                background: returns >= 0
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                borderRadius: '20px',
                padding: '30px',
                color: 'white'
            }}>
                <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold' }}>
                    {investment.name || 'Investment'}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>
                    <div>
                        <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>Invested</p>
                        <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '5px 0 0 0' }}>
                            {formatCurrency(investment.totalInvested)}
                        </p>
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>Current Value</p>
                        <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '5px 0 0 0' }}>
                            {formatCurrency(investment.currentValue)}
                        </p>
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>Returns</p>
                        <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '5px 0 0 0' }}>
                            {returns >= 0 ? '+' : ''}{formatCurrency(returns)}
                            <span style={{ fontSize: '14px', marginLeft: '8px' }}>
                                ({returnsPercentage >= 0 ? '+' : ''}{returnsPercentage.toFixed(2)}%)
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Investment Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <DetailRow label="Type" value={investment.type || 'N/A'} />
                <DetailRow label="Purchase Date" value={investment.purchaseDate ? new Date(investment.purchaseDate).toLocaleDateString() : 'N/A'} />
                <DetailRow label="Quantity" value={investment.quantity || 'N/A'} />
                <DetailRow label="Purchase Price" value={investment.purchasePrice ? formatCurrency(investment.purchasePrice) : 'N/A'} />
                <DetailRow label="Current Price" value={investment.currentPrice ? formatCurrency(investment.currentPrice) : 'N/A'} />
                <DetailRow label="Status" value={investment.status || 'Active'} />
            </div>
        </div>
    );
};

const SimpleInvestmentView = ({ content }) => {
    if (!content || (content.message && !Array.isArray(content))) {
        return (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                <p>{content?.message || 'No investment data available'}</p>
            </div>
        );
    }

    if (Array.isArray(content)) {
        if (content.length === 0) return <div style={{ textAlign: 'center', color: '#64748b' }}>No investments found</div>;
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
                {content.map(inv => <SimpleInvestmentItem key={inv.id} investment={inv} />)}
            </div>
        );
    }

    return <SimpleInvestmentItem investment={content} />;
};

const SimpleDashboardView = ({ content }) => {
    const { stats, recentTransactions, investmentStats } = content;
    return (
        <div>
            <LiveMarketTicker />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                <StatCard label="Total Income" value={stats.totalIncome} color="#10b981" />
                <StatCard label="Total Expense" value={stats.totalExpense} color="#ef4444" />
                <StatCard label="Current Balance" value={stats.balance} color="#3b82f6" />
                {investmentStats && <SharedInvestmentCard data={investmentStats} />}
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>Recent Transactions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentTransactions.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                        <div>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>{t.description || t.category}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{new Date(t.date).toLocaleDateString()} • {t.category}</p>
                        </div>
                        <p style={{ margin: 0, fontWeight: 'bold', color: t.type === 'income' ? '#10b981' : '#ef4444' }}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SimpleTransactionsView = ({ content }) => {
    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {content.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                        <div>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>{t.description || t.category}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{new Date(t.date).toLocaleDateString()} • {t.category}</p>
                        </div>
                        <p style={{ margin: 0, fontWeight: 'bold', color: t.type === 'income' ? '#10b981' : '#ef4444' }}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SimpleBudgetsView = ({ content }) => {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {content.map(b => (
                <div key={b.id} style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, fontWeight: 'bold' }}>{b.category}</h4>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>Monthly Limit</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{formatCurrency(b.spent || 0)} / {formatCurrency(b.amountLimit)}</span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{Math.round(((b.spent || 0) / b.amountLimit) * 100)}%</span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, ((b.spent || 0) / b.amountLimit) * 100)}%`, backgroundColor: (b.spent || 0) > b.amountLimit ? '#ef4444' : '#3b82f6' }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

const SharedView = () => {
    const { shareId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [shareData, setShareData] = useState(null);
    const [resourceContent, setResourceContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSharedContent = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const url = `${API_URL}/share/view/${shareId}`;
            console.log('[SharedView] Fetching from URL:', url);
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to fetch shared resource');
            }

            const data = await res.json();
            if (data?.share?.Owner?.currency) {
                sharedCurrency = data.share.Owner.currency;
            } else if (user?.currency) {
                sharedCurrency = user.currency;
            }
            setShareData(data.share);
            setResourceContent(data.content);
        } catch (err) {
            console.error('[SharedView] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [shareId, user]);

    useEffect(() => {
        fetchSharedContent();
    }, [shareId, fetchSharedContent]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [newTransaction, setNewTransaction] = useState({
        amount: '',
        type: 'expense',
        category: 'Food',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    const handleAddTransaction = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/share/${shareId}/transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newTransaction)
            });

            if (res.ok) {
                alert('Transaction added successfully');
                setShowAddModal(false);
                setNewTransaction({
                    amount: '',
                    type: 'expense',
                    category: 'Food',
                    description: '',
                    date: new Date().toISOString().split('T')[0]
                });
                fetchSharedContent(); // Refresh data
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to add transaction');
        }
    };

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: '40px', height: '40px', border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }} />
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617', color: 'white', padding: '20px' }}>
                <AlertCircle size={64} color="#ef4444" style={{ marginBottom: '20px' }} />
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Access Denied or Error</h1>
                <p style={{ color: '#64748b', textAlign: 'center', maxWidth: '400px', marginTop: '10px' }}>{error}</p>
                <button onClick={() => navigate('/')} style={{ marginTop: '30px', padding: '12px 24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Back to Home</button>
            </div>
        );
    }

    const { resource_type, Owner } = shareData;
    const canEdit = shareData.permission === 'edit' || shareData.permission === 'full';

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#020617', color: 'white', padding: '40px 20px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
                            <Clock size={16} />
                            SHARED VIEW {canEdit ? '(COLLABORATION)' : '(READ-ONLY)'}
                        </div>
                        <h1 style={{ fontSize: '32px', fontWeight: '900', margin: 0 }}>
                            {Owner.fullName || Owner.username}&apos;s {resource_type.charAt(0).toUpperCase() + resource_type.slice(1)}
                        </h1>
                        <p style={{ color: '#64748b', marginTop: '5px' }}>
                            {shareData.permission === 'view' ? 'You have read-only access to this resource.' :
                                shareData.permission === 'edit' ? 'You have collaboration access to this resource.' :
                                    'You have full administrative access to this resource.'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {/* Add Transaction Button for Editors */}
                        {canEdit && resource_type === 'transaction' && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 20px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                <Plus size={18} />
                                Add Transaction
                            </button>
                        )}

                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{Owner.fullName || Owner.username}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Resource Owner</p>
                        </div>
                        <img
                            src={Owner.profilePhoto && typeof Owner.profilePhoto === 'string' ? (Owner.profilePhoto.startsWith('http') ? Owner.profilePhoto : `${BASE_URL}/${Owner.profilePhoto.replace(/\\/g, '/')}`) : `https://api.dicebear.com/7.x/avataaars/svg?seed=${Owner.username}`}
                            style={{ width: '50px', height: '50px', borderRadius: '50%', border: '4px solid rgba(59, 130, 246, 0.2)', objectFit: 'cover' }}
                            alt={Owner.username}
                        />
                    </div>
                </div>

                {/* Content Rendering based on type */}
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '30px' }}>
                    {resource_type === 'dashboard' && <SimpleDashboardView content={resourceContent} owner={Owner} />}
                    {resource_type === 'transaction' && <SimpleTransactionsView content={resourceContent} />}
                    {resource_type === 'budget' && <SimpleBudgetsView content={resourceContent} />}
                    {resource_type === 'loan' && <SimpleLoanView content={resourceContent} />}
                    {resource_type === 'credit_card' && <SimpleCreditCardView content={resourceContent} />}
                    {resource_type === 'investment' && <SimpleInvestmentView content={resourceContent} />}

                    {/* Fallback for unsupported types */}
                    {!['dashboard', 'transaction', 'budget', 'loan', 'credit_card', 'investment'].includes(resource_type) && (
                        <div style={{ textAlign: 'center', padding: '60px' }}>
                            <AlertCircle size={64} style={{ opacity: 0.2, marginBottom: '20px' }} />
                            <p style={{ color: '#64748b', fontSize: '18px', fontWeight: 'bold' }}>
                                {resource_type} sharing is not yet supported
                            </p>
                            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px' }}>
                                This feature is coming soon!
                            </p>
                        </div>
                    )}
                </div>

                {/* Add Transaction Modal */}
                {showAddModal && (
                    <div style={{
                        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
                    }}>
                        <div style={{
                            width: '400px', backgroundColor: '#0f172a', padding: '30px', borderRadius: '24px',
                            border: '1px solid rgba(255,255,255,0.1)', inject: 'relative'
                        }}>
                            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Add Shared Transaction</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={newTransaction.amount}
                                    onChange={e => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                                    style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Description"
                                    value={newTransaction.description}
                                    onChange={e => setNewTransaction({ ...newTransaction, description: e.target.value })}
                                    style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                                />
                                <select
                                    value={newTransaction.type}
                                    onChange={e => setNewTransaction({ ...newTransaction, type: e.target.value })}
                                    style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                                >
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Category"
                                    value={newTransaction.category}
                                    onChange={e => setNewTransaction({ ...newTransaction, category: e.target.value })}
                                    style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                                />
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'white', cursor: 'pointer' }}>Cancel</button>
                                    <button onClick={handleAddTransaction} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Add</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SharedView;
