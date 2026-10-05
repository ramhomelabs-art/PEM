const express = require('express');
const router = express.Router();
const { SharedResource, User, Friendship, Transaction, Budget, Investment, Loan, CreditCard } = require('../../models');
const { Op } = require('sequelize');

// GET /api/share/resources - Get resources shared with me
router.get('/resources', async (req, res) => {
    try {
        const userId = req.user.id;

        const sharedResources = await SharedResource.findAll({
            where: {
                shared_with_id: userId
            },
            include: [{
                model: User,
                as: 'Owner',
                attributes: ['id', 'username', 'fullName', 'profilePhoto']
            }],
            order: [['created_at', 'DESC']]
        });

        res.json(sharedResources);
    } catch (error) {
        console.error('[Share] Error fetching shared resources:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/share/my-shares - Get resources I've shared
router.get('/my-shares', async (req, res) => {
    try {
        const userId = req.user.id;

        const myShares = await SharedResource.findAll({
            where: {
                owner_id: userId
            },
            include: [{
                model: User,
                as: 'SharedWith',
                attributes: ['id', 'username', 'fullName', 'profilePhoto']
            }],
            order: [['created_at', 'DESC']]
        });

        res.json(myShares);
    } catch (error) {
        console.error('[Share] Error fetching my shares:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/share/resource - Share a resource
router.post('/resource', async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId, resourceType, resourceId, permission } = req.body;

        // Verify friendship exists
        const friendship = await Friendship.findOne({
            where: {
                [Op.or]: [
                    { user_id: userId, friend_id: friendId, status: 'accepted' },
                    { user_id: friendId, friend_id: userId, status: 'accepted' }
                ]
            }
        });

        if (!friendship) {
            return res.status(403).json({ error: 'Can only share with friends' });
        }

        // Check if already shared
        const existing = await SharedResource.findOne({
            where: {
                owner_id: userId,
                shared_with_id: friendId,
                resource_type: resourceType,
                resource_id: resourceId || null
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Resource already shared with this user' });
        }

        const sharedResource = await SharedResource.create({
            owner_id: userId,
            shared_with_id: friendId,
            resource_type: resourceType,
            resource_id: resourceId || null,
            permission: permission || 'view'
        });

        const resourceWithUser = await SharedResource.findByPk(sharedResource.id, {
            include: [{
                model: User,
                as: 'SharedWith',
                attributes: ['id', 'username', 'fullName', 'profilePhoto']
            }]
        });

        res.json({ message: 'Resource shared successfully', resource: resourceWithUser });
    } catch (error) {
        console.error('[Share] Error sharing resource:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/share/permission/:id - Update permission
router.put('/permission/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const shareId = req.params.id;
        const { permission } = req.body;

        const sharedResource = await SharedResource.findByPk(shareId);

        if (!sharedResource) {
            return res.status(404).json({ error: 'Shared resource not found' });
        }

        if (sharedResource.owner_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to update this share' });
        }

        sharedResource.permission = permission;
        await sharedResource.save();

        res.json({ message: 'Permission updated', resource: sharedResource });
    } catch (error) {
        console.error('[Share] Error updating permission:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/share/:id - Revoke sharing
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const shareId = req.params.id;

        const sharedResource = await SharedResource.findByPk(shareId);

        if (!sharedResource) {
            return res.status(404).json({ error: 'Shared resource not found' });
        }

        if (sharedResource.owner_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to revoke this share' });
        }

        await sharedResource.destroy();

        res.json({ message: 'Sharing revoked successfully' });
    } catch (error) {
        console.error('[Share] Error revoking share:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/share/view/:shareId - View shared content
router.get('/view/:shareId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { shareId } = req.params;
        console.log(`[Share] Viewing shareId: ${shareId}, User: ${userId}`);

        const share = await SharedResource.findByPk(shareId, {
            include: [{
                model: User,
                as: 'Owner',
                attributes: ['id', 'username', 'fullName', 'profilePhoto', 'currency']
            }]
        });
        console.log(`[Share] Found share:`, share ? share.id : 'null');

        if (!share) {
            return res.status(404).json({ error: 'Shared resource not found' });
        }

        // Verify access: Must be the person it's shared with OR the owner
        if (share.shared_with_id !== userId && share.owner_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to view this resource' });
        }

        let content = null;

        // Fetch actual data based on type
        if (share.resource_type === 'dashboard') {
            const stats = {
                totalIncome: await Transaction.sum('amount', { where: { userId: share.owner_id, type: 'income' } }) || 0,
                totalExpense: await Transaction.sum('amount', { where: { userId: share.owner_id, type: 'expense' } }) || 0
            };
            stats.balance = stats.totalIncome - stats.totalExpense;

            const recentTransactions = await Transaction.findAll({
                where: { userId: share.owner_id },
                limit: 10,
                order: [['date', 'DESC']]
            });

            const investments = await Investment.findAll({
                where: { userId: share.owner_id, status: 'Active' }
            });
            const investmentStats = {
                invested: investments.reduce((sum, inv) => sum + Number(inv.totalInvested || 0), 0),
                current: investments.reduce((sum, inv) => sum + Number(inv.currentValue || 0), 0)
            };
            investmentStats.returns = investmentStats.current - investmentStats.invested;
            investmentStats.percentage = investmentStats.invested > 0
                ? ((investmentStats.returns / investmentStats.invested) * 100).toFixed(2)
                : 0;

            content = { stats, recentTransactions, investmentStats };
        } else if (share.resource_type === 'transaction') {
            content = await Transaction.findAll({
                where: { userId: share.owner_id },
                order: [['date', 'DESC']]
            });
        } else if (share.resource_type === 'budget') {
            const budgets = await Budget.findAll({
                where: { userId: share.owner_id }
            });

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            content = await Promise.all(budgets.map(async (b) => {
                const spent = await Transaction.sum('amount', {
                    where: {
                        userId: share.owner_id,
                        type: 'expense',
                        category: b.category,
                        date: { [Op.gte]: startOfMonth }
                    }
                }) || 0;

                return { ...b.get({ plain: true }), spent };
            }));
        } else if (share.resource_type === 'loan') {
            if (share.resource_id) {
                const loan = await Loan.findByPk(share.resource_id);
                if (loan) {
                    content = loan.toJSON();
                    content.amountPaid = (content.totalAmount || 0) - (content.remainingAmount || 0);
                    content.loanName = content.name;
                } else {
                    content = { message: 'Loan not found or deleted' };
                }
            } else {
                // Return ALL loans
                const loans = await Loan.findAll({ where: { userId: share.owner_id } });
                content = loans.map(l => {
                    const c = l.toJSON();
                    c.amountPaid = (c.totalAmount || 0) - (c.remainingAmount || 0);
                    c.loanName = c.name;
                    return c;
                });
            }
        } else if (share.resource_type === 'credit_card') {
            if (share.resource_id) {
                const card = await CreditCard.findByPk(share.resource_id);
                if (card) {
                    content = card.toJSON();
                    content.currentBalance = content.usedAmount;
                    content.minimumPayment = content.minPayment;
                    content.lastFourDigits = content.cardNumber ? content.cardNumber.slice(-4) : '****';
                } else {
                    content = { message: 'Credit card not found or deleted' };
                }
            } else {
                // Return ALL cards
                const cards = await CreditCard.findAll({ where: { userId: share.owner_id } });
                content = cards.map(c => {
                    const card = c.toJSON();
                    card.currentBalance = card.usedAmount;
                    card.minimumPayment = card.minPayment;
                    card.lastFourDigits = card.cardNumber ? card.cardNumber.slice(-4) : '****';
                    return card;
                });
            }
        } else if (share.resource_type === 'investment') {
            if (share.resource_id) {
                const investment = await Investment.findByPk(share.resource_id);
                if (investment) {
                    content = investment.toJSON();
                    content.quantity = content.unitsHeld;
                    content.currentPrice = content.lastMarketPrice;
                    content.purchaseDate = content.createdAt;
                    if (content.unitsHeld > 0) {
                        content.purchasePrice = content.totalInvested / content.unitsHeld;
                    }
                } else {
                    content = { message: 'Investment not found or deleted' };
                }
            } else {
                // Return ALL investments
                const investments = await Investment.findAll({ where: { userId: share.owner_id } });
                content = investments.map(inv => {
                    const c = inv.toJSON();
                    c.quantity = c.unitsHeld;
                    c.currentPrice = c.lastMarketPrice;
                    c.purchaseDate = c.createdAt;
                    if (c.unitsHeld > 0) {
                        c.purchasePrice = c.totalInvested / c.unitsHeld;
                    }
                    return c;
                });
            }
        } else {
            content = { message: 'Data fetching not implemented for this type yet' };
        }

        res.json({ share, content });
    } catch (error) {
        console.error('[Share] Error viewing shared resource:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/share/:shareId/transaction - Add transaction to shared resource
router.post('/:shareId/transaction', async (req, res) => {
    try {
        const userId = req.user.id;
        const { shareId } = req.params;
        const { amount, type, category, description, date } = req.body;

        const share = await SharedResource.findByPk(shareId);
        if (!share) return res.status(404).json({ error: 'Shared resource not found' });

        // Verify edit permission
        // Must be the person it's shared with OR the owner
        if (share.shared_with_id !== userId && share.owner_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        if (share.shared_with_id === userId && share.permission === 'view') {
            return res.status(403).json({ error: 'View only access' });
        }

        // Create transaction for the OWNER
        const transaction = await Transaction.create({
            userId: share.owner_id, // Important: Add to owner's account
            amount,
            type,
            category,
            description,
            date: date || new Date(),
            source: 'manual' // Mark as manually added
        });

        res.json(transaction);

    } catch (error) {
        console.error('[Share] Error adding shared transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
