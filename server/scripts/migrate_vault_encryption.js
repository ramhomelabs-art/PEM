/**
 * Migration script to encrypt legacy plain-text records in banks and cards tables.
 * Uses AES-256-GCM via cardCrypto.
 * Run with: node server/scripts/migrate_vault_encryption.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { Bank, Card, sequelize } = require('../models');
const { encrypt } = require('../utils/cardCrypto');

function isEncrypted(val) {
    if (!val || typeof val !== 'string') return true;
    return val.startsWith('gcm1:') || val.startsWith('v2:') || (val.includes(':') && val.length > 40);
}

async function runMigration() {
    try {
        console.log('[Migration] Connecting to database...');
        await sequelize.authenticate();
        console.log('[Migration] Database connected successfully.');

        // 1. Migrate Banks (accountNumber)
        const banks = await Bank.findAll();
        let migratedBanks = 0;
        for (const bank of banks) {
            if (bank.accountNumber && !isEncrypted(bank.accountNumber)) {
                const encrypted = encrypt(bank.accountNumber.trim());
                await bank.update({ accountNumber: encrypted });
                migratedBanks++;
            }
        }
        console.log(`[Migration] Banks checked: ${banks.length}, Migrated: ${migratedBanks}`);

        // 2. Migrate Cards (cardNumber and cvv)
        const cards = await Card.findAll();
        let migratedCards = 0;
        for (const card of cards) {
            let needsUpdate = false;
            const updates = {};

            if (card.cardNumber && !isEncrypted(card.cardNumber)) {
                updates.cardNumber = encrypt(card.cardNumber.trim());
                needsUpdate = true;
            }

            if (card.cvv && card.cvv !== '***' && !isEncrypted(card.cvv)) {
                updates.cvv = encrypt(card.cvv.trim());
                needsUpdate = true;
            }

            if (needsUpdate) {
                await card.update(updates);
                migratedCards++;
            }
        }
        console.log(`[Migration] Cards checked: ${cards.length}, Migrated: ${migratedCards}`);
        console.log('[Migration] Vault encryption migration completed successfully.');
    } catch (err) {
        console.error('[Migration] Migration failed:', err);
    } finally {
        await sequelize.close();
    }
}

if (require.main === module) {
    runMigration();
}

module.exports = runMigration;
