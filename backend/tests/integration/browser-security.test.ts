import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, disconnectDb } from '../../src/database/db.js';
import { hashPassword } from '../../src/auth/password.js';

describe('Browser Security & Defense-in-Depth Tests', () => {
  const app = createApp();
  let userCookie: string[];
  let validCsrfToken: string;

  beforeAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.record.deleteMany({});
    await prisma.user.deleteMany({});

    const pwdHash = await hashPassword('Password123!@#');
    const user = await prisma.user.create({
      data: { email: 'browser_user@secureauth.local', fullName: 'Browser Tester', role: 'USER', passwordHash: pwdHash },
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'Password123!@#' });
    userCookie = loginRes.headers['set-cookie'];
    validCsrfToken = loginRes.body.csrfToken;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.record.deleteMany({});
    await prisma.user.deleteMany({});
    await disconnectDb();
  });

  it('should deliver robust security headers on HTTP responses', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    // Anti-MIME sniffing
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    // Anti-Clickjacking
    expect(res.headers['x-frame-options']).toBe('DENY');
    // Referrer Policy
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    // Content Security Policy
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    // Server banner removal
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('should reject requests originating from unapproved CORS domains', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil-attacker.example.com');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('CORS policy violation');
  });

  it('should allow requests originating from configured whitelist domains', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should reject state-changing requests when CSRF token is completely missing', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Cookie', userCookie)
      // Omit x-csrf-token
      .send({
        title: 'Unauthorized CSRF Try',
        content: 'Attacker payload via cross-site form submission',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toBe('CSRF token missing or invalid');
  });

  it('should reject state-changing requests when CSRF token is forged or tampered', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Cookie', userCookie)
      .set('x-csrf-token', 'tampered.invalid_hmac_signature')
      .send({
        title: 'Tampered CSRF Try',
        content: 'Testing signature verification failure',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('CSRF');
  });

  it('should allow state-changing requests with valid CSRF token and cookie', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Cookie', userCookie)
      .set('x-csrf-token', validCsrfToken)
      .send({
        title: 'Legitimate Authorized Record',
        content: 'Protected against CSRF and authenticated via session cookie',
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Record created successfully');
  });
});
