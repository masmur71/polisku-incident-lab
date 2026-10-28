import app from './app';
import logger from './logger';
import pool from './db';

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'PolisKu server is running');
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal');
  server.close(async () => {
    await pool.end();
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
