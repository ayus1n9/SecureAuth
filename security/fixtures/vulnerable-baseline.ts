/**
 * ISOLATED VULNERABLE BASELINE DEMONSTRATION FIXTURE
 *
 * PURPOSE:
 * Serves as an isolated, reproducible dynamic application security testing (DAST) baseline
 * to demonstrate common real-world web application misconfigurations prior to remediation.
 *
 * DELIBERATE MISCONFIGURATIONS FOR EMPIRICAL DAST DETECTION:
 * 1. Missing Content-Security-Policy (CSP) (ZAP Rule 10038)
 * 2. Missing Anti-Clickjacking header (X-Frame-Options / frame-ancestors) (ZAP Rule 10020)
 * 3. Missing X-Content-Type-Options: nosniff (ZAP Rule 10021)
 * 4. Verbose server signature disclosure: X-Powered-By & Server banner (ZAP Rule 10036)
 * 5. Insecure session cookies: Missing HttpOnly and SameSite flags (ZAP Rules 10010, 10054)
 * 6. Permissive CORS: Wildcard origin with credential reflection (ZAP Rule 10098)
 * 7. Information disclosure debug route: /debug/info exposing environment details (ZAP Rule 10055)
 *
 * SAFETY GUARD:
 * This file is strictly excluded from production builds and runs exclusively on local port 5001.
 */

import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';

if (process.env.NODE_ENV === 'production') {
  console.error('[SECURITY FATAL] Vulnerable baseline fixture is forbidden from running in production.');
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.BASELINE_PORT || '5001', 10);

app.use(cookieParser());
app.use(express.json());

// Intentionally permissive CORS misconfiguration
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  // Intentionally leak Express server banner
  res.setHeader('X-Powered-By', 'Express/4.21.2');
  res.setHeader('Server', 'NodeJS/Express-Insecure-Baseline');
  next();
});

// Root endpoint: Missing CSP, X-Frame-Options, X-Content-Type-Options
app.get('/', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vulnerable Baseline Target</title>
      </head>
      <body>
        <h1>SecureAuth — Vulnerable Baseline Fixture</h1>
        <p>This endpoint intentionally demonstrates unhardened browser headers and cookies.</p>
        <a href="/login">Login Page</a>
        <a href="/debug/info">Debug System Info</a>
      </body>
    </html>
  `);
});

// Mock login endpoint with unhardened cookie (missing HttpOnly, SameSite, Secure)
app.get('/login', (req: Request, res: Response) => {
  res.cookie('vulnerable_session', 'insecure_token_12345', {
    httpOnly: false, // Insecure: readable by client-side JS
    sameSite: false as any, // Insecure: no CSRF protection
    secure: false,
    path: '/',
  });

  res.send(`
    <html>
      <body>
        <h2>Login Form (Baseline)</h2>
        <form action="/login" method="POST">
          <input type="text" name="email" placeholder="Email" />
          <input type="password" name="password" placeholder="Password" />
          <button type="submit">Login</button>
        </form>
      </body>
    </html>
  `);
});

// Information Disclosure route
app.get('/debug/info', (req: Request, res: Response) => {
  res.json({
    status: 'DEBUG_ACTIVE',
    environment: 'development-baseline',
    nodeVersion: process.version,
    platform: process.platform,
    systemUptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'BASELINE_UP' });
});

app.listen(PORT, () => {
  console.log(`[VULNERABLE BASELINE] Running on http://127.0.0.1:${PORT}`);
});
