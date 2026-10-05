const { DataTypes } = require('sequelize');

const TAX_CATEGORIES = ['equity', 'debt', 'gold', 'other'];

module.exports = (sequelize) => {
    return sequelize.define('TaxRule', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'users', key: 'id' }
            // NULL = system-wide default rule; a row with a userId overrides it
        },
        assetType: {
            type: DataTypes.STRING(20),
            allowNull: true
            // Optional scoping: mf / stock / gold / ... (NULL = all types)
        },
        taxCategory: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: { isIn: [TAX_CATEGORIES] }
        },
        holdingPeriodMonths: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 12
            // >= this many months => long-term
        },
        stcgRatePct: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 15.00
        },
        ltcgRatePct: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 10.00
        },
        exemptLimit: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
            // Annual LTCG exemption (e.g. Rs 1,00,000 for equity)
        },
        effectiveFrom: {
            type: DataTypes.DATEONLY,
            allowNull: false
        }
    }, {
        tableName: 'tax_rules',
        indexes: [
            { fields: ['userId'] },
            { fields: ['assetType', 'taxCategory', 'effectiveFrom'] }
        ]
    });
};