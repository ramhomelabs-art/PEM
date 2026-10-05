const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseApp = null;

function initializeFirebase() {
    if (firebaseApp) {
        return firebaseApp;
    }

    try {
        // Check if credentials are in environment variables
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
                })
            });
            console.log('✅ Firebase initialized from environment variables');
        } else {
            // Try to load from file
            const serviceAccount = require('../firebase-adminsdk.json');
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase initialized from service account file');
        }
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error.message);
        console.warn('⚠️ FCM notifications will not work. Falling back to polling only.');
    }

    return firebaseApp;
}

/**
 * Send MFA push notification via FCM
 * @param {string} fcmToken - Device FCM token
 * @param {object} mfaRequest - MFA request data
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendMfaPushNotification(fcmToken, mfaRequest) {
    if (!firebaseApp) {
        initializeFirebase();
    }

    if (!firebaseApp) {
        return { success: false, error: 'Firebase not initialized' };
    }

    if (!fcmToken) {
        return { success: false, error: 'No FCM token provided' };
    }

    const message = {
        token: fcmToken,
        data: {
            type: 'mfa_request',
            requestId: mfaRequest.requestId || '',
            username: mfaRequest.metadata?.username || '',
            email: mfaRequest.metadata?.email || '',
            ipAddress: mfaRequest.metadata?.ipAddress || '',
            userAgent: mfaRequest.metadata?.userAgent || '',
            timestamp: new Date().toISOString()
        },
        notification: {
            title: '🔐 MFA Login Request',
            body: `Approve login for ${mfaRequest.metadata?.username || 'your account'}?`,
            sound: 'default'
        },
        android: {
            priority: 'high',
            notification: {
                channelId: 'mfa_requests',
                clickAction: 'MFA_APPROVAL_ACTION',
                sound: 'default',
                priority: 'max',
                defaultSound: true,
                defaultVibrateTimings: true
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('✅ FCM notification sent successfully:', response);
        return { success: true, messageId: response };
    } catch (error) {
        console.error('❌ FCM notification failed:', error.message);

        // Check if token is invalid
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
            return { success: false, error: 'Invalid or expired FCM token', invalidToken: true };
        }

        return { success: false, error: error.message };
    }
}

/**
 * Send notification to multiple devices
 * @param {string[]} fcmTokens - Array of FCM tokens
 * @param {object} mfaRequest - MFA request data
 * @returns {Promise<{successCount: number, failureCount: number, results: array}>}
 */
async function sendMulticastMfaNotification(fcmTokens, mfaRequest) {
    if (!firebaseApp) {
        initializeFirebase();
    }

    if (!firebaseApp || !fcmTokens || fcmTokens.length === 0) {
        return { successCount: 0, failureCount: 0, results: [] };
    }

    const message = {
        data: {
            type: 'mfa_request',
            requestId: mfaRequest.requestId || '',
            username: mfaRequest.metadata?.username || '',
            email: mfaRequest.metadata?.email || '',
            ipAddress: mfaRequest.metadata?.ipAddress || '',
            timestamp: new Date().toISOString()
        },
        notification: {
            title: '🔐 MFA Login Request',
            body: `Approve login for ${mfaRequest.metadata?.username || 'your account'}?`
        },
        tokens: fcmTokens
    };

    try {
        const response = await admin.messaging().sendMulticast(message);
        console.log(`✅ Multicast sent: ${response.successCount} success, ${response.failureCount} failed`);
        return response;
    } catch (error) {
        console.error('❌ Multicast notification failed:', error.message);
        return { successCount: 0, failureCount: fcmTokens.length, error: error.message };
    }
}

module.exports = {
    initializeFirebase,
    sendMfaPushNotification,
    sendMulticastMfaNotification
};
