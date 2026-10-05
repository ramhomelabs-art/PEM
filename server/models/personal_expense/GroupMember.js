module.exports = (sequelize) => {
    const { DataTypes } = require('sequelize');
    const GroupMember = sequelize.define('GroupMember', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        group_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('admin', 'member'),
            defaultValue: 'member'
        }
    }, {
        tableName: 'chat_group_members',
        timestamps: true,
        createdAt: 'joined_at',
        updatedAt: false
    });
    return GroupMember;
};
