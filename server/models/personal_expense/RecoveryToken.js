const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

/**
 * A short-lived, single-use verification token used by the self-service
 * recovery flows (forgot password / forgot username). The OTP itself is never
 * stored in plaintext — only a bcrypt hash.
 */
module.exports = (sequelize) => {
    return sequelize.define('RecoveryToken', {
        id: {
            type: DataTypes.UUID,
            defaultValue: () => uuidv4(),
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'user_id'
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Destination the OTP was sent to (for audit)'
        },
        codeHash: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'code_hash',
            comment: 'bcrypt hash of the 6-digit OTP'
        },
        purpose: {
            type: DataTypes.ENUM('password_reset', 'username_recovery', 'recovery_check'),
            allowNull: false,
            defaultValue: 'password_reset',
            comment: "password_reset | username_recovery | recovery_check (Profile self-test)"
        },
        attempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        consumed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'expires_at'
        }
    }, {
        tableName: 'recovery_tokens',
        freezeTableName: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { name: 'idx_recovery_user_purpose', fields: ['user_id', 'purpose'] },
            { name: 'idx_recovery_token_consumed', fields: ['consumed'] }
        ]
    });
};
