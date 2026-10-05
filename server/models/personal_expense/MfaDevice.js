const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
    return sequelize.define('MfaDevice', {
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
        deviceName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'device_name'
        },
        deviceFingerprint: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'device_fingerprint'
        },
        deviceInfo: {
            type: DataTypes.JSON,
            allowNull: true,
            field: 'device_info',
            comment: 'Stores model, manufacturer, OS version, etc.'
        },
        webhookUrl: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'webhook_url'
        },
        secretKey: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'secret_key'
        },
        encryptionKey: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'encryption_key'
        },
        fcmToken: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'fcm_token',
            comment: 'Firebase Cloud Messaging token'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active'
        },
        lastUsed: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_used'
        }
    }, {
        tableName: 'mfa_devices',
        freezeTableName: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_user_device',
                fields: ['user_id', 'is_active']
            },
            {
                name: 'idx_device_fingerprint',
                fields: ['device_fingerprint']
            }
        ]
    });
};
