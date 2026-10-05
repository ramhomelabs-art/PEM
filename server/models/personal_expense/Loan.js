
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Loan', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING, // e.g., 'HDFC Home Loan'
            allowNull: false
        },
        category: {
            type: DataTypes.STRING, // 'Personal Loan', 'Home Loan', 'Credit Card EMI', 'Other'
            defaultValue: 'Personal Loan'
        },
        bankProvider: {
            type: DataTypes.STRING
        },
        processingFee: {
            type: DataTypes.FLOAT,
            defaultValue: 0
        },
        totalAmount: {
            type: DataTypes.FLOAT, // Principal
            allowNull: false
        },
        interestRate: {
            type: DataTypes.FLOAT // Annual Interest Rate %
        },
        tenureMonths: {
            type: DataTypes.INTEGER
        },
        emiAmount: {
            type: DataTypes.FLOAT
        },
        remainingAmount: {
            type: DataTypes.FLOAT
        },
        startDate: {
            type: DataTypes.DATEONLY
        },
        nextEmiDate: {
            type: DataTypes.DATEONLY
        },
        emiDay: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        },
        lastPaymentDate: {
            type: DataTypes.DATEONLY
        },
        interestType: {
            type: DataTypes.STRING,
            defaultValue: 'Reducing Balance'
        },
        terms: {
            type: DataTypes.TEXT
        },
        status: {
            type: DataTypes.ENUM('active', 'closed'),
            defaultValue: 'active'
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'loans'
    });
};
