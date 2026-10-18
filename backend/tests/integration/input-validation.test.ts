import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, disconnectDb } from '../../src/database/db.js';
import { hashPassword } from '../../src/auth/password.js';

describe('Input Validation & Injection Prevention Tests', () => {
  const app = createApp();
  let userCookie: string[];
  let userCsrf: string;

  beforeAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.record.deleteMany({});
    await prisma.user.deleteMany({});

    const pwdHash = await hashPassword('Password123!@#');
    const user = await prisma.user.create({
      data: { email: 'val_user@secureauth.local', fullName: 'Validation Tester', role: 'USER', passwordHash: pwdHash },
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'Password123!@#' });
    userCookie = loginRes.headers['set-cookie'];
    userCsrf = loginRes.body.csrfToken;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.record.deleteMany({});
    await prisma.user.deleteMany({});
    await disconnectDb();
  });

  it('should reject mass-assignment fields with 400 Validation Error', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Cookie', userCookie)
      .set('x-csrf-token', userCsrf)
      .send({
        title: 'Valid Title',
        content: 'Valid Content',
        injectedField: 'malicious', // Unexpected field
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('should reject malformed non-UUID identifiers with 400 Validation Error', async () => {
    const res = await request(app)
      .get('/api/v1/records/not-a-valid-uuid')
      .set('Cookie', userCookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.message).toContain('UUID');
  });

  it('should reject missing required fields on record creation', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Cookie', userCookie)
      .set('x-csrf-token', userCsrf)
      .send({
        title: 'Title Without Content',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('should safely handle SQL injection payloads in search and title fields via parameterization', async () => {
    const sqliPayload = "'; DROP TABLE \"Record\"; -- ' OR '1'='1";

    const res = await request(app)
      .post('/api/v1/records')
      .set('Cookie', userCookie)
      .set('x-csrf-token', userCsrf)
      .send({
        title: sqliPayload,
        content: 'Testing parameterized query safety with SQLi payload',
      });

    // Successfully stored as literal text, not executed as SQL
    expect(res.status).toBe(201);
    expect(res.body.record.title).toBe(sqliPayload);

    // Verify database table was NOT dropped
    const count = await prisma.record.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should reject malformed JSON with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Cookie', userCookie)
      .set('x-csrf-token', userCsrf)
      .set('Content-Type', 'application/json')
      .send('{"title": "Unclosed JSON string');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toContain('Malformed JSON payload');
  });
});
