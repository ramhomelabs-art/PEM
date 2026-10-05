-- 003_india_investments.sql
-- India-first Investments module.
-- 1) Preserves the legacy (generic) investment module's data by relocating its
--    tables under legacy_*  (no API/UIs are wired to them anymore).
-- 2) Creates the new schema: goals, assets, sips, investment_txns, prices,
--    tax_lots, tax_rules.
--
-- Conventions:
--   * Money columns are exact NUMERIC (never FLOAT). All computation in the
--     server layer uses integer paise via server/utils/investing/money.js.
--   * Prices/Navs are stored per-day and NEVER overwritten (upsert is an
--     INSERT .. ON CONFLICT DO NOTHING against idx_prices_asset_date).
--   * Enumerations are VARCHAR + CHECK (no native Postgres ENUM types), so the
--     schema stays identical regardless of Sequelize model definitions.

-- ---------------------------------------------------------------------------
-- 1. Keep legacy data, stop exposing the old tables (idempotent renames)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS investments             RENAME TO legacy_investments;
ALTER TABLE IF EXISTS investment_transactions RENAME TO legacy_investment_transactions;
ALTER TABLE IF EXISTS investment_plans        RENAME TO legacy_investment_plans;
ALTER TABLE IF EXISTS investment_snapshots    RENAME TO legacy_investment_snapshots;
ALTER TABLE IF EXISTS goals                   RENAME TO legacy_goals;

-- ---------------------------------------------------------------------------
-- 2. goals  (created before assets because assets.goalId references it)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    "targetAmount" NUMERIC(15,2) NOT NULL DEFAULT 0,
    "targetDate" DATE,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
    "assetIds" JSONB,
    notes TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals ("userId");

-- ---------------------------------------------------------------------------
-- 3. assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('mf', 'stock', 'etf', 'fd', 'ppf', 'epf', 'nps', 'gold', 'sgb', 'crypto', 'bond', 'other')),
    "assetCode" VARCHAR(64),
    isin VARCHAR(12),
    "amfiCode" VARCHAR(10),
    provider VARCHAR(100),
    "accountNumber" VARCHAR(100),
    "folioNumber" VARCHAR(100),
    "subCategory" VARCHAR(100),
    "taxCategory" VARCHAR(20) NOT NULL DEFAULT 'other' CHECK ("taxCategory" IN ('equity', 'debt', 'gold', 'other')),
    custodian VARCHAR(100),
    "goalId" INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    "openingDate" DATE,
    "closingDate" DATE,
    notes TEXT,
    meta JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_user ON assets ("userId");
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets (type);
CREATE INDEX IF NOT EXISTS idx_assets_amfi ON assets ("amfiCode");
CREATE INDEX IF NOT EXISTS idx_assets_goal ON assets ("goalId");

-- ---------------------------------------------------------------------------
-- 4. sips  (recurring investment schedule; each due date generates an
--    investment_txns row of type 'sip' when the bank confirms the debit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sips (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "assetId" INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'quarterly')),
    amount NUMERIC(15,2) NOT NULL,
    "instalmentDay" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "lastRunDate" DATE,
    "nextDueDate" DATE,
    "stepUpPct" NUMERIC(5,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sips_user ON sips ("userId");
CREATE INDEX IF NOT EXISTS idx_sips_asset ON sips ("assetId");
CREATE INDEX IF NOT EXISTS idx_sips_due ON sips (status, "nextDueDate");

-- ---------------------------------------------------------------------------
-- 5. investment_txns
--    importHash (SHA-256 of provider|folio|type|txDate|amount|units|nav) makes
--    CAS/CAMs imports idempotent per user; status gates SIP confirmation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investment_txns (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "assetId" INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    "sipId" INTEGER REFERENCES sips(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('buy', 'sell', 'sip', 'switch', 'dividend', 'bonus', 'split')),
    "txDate" DATE NOT NULL,
    "navDate" DATE,
    units NUMERIC(18,6) NOT NULL DEFAULT 0,
    nav NUMERIC(18,4) NOT NULL DEFAULT 0,
    amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    fees NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax NUMERIC(18,2) NOT NULL DEFAULT 0,
    notes TEXT,
    "importHash" VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_txns_user ON investment_txns ("userId");
CREATE INDEX IF NOT EXISTS idx_txns_asset ON investment_txns ("assetId");
CREATE INDEX IF NOT EXISTS idx_txns_sip ON investment_txns ("sipId");
CREATE INDEX IF NOT EXISTS idx_txns_date ON investment_txns ("txDate");
CREATE UNIQUE INDEX IF NOT EXISTS idx_txns_import_hash
    ON investment_txns ("userId", "importHash") WHERE "importHash" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. prices  (daily NAV / market price history; row-per-day, immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prices (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "assetId" INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    "navDate" DATE NOT NULL,
    nav NUMERIC(18,4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('amfi', 'yahoo', 'manual', 'cas')),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prices_asset_date ON prices ("userId", "assetId", "navDate");

-- ---------------------------------------------------------------------------
-- 7. tax_lots  (FIFO lots created on buy/sip; quantity shrinks on sell)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_lots (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "assetId" INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    "buyTxnId" INTEGER REFERENCES investment_txns(id) ON DELETE SET NULL,
    "openDate" DATE NOT NULL,
    quantity NUMERIC(18,6) NOT NULL DEFAULT 0,
    "costPerUnit" NUMERIC(18,4) NOT NULL DEFAULT 0,
    "closedDate" DATE,
    "isOpen" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_lots_user ON tax_lots ("userId");
CREATE INDEX IF NOT EXISTS idx_tax_lots_asset ON tax_lots ("assetId");
CREATE INDEX IF NOT EXISTS idx_tax_lots_open ON tax_lots ("assetId", "isOpen", "openDate");

-- ---------------------------------------------------------------------------
-- 8. tax_rules  (rate config with effective date; userId NULL = system default)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rules (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
    "assetType" VARCHAR(20),
    "taxCategory" VARCHAR(20) NOT NULL CHECK ("taxCategory" IN ('equity', 'debt', 'gold', 'other')),
    "holdingPeriodMonths" INTEGER NOT NULL DEFAULT 12,
    "stcgRatePct" NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    "ltcgRatePct" NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    "exemptLimit" NUMERIC(15,2) NOT NULL DEFAULT 0,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_user ON tax_rules ("userId");
CREATE INDEX IF NOT EXISTS idx_tax_rules_lookup ON tax_rules ("assetType", "taxCategory", "effectiveFrom");