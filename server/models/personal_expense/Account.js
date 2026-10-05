const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Account = sequelize.define('Account', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        accountName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        accountType: {
            type: DataTypes.ENUM('savings', 'checking', 'credit_card', 'wallet', 'investment'),
            defaultValue: 'savings'
        },
        bankName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        accountNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Masked account number (e.g., XXXX1234)'
        },
        balance: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0.00
        },
        currency: {
            type: DataTypes.STRING(3),
            defaultValue: 'INR'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        icon: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Icon identifier or emoji'
        },
        color: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Hex color for card display'
        }
    }, {
        tableName: 'accounts',
        timestamps: true
    });

    return Account;
};
