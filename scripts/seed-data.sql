-- PolisKu Seed Data
-- Generates: 100K customers, ~200K policies, ~500K claims, ~1M premium_payments

-- ===== CUSTOMERS (100,000) =====
INSERT INTO customers (full_name, email, phone, date_of_birth, address)
SELECT
    'Customer ' || gs || ' ' || (ARRAY['Pratama','Sari','Wijaya','Putri','Santoso','Dewi','Hidayat','Lestari','Kurniawan','Rahayu'])[1 + (gs % 10)],
    'customer' || gs || '@poliskumail.com',
    '08' || LPAD((1000000000 + (gs * 7) % 9000000000)::text, 10, '0'),
    DATE '1960-01-01' + (gs % 15000) * INTERVAL '1 day',
    'Jl. Contoh No. ' || (gs % 500) || ', Kota ' || (ARRAY['Jakarta','Surabaya','Bandung','Medan','Semarang','Makassar','Palembang','Depok','Tangerang','Bekasi'])[1 + (gs % 10)]
FROM generate_series(1, 100000) AS gs;

-- ===== POLICIES (~200,000 — 2 per customer) =====
INSERT INTO policies (customer_id, policy_number, type, status, start_date, end_date, premium_amount, coverage_amount)
SELECT
    c.id,
    'POL-' || LPAD(ROW_NUMBER() OVER ()::text, 7, '0'),
    (ARRAY['TERM_LIFE','WHOLE_LIFE','ENDOWMENT','UNIT_LINK'])[1 + (c.id % 4)],
    (ARRAY['ACTIVE','ACTIVE','ACTIVE','EXPIRED','CANCELLED'])[1 + (c.id % 5)],
    DATE '2018-01-01' + (c.id % 1500) * INTERVAL '1 day',
    DATE '2028-01-01' + (c.id % 1500) * INTERVAL '1 day',
    (100000 + (c.id % 50) * 50000)::NUMERIC(15,2),
    (50000000 + (c.id % 20) * 25000000)::NUMERIC(15,2)
FROM customers c
CROSS JOIN generate_series(1, 2) AS s;

-- ===== CLAIMS (~500,000) =====
INSERT INTO claims (policy_id, claim_type, description, amount, status, filed_at, resolved_at)
SELECT
    p.id,
    (ARRAY['DEATH','CRITICAL_ILLNESS','DISABILITY','MATURITY'])[1 + (p.id % 4)],
    'Klaim untuk polis ' || p.policy_number || ' - batch ' || s,
    (1000000 + (p.id % 100) * 500000)::NUMERIC(15,2),
    (ARRAY['PENDING','PENDING','PENDING','APPROVED','REJECTED','PAID'])[1 + ((p.id + s) % 6)],
    TIMESTAMP '2023-01-01' + ((p.id + s) % 800) * INTERVAL '1 day',
    CASE
        WHEN (p.id + s) % 6 > 2 THEN TIMESTAMP '2023-01-01' + ((p.id + s) % 800 + 30) * INTERVAL '1 day'
        ELSE NULL
    END
FROM policies p
CROSS JOIN generate_series(1, 2) AS s
WHERE p.id <= 250000;

-- ===== PREMIUM_PAYMENTS (~1,000,000) =====
INSERT INTO premium_payments (policy_id, amount, payment_date, payment_method, status, reference_number)
SELECT
    p.id,
    p.premium_amount,
    DATE '2020-01-01' + (s - 1) * INTERVAL '1 month' + (p.id % 28) * INTERVAL '1 day',
    (ARRAY['BANK_TRANSFER','CREDIT_CARD','AUTO_DEBIT'])[1 + ((p.id + s) % 3)],
    CASE WHEN (p.id + s) % 50 = 0 THEN 'FAILED' ELSE 'COMPLETED' END,
    'REF-' || p.id || '-' || s || '-' || EXTRACT(EPOCH FROM NOW())::int
FROM policies p
CROSS JOIN generate_series(1, 5) AS s;

-- Summary
DO $$
DECLARE
    c_count INTEGER;
    p_count INTEGER;
    cl_count INTEGER;
    pp_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO c_count FROM customers;
    SELECT COUNT(*) INTO p_count FROM policies;
    SELECT COUNT(*) INTO cl_count FROM claims;
    SELECT COUNT(*) INTO pp_count FROM premium_payments;
    RAISE NOTICE 'Seed complete: % customers, % policies, % claims, % premium_payments',
        c_count, p_count, cl_count, pp_count;
END $$;
