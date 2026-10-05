const express = require('express');
const router = express.Router();
const { Message, User, Friendship } = require('../../models');
const { Op } = require('sequelize');

// GET /api/messages/conversations - Get all conversations
router.get('/conversations', async (req, res) => {
    try {
        const userId = req.user.id;

        // Efficient query to get conversations:
        // 1. Get unique partner IDs from messages
        // 2. Fetch latest message for each partner

        const { QueryTypes } = require('sequelize');
        const rawConversations = await Message.sequelize.query(`
            SELECT m1.*, 
                   u_sender.username as sender_username, u_sender."fullName" as sender_fullname, u_sender."profilePhoto" as sender_photo,
                   u_receiver.username as receiver_username, u_receiver."fullName" as receiver_fullname, u_receiver."profilePhoto" as receiver_photo
            FROM messages m1
            LEFT JOIN users u_sender ON m1.sender_id = u_sender.id
            LEFT JOIN users u_receiver ON m1.receiver_id = u_receiver.id
            WHERE m1.id IN (
                SELECT MAX(id)
                FROM messages
                WHERE (sender_id = :userId OR receiver_id = :userId) AND group_id IS NULL
                GROUP BY CASE 
                    WHEN sender_id = :userId THEN receiver_id 
                    ELSE sender_id 
                END
            )
            ORDER BY m1.created_at DESC
        `, {
            replacements: { userId },
            type: QueryTypes.SELECT
        });

        // Get unread counts for these partners
        const unreadCounts = await Message.findAll({
            where: {
                receiver_id: userId,
                read_status: false,
                group_id: null
            },
            attributes: ['sender_id', [Message.sequelize.fn('COUNT', Message.sequelize.col('id')), 'count']],
            group: ['sender_id']
        });

        const unreadMap = {};
        unreadCounts.forEach(uc => {
            unreadMap[uc.sender_id] = parseInt(uc.get('count'));
        });

        const conversations = rawConversations
            .map(msg => {
                const isSender = msg.sender_id === userId;
                const partnerId = isSender ? msg.receiver_id : msg.sender_id;
                const partnerUsername = isSender ? msg.receiver_username : msg.sender_username;
                const partnerFullName = isSender ? msg.receiver_fullname : msg.sender_fullname;
                const partnerPhoto = isSender ? msg.receiver_photo : msg.sender_photo;

                // Skip if partner user was deleted
                if (!partnerUsername && !partnerFullName) {
                    return null;
                }

                const partner = {
                    id: partnerId,
                    username: partnerUsername,
                    fullName: partnerFullName,
                    profilePhoto: partnerPhoto
                };

                return {
                    partnerId,
                    partner,
                    lastMessage: msg.message,
                    lastMessageTime: msg.created_at,
                    unreadCount: unreadMap[partnerId] || 0
                };
            })
            .filter(conv => conv !== null); // Remove null entries

        res.json(conversations);
    } catch (error) {
        console.error('[Messages] Error fetching conversations:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/messages/:friendId - Get messages with a specific friend
router.get('/:friendId', async (req, res) => {
    try {
        const userId = req.user.id;
        const friendId = parseInt(req.params.friendId);

        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { sender_id: userId, receiver_id: friendId },
                    { sender_id: friendId, receiver_id: userId }
                ]
            },
            include: [
                {
                    model: User,
                    as: 'Sender',
                    attributes: ['id', 'username', 'fullName', 'profilePhoto']
                },
                {
                    model: User,
                    as: 'Receiver',
                    attributes: ['id', 'username', 'fullName', 'profilePhoto']
                }
            ],
            order: [['created_at', 'ASC']]
        });

        // Mark messages as read only if there are unread ones
        const unreadExists = messages.some(m => m.receiver_id === userId && !m.read_status);
        if (unreadExists) {
            await Message.update(
                { read_status: true },
                {
                    where: {
                        sender_id: friendId,
                        receiver_id: userId,
                        read_status: false
                    }
                }
            );
        }

        res.json(messages);
    } catch (error) {
        console.error('[Messages] Error fetching messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/messages/send - Send a message
router.post('/send', async (req, res) => {
    try {
        const userId = req.user.id;
        const { receiverId, message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }

        // Verify friendship exists
        const friendship = await Friendship.findOne({
            where: {
                [Op.or]: [
                    { user_id: userId, friend_id: receiverId, status: 'accepted' },
                    { user_id: receiverId, friend_id: userId, status: 'accepted' }
                ]
            }
        });

        if (!friendship) {
            return res.status(403).json({ error: 'Can only send messages to friends' });
        }

        const newMessage = await Message.create({
            sender_id: userId,
            receiver_id: receiverId,
            message: message.trim(),
            read_status: false
        });

        const messageWithUsers = await Message.findByPk(newMessage.id, {
            include: [
                {
                    model: User,
                    as: 'Sender',
                    attributes: ['id', 'username', 'fullName', 'profilePhoto']
                },
                {
                    model: User,
                    as: 'Receiver',
                    attributes: ['id', 'username', 'fullName', 'profilePhoto']
                }
            ]
        });

        res.json(messageWithUsers);
    } catch (error) {
        console.error('[Messages] Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/messages/unread/count - Get unread message count
router.get('/unread/count', async (req, res) => {
    try {
        const userId = req.user.id;

        const count = await Message.count({
            where: {
                receiver_id: userId,
                read_status: false
            }
        });

        res.json({ count });
    } catch (error) {
        console.error('[Messages] Error counting unread messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/messages/read/:id - Mark message as read
router.put('/read/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const messageId = req.params.id;

        const message = await Message.findByPk(messageId);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (message.receiver_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        message.read_status = true;
        await message.save();

        res.json({ message: 'Message marked as read' });
    } catch (error) {
        console.error('[Messages] Error marking message as read:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/messages/conversation/:friendId - Delete entire conversation
router.delete('/conversation/:friendId', async (req, res) => {
    try {
        const userId = req.user.id;
        const friendId = parseInt(req.params.friendId);

        await Message.destroy({
            where: {
                [Op.or]: [
                    { sender_id: userId, receiver_id: friendId },
                    { sender_id: friendId, receiver_id: userId }
                ]
            }
        });

        res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('[Messages] Error deleting conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
