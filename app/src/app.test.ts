import request from 'supertest';
import app from './app';
import pool from './db';

const createdClaims: number[] = [];
afterAll(async () => {
  if (createdClaims.length) await pool.query('DELETE FROM claims WHERE id = ANY($1::int[])', [createdClaims]);
  await pool.end();
});

describe('GET /health', () => {
  it('should return status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
  });
});

describe('GET /policies/:id', () => {
  it('should return 404 for non-existent policy', async () => {
    const res = await request(app).get('/policies/999999999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Policy not found');
  });

  it('should return policy with customer data for existing policy', async () => {
    const res = await request(app).get('/policies/1');
    if (res.status === 200) {
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('policyNumber');
      expect(res.body).toHaveProperty('customer');
      expect(res.body.customer).toHaveProperty('fullName');
    }
    expect(res.status).toBe(200);
  });
});

describe('POST /claims', () => {
  it('should return 400 for missing fields', async () => {
    const res = await request(app)
      .post('/claims')
      .send({ policyId: 1 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 404 for non-existent policy', async () => {
    const res = await request(app)
      .post('/claims')
      .send({
        policyId: 999999999,
        claimType: 'DEATH',
        description: 'Test claim',
        amount: 1000000,
      });
    expect(res.status).toBe(404);
  });

  it('should create claim for existing policy', async () => {
    const res = await request(app)
      .post('/claims')
      .send({
        policyId: 1,
        claimType: 'CRITICAL_ILLNESS',
        description: 'Test claim from integration test',
        amount: 5000000,
      });
    if (res.body.id) createdClaims.push(res.body.id);
    expect(res.status).toBe(201);
    if (res.status === 201) {
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status', 'PENDING');
      const saved = await pool.query('SELECT status FROM claims WHERE id = $1', [res.body.id]);
      expect(saved.rows[0].status).toBe('PENDING');
    }
  });
});

describe('GET /claims', () => {
  it('should return claims list', async () => {
    const res = await request(app).get('/claims');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('claims');
    expect(Array.isArray(res.body.claims)).toBe(true);
  });

  it('should filter by status', async () => {
    const res = await request(app).get('/claims?status=PENDING');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('claims');
    expect(res.body.claims.length).toBeGreaterThan(0);
    if (res.body.claims.length > 0) {
      expect(res.body.claims[0]).toHaveProperty('status', 'PENDING');
    }
  });
});

describe('GET /metrics', () => {
  it('should expose prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('polisku_http_requests_total');
    expect(res.text).toContain('polisku_pg_pool_total_connections');
    expect(res.text).toContain('polisku_http_request_duration_seconds');
  });
});


describe('Lab access and request correlation', () => {
  it('disables simulation routes unless LAB_MODE is explicitly enabled', async () => {
    const res = await request(app).get('/simulations/stats');
    expect(res.status).toBe(404);
  });
  it('returns the request id to the caller', async () => {
    const res = await request(app).get('/health').set('x-request-id', 'integration-recovery');
    expect(res.headers['x-request-id']).toBe('integration-recovery');
  });
});
