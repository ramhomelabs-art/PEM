const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SharedResource = sequelize.define('SharedResource', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        owner_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        shared_with_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        resource_type: {
            type: DataTypes.ENUM('transaction', 'budget', 'bill', 'loan', 'dashboard', 'investment'),
            allowNull: false
        },
        resource_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        permission: {
            type: DataTypes.ENUM('view', 'edit', 'full_access'),
            defaultValue: 'view'
        }
    }, {
        tableName: 'shared_resources',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                fields: ['owner_id', 'shared_with_id']
            },
            {
                fields: ['resource_type', 'resource_id']
            }
        ]
    });

    return SharedResource;
};
