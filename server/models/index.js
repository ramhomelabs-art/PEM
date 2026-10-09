
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Ensure Environment Variables are loaded (Safety Net)
if (!process.env.DB_USER) {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

// Validation
if (!process.env.DB_USER) {
    console.error('CRITICAL: DB_USER is missing from environment!');
    // Allow it to proceed to let verify check it, or default to root if desperate
}

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        dialect: process.env.DB_DIALECT || 'postgres',
        // DEBUG LOGGING
        logging: (msg) => console.log(`[SEQUELIZE] ${msg}`),
        hooks: {
            beforeConnect: (config) => {
                console.log(`[DEBUG] Connecting to DB: ${config.database} as User: '${config.username}'`);
                if (!config.username) console.error('!!! CRITICAL ERROR: DB_USER is empty/undefined !!!');
            }
        },
        replication: {
            read: [
                {
                    host: process.env.DB_REPLICA_HOST || process.env.DB_HOST,
                    username: process.env.DB_REPLICA_USER || process.env.DB_USER,
                    password: process.env.DB_REPLICA_PASS || process.env.DB_PASS,
                    port: process.env.DB_REPLICA_PORT || process.env.DB_PORT || 5432
                }
            ],
            write: {
                host: process.env.DB_HOST,
                username: process.env.DB_USER,
                password: process.env.DB_PASS,
                port: process.env.DB_PORT || 5432
            }
        },
        // logging: falseOverride removed
        pool: {
            max: 10,
            min: 0,
            idle: 10000
        }
    }
);

const User = require('./personal_expense/User')(sequelize);
const Expense = require('./personal_expense/Expense')(sequelize);
const Loan = require('./personal_expense/Loan')(sequelize);
const Transaction = require('./personal_expense/Transaction')(sequelize);
const Bill = require('./personal_expense/Bill')(sequelize);
const Borrow = require('./personal_expense/Borrow')(sequelize);
const Bank = require('./personal_expense/Bank')(sequelize);
const Card = require('./personal_expense/Card')(sequelize);
const BorrowPayment = require('./personal_expense/BorrowPayment')(sequelize);
const Budget = require('./personal_expense/Budget')(sequelize);
const Category = require('./personal_expense/Category')(sequelize);
const Account = require('./personal_expense/Account')(sequelize);
const Document = require('./personal_expense/Document')(sequelize);

// Credit Card Models
const CreditCard = require('./credit_card/CreditCard')(sequelize);
const CreditCardTransaction = require('./credit_card/CreditCardTransaction')(sequelize);
const CreditCardEMI = require('./credit_card/CreditCardEMI')(sequelize);
const CreditCardBill = require('./credit_card/CreditCardBill')(sequelize);
const CreditCardSetting = require('./credit_card/CreditCardSetting')(sequelize);





// Investment Models (legacy generic module - kept for sharing of preserved
// legacy_* data only; the /api/investments routes are no longer mounted)
const Investment = require('./investment/Investment')(sequelize);
const InvestmentTransaction = require('./investment/InvestmentTransaction')(sequelize);
const InvestmentSnapshot = require('./investment/InvestmentSnapshot')(sequelize);
const InvestmentPlan = require('./investment/InvestmentPlan')(sequelize);

// Investments (India-first module)
const Asset = require('./investing/Asset')(sequelize);
const Goal = require('./investing/Goal')(sequelize);
const Sip = require('./investing/Sip')(sequelize);
const InvestmentTxn = require('./investing/InvestmentTxn')(sequelize);
const Price = require('./investing/Price')(sequelize);
const TaxLot = require('./investing/TaxLot')(sequelize);
const TaxRule = require('./investing/TaxRule')(sequelize);

// Social Features Models
const Friendship = require('./personal_expense/Friendship')(sequelize);
const Message = require('./personal_expense/Message')(sequelize);
const SharedResource = require('./personal_expense/SharedResource')(sequelize);
const Group = require('./personal_expense/Group')(sequelize);
const GroupMember = require('./personal_expense/GroupMember')(sequelize);

// Alerting Models
const Alert = require('./personal_expense/Alert')(sequelize);

// MFA Models
const MfaDevice = require('./personal_expense/MfaDevice')(sequelize);
const MfaPushRequest = require('./personal_expense/MfaPushRequest')(sequelize);
const MfaTotpSecret = require('./personal_expense/MfaTotpSecret')(sequelize);
const MfaAuditLog = require('./personal_expense/MfaAuditLog')(sequelize);



// Associations
User.hasMany(Expense, { foreignKey: 'UserId' }); // Explicit mismatch fix
Expense.belongsTo(User, { foreignKey: 'UserId' });

User.hasMany(Loan, { foreignKey: 'userId' });
Loan.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Transaction, { foreignKey: 'userId' });
Transaction.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Bill, { foreignKey: 'userId' });
Bill.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Borrow, { foreignKey: 'userId' });
Borrow.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Bank, { foreignKey: 'userId' });
Bank.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Card, { foreignKey: 'userId' });
Card.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Budget, { foreignKey: 'userId' });
Budget.belongsTo(User, { foreignKey: 'userId' });

// Bank-Card Relationship
Bank.hasMany(Card, { foreignKey: 'bankId' });
Card.belongsTo(Bank, { foreignKey: 'bankId' });

// Transaction Linking
Loan.hasMany(Transaction, { foreignKey: 'loanId' });
Transaction.belongsTo(Loan, { foreignKey: 'loanId' });

Bill.hasMany(Transaction, { foreignKey: 'billId' });
Transaction.belongsTo(Bill, { foreignKey: 'billId' });

// Borrow-Payment Relationship
Borrow.hasMany(BorrowPayment, { foreignKey: 'borrowId' });
BorrowPayment.belongsTo(Borrow, { foreignKey: 'borrowId' });

// Account-Document Relationships
User.hasMany(Account, { foreignKey: 'userId' });
Account.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Document, { foreignKey: 'userId' });
Document.belongsTo(User, { foreignKey: 'userId' });

// Credit Card Relationships
User.hasMany(CreditCard, { foreignKey: 'userId' });
CreditCard.belongsTo(User, { foreignKey: 'userId' });

CreditCard.hasMany(CreditCardTransaction, { foreignKey: 'creditCardId', as: 'transactions' });
CreditCardTransaction.belongsTo(CreditCard, { foreignKey: 'creditCardId' });

CreditCard.hasMany(CreditCardEMI, { foreignKey: 'creditCardId', as: 'emis' });
CreditCardEMI.belongsTo(CreditCard, { foreignKey: 'creditCardId' });

User.hasMany(CreditCardTransaction, { foreignKey: 'userId' });
CreditCardTransaction.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(CreditCardEMI, { foreignKey: 'userId' });
CreditCardEMI.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(CreditCardBill, { foreignKey: 'userId' });
CreditCardBill.belongsTo(User, { foreignKey: 'userId' });

CreditCard.hasMany(CreditCardBill, { foreignKey: 'creditCardId', as: 'bills' });
CreditCardBill.belongsTo(CreditCard, { foreignKey: 'creditCardId' });

User.hasOne(CreditCardSetting, { foreignKey: 'userId', as: 'creditCardSettings' });
CreditCardSetting.belongsTo(User, { foreignKey: 'userId' });



// Investment Associations
User.hasMany(Investment, { foreignKey: 'userId' });
Investment.belongsTo(User, { foreignKey: 'userId' });

Investment.hasMany(InvestmentTransaction, { foreignKey: 'investmentId', as: 'transactions' });
InvestmentTransaction.belongsTo(Investment, { foreignKey: 'investmentId', as: 'investment' });

Investment.hasMany(InvestmentSnapshot, { foreignKey: 'investmentId', as: 'snapshots' });
InvestmentSnapshot.belongsTo(Investment, { foreignKey: 'investmentId', as: 'investment' });

// Investment Plans
User.hasMany(InvestmentPlan, { foreignKey: 'userId' });
InvestmentPlan.belongsTo(User, { foreignKey: 'userId' });

Investment.hasMany(InvestmentPlan, { foreignKey: 'investmentId', as: 'plans' });
InvestmentPlan.belongsTo(Investment, { foreignKey: 'investmentId', as: 'investment' });

InvestmentPlan.hasMany(InvestmentTransaction, { foreignKey: 'planId', as: 'contributions' });
InvestmentTransaction.belongsTo(InvestmentPlan, { foreignKey: 'planId', as: 'plan' });

// Investments (India-first module) Associations
User.hasMany(Asset, { foreignKey: 'userId' });
Asset.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Goal, { foreignKey: 'userId' });
Goal.belongsTo(User, { foreignKey: 'userId' });

Asset.belongsTo(Goal, { foreignKey: 'goalId', as: 'goal' });
Goal.hasMany(Asset, { foreignKey: 'goalId', as: 'assets' });
Investment.belongsTo(Goal, { foreignKey: 'goalId', as: 'goal' });
Goal.hasMany(Investment, { foreignKey: 'goalId', as: 'investments' });

User.hasMany(InvestmentTxn, { foreignKey: 'userId' });
InvestmentTxn.belongsTo(User, { foreignKey: 'userId' });

Asset.hasMany(InvestmentTxn, { foreignKey: 'assetId', as: 'transactions' });
InvestmentTxn.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

User.hasMany(Sip, { foreignKey: 'userId' });
Sip.belongsTo(User, { foreignKey: 'userId' });

Asset.hasMany(Sip, { foreignKey: 'assetId', as: 'sips' });
Sip.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

Sip.hasMany(InvestmentTxn, { foreignKey: 'sipId', as: 'transactions' });
InvestmentTxn.belongsTo(Sip, { foreignKey: 'sipId', as: 'sip' });

User.hasMany(Price, { foreignKey: 'userId' });
Price.belongsTo(User, { foreignKey: 'userId' });

Asset.hasMany(Price, { foreignKey: 'assetId', as: 'prices' });
Price.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

User.hasMany(TaxLot, { foreignKey: 'userId' });
TaxLot.belongsTo(User, { foreignKey: 'userId' });

Asset.hasMany(TaxLot, { foreignKey: 'assetId', as: 'taxLots' });
TaxLot.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

InvestmentTxn.hasOne(TaxLot, { foreignKey: 'buyTxnId', as: 'lot' });
TaxLot.belongsTo(InvestmentTxn, { foreignKey: 'buyTxnId', as: 'buyTxn' });

User.hasMany(TaxRule, { foreignKey: 'userId' });
TaxRule.belongsTo(User, { foreignKey: 'userId' });

// Social Features Associations
User.hasMany(Friendship, { as: 'Friendships', foreignKey: 'user_id' });
User.hasMany(Friendship, { as: 'FriendOf', foreignKey: 'friend_id' });
Friendship.belongsTo(User, { as: 'User', foreignKey: 'user_id' });
Friendship.belongsTo(User, { as: 'Friend', foreignKey: 'friend_id' });
Friendship.belongsTo(User, { as: 'Requester', foreignKey: 'requested_by' });

User.hasMany(Message, { as: 'SentMessages', foreignKey: 'sender_id' });
User.hasMany(Message, { as: 'ReceivedMessages', foreignKey: 'receiver_id' });
Message.belongsTo(User, { as: 'Sender', foreignKey: 'sender_id' });
Message.belongsTo(User, { as: 'Receiver', foreignKey: 'receiver_id' });

User.hasMany(SharedResource, { as: 'OwnedShares', foreignKey: 'owner_id' });
User.hasMany(SharedResource, { as: 'SharedWithMe', foreignKey: 'shared_with_id' });
SharedResource.belongsTo(User, { as: 'Owner', foreignKey: 'owner_id' });
SharedResource.belongsTo(User, { as: 'SharedWith', foreignKey: 'shared_with_id' });

// Group Chat Associations
User.belongsToMany(Group, { through: GroupMember, foreignKey: 'user_id', as: 'Groups' });
Group.belongsToMany(User, { through: GroupMember, foreignKey: 'group_id', as: 'Members' });
Group.hasMany(GroupMember, { foreignKey: 'group_id' });
GroupMember.belongsTo(User, { foreignKey: 'user_id' });
Group.hasMany(Message, { foreignKey: 'group_id' });
Message.belongsTo(Group, { foreignKey: 'group_id' });
Group.belongsTo(User, { as: 'Creator', foreignKey: 'created_by' });

// MFA Associations
User.hasMany(MfaDevice, { foreignKey: 'userId', as: 'mfaDevices' });
MfaDevice.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(MfaPushRequest, { foreignKey: 'userId', as: 'mfaPushRequests' });
MfaPushRequest.belongsTo(User, { foreignKey: 'userId' });

MfaDevice.hasMany(MfaPushRequest, { foreignKey: 'deviceId', as: 'pushRequests' });
MfaPushRequest.belongsTo(MfaDevice, { foreignKey: 'deviceId', as: 'device' });

User.hasOne(MfaTotpSecret, { foreignKey: 'userId', as: 'totpSecret' });
MfaTotpSecret.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(MfaAuditLog, { foreignKey: 'userId', as: 'mfaAuditLogs' });
MfaAuditLog.belongsTo(User, { foreignKey: 'userId' });

MfaDevice.hasMany(MfaAuditLog, { foreignKey: 'deviceId', as: 'auditLogs' });
MfaAuditLog.belongsTo(MfaDevice, { foreignKey: 'deviceId' });

// Alert Associations
User.hasMany(Alert, { foreignKey: 'userId', as: 'alerts' });
Alert.belongsTo(User, { foreignKey: 'userId' });


// Sync Database - DISABLED (handled in main index.js)
// sequelize.sync({ alter: true })
//     .then(() => console.log('Database & tables updated!'))
//     .catch(err => console.log('Error syncing database:', err));

module.exports = {
    sequelize,
    User,
    Expense,
    Loan,
    Transaction,
    Bill,
    Borrow,
    Bank,
    Card,
    BorrowPayment,
    Budget,
    Category,
    Account,
    Document,
    CreditCard,
    CreditCardTransaction,
    CreditCardEMI,
    CreditCardBill,
    CreditCardSetting,

    Investment,
    InvestmentTransaction,
    InvestmentSnapshot,
    InvestmentPlan,

    Asset,
    Goal,
    Sip,
    InvestmentTxn,
    Price,
    TaxLot,
    TaxRule,
    Friendship,
    Message,
    SharedResource,
    Group,
    GroupMember,
    Alert,
    MfaDevice,
    MfaPushRequest,
    MfaTotpSecret,
    MfaAuditLog
};
