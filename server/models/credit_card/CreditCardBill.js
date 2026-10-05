const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('CreditCardBill', {
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
        billDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        dueDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        totalAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        minDueAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        paidAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        status: {
            type: DataTypes.ENUM('paid', 'unpaid', 'partial', 'overdue'),
            defaultValue: 'unpaid'
        },
        paymentDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        tableName: 'credit_card_bills',
        timestamps: true,
        indexes: [
            {
                fields: ['creditCardId']
            },
            {
                fields: ['userId']
            },
            {
                fields: ['status']
            }
        ]
    });
};
