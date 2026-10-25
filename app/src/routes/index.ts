import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db';
import logger from '../logger';

const createClaimSchema = z.object({
  policyId: z.number().int().positive(),
  claimType: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
});

import { register } from '../metrics';

const router = Router();

// GET /metrics (Prometheus scrape endpoint)
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error({ err }, 'Failed to generate metrics');
    res.status(500).end();
  }
});

// GET /health
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW() as time');
    res.json({
      status: 'ok',
      timestamp: result.rows[0].time,
      uptime: process.uptime(),
    });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

// GET /policies/:id
router.get('/policies/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT p.id, p.policy_number, p.type, p.status, p.start_date, p.end_date,
              p.premium_amount, p.coverage_amount,
              c.id as customer_id, c.full_name, c.email
       FROM policies p
       JOIN customers c ON c.id = p.customer_id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      policyNumber: row.policy_number,
      type: row.type,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      premiumAmount: row.premium_amount,
      coverageAmount: row.coverage_amount,
      customer: {
        id: row.customer_id,
        fullName: row.full_name,
        email: row.email,
      },
    });
  } catch (err) {
    logger.error({ err, policyId: id }, 'Failed to fetch policy');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /claims
router.post('/claims', async (req: Request, res: Response) => {
  const parseResult = createClaimSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Missing or invalid required fields: policyId, claimType, description, amount',
      details: parseResult.error.issues,
    });
    return;
  }

  const { policyId, claimType, description, amount } = parseResult.data;

  try {
    // Verify policy exists
    const policyCheck = await pool.query('SELECT id FROM policies WHERE id = $1', [policyId]);
    if (policyCheck.rows.length === 0) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO claims (policy_id, claim_type, description, amount, status, filed_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW())
       RETURNING id, policy_id, claim_type, description, amount, status, filed_at`,
      [policyId, claimType, description, amount]
    );

    logger.info({ claimId: result.rows[0].id, policyId }, 'New claim filed');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error({ err, policyId }, 'Failed to create claim');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /claims?status=
// INTENTIONALLY NO INDEX on claims.status — needed for incident 3 (slow query)
router.get('/claims', async (req: Request, res: Response) => {
  const { status } = req.query;

  try {
    let query = 'SELECT id, policy_id, claim_type, description, amount, status, filed_at, resolved_at FROM claims';
    const params: string[] = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status as string);
    }

    query += ' ORDER BY filed_at DESC LIMIT 100';

    const result = await pool.query(query, params);

    res.json({
      count: result.rows.length,
      claims: result.rows,
    });
  } catch (err) {
    logger.error({ err, status }, 'Failed to fetch claims');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
