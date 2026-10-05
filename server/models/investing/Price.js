const { DataTypes } = require('sequelize');

const PRICE_SOURCES = ['amfi', 'yahoo', 'manual', 'cas'];

module.exports = (sequelize) => {
    return sequelize.define('Price', {
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
        navDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        nav: {
            type: DataTypes.DECIMAL(18, 4),
            allowNull: false
            // Daily NAV / close price; never mutated (immutable history).
        },
        currency: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: 'INR'
        },
        source: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'manual',
            validate: { isIn: [PRICE_SOURCES] }
        }
    }, {
        tableName: 'prices',
        indexes: [
            { fields: ['userId', 'assetId', 'navDate'], unique: true }
        ]
    });
};