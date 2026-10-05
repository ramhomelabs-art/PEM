const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
    return sequelize.define('MfaTotpSecret', {
        id: {
            type: DataTypes.UUID,
            defaultValue: () => uuidv4(),
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            field: 'user_id'
        },
        secret: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Base32 encoded TOTP secret'
        },
        backupCodes: {
            type: DataTypes.JSON,
            allowNull: true,
            field: 'backup_codes',
            comment: 'Array of hashed one-time backup codes'
        },
        isVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_verified',
            comment: 'True after user successfully verifies TOTP setup'
        }
    }, {
        tableName: 'mfa_totp_secrets',
        freezeTableName: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_user_verified',
                fields: ['user_id', 'is_verified']
            }
        ]
    });
};
