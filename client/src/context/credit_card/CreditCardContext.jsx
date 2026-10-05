import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCardSession } from './CardSessionContext';

const CreditCardContext = createContext();

export const useCreditCards = () => {
    const context = useContext(CreditCardContext);
    if (!context) {
        throw new Error('useCreditCards must be used within CreditCardProvider');
    }
    return context;
};

export const CreditCardProvider = ({ children }) => {
    const { user } = useAuth();
    const { unlocked, authFetch } = useCardSession();
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [categories, setCategories] = useState([]);

    // Fetch all cards. When the card session is locked we only pull the
    // non-sensitive summary; the full list (PAN/CVV/transactions/EMIs) is
    // fetched once the user unlocks the section.
    const fetchCards = useCallback(async () => {
        if (!user) {
            setCards([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const endpoint = unlocked ? '/credit-cards' : '/credit-cards/summary';
            const [cardsResponse, categoriesResponse] = await Promise.all([
                authFetch(endpoint),
                authFetch('/server/categories')
            ]);

            if (!cardsResponse.ok) {
                // Locked / expired card session: fall back to an empty list.
                if (cardsResponse.status === 403) {
                    setCards([]);
                    setError(null);
                    return;
                }
                throw new Error('Failed to fetch credit cards');
            }

            const data = await cardsResponse.json();

            // Transform backend data to match frontend component expectations
            const formattedCards = data.map(card => {
                const used = parseFloat(card.usedAmount || 0);
                const billed = parseFloat(card.totalDue || 0);

                // Calculate remaining principal for EMIs
                const remainingEmiPrincipal = (card.emis || []).reduce((sum, emi) => {
                    if (!emi.isActive) return sum;
                    const principalPerMonth = parseFloat(emi.principalAmount) / emi.tenure;
                    const remaining = parseFloat(emi.principalAmount) - (parseInt(emi.paidInstallments || 0) * principalPerMonth);
                    return sum + remaining;
                }, 0);

                // Unbilled = Used - Billed - Remaining EMI Principal
                const unbilled = Math.max(0, used - billed - remainingEmiPrincipal);

                return {
                    ...card,
                    name: card.cardName,
                    number: card.cardNumber,
                    limit: parseFloat(card.creditLimit || 0),
                    used: used,
                    totalDue: billed,
                    unbilled: unbilled,
                    available: parseFloat(card.creditLimit || 0) - used,
                    expiry: `${card.expiryMonth}/${card.expiryYear}`,
                    currency: user?.currency || 'INR',
                    transactions: (card.transactions || []).map(t => ({
                        ...t,
                        date: t.transactionDate || t.date
                    })),
                    emis: (card.emis || []).map(emi => ({
                        ...emi,
                        principal: parseFloat(emi.principalAmount || 0),
                        paid: parseInt(emi.paidInstallments || 0)
                    }))
                };
            });


            setCards(formattedCards);

            if (categoriesResponse.ok) {
                const categoriesData = await categoriesResponse.json();
                setCategories(categoriesData);
            }

            setError(null);
        } catch (err) {
            console.error("Error fetching cards:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user, unlocked, authFetch]);

    // Initial fetch + refetch on lock/unlock transitions
    useEffect(() => {
        fetchCards();
    }, [fetchCards]);

    // ==================== CARD MANAGEMENT ====================

    const addCard = async (newCard) => {
        const response = await authFetch('/credit-cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCard)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add card');
        }

        const savedCard = await response.json();
        // Refresh full state to ensure consistency
        fetchCards();
        return savedCard;
    };

    const updateCard = async (cardId, updates) => {
        const response = await authFetch(`/credit-cards/${cardId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error('Failed to update card');

        // Optimistic update for better UX or refetch
        fetchCards();
    };

    const deleteCard = async (cardId) => {
        const response = await authFetch(`/credit-cards/${cardId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete card');

        setCards(prev => prev.filter(card => card.id !== cardId));
    };

    const resetCardUtilization = async (cardId) => {
        const response = await authFetch(`/credit-cards/${cardId}/reset`, {
            method: 'POST'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to reset card utilization');
        }

        // Refresh cards to show updated balance
        fetchCards();
    };

    // ==================== TRANSACTION MANAGEMENT ====================

    const addTransaction = async (cardId, transactionData) => {
        // Ensure amount is string/number properly handled & map date to transactionDate for backend
        const payload = {
            ...transactionData,
            amount: parseFloat(transactionData.amount),
            transactionDate: transactionData.transactionDate || transactionData.date
        };

        const response = await authFetch(`/credit-cards/${cardId}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to add transaction');

        fetchCards(); // Refresh to update balances and transaction lists
    };

    const updateTransaction = async (cardId, transactionId, updates) => {
        const payload = {
            ...updates,
            amount: updates.amount !== undefined ? parseFloat(updates.amount) : undefined,
            transactionDate: updates.transactionDate || updates.date
        };

        const response = await authFetch(`/credit-cards/transactions/${transactionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to update transaction');
        }

        fetchCards(); // Refresh to update balances and transaction lists
    };

    const deleteTransaction = async (cardId, transactionId) => {
        const response = await authFetch(`/credit-cards/transactions/${transactionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete transaction');

        fetchCards(); // Refresh to revert balances
    };

    // ==================== EMI MANAGEMENT ====================

    const addEMI = async (cardId, emiData) => {
        const response = await authFetch(`/credit-cards/${cardId}/emis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emiData)
        });

        if (!response.ok) throw new Error('Failed to create EMI');

        fetchCards();
    };

    const payEMI = async (cardId, emiId) => {
        const response = await authFetch(`/credit-cards/emis/${emiId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactionDate: new Date().toISOString()
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
        }

        fetchCards();
    };



    const deleteEMI = async (emiId) => {
        const response = await authFetch(`/credit-cards/emis/${emiId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete EMI');

        fetchCards();
    };



    // Helper for manual manual balance adjustments if needed (uses updateCard internally)
    const updateCardBalance = async (cardId, amount) => {
        // This is complex as backend expects specific fields. 
        // For now, valid use cases usually go through addTransaction.
        // If this is for manual correction, we might need a dedicated endpoint or just use updateCard logic.
        const card = cards.find(c => c.id === cardId);
        if (!card) return;

        const newUsed = parseFloat(card.usedAmount || 0) + parseFloat(amount);
        await updateCard(cardId, { usedAmount: newUsed });
    };

    const value = {
        cards,
        categories,
        loading,
        error,
        fetchCards,
        addCard,
        deleteCard,
        resetCardUtilization,
        updateCard,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addEMI,
        payEMI,
        deleteEMI,
        updateCardBalance

    };

    return (
        <CreditCardContext.Provider value={value}>
            {children}
        </CreditCardContext.Provider>
    );
};
