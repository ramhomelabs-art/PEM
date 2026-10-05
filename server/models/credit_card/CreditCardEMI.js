const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('CreditCardEMI', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        creditCardId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'credit_cards',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        merchant: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        principalAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        monthlyPayment: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        interestRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 0
        },
        tenure: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 60
            }
        },
        paidInstallments: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        remainingInstallments: {
            type: DataTypes.VIRTUAL,
            get() {
                return this.tenure - this.paidInstallments;
            }
        },
        totalPaid: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        totalRemaining: {
            type: DataTypes.VIRTUAL,
            get() {
                return parseFloat(this.monthlyPayment) * (this.tenure - this.paidInstallments);
            }
        },
        startDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        nextDueDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'credit_card_emis',
        timestamps: true,
        indexes: [
            {
                fields: ['creditCardId']
            },
            {
                fields: ['userId']
            },
            {
                fields: ['isActive']
            },
            {
                fields: ['nextDueDate']
            }
        ]
    });
};
