
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
        accountHolderName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        ifsc: {
            type: DataTypes.STRING,
            allowNull: false
        },
        micrCode: {
            type: DataTypes.STRING,
            allowNull: true
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
