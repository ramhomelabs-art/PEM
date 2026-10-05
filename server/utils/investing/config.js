/**
 * Central config for the investments price engine. Everything user-tunable is
 * read from the environment; defaults keep the app runnable out of the box.
 */

module.exports = {
    // Full AMFI daily NAV dump (all schemes).
    amfiNavUrl: process.env.AMFI_NAV_URL || 'https://www.amfiindia.com/spages/NAVAll.txt',

    // Scheduler.
    priceSyncEnabled: process.env.PRICE_SYNC_ENABLED !== 'false',
    priceSyncIntervalMinutes: Number(process.env.PRICE_SYNC_INTERVAL_MINUTES || 360),
    priceSyncRunOnStart: process.env.PRICE_SYNC_RUN_ON_START !== 'false',

    // How many trading days to backfill from Yahoo for stocks/ETFs on sync
    // (0 = just today's quote). Kept tiny by default; NAV history for stocks
    // can be expanded in a later phase.
    yahooBackfillDays: Number(process.env.YAHOO_BACKFILL_DAYS || 0)
};