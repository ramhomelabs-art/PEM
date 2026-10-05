const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('InvestmentSnapshot', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        investmentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'investments',
                key: 'id'
            }
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        value: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
            // Market Value of the holding on this date
        },
        investedAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        }
    }, {
        indexes: [
            { fields: ['investmentId', 'userId', 'date'], unique: true }
        ],
        tableName: 'legacy_investment_snapshots'
    });
};
