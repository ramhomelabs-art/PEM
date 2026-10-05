const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Investment', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            // e.g. "HDFC Top 100", "SBI Gold ETF"
        },
        category: {
            type: DataTypes.ENUM('Fixed', 'Market', 'Alternative', 'Insurance'),
            allowNull: false
        },
        subCategory: {
            type: DataTypes.STRING,
            allowNull: true
            // e.g. "FD", "Stocks", "Mutual Funds", "Gold", "Crypto"
        },
        provider: {
            type: DataTypes.STRING,
            allowNull: true
            // e.g. "Zerodha", "HDFC Bank", "Binance"
        },
        accountNumber: {
            type: DataTypes.STRING,
            allowNull: true
            // Folio Number, Account ID, or Policy Number
        },
        ticker: {
            type: DataTypes.STRING,
            allowNull: true
            // e.g. "RELIANCE.NS", "NETF.NS"
        },
        lastMarketPrice: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },
        lastPriceUpdate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        currency: {
            type: DataTypes.STRING,
            defaultValue: 'INR'
        },
        country: {
            type: DataTypes.STRING,
            defaultValue: 'India'
        },
        status: {
            type: DataTypes.ENUM('Active', 'Closed', 'Matured'),
            defaultValue: 'Active'
        },
        goalId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'goals',
                key: 'id'
            }
        },

        // --- High Level Cached Stats (Updated by triggers/logic) ---
        totalInvested: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0
        },
        currentValue: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0
        },
        unitsHeld: {
            type: DataTypes.DECIMAL(15, 4),
            defaultValue: 0
        },

        // --- Meta Data ---
        tags: {
            type: DataTypes.JSON,
            allowNull: true
            // e.g. ["Retirement", "High Risk", "Tax Saving"]
        },
        meta: {
            type: DataTypes.JSON,
            allowNull: true
            // e.g. { lockInDate: "2025...", interestRate: 7.5, maturityDate: "..." }
        }
    }, {
        tableName: 'legacy_investments',
        indexes: [
            { fields: ['userId'] },
            { fields: ['category'] },
            { fields: ['goalId'] }
        ]
    });
};
