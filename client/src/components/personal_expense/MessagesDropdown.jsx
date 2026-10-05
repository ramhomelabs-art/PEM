import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowLeft,
    Check,
    LogOut,
    MessageCircle,
    Pencil,
    Send,
    Settings,
    Smile,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { SlideOver } from '../ui/SlideOver';
import { Button } from '../ui/primitives';
import { cx } from '../ui/cx';
import { useTheme } from '../../context/personal_expense/ThemeContext';
import { API_URL, BASE_URL } from '../../config';

const getProfilePhotoUrl = (user) => {
    if (!user) return `https://api.dicebear.com/7.x/avataaars/svg?seed=Unknown`;
    if (!user.profilePhoto) {
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username || 'User'}`;
    }
    if (user.profilePhoto.startsWith('http')) return user.profilePhoto;
    const cleanPath = user.profilePhoto.replace(/\\/g, '/');
    return `${BASE_URL}/${cleanPath}`;
};

const onAvatarError = (seed) => (e) => {
    e.target.onerror = null;
    e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed || 'User'}`;
};

const MessagesDropdown = ({ isOpen, onClose, currentUser, initialFriend }) => {
    const { isDarkMode } = useTheme();
    const [conversations, setConversations] = useState([]);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [activeTab, setActiveTab] = useState('direct');
    const [groups, setGroups] = useState([]);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupMembers, setNewGroupMembers] = useState([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [groupDetails, setGroupDetails] = useState(null);
    const [editGroupName, setEditGroupName] = useState('');
    const [addMembersList, setAddMembersList] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState(null);
    const [showLeaveGroupConfirm, setShowLeaveGroupConfirm] = useState(false);

    const [lastFetch, setLastFetch] = useState(0);
    const CACHE_TIME = 30000;

    useEffect(() => {
        if (isOpen) {
            const now = Date.now();
            if (now - lastFetch > CACHE_TIME) {
                if (activeTab === 'direct') fetchConversations();
                else fetchGroups();
                setLastFetch(now);
            }
        }
    }, [isOpen, activeTab, lastFetch]);

    useEffect(() => {
        if (isOpen && initialFriend) {
            const friendConv = {
                partnerId: initialFriend.id,
                partner: initialFriend,
                type: 'direct',
            };
            setSelectedFriend(friendConv);
            fetchMessages(initialFriend.id, 'direct');
        }
    }, [isOpen, initialFriend]);

    const fetchConversations = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/messages/conversations`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                const validConversations = data.filter(
                    (conv) =>
                        conv &&
                        conv.partner &&
                        conv.partner.id &&
                        (conv.partner.username || conv.partner.fullName)
                );
                setConversations(validConversations);
            }
        } catch (error) {
            console.error('[Messages] Error fetching conversations:', error);
        }
    };

    const fetchGroups = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/groups`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                const mapped = data.map((g) => ({
                    id: g.id,
                    partnerId: g.id,
                    partner: {
                        id: g.id,
                        fullName: g.name,
                        username: g.name,
                        type: 'group',
                    },
                    lastMessage: g.lastMessage,
                    lastMessageTime: g.lastMessageTime,
                    unreadCount: g.unreadCount,
                    type: 'group',
                }));
                setGroups(mapped);
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    const toggleMember = (id) => {
        setNewGroupMembers((prev) =>
            prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
        );
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) {
            alert('Please enter a group name');
            return;
        }
        if (newGroupMembers.length === 0) {
            alert('Please select at least one member');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/groups`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name: newGroupName, memberIds: newGroupMembers }),
            });
            if (res.ok) {
                setIsCreatingGroup(false);
                setNewGroupName('');
                setNewGroupMembers([]);
                fetchGroups();
                setActiveTab('groups');
            } else {
                const errData = await res.json();
                console.error('Failed to create group:', errData);
                alert(`Failed to create group: ${errData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Error creating group. Please check console.');
        }
    };

    const fetchGroupDetails = async (groupId) => {
        if (!groupId) {
            console.error('[Messages] fetchGroupDetails called with undefined groupId');
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/groups/${groupId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setGroupDetails(data);
                setEditGroupName(data.name);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const toggleSettings = () => {
        if (!isSettingsOpen && selectedFriend?.type === 'group') {
            const groupId = selectedFriend.partnerId || selectedFriend.partner?.id;
            if (groupId) fetchGroupDetails(groupId);
        }
        setIsSettingsOpen(!isSettingsOpen);
    };

    const handleRenameGroup = async () => {
        if (!editGroupName.trim()) return;
        const groupId = selectedFriend.partnerId || selectedFriend.partner?.id;
        if (!groupId) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/groups/${groupId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name: editGroupName }),
            });
            if (res.ok) {
                alert('Group renamed successfully');
                fetchGroups();
                setGroupDetails((prev) => ({ ...prev, name: editGroupName }));
                setSelectedFriend((prev) => ({
                    ...prev,
                    partner: {
                        ...prev.partner,
                        fullName: editGroupName,
                        username: editGroupName,
                    },
                }));
            } else {
                const err = await res.json();
                alert(`Error renaming group: ${err.error}`);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to rename group');
        }
    };

    const handleAddMembersToGroup = async () => {
        if (addMembersList.length === 0) return;
        const groupId = selectedFriend.partnerId || selectedFriend.partner?.id;
        if (!groupId) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/groups/${groupId}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ memberIds: addMembersList }),
            });
            if (res.ok) {
                alert('Members added successfully');
                setAddMembersList([]);
                fetchGroupDetails(groupId);
            } else {
                const err = await res.json();
                alert(`Error adding members: ${err.error}`);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to add members');
        }
    };

    const toggleNewMember = (id) => {
        setAddMembersList((prev) =>
            prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
        );
    };

    useEffect(() => {
        let interval;
        if (isOpen && selectedFriend) {
            interval = setInterval(() => {
                const id = selectedFriend.partnerId || selectedFriend.partner?.id;
                const type = selectedFriend.type || 'direct';
                if (id) fetchMessages(id, type, true);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isOpen, selectedFriend]);

    const fetchMessages = async (id, type = 'direct', isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const url =
                type === 'group'
                    ? `${API_URL}/groups/${id}/messages`
                    : `${API_URL}/messages/${id}`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (error) {
            console.error('[Messages] Error fetching messages:', error);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedFriend) return;

        try {
            const token = localStorage.getItem('token');
            const isGroup = selectedFriend.type === 'group';
            const url = isGroup
                ? `${API_URL}/groups/${selectedFriend.partnerId}/messages`
                : `${API_URL}/messages/send`;

            const body = isGroup
                ? { message: newMessage }
                : { receiverId: selectedFriend.partnerId, message: newMessage };

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const sentMessage = await res.json();
                setMessages([...messages, sentMessage]);
                setNewMessage('');
                if (selectedFriend.type === 'group') fetchGroups();
                else fetchConversations();
            }
        } catch (error) {
            console.error('[Messages] Error sending message:', error);
        }
    };

    const openChat = (conversation) => {
        setSelectedFriend(conversation);
        fetchMessages(conversation.partnerId, conversation.type || 'direct');
    };

    const backToConversations = () => {
        setSelectedFriend(null);
        setMessages([]);
        if (activeTab === 'groups') fetchGroups();
        else fetchConversations();
    };

    const deleteConversation = (e, friendId) => {
        e.stopPropagation();
        setDeleteTargetId(friendId);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/messages/conversation/${deleteTargetId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) fetchConversations();
        } catch (error) {
            console.error('Error deleting conversation:', error);
        } finally {
            setShowDeleteConfirm(false);
            setDeleteTargetId(null);
        }
    };

    const handleLeaveDeleteGroup = () => {
        setShowLeaveGroupConfirm(true);
    };

    const confirmLeaveDelete = async () => {
        const isCreator = groupDetails.createdBy === currentUser?.id;
        const action = isCreator ? 'delete' : 'leave';

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/groups/${selectedFriend.partnerId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                setShowLeaveGroupConfirm(false);
                setIsSettingsOpen(false);
                setSelectedFriend(null);
                fetchGroups();
            }
        } catch (error) {
            console.error(`Error ${action}ing group:`, error);
        }
    };

    const formatTime = (dateString, type = 'date') => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';
            if (type === 'time') {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            return date.toLocaleDateString();
        } catch {
            return '';
        }
    };

    if (!currentUser) return null;

    const isGroupChat = selectedFriend?.type === 'group';
    const uniqueContacts = Array.from(
        new Map(
            conversations.filter((c) => c && c.partner).map((c) => [c.partner.id, c.partner])
        ).values()
    );
    const canAddMembers = groupDetails?.Users?.some(
        (u) => u.id === currentUser?.id && u.GroupMember.role === 'admin'
    );
    const addableContacts = conversations.filter(
        (c) =>
            c &&
            c.partner &&
            !groupDetails?.Users?.some((u) => u.id === c.partner.id)
    );

    return (
        <SlideOver
            isOpen={isOpen}
            onClose={onClose}
            title={
                selectedFriend
                    ? selectedFriend.partner.fullName || selectedFriend.partner.username
                    : 'Messages'
            }
            subtitle={
                selectedFriend
                    ? `@${selectedFriend.partner.username}`
                    : `${conversations.length} conversations`
            }
            icon={MessageCircle}
            width="w-full sm:w-[480px]"
            bodyClassName="flex flex-col !p-0"
        >
            {!selectedFriend ? (
                <>
                    <div className="flex gap-1 border-b border-line p-3">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('direct');
                                setSelectedFriend(null);
                            }}
                            className={cx(
                                'flex-1 rounded-control px-3 py-2 text-sm font-bold transition',
                                activeTab === 'direct'
                                    ? 'bg-brand text-slate-950'
                                    : 'text-ink-muted hover:text-ink'
                            )}
                        >
                            Direct
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('groups');
                                fetchGroups();
                                setSelectedFriend(null);
                            }}
                            className={cx(
                                'flex-1 rounded-control px-3 py-2 text-sm font-bold transition',
                                activeTab === 'groups'
                                    ? 'bg-violet text-white'
                                    : 'text-ink-muted hover:text-ink'
                            )}
                        >
                            Groups
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
                        {activeTab === 'direct' ? (
                            conversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-ink-faint">
                                    <MessageCircle size={38} aria-hidden="true" />
                                    <p className="text-sm font-semibold">No messages yet</p>
                                </div>
                            ) : (
                                conversations
                                    .filter((conv) => conv && conv.partner && conv.partnerId)
                                    .map((conv) => (
                                        <motion.div
                                            key={`conv-${conv.partnerId}-${conv.partner?.id || 'unknown'}`}
                                            onClick={() => openChat(conv)}
                                            whileHover={{ scale: 1.01 }}
                                            className="flex cursor-pointer items-center gap-3 rounded-card border border-line bg-sunken p-3 transition hover:border-line-strong"
                                        >
                                            <div className="relative">
                                                <img
                                                    src={getProfilePhotoUrl(conv.partner)}
                                                    className="h-12 w-12 rounded-full border-2 border-pos"
                                                    alt={
                                                        conv.partner?.fullName ||
                                                        conv.partner?.username ||
                                                        'User'
                                                    }
                                                    onError={onAvatarError(conv.partner?.username)}
                                                />
                                                {conv.unreadCount > 0 ? (
                                                    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-pill bg-neg px-1 text-[11px] font-bold text-white">
                                                        {conv.unreadCount}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-ink">
                                                    {conv.partner?.fullName ||
                                                        conv.partner?.username ||
                                                        'Unknown user'}
                                                </p>
                                                <p className="truncate text-xs text-ink-muted">
                                                    {conv.lastMessage}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[11px] text-ink-faint">
                                                    {formatTime(conv.lastMessageTime)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) =>
                                                        deleteConversation(e, conv.partnerId)
                                                    }
                                                    title="Delete chat"
                                                    aria-label="Delete chat"
                                                    className="text-ink-faint transition hover:text-neg"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                            )
                        ) : (
                            <>
                                <Button
                                    variant={isCreatingGroup ? 'danger' : 'primary'}
                                    icon={isCreatingGroup ? X : Users}
                                    className="w-full"
                                    onClick={() => setIsCreatingGroup(!isCreatingGroup)}
                                >
                                    {isCreatingGroup ? 'Cancel creation' : 'Create new group'}
                                </Button>

                                {isCreatingGroup ? (
                                    <div className="rounded-card border border-line bg-sunken p-4">
                                        <input
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            placeholder="Group name"
                                            className="mb-3 h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-line-strong"
                                        />
                                        <p className="mb-2 text-xs font-bold text-ink-muted">
                                            Select members
                                        </p>
                                        <div className="mb-4 flex max-h-44 flex-col gap-2 overflow-y-auto pr-1">
                                            {uniqueContacts.map((p) => {
                                                const selected = newGroupMembers.includes(p.id);
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => toggleMember(p.id)}
                                                        className={cx(
                                                            'flex items-center justify-between rounded-control border p-2.5 text-left text-sm text-ink transition',
                                                            selected
                                                                ? 'border-brand bg-brand-soft'
                                                                : 'border-transparent bg-raised'
                                                        )}
                                                    >
                                                        <span className="flex items-center gap-2.5">
                                                            <img
                                                                src={getProfilePhotoUrl(p)}
                                                                className="h-8 w-8 rounded-full object-cover"
                                                                alt=""
                                                                onError={onAvatarError(p.username)}
                                                            />
                                                            <span className="font-semibold">
                                                                {p.fullName || p.username}
                                                            </span>
                                                        </span>
                                                        {selected ? (
                                                            <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[12px] text-slate-950">
                                                                <Check size={12} />
                                                            </span>
                                                        ) : null}
                                                    </button>
                                                );
                                            })}
                                            {conversations.length === 0 ? (
                                                <p className="p-2.5 text-center text-xs text-ink-muted">
                                                    No recent contacts found.
                                                </p>
                                            ) : null}
                                        </div>
                                        <Button
                                            variant="primary"
                                            className="w-full"
                                            disabled={!newGroupName.trim() || newGroupMembers.length === 0}
                                            onClick={handleCreateGroup}
                                        >
                                            Create chat group
                                        </Button>
                                    </div>
                                ) : null}

                                {groups.length === 0 ? (
                                    <p className="py-5 text-center text-sm text-ink-muted">
                                        No groups joined yet
                                    </p>
                                ) : (
                                    groups
                                        .filter((g) => g && g.partner)
                                        .map((g) => (
                                            <motion.div
                                                key={g.id}
                                                onClick={() => openChat(g)}
                                                whileHover={{ scale: 1.01 }}
                                                className="flex cursor-pointer items-center gap-3 rounded-card border border-line bg-sunken p-3 transition hover:border-line-strong"
                                            >
                                                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-violet text-lg font-black text-white">
                                                    {(g.partner?.fullName || 'G')
                                                        .slice(0, 2)
                                                        .toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-bold text-ink">
                                                        {g.partner?.fullName || 'Unknown group'}
                                                    </div>
                                                    <div className="truncate text-xs text-ink-muted">
                                                        {g.lastMessage || 'No messages'}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-ink-faint">
                                                    {formatTime(g.lastMessageTime)}
                                                </span>
                                            </motion.div>
                                        ))
                                )}
                            </>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <div className="flex items-center justify-between border-b border-line px-3 py-2">
                        <button
                            type="button"
                            onClick={backToConversations}
                            className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition hover:text-ink"
                        >
                            <ArrowLeft size={16} /> All conversations
                        </button>
                        {isGroupChat ? (
                            <button
                                type="button"
                                onClick={toggleSettings}
                                title="Group settings"
                                aria-label="Group settings"
                                className="grid h-8 w-8 place-items-center rounded-control border border-line text-ink-muted transition hover:text-ink"
                            >
                                <Settings size={16} />
                            </button>
                        ) : null}
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                        {loading ? (
                            <p className="py-10 text-center text-sm text-ink-muted">
                                Loading messages…
                            </p>
                        ) : messages.length === 0 ? (
                            <p className="py-10 text-center text-sm text-ink-muted">
                                No messages yet. Start the conversation!
                            </p>
                        ) : (
                            messages.map((msg) => {
                                const isMine = msg.sender_id === currentUser?.id;
                                return (
                                    <div
                                        key={msg.id}
                                        className={cx(
                                            'flex',
                                            isMine ? 'justify-end' : 'justify-start'
                                        )}
                                    >
                                        <div
                                            className={cx(
                                                'flex max-w-[75%] flex-col',
                                                isMine ? 'items-end' : 'items-start'
                                            )}
                                        >
                                            {!isMine && isGroupChat ? (
                                                <span className="mb-1 pl-1 text-[11px] font-bold text-ink-muted">
                                                    {msg.Sender?.fullName ||
                                                        msg.Sender?.username ||
                                                        'Member'}
                                                </span>
                                            ) : null}
                                            <div
                                                className={cx(
                                                    'w-fit break-words rounded-2xl px-4 py-2.5',
                                                    isMine
                                                        ? 'bg-brand text-slate-950'
                                                        : 'bg-raised text-ink'
                                                )}
                                            >
                                                <p className="text-sm">{msg.message}</p>
                                                <span className="mt-1 block text-[10px] opacity-70">
                                                    {formatTime(msg.created_at, 'time')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="relative flex items-center gap-2 border-t border-line p-3">
                        {showEmoji ? (
                            <div className="absolute bottom-[68px] left-3 z-10">
                                <EmojiPicker
                                    onEmojiClick={(emojiData) =>
                                        setNewMessage((prev) => prev + emojiData.emoji)
                                    }
                                    theme={isDarkMode ? 'dark' : 'light'}
                                    width={300}
                                    height={400}
                                />
                            </div>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setShowEmoji(!showEmoji)}
                            aria-label="Toggle emoji picker"
                            className="grid h-9 w-9 place-items-center rounded-control text-ink-muted transition hover:text-ink"
                        >
                            <Smile size={22} />
                        </button>
                        <input
                            type="text"
                            placeholder="Type a message…"
                            value={newMessage}
                            onClick={() => setShowEmoji(false)}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            className="h-11 min-w-0 flex-1 rounded-control border border-line bg-sunken px-3.5 text-sm text-ink outline-none focus:border-line-strong"
                        />
                        <Button
                            variant="primary"
                            icon={Send}
                            disabled={!newMessage.trim()}
                            onClick={sendMessage}
                            className="!h-11 !w-11 !px-0"
                            aria-label="Send message"
                        >
                            <span className="sr-only">Send</span>
                        </Button>
                    </div>
                </>
            )}

            {isSettingsOpen && groupDetails ? (
                <div className="absolute inset-0 z-30 flex flex-col bg-surface">
                    <div className="flex items-center justify-between border-b border-line p-4">
                        <h3 className="text-base font-bold text-ink">Group settings</h3>
                        <button
                            type="button"
                            onClick={() => setIsSettingsOpen(false)}
                            aria-label="Close settings"
                            className="grid h-8 w-8 place-items-center rounded-control border border-line text-ink-muted transition hover:text-ink"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                        <div className="rounded-card border border-line bg-sunken p-4">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-ink-muted">
                                Group name
                            </label>
                            <div className="flex gap-2">
                                <input
                                    value={editGroupName}
                                    onChange={(e) => setEditGroupName(e.target.value)}
                                    className="h-10 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-line-strong"
                                />
                                <Button
                                    variant="primary"
                                    icon={Pencil}
                                    onClick={handleRenameGroup}
                                    aria-label="Rename group"
                                />
                            </div>
                        </div>

                        {canAddMembers ? (
                            <div className="rounded-card border border-line bg-sunken p-4">
                                <label className="mb-3 block text-xs font-bold uppercase tracking-wide text-ink-muted">
                                    Add members
                                </label>
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {addableContacts.map((c) => {
                                        const selected = addMembersList.includes(c.partner.id);
                                        return (
                                            <button
                                                key={c.partner.id}
                                                type="button"
                                                onClick={() => toggleNewMember(c.partner.id)}
                                                className={cx(
                                                    'min-w-[70px] rounded-control p-2 text-center transition',
                                                    selected
                                                        ? 'bg-brand-soft ring-2 ring-brand'
                                                        : 'ring-2 ring-transparent'
                                                )}
                                            >
                                                <img
                                                    src={getProfilePhotoUrl(c.partner)}
                                                    className="mx-auto h-12 w-12 rounded-full object-cover"
                                                    alt=""
                                                    onError={onAvatarError(c.partner.username)}
                                                />
                                                <p className="mt-1.5 truncate text-[11px] font-semibold text-ink">
                                                    {c.partner.username}
                                                </p>
                                            </button>
                                        );
                                    })}
                                    {addableContacts.length === 0 ? (
                                        <p className="p-3 text-[13px] text-ink-faint">
                                            No contact to add
                                        </p>
                                    ) : null}
                                </div>
                                {addMembersList.length > 0 ? (
                                    <Button
                                        variant="primary"
                                        className="mt-3 w-full"
                                        onClick={handleAddMembersToGroup}
                                    >
                                        Add selected ({addMembersList.length})
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="flex-1 rounded-card border border-line bg-sunken p-4">
                            <label className="mb-3 block text-xs font-bold uppercase tracking-wide text-ink-muted">
                                Members ({groupDetails.Users?.length})
                            </label>
                            <div className="flex flex-col gap-2.5">
                                {groupDetails.Users?.map((u) => (
                                    <div
                                        key={u.id}
                                        className="flex items-center gap-3 rounded-control border border-line bg-surface p-2.5"
                                    >
                                        <img
                                            src={getProfilePhotoUrl(u)}
                                            className="h-10 w-10 rounded-full object-cover"
                                            alt=""
                                            onError={onAvatarError(u.username)}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-ink">
                                                {u.fullName || u.username}
                                            </span>
                                            {u.GroupMember.role === 'admin' ? (
                                                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-warn">
                                                    Admin
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button
                            variant="danger"
                            icon={LogOut}
                            className="w-full"
                            onClick={handleLeaveDeleteGroup}
                        >
                            {groupDetails.createdBy === currentUser?.id
                                ? 'Delete group'
                                : 'Leave group'}
                        </Button>
                    </div>
                </div>
            ) : null}

            <AnimatePresence>
                {showDeleteConfirm ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteTargetId(null);
                        }}
                        className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 16 }}
                            animate={{ scale: 1, y: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-raised"
                        >
                            <h3 className="text-base font-bold text-ink">Delete conversation?</h3>
                            <p className="mt-2 text-sm text-ink-muted">
                                This will permanently delete this conversation history. This
                                action cannot be undone.
                            </p>
                            <div className="mt-5 flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeleteTargetId(null);
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button variant="danger" onClick={confirmDelete}>
                                    Delete
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            <AnimatePresence>
                {showLeaveGroupConfirm && groupDetails ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowLeaveGroupConfirm(false)}
                        className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 16 }}
                            animate={{ scale: 1, y: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm rounded-card border border-line bg-surface p-6 text-center shadow-raised"
                        >
                            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-neg-soft text-neg">
                                <LogOut size={26} />
                            </div>
                            <h3 className="text-base font-bold text-ink">
                                {groupDetails.createdBy === currentUser?.id
                                    ? 'Delete group?'
                                    : 'Leave group?'}
                            </h3>
                            <p className="mt-2 text-sm text-ink-muted">
                                {groupDetails.createdBy === currentUser?.id
                                    ? 'This will permanently delete this group for all members. This action cannot be undone.'
                                    : 'Are you sure you want to leave this group? You can be added back by an admin.'}
                            </p>
                            <div className="mt-5 flex gap-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setShowLeaveGroupConfirm(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    className="flex-1"
                                    onClick={confirmLeaveDelete}
                                >
                                    {groupDetails.createdBy === currentUser?.id
                                        ? 'Delete group'
                                        : 'Leave group'}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </SlideOver>
    );
};

export default MessagesDropdown;
