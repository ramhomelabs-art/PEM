const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Budget', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false
        },
        amountLimit: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        period: {
            type: DataTypes.ENUM('monthly', 'yearly'),
            defaultValue: 'monthly'
        },
        startDate: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'budgets',
        freezeTableName: true
    });
};
