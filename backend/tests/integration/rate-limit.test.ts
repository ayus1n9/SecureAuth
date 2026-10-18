import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

describe('Rate Limiting Security Tests', () => {
  it('should enforce request ceiling and return 429 when threshold exceeded', async () => {
    const testApp = express();
    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 3, // Allow up to 3 requests
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
      },
    });

    testApp.use('/limited', testLimiter, (req: Request, res: Response) => {
      res.json({ ok: true });
    });

    // Request 1, 2, 3 should succeed
    const res1 = await request(testApp).get('/limited');
    expect(res1.status).toBe(200);

    const res2 = await request(testApp).get('/limited');
    expect(res2.status).toBe(200);

    const res3 = await request(testApp).get('/limited');
    expect(res3.status).toBe(200);

    // Request 4 should be blocked with 429 Too Many Requests
    const res4 = await request(testApp).get('/limited');
    expect(res4.status).toBe(429);
    expect(res4.body.error).toBe('Too Many Requests');
    expect(res4.body.message).toBe('Rate limit exceeded');
  });
});
