import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Check,
    Clock,
    Crown,
    Mail,
    Search,
    UserCheck,
    UserPlus,
    Users,
    UserX,
    X,
} from 'lucide-react';
import { SlideOver } from '../ui/SlideOver';
import { Badge, Button, EmptyState } from '../ui/primitives';
import { cx } from '../ui/cx';
import { API_URL, BASE_URL } from '../../config';

const getProfilePhotoUrl = (user) => {
    if (!user?.profilePhoto) {
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'User'}`;
    }
    if (user.profilePhoto.startsWith('http')) return user.profilePhoto;
    const cleanPath = user.profilePhoto.replace(/\\/g, '/');
    return `${BASE_URL}/${cleanPath}`;
};

const onAvatarError = (fallbackSeed) => (e) => {
    e.target.onerror = null;
    e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${fallbackSeed || 'User'}`;
};

const TABS = [
    { id: 'contacts', label: 'Contacts', tone: 'info' },
    { id: 'friends', label: 'Friends', tone: 'pos' },
];

const ContactsDropdown = ({ isOpen, onClose, currentUser, onOpenMessages }) => {
    const [activeTab, setActiveTab] = useState('contacts');
    const [allUsers, setAllUsers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState({ received: [], sent: [] });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [lastFetch, setLastFetch] = useState(0);
    const CACHE_TIME = 30000;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [usersRes, friendsRes, requestsRes] = await Promise.all([
                fetch(`${API_URL}/auth/users`, { headers }),
                fetch(`${API_URL}/friends`, { headers }),
                fetch(`${API_URL}/friends/requests`, { headers }),
            ]);

            const [users, friendsData, requests] = await Promise.all([
                usersRes.ok ? usersRes.json() : Promise.resolve([]),
                friendsRes.ok ? friendsRes.json() : Promise.resolve([]),
                requestsRes.ok ? requestsRes.json() : Promise.resolve({ received: [], sent: [] }),
            ]);

            setAllUsers(users.filter((u) => u.id !== currentUser?.id));
            setFriends(friendsData);
            setPendingRequests(requests);
            setLastFetch(Date.now());
        } catch (error) {
            console.error('[Contacts] Error:', error);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id]);

    useEffect(() => {
        if (!isOpen) return;
        const now = Date.now();
        if (now - lastFetch > CACHE_TIME || allUsers.length === 0) fetchData();
        // Cache check is a moment-in-time read; only re-run when the panel opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const sendFriendRequest = async (friendId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/friends/request`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ friendId }),
            });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('[Contacts] Error sending request:', error);
        }
    };

    const acceptRequest = async (requestId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/friends/accept/${requestId}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('[Contacts] Error accepting request:', error);
        }
    };

    const rejectRequest = async (requestId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/friends/reject/${requestId}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('[Contacts] Error rejecting request:', error);
        }
    };

    const unfriend = async (friendshipId) => {
        if (!confirm('Are you sure you want to remove this friend?')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/friends/${friendshipId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('[Contacts] Error unfriending:', error);
        }
    };

    const handleMessage = (friend) => {
        onClose();
        if (onOpenMessages) onOpenMessages(friend);
    };

    const getFriendStatus = (userId) => {
        if (friends.some((f) => f.id === userId)) return 'friend';
        if (pendingRequests.sent.some((r) => r.friend_id === userId)) return 'pending';
        if (pendingRequests.received.some((r) => r.user_id === userId)) return 'received';
        return 'none';
    };

    const query = searchQuery.toLowerCase();
    const filteredContacts = allUsers.filter(
        (contact) =>
            contact.fullName?.toLowerCase().includes(query) ||
            contact.username?.toLowerCase().includes(query)
    );
    const filteredFriends = friends.filter(
        (friend) =>
            friend.fullName?.toLowerCase().includes(query) ||
            friend.username?.toLowerCase().includes(query)
    );

    const activeCount = activeTab === 'contacts' ? filteredContacts.length : filteredFriends.length;

    return (
        <SlideOver
            isOpen={isOpen}
            onClose={onClose}
            title={activeTab === 'contacts' ? 'All Contacts' : 'My Friends'}
            subtitle={
                activeTab === 'contacts'
                    ? `${activeCount} users`
                    : `${activeCount} friends`
            }
            icon={Users}
            width="w-full sm:w-[440px]"
            bodyClassName="space-y-4"
        >
            <div className="inline-flex w-full rounded-control border border-line bg-sunken p-0.5">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cx(
                            'flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-semibold transition',
                            activeTab === tab.id
                                ? 'bg-surface text-ink shadow-card'
                                : 'text-ink-muted hover:text-ink'
                        )}
                    >
                        {tab.label} (
                        {tab.id === 'contacts' ? allUsers.length : friends.length})
                        {tab.id === 'friends' && pendingRequests.received.length > 0 ? (
                            <span className="rounded-pill bg-neg px-1.5 text-[10px] font-bold text-white">
                                {pendingRequests.received.length}
                            </span>
                        ) : null}
                    </button>
                ))}
            </div>

            <div className="relative">
                <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    aria-hidden="true"
                />
                <input
                    type="text"
                    placeholder="Search by name or username…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 w-full rounded-control border border-line bg-sunken pl-9 pr-3 text-sm text-ink outline-none transition focus:border-line-strong"
                />
            </div>

            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="pem-skeleton h-16 w-full rounded-card" />
                    ))}
                </div>
            ) : activeTab === 'contacts' ? (
                <div className="space-y-2.5">
                    {pendingRequests.received.length > 0 ? (
                        <div className="space-y-2 rounded-card border border-info bg-info-soft p-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-info">
                                Friend requests ({pendingRequests.received.length})
                            </h3>
                            {pendingRequests.received.map((request, idx) => (
                                <div
                                    key={`request-${request.id || idx}`}
                                    className="rounded-control border border-line bg-surface p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={getProfilePhotoUrl(request.requester)}
                                            className="h-10 w-10 rounded-full border-2 border-info"
                                            alt={request.requester.fullName}
                                            onError={onAvatarError(request.requester?.username)}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-ink">
                                                {request.requester.fullName ||
                                                    request.requester.username}
                                            </p>
                                            <p className="truncate text-xs text-ink-muted">
                                                @{request.requester.username}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2.5 flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            icon={Check}
                                            className="flex-1"
                                            onClick={() => acceptRequest(request.id)}
                                        >
                                            Accept
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            icon={X}
                                            className="flex-1"
                                            onClick={() => rejectRequest(request.id)}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {filteredContacts.length === 0 ? (
                        <EmptyState icon={Users} title="No contacts found" />
                    ) : (
                        filteredContacts.map((contact) => {
                            const status = getFriendStatus(contact.id);
                            return (
                                <div
                                    key={`contact-${contact.id}`}
                                    className="flex items-center gap-3 rounded-card border border-line bg-sunken p-3 transition hover:border-line-strong"
                                >
                                    <img
                                        src={getProfilePhotoUrl(contact)}
                                        className={cx(
                                            'h-12 w-12 rounded-full border-2',
                                            contact.role === 'admin' ? 'border-warn' : 'border-pos'
                                        )}
                                        alt={contact.fullName}
                                        onError={onAvatarError(contact.username)}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
                                            {contact.fullName || contact.username}
                                            {contact.role === 'admin' ? (
                                                <Crown size={12} className="text-warn" />
                                            ) : null}
                                        </p>
                                        <p className="truncate text-xs text-ink-muted">
                                            @{contact.username}
                                        </p>
                                    </div>
                                    {status === 'friend' ? (
                                        <UserCheck size={18} className="text-pos" aria-label="Friend" />
                                    ) : status === 'pending' ? (
                                        <Clock size={18} className="text-warn" aria-label="Request sent" />
                                    ) : status === 'received' ? (
                                        <Badge tone="info">Pending</Badge>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            icon={UserPlus}
                                            onClick={() => sendFriendRequest(contact.id)}
                                        >
                                            Add
                                        </Button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filteredFriends.length === 0 ? (
                        <EmptyState icon={Users} title="No friends yet" />
                    ) : (
                        filteredFriends.map((friend) => (
                            <motion.div
                                key={`friend-${friend.id}`}
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="group flex items-center gap-3 rounded-card border border-line bg-sunken p-3 transition hover:border-line-strong"
                            >
                                <img
                                    src={getProfilePhotoUrl(friend)}
                                    className={cx(
                                        'h-12 w-12 rounded-full border-2',
                                        friend.role === 'admin' ? 'border-warn' : 'border-pos'
                                    )}
                                    alt={friend.fullName}
                                    onError={onAvatarError(friend.username)}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
                                        {friend.fullName || friend.username}
                                        {friend.role === 'admin' ? (
                                            <Crown size={13} className="text-warn" />
                                        ) : null}
                                    </p>
                                    <p className="truncate text-xs text-ink-muted">
                                        @{friend.username}
                                    </p>
                                    {friend.role ? (
                                        <Badge
                                            tone={friend.role === 'admin' ? 'warn' : 'pos'}
                                            className="mt-1"
                                        >
                                            {friend.role}
                                        </Badge>
                                    ) : null}
                                </div>
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleMessage(friend)}
                                        title="Message"
                                        aria-label="Message"
                                        className="grid h-8 w-8 place-items-center rounded-control border border-line bg-raised text-info hover:bg-info-soft"
                                    >
                                        <Mail size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => unfriend(friend.friendshipId)}
                                        title="Remove friend"
                                        aria-label="Remove friend"
                                        className="grid h-8 w-8 place-items-center rounded-control border border-line bg-raised text-neg hover:bg-neg-soft"
                                    >
                                        <UserX size={15} />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            )}
        </SlideOver>
    );
};

export default ContactsDropdown;
