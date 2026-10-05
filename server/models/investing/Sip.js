const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Sip', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'users', key: 'id' }
        },
        assetId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'assets', key: 'id' }
        },
        frequency: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'monthly',
            validate: { isIn: [['weekly', 'monthly', 'quarterly']] }
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            validate: { min: 0 }
        },
        instalmentDay: {
            type: DataTypes.INTEGER,
            allowNull: true
            // frequency = monthly/quarterly: day of month (1-31, clamped)
            // frequency = weekly: ISO weekday (1=Monday .. 7=Sunday)
        },
        startDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        endDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        lastRunDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        nextDueDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        stepUpPct: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 0
            // annual step-up of the instalment amount (%)
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'active',
            validate: { isIn: [['active', 'paused', 'cancelled', 'completed']] }
        }
    }, {
        tableName: 'sips',
        indexes: [
            { fields: ['userId'] },
            { fields: ['assetId'] },
            { fields: ['status', 'nextDueDate'] }
        ]
    });
};