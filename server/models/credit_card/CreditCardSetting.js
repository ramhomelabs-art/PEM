const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('CreditCardSetting', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        // Free-form preferences object (security, notifications, regional, display).
        settings: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        tableName: 'credit_card_settings',
        timestamps: true,
        indexes: [
            {
                fields: ['userId']
            }
        ]
    });
};
