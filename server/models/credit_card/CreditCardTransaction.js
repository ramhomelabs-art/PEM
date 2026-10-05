const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('CreditCardTransaction', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        creditCardId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'credit_cards',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        merchant: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        transactionDate: {
            type: DataTypes.STRING,
            allowNull: false
        },
        category: {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: 'Others'
        },
        type: {
            type: DataTypes.ENUM('debit', 'credit'),
            allowNull: false,
            defaultValue: 'debit'
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed', 'failed'),
            allowNull: false,
            defaultValue: 'completed'
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        referenceNumber: {
            type: DataTypes.STRING(100),
            allowNull: true
        }
    }, {
        tableName: 'credit_card_transactions',
        timestamps: true,
        indexes: [
            {
                fields: ['creditCardId']
            },
            {
                fields: ['userId']
            },
            {
                fields: ['transactionDate']
            },
            {
                fields: ['category']
            },
            {
                fields: ['type']
            }
        ]
    });
};
