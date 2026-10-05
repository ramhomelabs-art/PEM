module.exports = (sequelize) => {
    const { DataTypes } = require('sequelize');
    const Group = sequelize.define('Group', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'chat_groups',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
    return Group;
};
