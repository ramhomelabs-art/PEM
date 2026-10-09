const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('InvestmentPlan', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        investmentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'legacy_investments',
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
        name: {
            type: DataTypes.STRING,
            allowNull: true
            // e.g. "Monthly Nifty SIP"
        },
        frequency: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'monthly',
            validate: {
                isIn: [['weekly', 'monthly', 'quarterly']]
            }
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            validate: {
                min: 0
            }
        },
        instalmentDay: {
            type: DataTypes.INTEGER,
            allowNull: true
            // monthly/quarterly: day of month (1-31, clamped)
            // weekly: ISO weekday (1=Monday .. 7=Sunday)
        },
        startDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        endDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        stepUpPct: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            defaultValue: 0
            // annual step-up of the contribution amount (%)
        },
        expectedReturnPct: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            defaultValue: 0
            // annual expected return used for projections
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'legacy_investment_plans',
        indexes: [
            { fields: ['userId'] },
            { fields: ['investmentId'] }
        ]
    });
};