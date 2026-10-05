const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
    return sequelize.define('MfaPushRequest', {
        id: {
            type: DataTypes.UUID,
            defaultValue: () => uuidv4(),
            primaryKey: true
        },
        requestId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            field: 'request_id',
            comment: 'Public-facing request ID for mobile API'
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'user_id',
            comment: 'User ID from association'
        },
        deviceId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'device_id'
        },
        loginAttemptId: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'login_attempt_id'
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'denied', 'expired'),
            defaultValue: 'pending',
            allowNull: false
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Contains ipAddress, userAgent, location, etc.'
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'expires_at',
            comment: '5 minutes from creation'
        },
        respondedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'responded_at'
        }
    }, {
        tableName: 'mfa_push_requests',
        freezeTableName: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_status_expiry',
                fields: ['status', 'expires_at']
            },
            {
                name: 'idx_request_id',
                fields: ['request_id']
            },
            {
                name: 'idx_device',
                fields: ['device_id']
            }
        ]
    });
};
