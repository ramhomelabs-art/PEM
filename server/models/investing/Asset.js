const { DataTypes } = require('sequelize');

const ASSET_TYPES = ['mf', 'stock', 'etf', 'fd', 'ppf', 'epf', 'nps', 'gold', 'sgb', 'crypto', 'bond', 'other'];
const TAX_CATEGORIES = ['equity', 'debt', 'gold', 'other'];

module.exports = (sequelize) => {
    return sequelize.define('Asset', {
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
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
            // e.g. "HDFC ELSS Tax Saver", "ICICI Nifty 50 Index" , "RELIANCE"
        },
        type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: { isIn: [ASSET_TYPES] }
            // mf | stock | etf | fd | ppf | epf | nps | gold | sgb | crypto | bond | other
        },
        assetCode: {
            type: DataTypes.STRING(64),
            allowNull: true
            // Ticker / scheme code: e.g. "RELIANCE.NS", "NIFTYBEES.NS"
        },
        isin: {
            type: DataTypes.STRING(12),
            allowNull: true
        },
        amfiCode: {
            type: DataTypes.STRING(10),
            allowNull: true
            // AMFI scheme code for daily NAV pulls
        },
        provider: {
            type: DataTypes.STRING(100),
            allowNull: true
            // Broker / custodian of record: Zerodha, Groww, SBI, NSDL, PPF A/c
        },
        accountNumber: {
            type: DataTypes.STRING(100),
            allowNull: true
            // Demat account / bank a/c / policy / UAN for EPF
        },
        folioNumber: {
            type: DataTypes.STRING(100),
            allowNull: true
            // Mutual-fund folio number
        },
        subCategory: {
            type: DataTypes.STRING(100),
            allowNull: true
            // e.g. "Growth", "Direct", "Value", "ELSS"
        },
        taxCategory: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'other',
            validate: { isIn: [TAX_CATEGORIES] }
            // equity | debt | gold | other  (drives STCG/LTCG rules)
        },
        custodian: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        goalId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'goals', key: 'id' }
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'active',
            validate: { isIn: [['active', 'closed']] }
        },
        openingDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        closingDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        meta: {
            type: DataTypes.JSONB,
            allowNull: true
            // Per-type extras: FD rate, EPF rate, direct plan flag, lock-in expiry...
        }
    }, {
        tableName: 'assets',
        indexes: [
            { fields: ['userId'] },
            { fields: ['type'] },
            { fields: ['amfiCode'] },
            { fields: ['goalId'] }
        ]
    });
};