const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Bill', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        category: {
            type: DataTypes.STRING, // Broadband, Mobile, Water, Electricity, etc.
            allowNull: false
        },
        amount: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        dueDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('generated', 'unpaid', 'paid', 'overdue'),
            defaultValue: 'unpaid'
        },
        isRecurring: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        frequency: {
            type: DataTypes.ENUM('monthly', 'yearly', 'quarterly'),
            defaultValue: 'monthly'
        },
        lastPaidDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        provider: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Service provider name (e.g. BESCOM, Jio)'
        },
        identifiers: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Account numbers, Consumer IDs for matching'
        }
    }, {
        tableName: 'bills'
    });
};
