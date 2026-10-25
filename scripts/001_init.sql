-- PolisKu Database Schema
-- Migration: 001_init.sql

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Policies
CREATE TABLE IF NOT EXISTS policies (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    policy_number VARCHAR(20) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'TERM_LIFE', 'WHOLE_LIFE', 'ENDOWMENT', 'UNIT_LINK'
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'CANCELLED', 'CLAIMED'
    start_date DATE NOT NULL,
    end_date DATE,
    premium_amount NUMERIC(15,2) NOT NULL,
    coverage_amount NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Claims
-- NOTE: Deliberately NO INDEX on claims.status — this is needed for incident 3 (slow query)
CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES policies(id),
    claim_type VARCHAR(50) NOT NULL, -- 'DEATH', 'CRITICAL_ILLNESS', 'DISABILITY', 'MATURITY'
    description TEXT,
    amount NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'PAID'
    filed_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Premium Payments
CREATE TABLE IF NOT EXISTS premium_payments (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES policies(id),
    amount NUMERIC(15,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(30) NOT NULL, -- 'BANK_TRANSFER', 'CREDIT_CARD', 'AUTO_DEBIT'
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'FAILED', 'PENDING'
    reference_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes (strategically placed — note: NO index on claims.status)
CREATE INDEX IF NOT EXISTS idx_policies_customer_id ON policies(customer_id);
CREATE INDEX IF NOT EXISTS idx_policies_policy_number ON policies(policy_number);
CREATE INDEX IF NOT EXISTS idx_claims_policy_id ON claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_premium_payments_policy_id ON premium_payments(policy_id);
CREATE INDEX IF NOT EXISTS idx_premium_payments_date ON premium_payments(payment_date);
