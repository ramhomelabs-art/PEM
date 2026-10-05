
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Expense', {
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
        date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'expenses'
    });
};
