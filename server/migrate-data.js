require('dotenv').config();
const { Sequelize } = require('sequelize');

// Initialize PostgreSQL (using standard env variables loaded by dotenv)
const pgSequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false
    }
);

// Initialize MariaDB (using hardcoded credentials matching the old config)
const mariaSequelize = new Sequelize(
    'expense_manager',
    'root',
    'Job@test~005',
    {
        host: '127.0.0.1',
        port: 3306,
        dialect: 'mysql',
        logging: false
    }
);

// Helper to load models for a given Sequelize instance
function loadModels(seq) {
    const User = require('./models/personal_expense/User')(seq);
    const Expense = require('./models/personal_expense/Expense')(seq);
    const Loan = require('./models/personal_expense/Loan')(seq);
    const Transaction = require('./models/personal_expense/Transaction')(seq);
    const Bill = require('./models/personal_expense/Bill')(seq);
    const Borrow = require('./models/personal_expense/Borrow')(seq);
    const Bank = require('./models/personal_expense/Bank')(seq);
    const Card = require('./models/personal_expense/Card')(seq);
    const BorrowPayment = require('./models/personal_expense/BorrowPayment')(seq);
    const Budget = require('./models/personal_expense/Budget')(seq);
    const Category = require('./models/personal_expense/Category')(seq);
    const Account = require('./models/personal_expense/Account')(seq);
    const Document = require('./models/personal_expense/Document')(seq);
    const CreditCard = require('./models/credit_card/CreditCard')(seq);
    const CreditCardTransaction = require('./models/credit_card/CreditCardTransaction')(seq);
    const CreditCardEMI = require('./models/credit_card/CreditCardEMI')(seq);
    const CreditCardBill = require('./models/credit_card/CreditCardBill')(seq);
    const Investment = require('./models/investment/Investment')(seq);
    const InvestmentTransaction = require('./models/investment/InvestmentTransaction')(seq);
    const InvestmentSnapshot = require('./models/investment/InvestmentSnapshot')(seq);
    const Goal = require('./models/investment/Goal')(seq);
    const Friendship = require('./models/personal_expense/Friendship')(seq);
    const Message = require('./models/personal_expense/Message')(seq);
    const SharedResource = require('./models/personal_expense/SharedResource')(seq);
    const Group = require('./models/personal_expense/Group')(seq);
    const GroupMember = require('./models/personal_expense/GroupMember')(seq);
    const MfaDevice = require('./models/personal_expense/MfaDevice')(seq);
    const MfaPushRequest = require('./models/personal_expense/MfaPushRequest')(seq);
    const MfaTotpSecret = require('./models/personal_expense/MfaTotpSecret')(seq);
    const MfaAuditLog = require('./models/personal_expense/MfaAuditLog')(seq);

    return {
        User, Expense, Loan, Transaction, Bill, Borrow, Bank, Card, BorrowPayment,
        Budget, Category, Account, Document, CreditCard, CreditCardTransaction,
        CreditCardEMI, CreditCardBill, Investment, InvestmentTransaction, InvestmentSnapshot,
        Goal, Friendship, Message, SharedResource, Group, GroupMember, MfaDevice,
        MfaPushRequest, MfaTotpSecret, MfaAuditLog
    };
}

async function migrate() {
    console.log('🔄 Starting Data Migration from MariaDB to PostgreSQL...');

    try {
        await mariaSequelize.authenticate();
        console.log('✅ Connected to MariaDB.');
        await pgSequelize.authenticate();
        console.log('✅ Connected to PostgreSQL.');

        const mariaModels = loadModels(mariaSequelize);
        const pgModels = loadModels(pgSequelize);

        console.log('🗑️ Recreating PostgreSQL schema...');
        await pgSequelize.sync({ force: true });
        console.log('✅ PostgreSQL tables recreated.');

        const modelNames = Object.keys(mariaModels);

        await pgSequelize.transaction(async (t) => {
            console.log('🔒 Disabling foreign key constraints and triggers in PostgreSQL transaction...');
            await pgSequelize.query("SET session_replication_role = 'replica';", { transaction: t });

            for (const modelName of modelNames) {
                const mariaModel = mariaModels[modelName];
                const pgModel = pgModels[modelName];

                console.log(`⏳ Migrating ${modelName} (${pgModel.tableName})...`);

                // Fetch all data from MariaDB
                const records = await mariaModel.findAll({ raw: true });
                if (records.length === 0) {
                    console.log(`   - No records to migrate.`);
                    continue;
                }

                // Sanitize and convert types for PostgreSQL
                const sanitized = records.map(row => {
                    const cleanRow = { ...row };
                    const attributes = pgModel.rawAttributes;

                    for (const [colName, attr] of Object.entries(attributes)) {
                        if (cleanRow[colName] === undefined || cleanRow[colName] === null) {
                            continue;
                        }

                        // Convert boolean columns (MariaDB tinyint 0/1 -> Postgres boolean)
                        if (attr.type instanceof Sequelize.BOOLEAN) {
                            if (cleanRow[colName] === 1 || cleanRow[colName] === '1' || cleanRow[colName] === true) {
                                cleanRow[colName] = true;
                            } else if (cleanRow[colName] === 0 || cleanRow[colName] === '0' || cleanRow[colName] === false) {
                                cleanRow[colName] = false;
                            }
                        }

                        // Parse JSON/JSONB columns if they are returned as string from MariaDB
                        if (attr.type instanceof Sequelize.JSON || attr.type instanceof Sequelize.JSONB) {
                            if (typeof cleanRow[colName] === 'string') {
                                try {
                                    cleanRow[colName] = JSON.parse(cleanRow[colName]);
                                } catch (e) {
                                    console.warn(`      ⚠️ Warning: failed to parse JSON for ${colName} in row:`, cleanRow[colName]);
                                }
                            }
                        }
                    }
                    return cleanRow;
                });

                // Bulk insert into PostgreSQL
                await pgModel.bulkCreate(sanitized, {
                    transaction: t,
                    validate: false,
                    hooks: false,
                    individualHooks: false
                });

                console.log(`   ✅ Successfully migrated ${sanitized.length} records.`);
            }

            console.log('🔓 Re-enabling foreign key constraints in PostgreSQL transaction...');
            await pgSequelize.query("SET session_replication_role = 'origin';", { transaction: t });

            console.log('🔄 Resetting sequence counters for serial auto-increment keys...');
            const [sequences] = await pgSequelize.query(`
                SELECT c.relname AS sequence_name, t.relname AS table_name, a.attname AS column_name
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_depend d ON d.objid = c.oid AND d.deptype = 'a'
                JOIN pg_class t ON t.oid = d.refobjid
                JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
                WHERE c.relkind = 'S' AND n.nspname = 'public';
            `, { transaction: t });

            for (const seq of sequences) {
                const { sequence_name, table_name, column_name } = seq;
                console.log(`   - Resetting sequence ${sequence_name} for ${table_name}.${column_name}`);
                await pgSequelize.query(`
                    SELECT setval('${sequence_name}', COALESCE((SELECT MAX("${column_name}") FROM "${table_name}"), 1));
                `, { transaction: t });
            }
        });

        console.log('🎉 Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await mariaSequelize.close();
        await pgSequelize.close();
    }
}

migrate();
