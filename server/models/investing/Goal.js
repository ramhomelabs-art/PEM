const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Goal', {
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
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        targetAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        targetDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        priority: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'medium',
            set(val) {
                this.setDataValue('priority', val ? String(val).toLowerCase() : 'medium');
            },
            validate: { isIn: [['high', 'medium', 'low', 'High', 'Medium', 'Low']] }
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'active',
            validate: { isIn: [['active', 'achieved', 'abandoned', 'Active', 'Achieved', 'Abandoned']] }
        },
        color: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: '#3b82f6'
        },
        icon: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: 'Target'
        },
        assetIds: {
            type: DataTypes.JSONB,
            allowNull: true
            // [assetId, ...] assets allocated to this goal
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'goals',
        indexes: [
            { fields: ['userId'] }
        ]
    });
};