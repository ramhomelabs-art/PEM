const { DataTypes } = require('sequelize');

const TXN_TYPES = ['buy', 'sell', 'sip', 'switch', 'dividend', 'bonus', 'split'];
const TXN_STATUS = ['pending', 'confirmed', 'cancelled'];

module.exports = (sequelize) => {
    return sequelize.define('InvestmentTxn', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'users', key: 'id' }
        },
        assetId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'assets', key: 'id' }
        },
        sipId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'sips', key: 'id' }
        },
        type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: { isIn: [TXN_TYPES] }
            // buy | sell | sip | switch | dividend | bonus | split
        },
        txDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
            // Trade / value date
        },
        navDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
            // Units applied date (MFs lag by a day)
        },
        units: {
            type: DataTypes.DECIMAL(18, 6),
            allowNull: false,
            defaultValue: 0
        },
        nav: {
            type: DataTypes.DECIMAL(18, 4),
            allowNull: false,
            defaultValue: 0
            // Price / NAV at which the units were transacted
        },
        amount: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: false,
            defaultValue: 0
            // Money in (buy/sip) or out (sell). For dividend: payout amount.
        },
        fees: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: false,
            defaultValue: 0
            // Brokerage / STT / exit load
        },
        tax: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: false,
            defaultValue: 0
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        importHash: {
            type: DataTypes.STRING(64),
            allowNull: true
            // SHA-256 of provider|folio|type|txDate|amount|units|nav; CAS dedupe
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'confirmed',
            validate: { isIn: [TXN_STATUS] }
            // pending (SIP order) -> confirmed (bank debit + units) -> cancelled
        }
    }, {
        tableName: 'investment_txns',
        indexes: [
            { fields: ['userId'] },
            { fields: ['assetId'] },
            { fields: ['sipId'] },
            { fields: ['txDate'] },
            { fields: ['userId', 'importHash'], unique: true }
        ]
    });
};