-- 002_investment_plans.sql
-- Adds InvestmentPlan (recurring contribution schedule) and links
-- investment_transactions to a plan.

CREATE TABLE IF NOT EXISTS investment_plans (
    id SERIAL PRIMARY KEY,
    "investmentId" INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
    amount NUMERIC(15, 2) NOT NULL,
    "instalmentDay" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "stepUpPct" NUMERIC(5, 2) DEFAULT 0,
    "expectedReturnPct" NUMERIC(5, 2) DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_plans_user ON investment_plans ("userId");
CREATE INDEX IF NOT EXISTS idx_investment_plans_investment ON investment_plans ("investmentId");

ALTER TABLE investment_transactions
    ADD COLUMN IF NOT EXISTS "planId" INTEGER REFERENCES investment_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_investment_transactions_plan ON investment_transactions ("planId");