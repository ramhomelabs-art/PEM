
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('User', {
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        fullName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        mobile: {
            type: DataTypes.STRING,
            allowNull: true
        },
        dob: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        country: {
            type: DataTypes.STRING,
            defaultValue: 'USA'
        },
        currency: {
            type: DataTypes.STRING,
            defaultValue: 'USD'
        },
        timezone: {
            type: DataTypes.STRING,
            defaultValue: 'UTC'
        },
        profilePhoto: {
            type: DataTypes.STRING, // Path to image
            allowNull: true
        },
        role: {
            type: DataTypes.ENUM('user', 'admin'),
            defaultValue: 'user'
        },
        group: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'Default'
        },
        status: {
            type: DataTypes.ENUM('pending', 'active'),
            defaultValue: 'pending' // Users must be approved by admin
        },
        smsApiKey: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        lastDeviceSync: {
            type: DataTypes.DATE,
            allowNull: true
        },
        isDeviceApproved: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        deviceInfo: {
            type: DataTypes.JSON, // Stores model, manufacturer, id
            allowNull: true
        },
        lastHeartbeat: {
            type: DataTypes.DATE,
            allowNull: true
        },
        encryptionKey: {
            type: DataTypes.STRING,
            allowNull: true
        },
        preferences: {
            type: DataTypes.JSON,
            defaultValue: {},
            allowNull: true
        },
        mfaEnabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Whether MFA is enabled for this user'
        },
        mfaMethod: {
            type: DataTypes.ENUM('push', 'totp', 'both'),
            allowNull: true,
            comment: 'Preferred MFA method'
        },
        mfaExempt: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Admin exemption from MFA requirement'
        },
        mfaConfigured: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Whether user has completed MFA setup'
        },
        phoneNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Phone number for SMS fallback'
        },
        phoneVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Whether phone number is verified'
        }
    }, {
        tableName: 'users',
        freezeTableName: true,
        hooks: {
            beforeCreate: (user) => {
                if (!user.smsApiKey) {
                    user.smsApiKey = require('crypto').randomBytes(8).toString('hex');
                }
                if (!user.encryptionKey) {
                    user.encryptionKey = require('crypto').randomBytes(24).toString('base64').substring(0, 32);
                }
            }
        }
    });
};

