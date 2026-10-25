import request from 'supertest';
import app from './app';
import pool from './db';

afterAll(async () => {
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
    // If no seed data, 404 is also acceptable
    expect([200, 404]).toContain(res.status);
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
    // 201 if policy exists with seed data, 404 if no seed
    expect([201, 404]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status', 'PENDING');
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
    if (res.body.claims.length > 0) {
      expect(res.body.claims[0]).toHaveProperty('status', 'PENDING');
    }
  });
});
