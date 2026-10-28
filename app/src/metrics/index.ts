import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { getPoolStats } from '../db';
import { diskStats } from '../disk';

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

export const downstreamRequests = new client.Counter({
  name: 'polisku_downstream_requests_total', help: 'Completed partner calls by outcome', labelNames: ['outcome'], registers: [register],
});
export const downstreamDuration = new client.Histogram({
  name: 'polisku_downstream_duration_seconds', help: 'Partner call duration including response body', labelNames: ['outcome'],
  buckets: [0.1, 0.5, 1, 2, 2.5, 5, 10, 15], registers: [register],
});
const abortedRequests = new client.Counter({
  name: 'polisku_http_aborted_requests_total', help: 'Client disconnected before response finished', registers: [register],
});
for (const [name, field] of [['size', 'sizeBytes'], ['avail', 'availableBytes']] as const) {
  new client.Gauge({ name: `polisku_incident_disk_${name}_bytes`, help: 'Dedicated incident filesystem bytes', registers: [register],
    collect() { this.set(diskStats()[field]); },
  });
}
new client.Gauge({ name: 'polisku_heap_limit_bytes', help: 'V8 heap limit in bytes', registers: [register],
  collect() { this.set(require('v8').getHeapStatistics().heap_size_limit); },
});

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
      if (!res.writableFinished) abortedRequests.inc();
      httpInFlightRequests.dec();
      decremented = true;
    }
  };

  res.on('close', onComplete);

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;

    let route = 'unmatched';
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
