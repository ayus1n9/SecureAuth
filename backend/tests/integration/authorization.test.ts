import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, disconnectDb } from '../../src/database/db.js';
import { hashPassword } from '../../src/auth/password.js';

describe('Server-Enforced RBAC Authorization Tests', () => {
  const app = createApp();
  let userCookie: string[];
  let userCsrf: string;
  let supportCookie: string[];
  let supportCsrf: string;
  let adminCookie: string[];
  let adminCsrf: string;
  let normalUserId: string;

  beforeAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.record.deleteMany({});
    await prisma.user.deleteMany({});

    const pwdHash = await hashPassword('Password123!@#');

    const admin = await prisma.user.create({
      data: { email: 'rbac_admin@secureauth.local', fullName: 'Admin', role: 'ADMIN', passwordHash: pwdHash },
    });

    const support = await prisma.user.create({
      data: { email: 'rbac_support@secureauth.local', fullName: 'Support', role: 'SUPPORT', passwordHash: pwdHash },
    });

    const normalUser = await prisma.user.create({
      data: { email: 'rbac_user@secureauth.local', fullName: 'User', role: 'USER', passwordHash: pwdHash },
    });
    normalUserId = normalUser.id;

    // Login Admin
    const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'Password123!@#' });
    adminCookie = adminLogin.headers['set-cookie'];
    adminCsrf = adminLogin.body.csrfToken;

    // Login Support
    const supportLogin = await request(app).post('/api/v1/auth/login').send({ email: support.email, password: 'Password123!@#' });
    supportCookie = supportLogin.headers['set-cookie'];
    supportCsrf = supportLogin.body.csrfToken;

    // Login Normal User
    const userLogin = await request(app).post('/api/v1/auth/login').send({ email: normalUser.email, password: 'Password123!@#' });
    userCookie = userLogin.headers['set-cookie'];
    userCsrf = userLogin.body.csrfToken;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.record.deleteMany({});
    await prisma.user.deleteMany({});
    await disconnectDb();
  });

  it('Anonymous request to protected endpoint should be rejected with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/records');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('USER attempting to access ADMIN dashboard stats should receive 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', userCookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('permission');
  });

  it('SUPPORT attempting to access ADMIN dashboard stats should receive 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', supportCookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('ADMIN can access ADMIN dashboard stats with 200 OK', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.metrics).toBeDefined();
    expect(res.body.metrics.totalUsers).toBe(3);
  });

  it('SUPPORT can view minimal user list, but cannot view sensitive fields like lockout or counts', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Cookie', supportCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const first = res.body.data[0];
    expect(first.email).toBeDefined();
    expect(first.role).toBeDefined();
    expect(first.failedLoginAttempts).toBeUndefined();
    expect(first._count).toBeUndefined();
  });

  it('USER attempting to change roles should receive 403 Forbidden', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${normalUserId}/role`)
      .set('Cookie', userCookie)
      .set('x-csrf-token', userCsrf)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('ADMIN can legitimately update a user role to SUPPORT', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${normalUserId}/role`)
      .set('Cookie', adminCookie)
      .set('x-csrf-token', adminCsrf)
      .send({ role: 'SUPPORT' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('SUPPORT');
  });

  it('ADMIN self-demotion is rejected with 400 Bad Request to prevent administrator lockout', async () => {
    // Get admin ID
    const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', adminCookie);
    const adminId = meRes.body.user.id;

    const res = await request(app)
      .patch(`/api/v1/users/${adminId}/role`)
      .set('Cookie', adminCookie)
      .set('x-csrf-token', adminCsrf)
      .send({ role: 'USER' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toContain('Administrators cannot alter their own role');
  });
});
