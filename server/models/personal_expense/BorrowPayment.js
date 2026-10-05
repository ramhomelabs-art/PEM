const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('BorrowPayment', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        borrowId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'borrows', // Match lowercase table name
                key: 'id'
            }
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        paymentDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'borrowpayments', // Match lowercase table name
        timestamps: true
    });
};
