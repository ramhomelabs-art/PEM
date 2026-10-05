/**
 * Development-Only Script Guard
 * Prevents test/debug/injection scripts from running in production
 */
module.exports = function devOnly(scriptName) {
    if (process.env.NODE_ENV === 'production') {
        console.error(`\n❌ ERROR: ${scriptName} cannot run in production mode`);
        console.error(`This script is for development/testing only.`);
        console.error(`Set NODE_ENV=development to run this script.\n`);
        process.exit(1);
    }
    console.log(`✅ Running in development mode: ${scriptName}`);
};
