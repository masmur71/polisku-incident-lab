import { Pool, PoolConfig } from 'pg';
import logger from '../logger';

const poolConfig: PoolConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'poliskudb',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '5000', 10),
};

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.debug('New client connected to pool');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle client');
});

pool.on('remove', () => {
  logger.debug('Client removed from pool');
});

export const getPoolStats = () => ({
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount,
});

export default pool;
