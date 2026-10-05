const express = require('express');
const router = express.Router();
const { Friendship, User } = require('../../models');
const { Op } = require('sequelize');

// GET /api/friends - Get all accepted friends
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const friendships = await Friendship.findAll({
            where: {
                [Op.or]: [
                    { user_id: userId, status: 'accepted' },
                    { friend_id: userId, status: 'accepted' }
                ]
            },
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'username', 'fullName', 'email', 'profilePhoto', 'role']
                },
                {
                    model: User,
                    as: 'Friend',
                    attributes: ['id', 'username', 'fullName', 'email', 'profilePhoto', 'role']
                }
            ]
        });

        // Extract friend data (not the current user)
        const friends = friendships.map(f => {
            if (f.user_id === userId) {
                return { ...f.Friend.toJSON(), friendshipId: f.id };
            } else {
                return { ...f.User.toJSON(), friendshipId: f.id };
            }
        });

        res.json(friends);
    } catch (error) {
        console.error('[Friends] Error fetching friends:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/friends/requests - Get pending friend requests
router.get('/requests', async (req, res) => {
    try {
        const userId = req.user.id;

        // Requests sent to me
        const receivedRequests = await Friendship.findAll({
            where: {
                friend_id: userId,
                status: 'pending'
            },
            include: [{
                model: User,
                as: 'User',
                attributes: ['id', 'username', 'fullName', 'email', 'profilePhoto', 'role']
            }]
        });

        // Requests I sent
        const sentRequests = await Friendship.findAll({
            where: {
                user_id: userId,
                status: 'pending'
            },
            include: [{
                model: User,
                as: 'Friend',
                attributes: ['id', 'username', 'fullName', 'email', 'profilePhoto', 'role']
            }]
        });

        res.json({
            received: receivedRequests.map(r => ({ ...r.toJSON(), requester: r.User })),
            sent: sentRequests.map(r => ({ ...r.toJSON(), recipient: r.Friend }))
        });
    } catch (error) {
        console.error('[Friends] Error fetching requests:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/friends/request - Send friend request
router.post('/request', async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.body;

        if (userId === friendId) {
            return res.status(400).json({ error: 'Cannot send friend request to yourself' });
        }

        // Check if friendship already exists
        const existing = await Friendship.findOne({
            where: {
                [Op.or]: [
                    { user_id: userId, friend_id: friendId },
                    { user_id: friendId, friend_id: userId }
                ]
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Friend request already exists' });
        }

        const friendship = await Friendship.create({
            user_id: userId,
            friend_id: friendId,
            requested_by: userId,
            status: 'pending'
        });

        res.json({ message: 'Friend request sent', friendship });
    } catch (error) {
        console.error('[Friends] Error sending request:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/friends/accept/:id - Accept friend request
router.put('/accept/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const requestId = req.params.id;

        const friendship = await Friendship.findByPk(requestId);

        if (!friendship) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        // Verify this request was sent to the current user
        if (friendship.friend_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to accept this request' });
        }

        friendship.status = 'accepted';
        await friendship.save();

        res.json({ message: 'Friend request accepted', friendship });
    } catch (error) {
        console.error('[Friends] Error accepting request:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/friends/reject/:id - Reject friend request
router.put('/reject/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const requestId = req.params.id;

        const friendship = await Friendship.findByPk(requestId);

        if (!friendship) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        // Verify this request was sent to the current user
        if (friendship.friend_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to reject this request' });
        }

        await friendship.destroy();

        res.json({ message: 'Friend request rejected' });
    } catch (error) {
        console.error('[Friends] Error rejecting request:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/friends/:id - Remove friend
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const friendshipId = req.params.id;

        const friendship = await Friendship.findByPk(friendshipId);

        if (!friendship) {
            return res.status(404).json({ error: 'Friendship not found' });
        }

        // Verify user is part of this friendship
        if (friendship.user_id !== userId && friendship.friend_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to remove this friendship' });
        }

        await friendship.destroy();

        res.json({ message: 'Friend removed successfully' });
    } catch (error) {
        console.error('[Friends] Error removing friend:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
