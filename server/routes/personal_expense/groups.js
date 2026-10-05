const express = require('express');
const router = express.Router();
const { Group, GroupMember, User, Message } = require('../../models');

// GET /api/groups - List my groups
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId, {
            include: [{
                model: Group,
                as: 'Groups',
                include: [
                    {
                        model: Message,
                        limit: 1,
                        order: [['created_at', 'DESC']]
                    }
                ]
            }]
        });

        if (!user) {
            return res.json([]);
        }

        const groups = user.Groups.map(g => ({
            id: g.id,
            name: g.name,
            lastMessage: g.Messages && g.Messages.length > 0 ? g.Messages[0].message : 'No messages yet',
            lastMessageTime: g.Messages && g.Messages.length > 0 ? g.Messages[0].created_at : g.created_at,
            type: 'group',
            unreadCount: 0,
            role: g.GroupMember ? g.GroupMember.role : 'member',
            createdBy: g.created_by
        }));

        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/groups - Create Group
router.post('/', async (req, res) => {
    try {
        const { name, memberIds } = req.body;
        const userId = req.user.id;

        if (!name || !memberIds || memberIds.length === 0) {
            return res.status(400).json({ error: 'Name and at least one member required' });
        }

        const group = await Group.create({
            name,
            created_by: userId
        });

        // Add creator
        await GroupMember.create({ group_id: group.id, user_id: userId, role: 'admin' });

        // Add members
        for (const mId of memberIds) {
            // Check if user exists? skipping for speed
            await GroupMember.create({ group_id: group.id, user_id: mId });
        }

        res.json(group);
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/groups/:groupId - Get Group Details (Members)
router.get('/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const group = await Group.findByPk(groupId, {
            include: [{
                model: User,
                as: 'Members',
                attributes: ['id', 'username', 'fullName', 'profilePhoto'],
                through: { attributes: ['role'] }
            }]
        });

        if (!group) return res.status(404).json({ error: 'Group not found' });

        // Verify membership
        const isMember = group.Members && group.Members.some(u => u.id === userId);
        if (!isMember) return res.status(403).json({ error: 'Not a member' });

        // Return group with Users key for frontend compatibility
        const response = {
            id: group.id,
            name: group.name,
            created_by: group.created_by,
            Users: group.Members  // Map Members to Users for frontend
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching group details:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/groups/:groupId/messages - Get messages
router.get('/:groupId/messages', async (req, res) => {
    try {
        const { groupId } = req.params;
        // Verify membership?
        const userId = req.user.id;
        const membership = await GroupMember.findOne({ where: { group_id: groupId, user_id: userId } });
        if (!membership) return res.status(403).json({ error: 'Not a member' });

        const messages = await Message.findAll({
            where: { group_id: groupId },
            include: [{ model: User, as: 'Sender', attributes: ['id', 'username', 'fullName', 'profilePhoto'] }],
            order: [['created_at', 'ASC']]
        });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching group messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/groups/:groupId/messages - Send message
router.post('/:groupId/messages', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { message } = req.body;
        const userId = req.user.id;

        if (!message || !message.trim()) return res.status(400).json({ error: 'Message empty' });

        const membership = await GroupMember.findOne({ where: { group_id: groupId, user_id: userId } });
        if (!membership) return res.status(403).json({ error: 'Not a member' });

        const newMsg = await Message.create({
            group_id: groupId,
            sender_id: userId,
            message: message.trim(),
            read_status: false
        });

        // Fetch with sender info
        const msgWithSender = await Message.findByPk(newMsg.id, {
            include: [{ model: User, as: 'Sender', attributes: ['id', 'username', 'fullName', 'profilePhoto'] }]
        });

        res.json(msgWithSender);
    } catch (error) {
        console.error('Error sending group message:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/groups/:groupId - Rename Group
router.put('/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name } = req.body;
        const userId = req.user.id;

        // Check if admin/creator
        const group = await Group.findByPk(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const membership = await GroupMember.findOne({ where: { group_id: groupId, user_id: userId } });
        if (!membership || (membership.role !== 'admin' && group.created_by !== userId)) {
            return res.status(403).json({ error: 'Only admins can rename group' });
        }

        await Group.update({ name }, { where: { id: groupId } });
        res.json({ success: true, name });
    } catch (error) {
        console.error('Error renaming group:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/groups/:groupId/members - Add Members
router.post('/:groupId/members', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { memberIds } = req.body;
        const userId = req.user.id;

        const membership = await GroupMember.findOne({ where: { group_id: groupId, user_id: userId } });
        if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only admins can add members' });

        if (!memberIds || !Array.isArray(memberIds)) return res.status(400).json({ error: 'Invalid members' });

        for (const mId of memberIds) {
            await GroupMember.findOrCreate({ where: { group_id: groupId, user_id: mId } });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding members:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/groups/:groupId - Delete or Leave
router.delete('/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const group = await Group.findByPk(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        if (group.created_by === userId) {
            await Group.destroy({ where: { id: groupId } });
            return res.json({ success: true, action: 'deleted', message: 'Group deleted completely' });
        } else {
            await GroupMember.destroy({ where: { group_id: groupId, user_id: userId } });
            return res.json({ success: true, action: 'left', message: 'You left the group' });
        }
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
