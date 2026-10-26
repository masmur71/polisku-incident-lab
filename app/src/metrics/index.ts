import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { getPoolStats } from '../db';

const register = new client.Registry();

// Default metrics (heap memory, event loop lag, GC, CPU, etc.)
client.collectDefaultMetrics({ register, prefix: 'polisku_' });

// HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: 'polisku_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});
register.registerMetric(httpRequestDuration);

// HTTP requests counter
export const httpRequestsTotal = new client.Counter({
  name: 'polisku_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});
register.registerMetric(httpRequestsTotal);

// DB Pool gauges
export const poolTotalConnections = new client.Gauge({
  name: 'polisku_pg_pool_total_connections',
  help: 'Total number of connections in the PostgreSQL pool',
  collect() {
    const stats = getPoolStats();
    this.set(stats.totalCount);
  },
});
register.registerMetric(poolTotalConnections);

export const poolIdleConnections = new client.Gauge({
  name: 'polisku_pg_pool_idle_connections',
  help: 'Number of idle connections in the PostgreSQL pool',
  collect() {
    const stats = getPoolStats();
    this.set(stats.idleCount);
  },
});
register.registerMetric(poolIdleConnections);

export const poolWaitingConnections = new client.Gauge({
  name: 'polisku_pg_pool_waiting_connections',
  help: 'Number of requests waiting for a PostgreSQL connection',
  collect() {
    const stats = getPoolStats();
    this.set(stats.waitingCount);
  },
});
register.registerMetric(poolWaitingConnections);

// HTTP In-flight requests gauge
export const httpInFlightRequests = new client.Gauge({
  name: 'polisku_http_in_flight_requests',
  help: 'Current number of HTTP requests being processed',
});
register.registerMetric(httpInFlightRequests);

// Middleware to track HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/metrics') {
    return next();
  }

  httpInFlightRequests.inc();
  const start = process.hrtime();
  let decremented = false;

  const onComplete = () => {
    if (!decremented) {
      httpInFlightRequests.dec();
      decremented = true;
    }
  };

  res.on('close', onComplete);

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;

    let route = req.path;
    if (req.route?.path) {
      route = (req.baseUrl || '') + req.route.path;
    } else if (req.path.startsWith('/policies/')) {
      route = '/policies/:id';
    }

    const statusCode = res.statusCode.toString();

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: statusCode,
      },
      durationInSeconds
    );
  });

  next();
};

export { register };
