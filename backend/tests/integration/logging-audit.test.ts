import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, disconnectDb } from '../../src/database/db.js';
import { sanitizePayload } from '../../src/logging/logger.js';

describe('Security Logging & Audit Trail Tests', () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.session.deleteMany({ where: { user: { email: 'audit_test@secureauth.local' } } });
    await prisma.user.deleteMany({ where: { email: 'audit_test@secureauth.local' } });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { user: { email: 'audit_test@secureauth.local' } } });
    await prisma.user.deleteMany({ where: { email: 'audit_test@secureauth.local' } });
    await disconnectDb();
  });

  it('should redact sensitive credentials and tokens in sanitizePayload', () => {
    const rawPayload = {
      username: 'johndoe',
      password: 'MySecretPassword123!',
      passwordConfirm: 'MySecretPassword123!',
      token: 'sensitive_bearer_token',
      apiKey: 'secret_key_123',
      nested: {
        currentPassword: 'old_secret_pwd',
        safeMetadata: 'public_info',
      },
    };

    const sanitized: any = sanitizePayload(rawPayload);

    expect(sanitized.username).toBe('johndoe');
    expect(sanitized.password).toBe('[REDACTED_SENSITIVE]');
    expect(sanitized.passwordConfirm).toBe('[REDACTED_SENSITIVE]');
    expect(sanitized.token).toBe('[REDACTED_SENSITIVE]');
    expect(sanitized.apiKey).toBe('[REDACTED_SENSITIVE]');
    expect(sanitized.nested.currentPassword).toBe('[REDACTED_SENSITIVE]');
    expect(sanitized.nested.safeMetadata).toBe('public_info');
  });

  it('should create immutable audit event on user registration and login', async () => {
    // 1. Register
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'audit_test@secureauth.local',
        password: 'Password123!@#',
        fullName: 'Audit User',
      });

    expect(regRes.status).toBe(201);
    const userId = regRes.body.user.id;

    // 2. Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'audit_test@secureauth.local',
        password: 'Password123!@#',
      });

    expect(loginRes.status).toBe(200);

    // Verify AuditEvent records
    const registrationAudit = await prisma.auditEvent.findFirst({
      where: { eventType: 'USER_REGISTERED', actorId: userId },
    });
    expect(registrationAudit).toBeDefined();
    expect((registrationAudit?.details as any)?.email).toBe('audit_test@secureauth.local');
    // Ensure no password was persisted in audit log details
    expect(JSON.stringify(registrationAudit?.details)).not.toContain('Password123!@#');

    const loginAudit = await prisma.auditEvent.findFirst({
      where: { eventType: 'LOGIN_SUCCESS', actorId: userId },
    });
    expect(loginAudit).toBeDefined();
    expect((loginAudit?.details as any)?.email).toBe('audit_test@secureauth.local');
  });
});
