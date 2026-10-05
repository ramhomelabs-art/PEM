const crypto = require('crypto');

/**
 * KeyManager handles API and Encryption keys using raw SQL to bypass ORM caching.
 */
module.exports = (sequelize) => {
    return {
        /**
         * Get keys for a user directly from the database.
         */
        async getKeys(userId) {
            try {
                const results = await sequelize.query(
                    "SELECT \"smsApiKey\", \"encryptionKey\" FROM users WHERE id = ?",
                    {
                        replacements: [userId],
                        type: sequelize.QueryTypes.SELECT
                    }
                );
                if (!results || results.length === 0) return null;

                const row = results[0];

                // Case-insensitive mapping for safety
                return {
                    smsApiKey: row.smsApiKey || row.sms_api_key || row.smsapikey,
                    encryptionKey: row.encryptionKey || row.encryption_key || row.encryptionkey
                };
            } catch (err) {
                console.error("[KeyManager] Error getting keys:", err);
                return null;
            }
        },

        /**
         * Generate and save new keys for a user.
         */
        async generateKeys(userId) {
            try {
                const smsApiKey = crypto.randomBytes(8).toString('hex');
                const encryptionKey = crypto.randomBytes(24).toString('base64').substring(0, 32);

                await sequelize.query(
                    "UPDATE users SET \"smsApiKey\" = ?, \"encryptionKey\" = ? WHERE id = ?",
                    { replacements: [smsApiKey, encryptionKey, userId] }
                );

                console.log(`[KeyManager] Generated new keys for User ID: ${userId}`);
                return { smsApiKey, encryptionKey };
            } catch (err) {
                console.error("[KeyManager] Error generating keys:", err);
                throw err;
            }
        },

        /**
         * Ensure user has keys, creating them if missing.
         */
        async ensureKeys(userId) {
            const keys = await this.getKeys(userId);
            if (!keys || !keys.smsApiKey || !keys.encryptionKey) {
                console.log(`[KeyManager] Keys missing for User ID: ${userId}. Generating...`);
                return await this.generateKeys(userId);
            }
            return keys;
        }
    };
};
