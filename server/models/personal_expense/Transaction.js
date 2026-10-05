const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Transaction', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        type: {
            type: DataTypes.ENUM('income', 'expense'),
            allowNull: false
        },
        amount: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.STRING
        },
        paymentMode: {
            type: DataTypes.STRING, // Changed from ENUM for SQLite stability
            allowNull: false,
            defaultValue: 'Cash'
        },
        otherPaymentMode: {
            type: DataTypes.STRING,
            allowNull: true
        },
        source: {
            type: DataTypes.ENUM('manual', 'sms', 'email', 'api'),
            defaultValue: 'manual'
        },
        rawContent: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        userId: {
            type: DataTypes.INTEGER, // Matching User.id type
            allowNull: false
        },
        loanId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        billId: {
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        tableName: 'transactions',
        freezeTableName: true
    });
};
