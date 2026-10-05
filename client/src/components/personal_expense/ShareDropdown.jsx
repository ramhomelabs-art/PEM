import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    CreditCard,
    Eye,
    FileText,
    Landmark,
    LayoutDashboard,
    Pencil,
    PiggyBank,
    Share2,
    Trash2,
    TrendingUp,
    Unlock,
    Users,
} from 'lucide-react';
import { SlideOver } from '../ui/SlideOver';
import { Badge, Button, EmptyState } from '../ui/primitives';
import { cx } from '../ui/cx';
import { API_URL } from '../../config';

const RESOURCE_TYPES = [
    { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { value: 'budget', label: 'Budget', icon: PiggyBank },
    { value: 'transaction', label: 'Transactions', icon: CreditCard },
    { value: 'bill', label: 'Bills', icon: FileText },
    { value: 'loan', label: 'Loans', icon: Landmark },
    { value: 'investment', label: 'Investments', icon: TrendingUp },
];

const PERMISSIONS = [
    { value: 'view', label: 'Can see', icon: Eye, tone: 'info', desc: 'View only access' },
    { value: 'edit', label: 'Can edit', icon: Pencil, tone: 'warn', desc: 'View and edit' },
    { value: 'full_access', label: 'Full access', icon: Unlock, tone: 'neg', desc: 'Complete control' },
];

const avatarFor = (profilePhoto, username) =>
    profilePhoto?.startsWith('http')
        ? profilePhoto
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

const ShareDropdown = ({ isOpen, onClose }) => {
    const [friends, setFriends] = useState([]);
    const [myShares, setMyShares] = useState([]);
    const [sharedResources, setSharedResources] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState('');
    const [resourceType, setResourceType] = useState('dashboard');
    const [permission, setPermission] = useState('view');
    const [viewMode, setViewMode] = useState('share');
    const [notice, setNotice] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [friendsRes, sharesRes, sharedToMeRes] = await Promise.all([
                fetch(`${API_URL}/friends`, { headers }),
                fetch(`${API_URL}/share/my-shares`, { headers }),
                fetch(`${API_URL}/share/resources`, { headers }),
            ]);

            if (friendsRes.ok) setFriends(await friendsRes.json());
            if (sharesRes.ok) setMyShares(await sharesRes.json());
            if (sharedToMeRes.ok) setSharedResources(await sharedToMeRes.json());
        } catch (error) {
            console.error('[Share] Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setNotice('');
            fetchData();
        }
    }, [isOpen, fetchData]);

    const shareResource = async () => {
        if (!selectedFriend) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/share/resource`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    friendId: parseInt(selectedFriend),
                    resourceType,
                    resourceId: null,
                    permission,
                }),
            });

            if (res.ok) {
                await fetchData();
                setSelectedFriend('');
                setNotice('Resource shared successfully.');
            } else {
                const error = await res.json();
                setNotice(error.error || 'Failed to share resource.');
            }
        } catch (error) {
            console.error('[Share] Error sharing resource:', error);
            setNotice('Failed to share resource.');
        }
    };

    const revokeShare = async (shareId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/share/${shareId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) await fetchData();
        } catch (error) {
            console.error('[Share] Error revoking share:', error);
        }
    };

    const copyLink = (shareId) => {
        navigator.clipboard.writeText(`${window.location.origin}/shared/${shareId}`);
        setNotice('Link copied to clipboard.');
    };

    const permOf = (perm) => PERMISSIONS.find((p) => p.value === perm) || PERMISSIONS[0];
    const resourceOf = (value) => RESOURCE_TYPES.find((r) => r.value === value);

    return (
        <SlideOver
            isOpen={isOpen}
            onClose={onClose}
            title="Share resources"
            subtitle="Collaboration & visibility"
            icon={Share2}
            width="w-full sm:w-[460px]"
            bodyClassName="space-y-5"
        >
            <div className="inline-flex w-full rounded-control border border-line bg-sunken p-0.5">
                <button
                    type="button"
                    onClick={() => setViewMode('share')}
                    className={cx(
                        'flex-1 rounded-[8px] px-3 py-1.5 text-xs font-semibold transition',
                        viewMode === 'share'
                            ? 'bg-surface text-ink shadow-card'
                            : 'text-ink-muted hover:text-ink'
                    )}
                >
                    Share new
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode('shared_to_me')}
                    className={cx(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-semibold transition',
                        viewMode === 'shared_to_me'
                            ? 'bg-surface text-ink shadow-card'
                            : 'text-ink-muted hover:text-ink'
                    )}
                >
                    Shared with me
                    {sharedResources.length > 0 ? (
                        <span className="rounded-pill bg-brand px-1.5 text-[10px] font-bold text-slate-950">
                            {sharedResources.length}
                        </span>
                    ) : null}
                </button>
            </div>

            {notice ? (
                <p className="rounded-control bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">
                    {notice}
                </p>
            ) : null}

            {viewMode === 'share' ? (
                <>
                    <section className="rounded-card border border-line bg-sunken p-4">
                        <h3 className="text-sm font-bold text-ink">Share new resource</h3>

                        <label className="mt-4 block text-xs font-semibold text-ink-muted">
                            Friend
                            <select
                                value={selectedFriend}
                                onChange={(e) => setSelectedFriend(e.target.value)}
                                className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-line-strong"
                            >
                                <option value="">Choose a friend…</option>
                                {friends.map((friend) => (
                                    <option key={friend.id} value={friend.id}>
                                        {friend.fullName || friend.username}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <p className="mt-4 text-xs font-semibold text-ink-muted">Resource type</p>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                            {RESOURCE_TYPES.map((type) => {
                                const Icon = type.icon;
                                const active = resourceType === type.value;
                                return (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setResourceType(type.value)}
                                        className={cx(
                                            'flex items-center justify-center gap-2 rounded-control border px-2 py-2 text-xs font-semibold transition',
                                            active
                                                ? 'border-brand bg-brand-soft text-brand'
                                                : 'border-line bg-surface text-ink-muted hover:text-ink'
                                        )}
                                    >
                                        <Icon size={14} aria-hidden="true" />
                                        {type.label}
                                    </button>
                                );
                            })}
                        </div>

                        <label className="mt-4 block text-xs font-semibold text-ink-muted">
                            Permission level
                            <select
                                value={permission}
                                onChange={(e) => setPermission(e.target.value)}
                                className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-line-strong"
                            >
                                {PERMISSIONS.map((perm) => (
                                    <option key={perm.value} value={perm.value}>
                                        {perm.label} — {perm.desc}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <Button
                            variant="primary"
                            icon={Share2}
                            className="mt-4 w-full"
                            disabled={!selectedFriend}
                            onClick={shareResource}
                        >
                            Share resource
                        </Button>
                    </section>

                    <section>
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                            My active shares ({myShares.length})
                        </h3>

                        {loading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 2 }).map((_, i) => (
                                    <div key={i} className="pem-skeleton h-24 w-full rounded-card" />
                                ))}
                            </div>
                        ) : myShares.length === 0 ? (
                            <EmptyState icon={Share2} title="No shared resources yet" />
                        ) : (
                            <div className="space-y-2.5">
                                {myShares.map((share) => {
                                    const perm = permOf(share.permission);
                                    const PermIcon = perm.icon;
                                    const resource = resourceOf(share.resource_type);
                                    return (
                                        <motion.div
                                            key={share.id}
                                            initial={{ opacity: 0, x: 12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="rounded-card border border-line bg-sunken p-3.5"
                                        >
                                            <div className="flex items-start gap-3">
                                                <img
                                                    src={avatarFor(
                                                        share.SharedWith?.profilePhoto,
                                                        share.SharedWith?.username
                                                    )}
                                                    className="h-10 w-10 rounded-full border-2 border-pos"
                                                    alt={share.SharedWith?.username}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-bold text-ink">
                                                        {share.SharedWith?.fullName ||
                                                            share.SharedWith?.username}
                                                    </p>
                                                    <p className="text-xs text-ink-muted">
                                                        {resource?.label || share.resource_type}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => copyLink(share.id)}
                                                    title="Copy link"
                                                    aria-label="Copy link"
                                                    className="grid h-7 w-7 place-items-center rounded-control border border-line bg-raised text-ink-muted hover:text-ink"
                                                >
                                                    <Share2 size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => revokeShare(share.id)}
                                                    title="Revoke access"
                                                    aria-label="Revoke access"
                                                    className="grid h-7 w-7 place-items-center rounded-control border border-line bg-raised text-neg hover:bg-neg-soft"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                            <div className="mt-3">
                                                <Badge tone={perm.tone} icon={PermIcon}>
                                                    {perm.label}
                                                </Badge>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            ) : (
                <section>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                        Shared with me ({sharedResources.length})
                    </h3>

                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 2 }).map((_, i) => (
                                <div key={i} className="pem-skeleton h-28 w-full rounded-card" />
                            ))}
                        </div>
                    ) : sharedResources.length === 0 ? (
                        <EmptyState icon={Users} title="No resources shared with you yet" />
                    ) : (
                        <div className="space-y-2.5">
                            {sharedResources.map((share) => {
                                const perm = permOf(share.permission);
                                const PermIcon = perm.icon;
                                const resource = resourceOf(share.resource_type);
                                return (
                                    <motion.div
                                        key={share.id}
                                        initial={{ opacity: 0, x: 12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="rounded-card border border-line bg-sunken p-3.5"
                                    >
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={avatarFor(
                                                    share.Owner?.profilePhoto,
                                                    share.Owner?.username
                                                )}
                                                className="h-11 w-11 rounded-full border-2 border-info"
                                                alt={share.Owner?.username}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="truncate text-sm font-bold text-ink">
                                                        {share.Owner?.fullName ||
                                                            share.Owner?.username}
                                                    </p>
                                                    <Badge tone="pos">Active</Badge>
                                                </div>
                                                <p className="text-xs text-ink-muted">
                                                    Shared a {resource?.label || share.resource_type}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <Badge tone={perm.tone} icon={PermIcon}>
                                                {perm.label}
                                            </Badge>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                icon={Eye}
                                                onClick={() =>
                                                    window.open(`/shared/${share.id}`, '_blank')
                                                }
                                            >
                                                Open
                                            </Button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}
        </SlideOver>
    );
};

export default ShareDropdown;
