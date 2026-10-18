import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, disconnectDb } from '../../src/database/db.js';
import { SESSION_COOKIE_NAME } from '../../src/auth/session.js';

describe('Authentication Integration Tests', () => {
  const app = createApp();

  beforeAll(async () => {
    // Clean up test users
    await prisma.session.deleteMany({});
    await prisma.record.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { in: ['testauth@secureauth.local', 'duplicate@secureauth.local'] } },
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.record.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { in: ['testauth@secureauth.local', 'duplicate@secureauth.local'] } },
    });
    await disconnectDb();
  });

  it('should register a new account with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'testauth@secureauth.local',
        password: 'StrongPassword123!@#',
        fullName: 'Test Auth User',
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Account successfully registered');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('testauth@secureauth.local');
    expect(res.body.user.role).toBe('USER');
    // Ensure password hash is NEVER exposed through API response
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('should reject duplicate registration with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'testauth@secureauth.local',
        password: 'AnotherPassword123!@#',
        fullName: 'Duplicate Tester',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('should reject registration with weak password violating policy', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'weakpass@secureauth.local',
        password: 'weak',
        fullName: 'Weak Password',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('should prevent untrusted role escalation via registration body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'hacker@secureauth.local',
        password: 'StrongPassword123!@#',
        fullName: 'Hacker Try',
        role: 'ADMIN', // Mass assignment attempt
      });

    // Zod strict validation should reject unexpected field 'role'
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('should authenticate valid user, rotate session, and set HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'testauth@secureauth.local',
        password: 'StrongPassword123!@#',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Authentication successful');
    expect(res.body.user.email).toBe('testauth@secureauth.local');
    expect(res.body.csrfToken).toBeDefined();

    // Verify session cookie attributes
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const sessionCookie = cookies.find((c: string) => c.includes(SESSION_COOKIE_NAME));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
  });

  it('should reject invalid password with generic 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'testauth@secureauth.local',
        password: 'WrongPassword123!@#',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should reject non-existent user with generic 401 (preventing user enumeration)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@secureauth.local',
        password: 'Password123!@#',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should allow authenticated user to retrieve own profile via /api/v1/auth/me', async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'testauth@secureauth.local',
        password: 'StrongPassword123!@#',
      });

    const cookie = loginRes.headers['set-cookie'];

    // 2. Fetch profile
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('testauth@secureauth.local');
    expect(meRes.body.user.passwordHash).toBeUndefined();
  });

  it('should invalidate session and clear cookie upon logout', async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'testauth@secureauth.local',
        password: 'StrongPassword123!@#',
      });

    const cookie = loginRes.headers['set-cookie'];
    const csrfToken = loginRes.body.csrfToken;

    // 2. Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrfToken);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toBe('Logged out successfully');

    // 3. Verify session is dead
    const afterLogoutRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(afterLogoutRes.status).toBe(401);
  });
});
