
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Borrow', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('borrow', 'lend'),
            allowNull: false
        },
        personName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        amount: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        amountPaid: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },
        date: {
            type: DataTypes.DATEONLY,
            defaultValue: DataTypes.NOW
        },
        dueDate: {
            type: DataTypes.DATEONLY
        },
        status: {
            type: DataTypes.ENUM('active', 'partially_paid', 'settled'),
            defaultValue: 'active'
        },
        description: {
            type: DataTypes.STRING
        }
    }, {
        tableName: 'borrows'
    });
};
