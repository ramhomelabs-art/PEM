const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const {
    User,
    MfaDevice,
    MfaPushRequest,
    MfaTotpSecret,
    MfaAuditLog
} = require('../models');
const { Op } = require('sequelize');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth');

// QR pairing payload encryption secret. Must match the Android client's build-time
// PEM_PAIRING_SECRET. The value below is a development fallback only.
const DEFAULT_PAIRING_SECRET = 'PEM_FINANCE_SECURE_PAIRING_V2_KEY_2026';
const CONFIGURED_PAIRING_SECRET = process.env.PEM_QR_PAIRING_SECRET;
if (!CONFIGURED_PAIRING_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('[SECURITY] PEM_QR_PAIRING_SECRET must be set in production (QR pairing payload encryption).');
    }
    console.warn('⚠️ [SECURITY] Using development PEM_QR_PAIRING_SECRET fallback. Set it before deploying.');
}
const PAIRING_SECRET = CONFIGURED_PAIRING_SECRET || DEFAULT_PAIRING_SECRET;

const isValidUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// Serializes read-modify-write operations on user.preferences per user. Without this,
// concurrent QR generations both read stale preferences and one token's write is lost,
// producing "Invalid binding token" on the client (the displayed token is never persisted).
const userLocks = new Map();
function withUserLock(key, fn) {
    const prev = userLocks.get(key) || Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.then(() => {}, () => {});
    userLocks.set(key, tail);
    tail.then(() => { if (userLocks.get(key) === tail) userLocks.delete(key); });
    return run;
}

class MFAService {
    /**
     * Encrypts pairing payload with AES-256-GCM using SHA-256 derived key.
     * Format: Base64(12-byte IV + ciphertext + 16-byte auth tag)
     */
    encryptPairingPayload(payloadStr, password = PAIRING_SECRET) {
        const key = crypto.createHash('sha256').update(password, 'utf8').digest();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(payloadStr, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        const combined = Buffer.concat([iv, encrypted, tag]);
        return combined.toString('base64');
    }

    /**
     * Decrypts AES-256-GCM pairing payload
     */
    decryptPairingPayload(base64Str, password = PAIRING_SECRET) {
        const key = crypto.createHash('sha256').update(password, 'utf8').digest();
        const combined = Buffer.from(base64Str, 'base64');
        if (combined.length < 12 + 16) {
            throw new Error('Invalid payload size');
        }
        const iv = combined.subarray(0, 12);
        const tag = combined.subarray(combined.length - 16);
        const ciphertext = combined.subarray(12, combined.length - 16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    }

    /**
     * Generate encrypted QR code data for device binding
     * Strictly restricted to the official PEM Android Companion App
     * @param {number} userId - User ID
     * @param {string} serverUrlOverride - Optional custom server URL
     * @returns {Promise<{bindingToken: string, qrCodeUrl: string, rawEnvelope: string, isEncrypted: boolean, expiresAt: Date}>}
     */
    async generateQRCodeData(userId, serverUrlOverride = null) {
        return withUserLock(`qr:${userId}`, async () => {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Generate unique cryptographically strong binding token
        const bindingToken = crypto.randomBytes(32).toString('hex');

        // Store binding token temporarily (expires in 10 minutes)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const { getPrimaryLanIp, getAllLanIps } = require('../utils/networkUtils');
        const lanIp = getPrimaryLanIp();
        const allLanIps = getAllLanIps();
        let serverUrl = (serverUrlOverride || process.env.SERVER_URL || `http://${lanIp}:5174`).trim().replace(/\/+$/, '');
        if (serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1')) {
            const portPart = serverUrl.split(':')[2] || '5174';
            serverUrl = `http://${lanIp}:${portPart}`;
        }
        const port5005 = serverUrl.includes(':5174') ? serverUrl.replace(':5174', ':5005') : serverUrl;
        const port5174 = serverUrl.includes(':5005') ? serverUrl.replace(':5005', ':5174') : (serverUrl.includes(':5174') ? serverUrl : `${serverUrl}:5174`);
        // Advertise every physical LAN IP (not just the primary) on both ports so the
        // app keeps working right after the host changes networks (Wi-Fi <-> Ethernet).
        const lanIpUrls = allLanIps.flatMap((ip) => [`http://${ip}:5174`, `http://${ip}:5005`]);
        const fallbackUrls = Array.from(new Set([port5174, port5005, ...lanIpUrls]));

        // Create compact raw payload containing device binding credentials
        const rawPayload = JSON.stringify({
            userId: userId,
            bindingToken: bindingToken,
            serverUrl: port5174, // Prefer LAN-accessible port 5174 which proxies /api to port 5005
            fallbackUrls: fallbackUrls
        });

        // Encrypt payload with AES-256-GCM so NO external camera, Google Lens, or 3rd-party scanner
        // can extract URLs, tokens, or secret credentials.
        const encryptedBase64 = this.encryptPairingPayload(rawPayload);
        const secureEnvelope = `PEMSEC2::${encryptedBase64}`;

        // Generate high-speed, crisp high-contrast encrypted QR code with Error Correction Level 'M'
        const qrCodeUrl = await QRCode.toDataURL(secureEnvelope, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.98,
            margin: 2,
            color: {
                dark: '#000000', // Crisp pure black modules for instantaneous camera sensor detection
                light: '#ffffff'
            },
            width: 380
        });

        // Store binding token in user preferences temporarily (with recent tokens pool for session resilience)
        const existingTokens = Array.isArray(user.preferences?.pendingMfaTokens)
            ? user.preferences.pendingMfaTokens.filter(t => t && new Date(t.expiresAt) > new Date())
            : [];
        if (user.preferences?.pendingMfaBinding?.token) {
            existingTokens.push(user.preferences.pendingMfaBinding);
        }
        existingTokens.push({
            token: bindingToken,
            expiresAt: expiresAt.toISOString(),
            serverUrl: serverUrl
        });
        const pendingTokens = existingTokens.slice(-5);

        await user.update({
            preferences: {
                ...user.preferences,
                pendingMfaBinding: {
                    token: bindingToken,
                    expiresAt: expiresAt.toISOString(),
                    serverUrl: serverUrl
                },
                pendingMfaTokens: pendingTokens
            }
        });

        return {
            bindingToken,
            qrCodeUrl,
            rawEnvelope: secureEnvelope,
            isEncrypted: true,
            securityProtocol: 'PEM-AES256-GCM-V2',
            expiresAt
        };
        });
    }

    /**
     * Bind a device to a user account
     * @param {number} userId - User ID
     * @param {object} deviceInfo - Device information
     * @param {string} bindingToken - Binding token from QR code
     * @param {string} fcmToken - Firebase Cloud Messaging token
     * @returns {Promise<{deviceId: string, webhookUrl: string, secretKey: string, encryptionKey: string}>}
     */
    async bindDevice(userId, deviceInfo, bindingToken, fcmToken) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Validate binding token
        const submittedToken = (bindingToken || '').trim();
        const primaryPending = user.preferences?.pendingMfaBinding;
        const pendingList = Array.isArray(user.preferences?.pendingMfaTokens) ? user.preferences.pendingMfaTokens : [];

        console.log(`[MFA Bind] User ${userId} attempting device bind. Submitted token prefix: "${submittedToken.substring(0, 8)}", Primary stored: "${(primaryPending?.token || '').substring(0, 8)}", Stored pool count: ${pendingList.length}`);

        let matchedBinding = null;
        if (primaryPending && (primaryPending.token || '').trim().toLowerCase() === submittedToken.toLowerCase()) {
            matchedBinding = primaryPending;
        } else {
            matchedBinding = pendingList.find(t => t && (t.token || '').trim().toLowerCase() === submittedToken.toLowerCase());
        }

        if (!matchedBinding) {
            // Also check emergency fallback against existing user credentials (smsApiKey, encryptionKey)
            if (user.smsApiKey && user.smsApiKey.toLowerCase() === submittedToken.toLowerCase()) {
                console.log(`[MFA Bind] Emergency fallback matched user.smsApiKey for User ${userId}`);
                matchedBinding = { serverUrl: null, expiresAt: new Date(Date.now() + 60000).toISOString() };
            } else if (user.encryptionKey && user.encryptionKey.toLowerCase() === submittedToken.toLowerCase()) {
                console.log(`[MFA Bind] Emergency fallback matched user.encryptionKey for User ${userId}`);
                matchedBinding = { serverUrl: null, expiresAt: new Date(Date.now() + 60000).toISOString() };
            } else {
                console.error(`[MFA Bind] Token mismatch for User ${userId}. Submitted: "${submittedToken}", Stored Primary: "${primaryPending?.token}"`);
                throw new Error('Invalid binding token');
            }
        }

        // Check if token has expired
        if (new Date(matchedBinding.expiresAt) < new Date()) {
            throw new Error('Binding token has expired');
        }

        // Generate device credentials
        const deviceId = uuidv4();
        const secretKey = crypto.randomBytes(32).toString('hex');
        const encryptionKey = crypto.randomBytes(24).toString('base64').substring(0, 32);
        const { getPrimaryLanIp: getLanIp } = require('../utils/networkUtils');
        const defaultLan = getLanIp();
        let serverBase = matchedBinding.serverUrl || process.env.SERVER_URL || `http://${defaultLan}:5174`;
        if (serverBase.includes('localhost') || serverBase.includes('127.0.0.1')) {
            const portPart = serverBase.split(':')[2] || '5174';
            serverBase = `http://${defaultLan}:${portPart}`;
        }
        if (serverBase.includes(':5005')) {
            serverBase = serverBase.replace(':5005', ':5174');
        }
        const webhookUrl = `${serverBase}/api/sms/webhook`;

        // Create device fingerprint
        const deviceFingerprint = crypto
            .createHash('sha256')
            .update(`${deviceInfo.model}-${deviceInfo.manufacturer}-${deviceInfo.androidId}`)
            .digest('hex');

        // Create device record
        const device = await MfaDevice.create({
            id: deviceId,
            userId: userId,
            deviceName: `${deviceInfo.manufacturer} ${deviceInfo.model}`,
            deviceFingerprint: deviceFingerprint,
            deviceInfo: deviceInfo,
            webhookUrl: webhookUrl,
            secretKey: secretKey,
            encryptionKey: encryptionKey,
            fcmToken: fcmToken,
            isActive: true,
            lastUsed: new Date()
        });

        // Ensure TOTP secret exists for the user (Auto-configure logic)
        const existingTotp = await MfaTotpSecret.findOne({ where: { userId: userId } });
        let totpSecret = '';

        if (!existingTotp) {
            console.log(`[MFA] Auto-configuring TOTP for user ${userId} during device binding.`);
            const newTotp = await this.generateTOTPSecret(userId);
            totpSecret = newTotp.secret;

            // Verify the newly created secret immediately since this is a bound device
            await MfaTotpSecret.update({ isVerified: true }, {
                where: { userId: userId, secret: totpSecret }
            });

            // Also update user MFA settings
            await user.update({
                mfaEnabled: true,
                mfaConfigured: true,
                mfaMethod: 'both', // Default to BOTH (Push + TOTP) for mobile binding
                preferences: {
                    ...user.preferences,
                    pendingMfaBinding: null
                }
            });
        } else {
            console.log(`[MFA] TOTP already configured (or pending) for user ${userId}. Using existing secret.`);
            totpSecret = existingTotp.secret;

            // CRITICAL: Mark the existing pre-generated secret as verified now that device is bound
            if (!existingTotp.isVerified) {
                console.log(`[MFA] Verifying pending TOTP secret for user ${userId}`);
                await existingTotp.update({ isVerified: true });
            }

            // Upgrade to BOTH if currently just TOTP, since we now have a device
            const newMethod = (user.mfaMethod === 'totp' || !user.mfaMethod) ? 'both' : user.mfaMethod;

            // Clear pending binding & ensure enabled
            await user.update({
                mfaEnabled: true,
                mfaConfigured: true,
                mfaMethod: newMethod,
                preferences: {
                    ...user.preferences,
                    pendingMfaBinding: null
                }
            });
        }

        // Update user device connectivity status for instant approval
        await user.update({
            lastDeviceSync: new Date(),
            isDeviceApproved: true,
            deviceInfo: deviceInfo
        });

        // Log device binding event
        await this.logMFAEvent(userId, 'device_bound', deviceId, null, {
            deviceName: device.deviceName,
            deviceFingerprint: deviceFingerprint
        });


        return {
            deviceId: device.id,
            webhookUrl: webhookUrl,
            secretKey: user.smsApiKey || secretKey,
            encryptionKey: encryptionKey || (device && device.encryptionKey) || '',
            totpSecret: totpSecret || ''
        };
    }


    /**
     * Send push notification request
     * @param {number} userId - User ID
     * @param {string} deviceId - Device ID (optional, uses first active device if not provided)
     * @param {object} metadata - Request metadata (IP, user agent, etc.)
     * @returns {Promise<{requestId: string, expiresAt: Date}>}
     */
    async sendPushRequest(userId, deviceId = null, metadata = {}) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Get device
        let device;
        if (deviceId) {
            device = await MfaDevice.findOne({
                where: { id: deviceId, userId: userId, isActive: true }
            });
        } else {
            // Get first active device
            device = await MfaDevice.findOne({
                where: { userId: userId, isActive: true },
                order: [['last_used', 'DESC']]
            });
        }

        if (!device) {
            // Fallback to latest device registered for this user
            device = await MfaDevice.findOne({
                where: { userId: userId },
                order: [['last_used', 'DESC']]
            });
            if (device) {
                device.isActive = true;
                await device.save().catch(() => {});
            }
        }

        if (!device) {
            throw new Error('No active device found');
        }

        // Generate UUID for request
        const requestId = uuidv4();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Create push request with correct field structure
        const pushRequest = await MfaPushRequest.create({
            requestId: requestId,  // UUID instead of requestToken
            userId: userId,  // Required by association
            deviceId: device.id,
            loginAttemptId: metadata.loginAttemptId || null,
            status: 'pending',
            metadata: {  // Pass object directly to Sequelize for JSON columns
                ipAddress: metadata.ipAddress || 'Unknown',
                userAgent: metadata.userAgent || 'Unknown',
                location: metadata.location || 'Unknown',
                username: user.username,
                email: user.email,
                timestamp: new Date().toISOString()
            },
            expiresAt: expiresAt
        });

        console.log(`✅ Created push request: ${requestId} for device ${device.deviceName}`);

        // FCM is disabled. Mobile devices will poll the /pending-requests endpoint to receive the request.
        console.log(`ℹ️ Created push request: ${requestId} for device ${device.deviceName}. Polling-only mode active.`);

        return {
            requestId: pushRequest.requestId,  // Return the UUID
            expiresAt: expiresAt
        };
    }



    /**
     * Verify push notification response
     * @param {string} requestId - Request ID
     * @param {string} response - 'approved' or 'denied'
     * @param {string} deviceId - Device ID (for verification)
     * @returns {Promise<{success: boolean, token?: string}>}
     */
    async verifyPushResponse(requestId, response, deviceId, responseIp) {
        if (!isValidUUID(requestId)) {
            throw new Error('Push request not found');
        }
        const pushRequest = await MfaPushRequest.findOne({
            where: { requestId: requestId }
        });

        if (!pushRequest) {
            throw new Error('Push request not found');
        }

        // Verify device
        if (pushRequest.deviceId !== deviceId) {
            throw new Error('Device mismatch');
        }

        // Check if already responded
        if (pushRequest.status !== 'pending') {
            throw new Error('Request already responded to');
        }

        // Check if expired
        if (new Date() > new Date(pushRequest.expiresAt)) {
            await pushRequest.update({ status: 'expired' });
            await this.logMFAEvent(pushRequest.userId, 'push_timeout', deviceId, pushRequest.metadata?.ipAddress);
            throw new Error('Request has expired');
        }

        // IP Validation (Device Fingerprinting)
        let warningDetails = {};
        const requestIp = pushRequest.metadata?.ipAddress;
        if (responseIp && requestIp && responseIp !== requestIp) {
            console.warn(`[MFA Warning] Push response IP (${responseIp}) differs from request IP (${requestIp})`);
            warningDetails = {
                warning: 'IP mismatch',
                originalIp: requestIp,
                responseIp: responseIp
            };
        }

        // Update request status
        const status = response === 'approved' ? 'approved' : 'denied';
        await pushRequest.update({
            status: status,
            respondedAt: new Date()
        });

        // Update device last used
        await MfaDevice.update(
            { lastUsed: new Date() },
            { where: { id: deviceId } }
        );

        // Log event
        const eventType = response === 'approved' ? 'push_approved' : 'push_denied';
        await this.logMFAEvent(pushRequest.userId, eventType, deviceId, requestIp, warningDetails);

        if (response === 'approved') {
            // Generate JWT token
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { id: pushRequest.userId },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            await this.logMFAEvent(pushRequest.userId, 'login_success', deviceId, requestIp);

            return { success: true, token: token };
        } else {
            return { success: false };
        }
    }

    /**
     * Get push request status
     * @param {string} requestId - Request ID
     * @returns {Promise<{status: string, token?: string}>}
     */
    async getPushRequestStatus(requestId) {
        if (!isValidUUID(requestId)) {
            throw new Error('Push request not found');
        }
        const pushRequest = await MfaPushRequest.findOne({
            where: { requestId: requestId }
        });

        if (!pushRequest) {
            throw new Error('Push request not found');
        }

        // Check if expired
        if (pushRequest.status === 'pending' && new Date() > new Date(pushRequest.expiresAt)) {
            await pushRequest.update({ status: 'expired' });
            await this.logMFAEvent(pushRequest.userId, 'push_timeout', pushRequest.deviceId, pushRequest.metadata?.ipAddress);
            return { status: 'expired' };
        }

        if (pushRequest.status === 'approved') {
            const user = await User.findByPk(pushRequest.userId);
            if (!user) {
                return { status: 'denied', reason: 'User not found' };
            }

            // Generate JWT token
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            return {
                status: 'approved',
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName,
                    profilePhoto: user.profilePhoto,
                    role: user.role,
                    currency: user.currency || 'INR',
                    country: user.country || 'India',
                    timezone: user.timezone || 'IST (UTC+5:30)',
                    preferences: user.preferences
                }
            };
        }

        return { status: pushRequest.status };
    }

    /**
     * Handle push notification response from mobile device
     * @param {string} requestId - Push request ID
     * @param {string} deviceId - Device ID
     * @param {string} response - 'approved' or 'denied'
     * @returns {Promise<void>}
     */
    async handlePushResponse(requestId, deviceId, response) {
        if (!isValidUUID(requestId)) {
            throw new Error('Push request not found');
        }
        const pushRequest = await MfaPushRequest.findOne({
            where: { requestId: requestId }
        });

        if (!pushRequest) {
            throw new Error('Push request not found');
        }

        if (pushRequest.deviceId !== deviceId) {
            throw new Error('Device mismatch');
        }

        if (pushRequest.status !== 'pending') {
            throw new Error('Request already processed');
        }

        // Check for expiration
        if (new Date() > new Date(pushRequest.expiresAt)) {
            await pushRequest.update({ status: 'expired' });
            throw new Error('Request expired');
        }

        // Update status
        await pushRequest.update({ status: response });

        // Log event
        await this.logMFAEvent(
            pushRequest.userId,
            response === 'approved' ? 'push_approved' : 'push_denied',
            deviceId,
            pushRequest.metadata?.ipAddress
        );

        return { success: true };
    }

    /**
     * Generate TOTP secret for user
     * @param {number} userId - User ID
     * @returns {Promise<{secret: string, qrCodeUrl: string, backupCodes: string[]}>}
     */
    async generateTOTPSecret(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Check if TOTP already exists
        let totpSecret = await MfaTotpSecret.findOne({ where: { userId: userId } });

        if (totpSecret && totpSecret.isVerified) {
            throw new Error('TOTP already configured. Reset MFA to reconfigure.');
        }

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `PEM Pro (${user.email})`,
            issuer: 'Personal Expense Manager'
        });

        // Generate backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            const code = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 characters
            backupCodes.push(code);
        }

        // Hash backup codes for storage
        const hashedBackupCodes = await Promise.all(
            backupCodes.map(code => bcrypt.hash(code, 10))
        );

        // Create or update TOTP secret
        if (totpSecret) {
            await totpSecret.update({
                secret: secret.base32,
                backupCodes: hashedBackupCodes,
                isVerified: false
            });
        } else {
            totpSecret = await MfaTotpSecret.create({
                userId: userId,
                secret: secret.base32,
                backupCodes: hashedBackupCodes,
                isVerified: false
            });
        }

        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        return {
            secret: secret.base32,
            qrCodeUrl: qrCodeUrl,
            backupCodes: backupCodes // Return plain codes for user to save
        };
    }

    /**
     * Verify TOTP code
     * @param {number} userId - User ID
     * @param {string} code - 6-digit TOTP code
     * @param {boolean} isSetup - Whether this is for setup verification
     * @returns {Promise<{success: boolean, token?: string}>}
     */
    async verifyTOTP(userId, code, isSetup = false) {
        const totpSecret = await MfaTotpSecret.findOne({ where: { userId: userId } });

        if (!totpSecret) {
            throw new Error('TOTP not configured');
        }

        // Verify code
        const verified = speakeasy.totp.verify({
            secret: totpSecret.secret,
            encoding: 'base32',
            token: code,
            window: 1 // Allow 1 time step before/after for clock skew
        });

        if (verified) {
            // Mark as verified if this is setup
            if (isSetup && !totpSecret.isVerified) {
                await totpSecret.update({ isVerified: true });
            }

            await this.logMFAEvent(userId, 'totp_success', null, null);

            if (!isSetup) {
                // Generate JWT token
                const jwt = require('jsonwebtoken');
                const user = await User.findByPk(userId);
                const token = jwt.sign(
                    { id: user.id, username: user.username, role: user.role },
                    JWT_SECRET,
                    { expiresIn: JWT_EXPIRES_IN }
                );

                await this.logMFAEvent(userId, 'login_success', null, null);

                return {
                    success: true,
                    token: token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        fullName: user.fullName,
                        profilePhoto: user.profilePhoto,
                        role: user.role
                    }
                };
            }

            return { success: true };
        } else {
            await this.logMFAEvent(userId, 'totp_failure', null, null);
            return { success: false };
        }
    }

    /**
     * Verify backup code
     * @param {number} userId - User ID
     * @param {string} code - Backup code
     * @returns {Promise<{success: boolean, token?: string}>}
     */
    async verifyBackupCode(userId, code) {
        const totpSecret = await MfaTotpSecret.findOne({ where: { userId: userId } });

        if (!totpSecret || !totpSecret.backupCodes) {
            throw new Error('No backup codes found');
        }

        // Check each backup code
        for (let i = 0; i < totpSecret.backupCodes.length; i++) {
            const isMatch = await bcrypt.compare(code, totpSecret.backupCodes[i]);

            if (isMatch) {
                // Remove used backup code
                const updatedCodes = [...totpSecret.backupCodes];
                updatedCodes.splice(i, 1);
                await totpSecret.update({ backupCodes: updatedCodes });

                await this.logMFAEvent(userId, 'backup_code_used', null, null);

                // Generate JWT token
                const jwt = require('jsonwebtoken');
                const token = jwt.sign(
                    { id: userId },
                    JWT_SECRET,
                    { expiresIn: JWT_EXPIRES_IN }
                );

                await this.logMFAEvent(userId, 'login_success', null, null);

                return { success: true, token: token };
            }
        }

        return { success: false };
    }

    /**
     * Configure MFA method for user
     * @param {number} userId - User ID
     * @param {string} method - 'push', 'totp', or 'both'
     * @returns {Promise<void>}
     */
    async configureMFAMethod(userId, method) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (method === 'none') {
            await user.update({
                mfaEnabled: false,
                mfaMethod: null,
                mfaConfigured: false
            });
            await this.logMFAEvent(userId, 'mfa_disabled', null, null);
            return;
        }

        // Validate method
        if (!['push', 'totp', 'both'].includes(method)) {
            throw new Error('Invalid MFA method');
        }

        // Check if required setup is complete
        if (method === 'push' || method === 'both') {
            const hasDevice = await MfaDevice.findOne({
                where: { userId: userId, isActive: true }
            });
            if (!hasDevice) {
                throw new Error('No device configured for push notifications');
            }
        }

        if (method === 'totp' || method === 'both') {
            const totpSecret = await MfaTotpSecret.findOne({
                where: { userId: userId, isVerified: true }
            });
            if (!totpSecret) {
                throw new Error('TOTP not configured or not verified');
            }
        }

        // Update user
        await user.update({
            mfaEnabled: true,
            mfaMethod: method,
            mfaConfigured: true
        });

        await this.logMFAEvent(userId, 'mfa_enabled', null, null, { method: method });
    }

    /**
     * Revoke a device
     * @param {string} deviceId - Device ID
     * @param {number} adminUserId - Admin user ID (for audit)
     * @returns {Promise<void>}
     */
    async revokeDevice(deviceId, adminUserId = null) {
        const device = await MfaDevice.findByPk(deviceId);

        if (!device) {
            throw new Error('Device not found');
        }

        await device.update({ isActive: false });

        await this.logMFAEvent(
            device.userId,
            'device_revoked',
            deviceId,
            null,
            { revokedBy: adminUserId, deviceName: device.deviceName }
        );
    }

    /**
     * Reset user MFA configuration
     * @param {number} userId - User ID
     * @param {number} adminUserId - Admin user ID (for audit)
     * @returns {Promise<void>}
     */
    async resetUserMFA(userId, adminUserId = null) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Deactivate all devices
        await MfaDevice.update(
            { isActive: false },
            { where: { userId: userId } }
        );

        // Delete TOTP secret
        await MfaTotpSecret.destroy({ where: { userId: userId } });

        // Update user
        await user.update({
            mfaEnabled: false,
            mfaMethod: null,
            mfaConfigured: false
        });

        await this.logMFAEvent(userId, 'mfa_reset', null, null, { resetBy: adminUserId });
    }

    /**
     * Log MFA event
     * @param {number} userId - User ID
     * @param {string} eventType - Event type
     * @param {string} deviceId - Device ID (optional)
     * @param {string} ipAddress - IP address (optional)
     * @param {object} details - Additional details (optional)
     * @returns {Promise<void>}
     */
    async logMFAEvent(userId, eventType, deviceId = null, ipAddress = null, details = {}) {
        try {
            await MfaAuditLog.create({
                userId: userId,
                eventType: eventType,
                deviceId: deviceId,
                ipAddress: ipAddress,
                userAgent: details?.userAgent || null,
                details: details || {}
            });
        } catch (error) {
            console.error('Failed to log MFA event:', error);
            // Don't throw - logging failures shouldn't break the flow
        }
    }

    /**
     * Setup MFA for a user (Alias for generateTOTPSecret)
     * @param {number} userId - User ID
     * @returns {Promise<{secret: string, qrCodeUrl: string, backupCodes: string[]}>}
     */
    async setupMFA(userId) {
        return await this.generateTOTPSecret(userId);
    }

    /**
     * Get user's MFA devices
     * @param {number} userId - User ID
     * @returns {Promise<Array>}
     */
    async getUserDevices(userId) {
        return await MfaDevice.findAll({
            where: { userId: userId },
            order: [['lastUsed', 'DESC']]
        });
    }

    /**
     * Get MFA audit logs
     * @param {number} userId - User ID (optional)
     * @param {number} limit - Limit
     * @param {number} offset - Offset
     * @returns {Promise<{rows: Array, count: number}>}
     */
    async getAuditLogs(userId = null, limit = 50, offset = 0) {
        const where = userId ? { userId: userId } : {};

        return await MfaAuditLog.findAndCountAll({
            where: where,
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset,
            include: [
                {
                    model: User,
                    attributes: ['id', 'username', 'email']
                },
                {
                    model: MfaDevice,
                    attributes: ['id', 'deviceName']
                }
            ]
        });
    }

    /**
     * Cleanup expired push requests
     * @returns {Promise<number>} Number of deleted requests
     */
    async cleanupExpiredRequests() {
        const result = await MfaPushRequest.update(
            { status: 'expired' },
            {
                where: {
                    status: 'pending',
                    expiresAt: { [Op.lt]: new Date() }
                }
            }
        );

        return result[0]; // Number of affected rows
    }

    /**
     * Generate current TOTP code for a bound device (Mobile App)
     * @param {string} deviceId - Device ID
     * @returns {Promise<{code: string, expiresIn: number}>}
     */
    async generateTOTPForDevice(deviceId) {
        const device = await MfaDevice.findByPk(deviceId);

        if (!device) {
            throw new Error('Device not found');
        }

        if (!device.isActive) {
            throw new Error('Device is not active');
        }

        // Get user's TOTP secret
        const totpSecret = await MfaTotpSecret.findOne({
            where: { userId: device.userId, isVerified: true }
        });

        if (!totpSecret) {
            throw new Error('TOTP not configured for this user');
        }

        // Generate current TOTP code
        const code = speakeasy.totp({
            secret: totpSecret.secret,
            encoding: 'base32'
        });

        // Calculate time remaining until code expires (30 second window)
        const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

        // Update device last used
        await device.update({ lastUsed: new Date() });

        await this.logMFAEvent(device.userId, 'totp_generated', deviceId, null, {
            deviceName: device.deviceName
        });

        return {
            code: code,
            expiresIn: timeRemaining
        };
    }

    /**
     * Validate device binding is still valid
     * @param {string} deviceId - Device ID
     * @param {string} deviceFingerprint - Device fingerprint
     * @returns {Promise<{valid: boolean, reason?: string}>}
     */
    async validateDeviceBinding(deviceId, deviceFingerprint) {
        const device = await MfaDevice.findByPk(deviceId);

        if (!device) {
            return { valid: false, reason: 'Device not found' };
        }

        if (!device.isActive) {
            return { valid: false, reason: 'Device has been revoked' };
        }

        // Verify device fingerprint matches
        if (device.deviceFingerprint !== deviceFingerprint) {
            await this.logMFAEvent(device.userId, 'device_fingerprint_mismatch', deviceId, null, {
                expectedFingerprint: device.deviceFingerprint,
                receivedFingerprint: deviceFingerprint
            });
            return { valid: false, reason: 'Device fingerprint mismatch' };
        }

        // Update last used
        await device.update({ lastUsed: new Date() });

        return { valid: true };
    }

    /**
     * Get MFA status for a specific device
     * @param {string} deviceId - Device ID
     * @returns {Promise<{mfaEnabled: boolean, mfaMethod: string, deviceInfo: object}>}
     */
    async getDeviceMFAStatus(deviceId) {
        const device = await MfaDevice.findByPk(deviceId, {
            include: [{
                model: User,
                attributes: ['id', 'username', 'email', 'mfaEnabled', 'mfaMethod', 'mfaConfigured']
            }]
        });

        if (!device) {
            throw new Error('Device not found');
        }

        if (!device.isActive) {
            throw new Error('Device is not active');
        }

        const user = device.User;

        return {
            mfaEnabled: user.mfaEnabled,
            mfaMethod: user.mfaMethod,
            mfaConfigured: user.mfaConfigured,
            deviceInfo: {
                deviceId: device.id,
                deviceName: device.deviceName,
                lastUsed: device.lastUsed,
                webhookUrl: device.webhookUrl
            },
            userInfo: {
                userId: user.id,
                username: user.username,
                email: user.email
            }
        };
    }

    /**
     * Initiate login MFA process (send push if needed)
     * @param {number} userId - User ID
     * @param {string} ipAddress - Client IP
     * @param {string} userAgent - Client User Agent
     * @returns {Promise<{mfaRequired: boolean, mfaMethod: string, requestId: string}>}
     */
    async initiateLogin(userId, ipAddress, userAgent) {
        const user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');

        let requestId = null;
        let effectiveMethod = user.mfaMethod || 'totp';

        // Check if user has an active push device
        const activeDevice = await MfaDevice.findOne({
            where: { userId: userId, isActive: true }
        });

        if (effectiveMethod === 'push' || effectiveMethod === 'both') {
            if (activeDevice) {
                try {
                    const pushResult = await this.sendPushRequest(userId, null, {
                        ipAddress,
                        userAgent,
                        type: 'login_request'
                    });
                    requestId = pushResult.requestId;
                } catch (err) {
                    console.error('Failed to send push request:', err);
                    requestId = null;
                }
            } else {
                // No active companion device paired -> fallback to TOTP
                effectiveMethod = 'totp';
            }
        }

        // Log the MFA challenge
        await this.logMFAEvent(userId, 'mfa_challenge_issued', null, ipAddress, {
            method: effectiveMethod,
            requestId
        });

        return {
            mfaRequired: true,
            mfaMethod: effectiveMethod,
            requestId: requestId
        };
    }

    /**
     * Mobile login - authenticate and handle MFA
     * @param {string} username - Username
     * @param {string} password - Password
     * @param {string} deviceId - Device ID (optional)
     * @param {object} metadata - Request metadata
     * @returns {Promise<{success: boolean, mfaRequired: boolean, requestId?: string, token?: string}>}
     */
    async mobileLogin(username, password, deviceId = null, metadata = {}, totpCode = null) {
        const user = await User.findOne({
            where: {
                [Op.or]: [{ username: username }, { email: username }]
            }
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Check if user is active
        if (user.status !== 'active') {
            throw new Error('Account is not active');
        }

        // If device ID provided, validate it
        if (deviceId) {
            const device = await MfaDevice.findOne({
                where: { id: deviceId, userId: user.id, isActive: true }
            });

            if (!device) {
                throw new Error('Device not found or not bound to this user');
            }
        }

        // Check if MFA is enabled
        if (!user.mfaEnabled || !user.mfaConfigured) {
            // MFA not configured - return token directly
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            await this.logMFAEvent(user.id, 'mobile_login_success', deviceId, metadata.ipAddress, {
                mfaNotConfigured: true
            });

            // If device is bound, return credentials for SMS webhook
            let credentials = {};
            if (deviceId) {
                const device = await MfaDevice.findByPk(deviceId);
                if (device) {
                    credentials = {
                        smsApiKey: user.smsApiKey,
                        encryptionKey: user.encryptionKey,
                        webhookUrl: device.webhookUrl
                    };
                }
            }

            return {
                success: true,
                mfaRequired: false,
                needsSetup: user.mfaEnabled && !user.mfaConfigured,
                token: token,
                userId: user.id,
                ...credentials
            };
        }

        // Check optional TOTP code if provided
        if (totpCode) {
            const verifyResult = await this.verifyTOTP(user.id, totpCode);
            if (verifyResult.success) {
                // Generate full token with user details
                const jwt = require('jsonwebtoken');
                const token = jwt.sign(
                    { id: user.id, username: user.username, role: user.role },
                    JWT_SECRET,
                    { expiresIn: JWT_EXPIRES_IN }
                );

                await this.logMFAEvent(user.id, 'mobile_login_success', deviceId, metadata.ipAddress, {
                    method: 'totp'
                });

                // If device is bound, return credentials for SMS webhook
                let credentials = {};
                if (deviceId) {
                    const device = await MfaDevice.findByPk(deviceId);
                    if (device) {
                        credentials = {
                            smsApiKey: user.smsApiKey,
                            encryptionKey: user.encryptionKey,
                            webhookUrl: device.webhookUrl
                        };
                    }
                }

                return {
                    success: true,
                    mfaRequired: false,
                    token: token,
                    userId: user.id,
                    ...credentials
                };
            } else {
                throw new Error('Invalid TOTP code');
            }
        }

        // MFA is enabled - send push request if method is push or both
        if (user.mfaMethod === 'push' || user.mfaMethod === 'both') {
            const pushRequest = await this.sendPushRequest(user.id, deviceId, metadata);

            return {
                success: true,
                mfaRequired: true,
                mfaMethod: user.mfaMethod,
                requestId: pushRequest.requestId,
                expiresAt: pushRequest.expiresAt
            };
        }

        // TOTP only
        return {
            success: true,
            mfaRequired: true,
            mfaMethod: 'totp',
            userId: user.id
        };
    }
}


module.exports = new MFAService();

