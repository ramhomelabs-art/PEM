const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_CHANGE_IN_PRODUCTION';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

module.exports = {
    JWT_SECRET,
    JWT_EXPIRES_IN
};
