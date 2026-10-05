const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Friendship = sequelize.define('Friendship', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        friend_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
            defaultValue: 'pending'
        },
        requested_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        }
    }, {
        tableName: 'friendships',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'friend_id']
            }
        ]
    });

    return Friendship;
};
