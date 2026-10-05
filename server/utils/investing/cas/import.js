/**
 * CAS import service: prepare (preview) -> commit (DB writes). Auto-creates
 * missing assets, seeds missing CAS prices with source='cas' (immutable),
 * idempotently writes investment_txns via importHash, and leaves tax lot
 * creation to a later phase (or to the FIFO engine hook later). SIP detection
 * is intentionally not implemented yet (explicitly skipped for now).
 */

const { parseSource } = require('./extract');
const { matchRowsToAssets } = require('./parse');
const { QueryTypes } = require('sequelize');
const { upsertPrices } = require('../prices');
const crypto = require('crypto');

const TX_PROVIDER = 'cas';

/** Build a stable preview hash for a row (mirrors parse.hashCasRow). */
function previewHash(row) {
    const seed = [
        TX_PROVIDER,
        row.provider || '',
        row.folio || '',
        row.type,
        row.date,
        row.amount ?? '',
        row.units ?? '',
        row.nav ?? ''
    ].join('|');
    return crypto.createHash('sha256').update(seed).digest('hex');
}

/**
 * Find or create an asset for a matched user. For matched by name/amfi/isin,
 * reuse existing asset id. For unmatched, create a new 'mf' asset with a
 * reasonable name (min 50 chars truncated from schemeName) and stash amfi/isin
 * if present; also set taxCategory sensibly later? Keep defaults ('other').
 */
async function findOrCreateAsset(sequelize, userId, row, existingMap) {
    // prefer already matched
    if (existingMap && existingMap.has(row)) return existingMap.get(row);
    const Asset = sequelize.models.Asset;
    const where = {};
    if (row.amfiCode) where.amfiCode = String(row.amfiCode).trim();
    else if (row.isin) where.isin = String(row.isin).trim();
    else {
        const like = String(row.schemeName || '').slice(0, 60);
        if (like) where.name = like;
    }
    let asset = null;
    if (Object.keys(where).length) {
        asset = await Asset.findOne({ where: { userId, ...where } });
    }
    if (!asset) {
        const created = await Asset.create({
            userId,
            name: String(row.schemeName || 'Imported Fund').trim().slice(0, 255),
            type: 'mf',
            amfiCode: row.amfiCode || null,
            isin: row.isin || null,
            provider: row.provider || null,
            status: 'active',
            taxCategory: 'equity'
        });
        asset = created;
    }
    return asset;
}

/**
 * Prepare a CAS import preview: parse, match, return grouped items.
 * Returns { assetsToCreate, transactions, summary, parse }.
 */
async function prepareImport(sequelize, userId, opts) {
    const parsed = await parseSource(opts);
    const Asset = sequelize.models.Asset;
    const existingAssets = await Asset.findAll({ where: { userId, status: 'active' } });
    const { matched, unmatched } = matchRowsToAssets(existingAssets, parsed.rows);
    const transactions = [];
    const assetsToCreate = [];

    // assign hashes consistently
    for (const row of parsed.rows) row.hash = previewHash(row);

    // items that need new assets
    for (const row of unmatched) {
        assetsToCreate.push({
            schemeName: row.schemeName,
            amfiCode: row.amfiCode,
            isin: row.isin,
            taxCategory: 'other',
            reason: 'not found for this user'
        });
    }

    // build transaction preview
    for (const row of parsed.rows) {
        const asset = matched.get(row) || null;
        transactions.push({
            date: row.date,
            type: row.type,
            schemeName: row.schemeName,
            amfiCode: row.amfiCode,
            isin: row.isin,
            units: Number(row.units || 0),
            nav: Number(row.nav || 0),
            amount: Number(row.amount || 0),
            folio: row.folio,
            provider: row.provider,
            hash: row.hash,
            assetId: asset ? asset.id : null
        });
    }

    return {
        parse: { rows: parsed.rows.length, errors: parsed.errors, source: parsed.source, sourceName: parsed.sourceName },
        summary: { matched: matched.size, unmatched: unmatched.length, total: transactions.length },
        assetsToCreate,
        transactions
    };
}

/**
 * Commit: create missing assets, insert transactions with importHash (dedupe),
 * and seed CAS prices where the (userId,assetId,navDate) doesn't exist.
 * Returns { assetsCreated, txInserted, txSkipped, pricesSeeded, errors }.
 */
async function commitImport(sequelize, userId, payload) {
    // payload must include parsed rows (canonical) + preview
    const { rows } = payload || {};
    if (!rows || !rows.length) {
        const err = new Error('No rows to commit');
        err.status = 400;
        throw err;
    }
    for (const row of rows) row.hash = previewHash(row);

    const Asset = sequelize.models.Asset;
    const existingAssets = await Asset.findAll({ where: { userId, status: 'active' } });
    const { matched, unmatched } = matchRowsToAssets(existingAssets, rows);
    const created = [];

    // build id->asset map (reuse and create)
    const assetMap = new Map(matched);
    for (const row of unmatched) {
        const a = await Asset.create({
            userId,
            name: String(row.schemeName || 'Imported Fund').trim().slice(0, 255),
            type: 'mf',
            amfiCode: row.amfiCode || null,
            isin: row.isin || null,
            provider: row.provider || null,
            status: 'active',
            taxCategory: 'equity'
        });
        assetMap.set(row, a);
        created.push({ id: a.id, name: a.name, amfiCode: a.amfiCode, isin: a.isin });
    }

    // insert transactions (deduped by importHash partial unique)
    let txInserted = 0;
    let txSkipped = 0;
    const errors = [];

    for (const row of rows) {
        const asset = assetMap.get(row);
        if (!asset) { errors.push({ date: row.date, schemeName: row.schemeName, reason: 'no asset resolved' }); continue; }
        try {
            const res = await sequelize.query(
                `INSERT INTO investment_txns ("userId","assetId","type","txDate","navDate","units","nav","amount","fees","tax","notes","importHash","status","createdAt","updatedAt")
                 VALUES ($1,$2,$3,$4,$4,$5,$6,$7,0,0,$8,$9,'confirmed',NOW(),NOW())
                 ON CONFLICT ("userId","importHash") WHERE "importHash" IS NOT NULL DO NOTHING`,
                {
                    bind: [
                        userId,
                        asset.id,
                        row.type,
                        row.date,
                        Number(row.units || 0),
                        Number(row.nav || 0),
                        Number(row.amount || 0),
                        (row.provider ? `provider:${row.provider}` : '') + (row.folio ? `|folio:${row.folio}` : ''),
                        row.hash
                    ],
                    type: QueryTypes.INSERT
                }
            );
            if (res && res[1] > 0) txInserted += 1; else txSkipped += 1;
        } catch (err) {
            errors.push({ date: row.date, schemeName: row.schemeName, reason: err.message });
        }
    }

    // seed CAS prices for navDate=txDate where we have nav (unique no-op if exists)
    const priceRows = [];
    for (const row of rows) {
        const asset = assetMap.get(row);
        if (!asset) continue;
        if (Number(row.nav) > 0) {
            priceRows.push({
                userId,
                assetId: asset.id,
                navDate: row.date,
                nav: Number(row.nav),
                currency: 'INR',
                source: 'cas'
            });
        }
    }
    const prices = await upsertPrices(sequelize, priceRows);
    return {
        assetsCreated: created.length,
        txInserted,
        txSkipped,
        pricesSeeded: prices.inserted,
        pricesSkipped: prices.skipped,
        errors
    };
}

module.exports = { prepareImport, commitImport, findOrCreateAsset };