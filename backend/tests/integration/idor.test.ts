import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma, disconnectDb } from '../../src/database/db.js';
import { hashPassword } from '../../src/auth/password.js';

describe('Object-Level Authorization & IDOR/BOLA Prevention Tests', () => {
  const app = createApp();
  let aliceCookie: string[];
  let aliceCsrf: string;
  let bobCookie: string[];
  let bobCsrf: string;
  let aliceRecordId: string;

  beforeAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.record.deleteMany({});
    await prisma.user.deleteMany({});

    const pwdHash = await hashPassword('Password123!@#');

    const alice = await prisma.user.create({
      data: { email: 'alice_idor@secureauth.local', fullName: 'Alice', role: 'USER', passwordHash: pwdHash },
    });

    const bob = await prisma.user.create({
      data: { email: 'bob_idor@secureauth.local', fullName: 'Bob', role: 'USER', passwordHash: pwdHash },
    });

    // Login Alice
    const aliceLogin = await request(app).post('/api/v1/auth/login').send({ email: alice.email, password: 'Password123!@#' });
    aliceCookie = aliceLogin.headers['set-cookie'];
    aliceCsrf = aliceLogin.body.csrfToken;

    // Login Bob
    const bobLogin = await request(app).post('/api/v1/auth/login').send({ email: bob.email, password: 'Password123!@#' });
    bobCookie = bobLogin.headers['set-cookie'];
    bobCsrf = bobLogin.body.csrfToken;

    // Alice creates a private confidential record
    const recordRes = await request(app)
      .post('/api/v1/records')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({
        title: "Alice's Secret Vault Entry",
        content: 'Confidential client encryption keys.',
        classification: 'RESTRICTED',
      });

    aliceRecordId = recordRes.body.record.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.record.deleteMany({});
    await prisma.user.deleteMany({});
    await disconnectDb();
  });

  it("Alice can view her own record successfully with 200 OK", async () => {
    const res = await request(app)
      .get(`/api/v1/records/${aliceRecordId}`)
      .set('Cookie', aliceCookie);

    expect(res.status).toBe(200);
    expect(res.body.record.id).toBe(aliceRecordId);
    expect(res.body.record.title).toBe("Alice's Secret Vault Entry");
  });

  it("Bob attempting to read Alice's record IDOR gets 404 (resource enumeration mitigated)", async () => {
    const res = await request(app)
      .get(`/api/v1/records/${aliceRecordId}`)
      .set('Cookie', bobCookie);

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Record not found or access denied');
  });

  it("Bob attempting to update Alice's record IDOR gets 404 and record is unmodified", async () => {
    const res = await request(app)
      .put(`/api/v1/records/${aliceRecordId}`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .send({
        title: "Bob's Tampered Title",
        content: 'Malicious modification payload',
      });

    expect(res.status).toBe(404);

    // Verify record in database remains unaltered
    const untouched = await prisma.record.findUnique({ where: { id: aliceRecordId } });
    expect(untouched?.title).toBe("Alice's Secret Vault Entry");
  });

  it("Bob attempting to delete Alice's record IDOR gets 404 and record remains", async () => {
    const res = await request(app)
      .delete(`/api/v1/records/${aliceRecordId}`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf);

    expect(res.status).toBe(404);

    // Verify record still exists
    const stillExists = await prisma.record.findUnique({ where: { id: aliceRecordId } });
    expect(stillExists).not.toBeNull();
  });

  it("Alice can legitimately delete her own record", async () => {
    const res = await request(app)
      .delete(`/api/v1/records/${aliceRecordId}`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Record deleted successfully');

    // Confirm deletion
    const deleted = await prisma.record.findUnique({ where: { id: aliceRecordId } });
    expect(deleted).toBeNull();
  });
});
