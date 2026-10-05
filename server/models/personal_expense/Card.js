
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Card', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        bankId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        cardNumber: {
            type: DataTypes.STRING,
            allowNull: false
        },
        cardHolder: {
            type: DataTypes.STRING,
            allowNull: false
        },
        expiry: {
            type: DataTypes.STRING,
            allowNull: false
        },
        cvv: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('Credit', 'Debit', 'Virtual'),
            defaultValue: 'Debit'
        },
        limit: {
            type: DataTypes.FLOAT
        }
    }, {
        tableName: 'cards'
    });
};
