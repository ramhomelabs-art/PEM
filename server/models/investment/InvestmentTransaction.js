const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('InvestmentTransaction', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        investmentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'legacy_investments',
                key: 'id'
            }
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        type: {
            type: DataTypes.ENUM('BUY', 'SELL', 'SIP', 'DIVIDEND', 'INTEREST', 'CHARGES', 'TAX', 'MATURITY'),
            allowNull: false
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
            // Total amount involved in txn (e.g. 5000 INR)
        },
        units: {
            type: DataTypes.DECIMAL(15, 4),
            allowNull: true
            // e.g. 2.5 units of Gold
        },
        pricePerUnit: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
            // Rate at which bought/sold
        },

        // --- Post-Txn Snapshot (For integrity) ---
        netBalance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },

        meta: {
            type: DataTypes.JSON,
            allowNull: true
            // e.g. transactionReferenceId, notes
        }
    }, {
        indexes: [
            { fields: ['investmentId'] },
            { fields: ['date'] }
        ],
        tableName: 'legacy_investment_transactions'
    });
};
