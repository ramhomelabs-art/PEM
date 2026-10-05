const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('CreditCard', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
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
        bankName: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        cardName: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        cardType: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'Visa'
        },
        cardNumber: {
            type: DataTypes.STRING(255), // Encrypted, will be longer
            allowNull: false,
            unique: true
        },
        cvv: {
            type: DataTypes.STRING(255), // Encrypted
            allowNull: false
        },
        expiryMonth: {
            type: DataTypes.STRING(2),
            allowNull: false
        },
        expiryYear: {
            type: DataTypes.STRING(4),
            allowNull: false
        },
        creditLimit: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        usedAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        availableCredit: {
            type: DataTypes.VIRTUAL,
            get() {
                return parseFloat(this.creditLimit) - parseFloat(this.usedAmount);
            }
        },
        billingDate: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 31
            }
        },
        dueDate: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 31
            }
        },
        minPayment: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        totalDue: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        rewardPoints: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        rewardRate: {
            type: DataTypes.INTEGER, // Reward points earned per ₹100 spent
            allowNull: false,
            defaultValue: 1
        },
        apr: {
            type: DataTypes.DECIMAL(5, 2), // Annual Percentage Rate (% p.a.) on revolving credit
            allowNull: false,
            defaultValue: 42.00
        },
        interestFreeDays: {
            type: DataTypes.INTEGER, // Interest-free period (days from spend to due date)
            allowNull: false,
            defaultValue: 45
        },
        cashback: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        annualFee: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        joiningFee: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        benefits: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: []
        },
        color: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'credit_cards',
        timestamps: true,
        indexes: [
            {
                fields: ['userId']
            },
            {
                fields: ['isActive']
            }
        ]
    });
};
