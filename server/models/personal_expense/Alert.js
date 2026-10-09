const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

/**
 * Alert
 * A user-facing notification/alert that can be delivered via push and/or
 * surfaced by the mobile app's polling worker. Supports interactive actions
 * (e.g. acknowledge, dismiss, categorize) taken from the notification itself.
 */
module.exports = (sequelize) => {
    return sequelize.define('Alert', {
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
        type: {
            type: DataTypes.ENUM('TRANSACTION', 'ANOMALY', 'RECONCILIATION', 'SYSTEM'),
            defaultValue: 'SYSTEM'
        },
        severity: {
            type: DataTypes.ENUM('info', 'warning', 'critical'),
            defaultValue: 'info'
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        body: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        category: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        amount: {
            type: DataTypes.FLOAT,
            allowNull: true
        },
        referenceId: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'reference_id',
            comment: 'Related transaction / bill / anomaly id'
        },
        actions: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Array of interactive action keys, e.g. ["acknowledge","dismiss"]'
        },
        status: {
            type: DataTypes.ENUM('pending', 'notified', 'acknowledged', 'dismissed'),
            defaultValue: 'pending'
        },
        actionTaken: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'action_taken'
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        tableName: 'alerts',
        freezeTableName: true,
        timestamps: true,
        indexes: [
            { name: 'idx_alert_user_status', fields: ['user_id', 'status'] },
            { name: 'idx_alert_type', fields: ['type'] }
        ]
    });
};
