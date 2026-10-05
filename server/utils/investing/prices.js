/**
 * Price persistence + sync orchestration for the investments module.
 *
 * The `prices` table stores one row per (userId, assetId, navDate) and is
 * IMMUTABLE: every write is INSERT ... ON CONFLICT DO NOTHING. NAV history is
 * therefore never overwritten or retroactively changed - a manual price entry
 * on a date that already has data is silently skipped and reported.
 *
 * Pure helpers (buildAmfiInserts) are unit-tested; the DB functions below are
 * exercised against Postgres in the live smoke checks.
 */

const { QueryTypes } = require('sequelize');
const { parseNavDump, fetchNavDump } = require('./providers/amfi');
const { fetchQuote, fetchHistorical, toYmd } = require('./providers/yahoo');
const { yahooBackfillDays } = require('./config');

const INSERT_PRICE_SQL = `
  INSERT INTO prices ("userId", "assetId", "navDate", nav, currency, source)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT ("userId", "assetId", "navDate") DO NOTHING
`;

/** Insert rows immutably. rows: [{userId, assetId, navDate, nav, source, currency?}] */
async function upsertPrices(sequelize, rows) {
    let inserted = 0;
    let skipped = 0;
    for (const row of rows) {
        if (!row || !row.userId || !row.assetId || !row.navDate || !(Number(row.nav) > 0)) {
            skipped += 1;
            continue;
        }
        // ON CONFLICT DO NOTHING -> metadata is a rowCount number: 1 = inserted,
        // 0 = conflicting immutable price already present.
        const [, rowCount] = await sequelize.query(INSERT_PRICE_SQL, {
            bind: [
                Number(row.userId),
                Number(row.assetId),
                String(row.navDate),
                Number(row.nav),
                row.currency || 'INR',
                row.source || 'manual'
            ],
            type: QueryTypes.INSERT
        });
        if (rowCount > 0) inserted += 1;
        else skipped += 1;
    }
    return { inserted, skipped };
}

/**
 * Pure: join AMFI dump rows to a user's MF assets by amfiCode.
 * assets: rows with { id, userId, amfiCode }. rows: parseNavDump() output.
 * Returns [{ userId, assetId, navDate, nav, source: 'amfi', schemeName }].
 */
function buildAmfiInserts(assets, rows) {
    const byCode = new Map();
    for (const a of assets || []) {
        const code = String(a.amfiCode || '').trim();
        if (code) byCode.set(code, a);
    }
    const inserts = [];
    for (const row of rows || []) {
        const asset = byCode.get(String(row.amfiCode).trim());
        if (!asset) continue;
        inserts.push({
            userId: asset.userId,
            assetId: asset.id,
            navDate: row.navDate,
            nav: row.nav,
            source: 'amfi',
            schemeName: row.schemeName
        });
    }
    return inserts;
}

/**
 * Sync one user's assets with live NAVs.
 * opts.assets - pre-loaded Asset instances (defaults to querying active ones)
 * opts.amfiRows - pre-parsed AMFI dump (defaults to fetching it when the user has MFs)
 * opts.fetchQuoteOpts - internal
 */
async function syncUserAssets(sequelize, userId, opts = {}) {
    const Asset = sequelize.models.Asset;
    const assets = opts.assets || (await Asset.findAll({ where: { userId, status: 'active' } }));
    const startedAt = new Date();

    const mfAssets = assets.filter((a) => a.type === 'mf' && a.amfiCode);
    const marketAssets = assets.filter((a) => a.type === 'stock' || a.type === 'etf');

    const report = {
        userId,
        amfi: { rows: 0, matched: 0, inserted: 0, skipped: 0, failed: 0 },
        market: { assets: marketAssets.length, queried: 0, inserted: 0, skipped: 0, failed: [] },
        startedAt,
        finishedAt: null
    };

    if (mfAssets.length) {
        try {
            const rows = opts.amfiRows || parseNavDump(await fetchNavDump());
            report.amfi.rows = rows.length;
            const inserts = buildAmfiInserts(mfAssets, rows);
            report.amfi.matched = inserts.length;
            const { inserted, skipped } = await upsertPrices(sequelize, inserts);
            report.amfi.inserted = inserted;
            report.amfi.skipped = skipped;
        } catch (err) {
            report.amfi.failed = 1;
            report.amfi.error = err.message;
        }
    }

    if (marketAssets.length) {
        const backfill = yahooBackfillDays > 0;
        for (const asset of marketAssets) {
            const symbol = asset.assetCode;
            if (!symbol) {
                report.market.failed.push({ assetId: asset.id, symbol: null, error: 'no assetCode' });
                continue;
            }
            try {
                const quote = await fetchQuote(symbol);
                const today = toYmd(new Date());
                const base = {
                    userId,
                    assetId: asset.id,
                    nav: quote.price,
                    currency: quote.currency || 'INR',
                    source: 'yahoo'
                };
                const rowsToInsert = [{ ...base, navDate: today }];
                if (backfill) {
                    const from = new Date(Date.now() - (yahooBackfillDays + 2) * 86400000);
                    const bars = await fetchHistorical(symbol, from, new Date());
                    rowsToInsert.push(...bars.slice(0, yahooBackfillDays).map((b) => ({
                        ...base, navDate: b.date, nav: b.close
                    })));
                }
                report.market.queried += 1;
                const { inserted, skipped } = await upsertPrices(sequelize, rowsToInsert);
                report.market.inserted += inserted;
                report.market.skipped += skipped;
            } catch (err) {
                report.market.failed.push({ assetId: asset.id, symbol, error: err.message });
            }
        }
    }

    report.finishedAt = new Date();
    return report;
}

/**
 * Run a full sync: one AMFI dump fetch shared across every user that holds MFs.
 * opts.userId - restrict to a single user (used by the /sync endpoint).
 */
async function runPriceSync(sequelize, { userId } = {}) {
    const Asset = sequelize.models.Asset;
    const where = { status: 'active' };
    if (userId) where.userId = Number(userId);

    const assets = await Asset.findAll({ where });
    const startedAt = new Date();
    const summary = { startedAt, users: 0, assets: assets.length, reports: [] };

    if (assets.length) {
        const mfAssets = assets.filter((a) => a.type === 'mf' && a.amfiCode);
        let amfiRows = [];
        if (mfAssets.length) {
            amfiRows = parseNavDump(await fetchNavDump());
        }
        const users = [...new Set(assets.map((a) => a.userId))];
        summary.users = users.length;
        for (const uid of users) {
            const userAssets = assets.filter((a) => a.userId === uid);
            summary.reports.push(await syncUserAssets(sequelize, uid, { assets: userAssets, amfiRows }));
        }
    }

    summary.finishedAt = new Date();
    return summary;
}

/** Latest NAV for every asset of a user (LEFT JOIN LATERAL, one round trip). */
async function latestPrices(sequelize, userId) {
    const rows = await sequelize.query(
        `SELECT a.id AS "assetId", a.name, a.type, a."amfiCode", a."assetCode",
                p."navDate", p.nav, p.source, p.currency
         FROM assets a
         LEFT JOIN LATERAL (
             SELECT "navDate", nav, source, currency
             FROM prices
             WHERE prices."userId" = $1 AND prices."assetId" = a.id
             ORDER BY "navDate" DESC
             LIMIT 1
         ) p ON true
         WHERE a."userId" = $1 AND a.status = 'active'
         ORDER BY a.name`,
        { bind: [Number(userId)], type: QueryTypes.SELECT }
    );
    return rows.map((r) => ({ ...r, nav: r.nav == null ? null : Number(r.nav) }));
}

/** Daily NAV history for one asset (ascending). */
async function priceHistory(sequelize, userId, assetId, { from, to } = {}) {
    const { Op } = require('sequelize');
    const where = { userId: Number(userId), assetId: Number(assetId) };
    if (from) where.navDate = { [Op.gte]: String(from) };
    if (to) where.navDate = { ...(where.navDate || {}), [Op.lte]: String(to) };
    const rows = await sequelize.models.Price.findAll({
        where,
        attributes: ['navDate', 'nav', 'source', 'currency'],
        order: [['navDate', 'ASC']],
        limit: 5000
    });
    return rows.map((r) => ({ navDate: r.navDate, nav: Number(r.nav), source: r.source, currency: r.currency }));
}

/** Manual price entry for a user-owned asset (immutable; reports conflicts). */
async function manualInsert(sequelize, userId, assetId, navDate, nav) {
    const Asset = sequelize.models.Asset;
    const asset = await Asset.findOne({ where: { id: Number(assetId), userId: Number(userId) } });
    if (!asset) {
        const err = new Error(`Asset ${assetId} not found for this user`);
        err.status = 404;
        throw err;
    }
    return upsertPrices(sequelize, [{
        userId: Number(userId),
        assetId: asset.id,
        navDate: String(navDate),
        nav: Number(nav),
        source: 'manual',
        currency: 'INR'
    }]);
}

module.exports = {
    upsertPrices,
    buildAmfiInserts,
    syncUserAssets,
    runPriceSync,
    latestPrices,
    priceHistory,
    manualInsert
};