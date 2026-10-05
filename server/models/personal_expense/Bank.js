
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Bank', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        accountNumber: {
            type: DataTypes.STRING,
            allowNull: false
        },
        ifsc: {
            type: DataTypes.STRING,
            allowNull: false
        },
        branch: {
            type: DataTypes.STRING
        },
        balance: {
            type: DataTypes.FLOAT,
            defaultValue: 0.0
        },
        type: {
            type: DataTypes.ENUM('Savings', 'Current'),
            defaultValue: 'Savings'
        }
    }, {
        tableName: 'banks'
    });
};
