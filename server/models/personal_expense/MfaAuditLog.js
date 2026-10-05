const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
    return sequelize.define('MfaAuditLog', {
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
        eventType: {
            type: DataTypes.ENUM(
                'login_success',
                'login_failure',
                'push_approved',
                'push_denied',
                'push_timeout',
                'totp_success',
                'totp_failure',
                'device_bound',
                'device_revoked',
                'mfa_reset',
                'mfa_enabled',
                'mfa_disabled',
                'mfa_exempt_enabled',
                'mfa_exempt_disabled',
                'backup_code_used',
                'mfa_challenge_issued',
                'totp_generated',
                'mobile_login_success',
                'device_fingerprint_mismatch'
            ),
            allowNull: false,
            field: 'event_type'
        },
        deviceId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'device_id'
        },
        ipAddress: {
            type: DataTypes.STRING(45),
            allowNull: true,
            field: 'ip_address'
        },
        userAgent: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'user_agent'
        },
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at',
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        details: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Additional event-specific data'
        }
    }, {
        tableName: 'mfa_audit_log',
        freezeTableName: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                name: 'idx_user_event',
                fields: ['user_id', 'event_type', 'created_at']
            },
            {
                name: 'idx_created_at',
                fields: ['created_at']
            },
            {
                name: 'idx_device_id',
                fields: ['device_id']
            }
        ]
    });
};
