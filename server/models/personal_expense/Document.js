const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Document = sequelize.define('Document', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        documentName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        documentType: {
            type: DataTypes.ENUM('pan', 'aadhar', 'passport', 'driving_license', 'bank_statement', 'tax_return', 'invoice', 'receipt', 'other'),
            defaultValue: 'other'
        },
        filePath: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Relative path to uploaded file'
        },
        fileSize: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'File size in bytes'
        },
        mimeType: {
            type: DataTypes.STRING,
            allowNull: true
        },
        source: {
            type: DataTypes.ENUM('upload', 'digilocker', 'scan'),
            defaultValue: 'upload'
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Additional document metadata'
        },
        uploadedAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'documents', // Match lowercase table name
        timestamps: true
    });

    return Document;
};
