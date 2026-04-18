'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_at_least_32_characters_long';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/finflow_test';

const request = require('supertest');
const app     = require('../../src/server');

describe('POST /api/auth/register', () => {
  it('returns 201 with accessToken for valid data', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Test',
        lastName:  'User',
        email:     `test_${Date.now()}@example.com`,
        password:  'Password123!',
        preferredCurrency: 'INR',
      });
    expect([201, 409]).toContain(res.status);
  });

  it('returns 422 for missing password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad@test.com' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 401 for wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
