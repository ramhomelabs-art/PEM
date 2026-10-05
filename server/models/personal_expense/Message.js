const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Message = sequelize.define('Message', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        sender_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        receiver_id: {
            type: DataTypes.INTEGER,
            allowNull: true, // Nullable for group messages
            references: {
                model: 'users',
                key: 'id'
            }
        },
        group_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'chat_groups',
                key: 'id'
            }
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        read_status: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'messages',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                fields: ['sender_id', 'receiver_id']
            },
            {
                fields: ['read_status']
            }
        ]
    });

    return Message;
};
