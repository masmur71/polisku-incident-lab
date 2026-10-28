import express from 'express';
import pinoHttp from 'pino-http';
import logger from './logger';
import routes from './routes';
import simulationsRouter from './routes/simulations';
import { metricsMiddleware } from './metrics';

const app = express();

// Middleware
app.use(express.json());
app.use(
  pinoHttp({
    logger,
    genReqId: (req) =>
      (req.headers['x-request-id'] as string) || crypto.randomUUID(),
    autoLogging: {
      ignore: (req) => req.url === '/metrics',
    },
  })
);

app.use((req, res, next) => {
  res.setHeader('x-request-id', String(req.id));
  next();
});

// Prometheus metrics middleware
app.use(metricsMiddleware);

// Routes
app.use(routes);
if (process.env.LAB_MODE === 'true') app.use('/simulations', simulationsRouter);

export default app;
