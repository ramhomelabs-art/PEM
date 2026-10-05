/**
 * Dependency-free price sync scheduler.
 *
 * Runs handler() on a fixed interval with a simple overlap guard: if the
 * previous run is still in flight when the next tick fires, that tick is
 * skipped and logged instead of stacking concurrent syncs. The interval timer
 * is unref()'d so it never keeps the process alive by itself.
 */

const { priceSyncEnabled, priceSyncIntervalMinutes, priceSyncRunOnStart } = require('./config');
const { runPriceSync } = require('./prices');

class PriceScheduler {
    constructor() {
        this.timer = null;
        this.busy = false;
        this.lastRunAt = null;
        this.runs = 0;
    }

    get isRunning() {
        return this.timer !== null;
    }

    /** start(handler, intervalMs) -> stop() */
    start(handler, intervalMs) {
        if (this.timer) return this.stop;
        this.timer = setInterval(async () => {
            if (this.busy) {
                console.log(`[PriceSync] Skipped tick (previous run still in flight, lastRun=${this.lastRunAt ? this.lastRunAt.toISOString() : 'never'})`);
                return;
            }
            this.busy = true;
            this.runs += 1;
            try {
                await handler();
                this.lastRunAt = new Date();
            } catch (err) {
                console.error('[PriceSync] Handler error:', err.message);
            } finally {
                this.busy = false;
            }
        }, intervalMs);
        this.timer.unref?.();
        return this.stop.bind(this);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

let instance = null;

/** Fire-and-forget full sync (used at boot and by the interval). */
function scheduleHandler(sequelize) {
    return async () => {
        try {
            const report = await runPriceSync(sequelize);
            const totals = report.reports.reduce((acc, r) => ({
                amfiInserted: acc.amfiInserted + r.amfi.inserted,
                marketInserted: acc.marketInserted + r.market.inserted
            }), { amfiInserted: 0, marketInserted: 0 });
            console.log(`[PriceSync] Completed: users=${report.users} assets=${report.assets} amfiInserted=${totals.amfiInserted} marketInserted=${totals.marketInserted} in ${(report.finishedAt - report.startedAt) / 1000}s`);
            return report;
        } catch (err) {
            console.error('[PriceSync] Run failed:', err.message);
            throw err;
        }
    };
}

/**
 * Start the price scheduler (idempotent). Returns the scheduler instance.
 * Controlled by PRICE_SYNC_ENABLED / PRICE_SYNC_INTERVAL_MINUTES /
 * PRICE_SYNC_RUN_ON_START.
 */
function startPriceSync(sequelize) {
    if (!priceSyncEnabled) {
        console.log('[PriceSync] Disabled (PRICE_SYNC_ENABLED=false)');
        return instance;
    }
    if (instance && instance.isRunning) return instance;

    instance = new PriceScheduler();
    const intervalMs = Math.max(
        60 * 1000,
        (Number.isFinite(priceSyncIntervalMinutes) ? priceSyncIntervalMinutes : 360) * 60 * 1000
    );
    const handler = scheduleHandler(sequelize);

    // Fire the first run shortly after boot (post-listen) without blocking.
    if (priceSyncRunOnStart) {
        setTimeout(() => handler().catch(() => {}), 5000).unref?.();
    }
    instance.start(handler, intervalMs);
    console.log(`[PriceSync] Scheduler started (interval=${intervalMs / 1000}s, runOnStart=${priceSyncRunOnStart})`);
    return instance;
}

module.exports = { PriceScheduler, startPriceSync, runPriceSync };