/**
 * Pure, dependency-free maths for the India-first investments module.
 * All money is integer paise; unit/price precision matches the DB columns.
 */
const money = require('./money');
const portfolio = require('./portfolio');
const xirr = require('./xirr');
const fifo = require('./fifo');
const sips = require('./sips');
const config = require('./config');
const providers = require('./providers/amfi');
const prices = require('./prices');
const scheduler = require('./scheduler');
const cas = require('./cas/parse');
const casExtract = require('./cas/extract');
const casImport = require('./cas/import');

module.exports = { money, portfolio, xirr, fifo, sips, config, providers, prices, scheduler, cas, casExtract, casImport };