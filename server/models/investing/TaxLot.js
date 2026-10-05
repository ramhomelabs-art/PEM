const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('TaxLot', {
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
        buyTxnId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'investment_txns', key: 'id' }
        },
        openDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
            // Acquisition date (FIFO ordering key)
        },
        quantity: {
            type: DataTypes.DECIMAL(18, 6),
            allowNull: false,
            defaultValue: 0
            // Remaining units in this lot (reduced by FIFO sells)
        },
        costPerUnit: {
            type: DataTypes.DECIMAL(18, 4),
            allowNull: false,
            defaultValue: 0
            // Buy NAV; full and partial FIFO cost are derived from it
        },
        closedDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        isOpen: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'tax_lots',
        indexes: [
            { fields: ['userId'] },
            { fields: ['assetId'] },
            { fields: ['assetId', 'isOpen', 'openDate'] }
        ]
    });
};