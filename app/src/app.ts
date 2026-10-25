import express from 'express';
import pinoHttp from 'pino-http';
import logger from './logger';
import routes from './routes';

const app = express();

// Middleware
app.use(express.json());
app.use(
  pinoHttp({
    logger,
    genReqId: (req) =>
      (req.headers['x-request-id'] as string) || crypto.randomUUID(),
  })
);

// Routes
app.use(routes);

export default app;
