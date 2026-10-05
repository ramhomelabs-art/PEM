const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Category', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('income', 'expense', 'both'),
            defaultValue: 'expense'
        },
        color: {
            type: DataTypes.STRING,
            defaultValue: '#94a3b8' // Default gray
        },
        isSystem: {
            type: DataTypes.BOOLEAN,
            defaultValue: false // To prevent deletion of core categories
        }
    }, {
        tableName: 'categories'
    });
};
