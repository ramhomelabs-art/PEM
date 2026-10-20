const { sequelize, Card, Bank } = require('../models');

async function migrate() {
    try {
        await sequelize.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS "bankName" VARCHAR(255);');
        console.log('Added bankName column to cards table if not exists.');

        // Update card ending in 4116 to have bankName Canara Bank
        await sequelize.query(`UPDATE cards SET "bankName" = 'Canara Bank' WHERE "cardNumber" LIKE '%:4116' OR id = '63102898-180b-4213-860b-77a32d4ede70';`);
        console.log('Updated standalone card 4116 with bankName = Canara Bank.');

        // For any other cards, set bankName from their linked Bank if bankName is null
        await sequelize.query(`UPDATE cards c SET "bankName" = b.name FROM banks b WHERE c."bankId" = b.id AND (c."bankName" IS NULL OR c."bankName" = '');`);
        console.log('Backfilled existing linked cards with bank names.');
        
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    }
}

migrate();
