// Real-time synchronization utility for PEM
// Provides instant cross-component and cross-tab reactive updates

const SYNC_EVENT = 'pem:data-sync';
let broadcastChannel = null;

try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel('pem_realtime_sync_channel');
    }
} catch (e) {
    console.debug('BroadcastChannel unavailable, using in-window events');
}

/**
 * Notify all listeners across the app and open tabs that data has changed
 * @param {string} dataType - e.g. 'transactions', 'bills', 'commitments', 'fun_jar'
 */
export function notifyDataChanged(dataType = 'transactions') {
    if (typeof window === 'undefined') return;

    // Dispatch local DOM custom event
    const event = new CustomEvent(SYNC_EVENT, {
        detail: { dataType, timestamp: Date.now() }
    });
    window.dispatchEvent(event);

    // Broadcast to other open browser tabs
    if (broadcastChannel) {
        try {
            broadcastChannel.postMessage({ dataType, timestamp: Date.now() });
        } catch (err) {
            console.warn('Broadcast sync error:', err);
        }
    }
}

/**
 * Subscribe to real-time data changes
 * @param {Function} callback - Callback function receiving event details
 * @returns {Function} Unsubscribe function
 */
export function subscribeToDataChanges(callback) {
    if (typeof window === 'undefined') return () => {};

    const localHandler = (e) => {
        if (callback) callback(e.detail || { dataType: 'transactions' });
    };

    const broadcastHandler = (msgEvent) => {
        if (callback) callback(msgEvent.data || { dataType: 'transactions' });
    };

    window.addEventListener(SYNC_EVENT, localHandler);
    if (broadcastChannel) {
        broadcastChannel.addEventListener('message', broadcastHandler);
    }

    // Auto-refresh when user focuses or returns to the tab
    const visibilityHandler = () => {
        if (document.visibilityState === 'visible' && callback) {
            callback({ dataType: 'tab_focus', timestamp: Date.now() });
        }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
        window.removeEventListener(SYNC_EVENT, localHandler);
        if (broadcastChannel) {
            broadcastChannel.removeEventListener('message', broadcastHandler);
        }
        document.removeEventListener('visibilitychange', visibilityHandler);
    };
}
