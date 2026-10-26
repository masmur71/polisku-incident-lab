import { Router, Request, Response } from 'express';
import { PoolClient } from 'pg';
import pool, { getPoolStats } from '../db';
import logger from '../logger';

const router = Router();

// Store leaked connections so they can be monitored and optionally released
const leakedClients: PoolClient[] = [];

// Global array for simulating memory leaks
const leakedMemoryStore: Array<{ id: number; data: string; timestamp: Date }> = [];
let leakCounter = 0;

/**
 * GET /simulations/stats
 * Inspect runtime stats: memory and connection pool
 */
router.get('/stats', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    pool: {
      ...getPoolStats(),
      simulatedLeakedCount: leakedClients.length,
    },
    memory: {
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      externalMb: Math.round((mem.external / 1024 / 1024) * 100) / 100,
      leakArrayLength: leakedMemoryStore.length,
    },
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

/**
 * GET /simulations/hold-connection?seconds=30
 * Simulates a slow transaction or locked query holding a connection from the pool
 */
router.get('/hold-connection', async (req: Request, res: Response) => {
  const seconds = Math.min(Math.max(parseInt(req.query.seconds as string, 10) || 10, 1), 120);
  logger.warn({ seconds }, 'Simulation: acquiring connection and holding with pg_sleep');

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('SELECT pg_sleep($1)', [seconds]);
    res.json({
      status: 'ok',
      message: `Held connection for ${seconds} seconds`,
      pool: getPoolStats(),
    });
  } catch (err: any) {
    logger.error({ err: err?.message || err }, 'Error during hold-connection');
    res.status(500).json({ error: err?.message || 'Connection error' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

/**
 * GET /simulations/leak-connection
 * Simulates buggy code where client is checked out from pool but never released
 */
router.get('/leak-connection', async (_req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    leakedClients.push(client);
    logger.warn(
      { totalLeaked: leakedClients.length, pool: getPoolStats() },
      'Simulation: Leaked a connection from pool without release'
    );
    res.json({
      status: 'leaked',
      totalLeaked: leakedClients.length,
      pool: getPoolStats(),
    });
  } catch (err: any) {
    logger.error({ err: err?.message || err }, 'Failed to acquire connection to leak');
    res.status(500).json({ error: err?.message || 'Connection acquisition failed' });
  }
});

/**
 * POST /simulations/release-leaks
 * Releases all manually leaked connections to restore pool health
 */
router.post('/release-leaks', (_req: Request, res: Response) => {
  const count = leakedClients.length;
  while (leakedClients.length > 0) {
    const client = leakedClients.pop();
    try {
      client?.release();
    } catch (e) {
      logger.error({ e }, 'Error releasing leaked client');
    }
  }
  logger.info({ releasedCount: count, pool: getPoolStats() }, 'Released all leaked connections');
  res.json({
    status: 'ok',
    releasedCount: count,
    pool: getPoolStats(),
  });
});

/**
 * POST /simulations/memory-leak
 * Appends chunks of non-reclaimable data to the global array
 * Body: { items?: number, sizeKb?: number }
 */
router.post('/memory-leak', (req: Request, res: Response) => {
  const items = parseInt(req.body?.items, 10) || 5000;
  const sizeKb = parseInt(req.body?.sizeKb, 10) || 4; // 4KB per item

  // Create a padding payload string of sizeKb
  const payloadChunk = 'X'.repeat(sizeKb * 1024);

  for (let i = 0; i < items; i++) {
    leakCounter++;
    leakedMemoryStore.push({
      id: leakCounter,
      data: `${payloadChunk}_${leakCounter}`,
      timestamp: new Date(),
    });
  }

  const mem = process.memoryUsage();
  const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
  logger.warn(
    { addedItems: items, totalLeakedItems: leakedMemoryStore.length, heapUsedMb },
    'Simulation: Memory leak increased'
  );

  res.json({
    status: 'leak_injected',
    addedItems: items,
    totalLeakedItems: leakedMemoryStore.length,
    memory: {
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      heapUsedMb,
    },
  });
});

/**
 * POST /simulations/clear-memory-leak
 * Clears the memory leak array to allow garbage collection
 */
router.post('/clear-memory-leak', (_req: Request, res: Response) => {
  const beforeLen = leakedMemoryStore.length;
  leakedMemoryStore.length = 0;
  leakCounter = 0;

  if (global.gc) {
    try {
      global.gc();
    } catch {
      // ignore
    }
  }

  const mem = process.memoryUsage();
  logger.info({ clearedItems: beforeLen }, 'Simulation: Cleared memory leak array');

  res.json({
    status: 'cleared',
    clearedItems: beforeLen,
    memory: {
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    },
  });
});

export default router;
