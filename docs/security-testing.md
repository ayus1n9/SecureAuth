# SecureAuth — Automated Security Testing Suite

## 1. Testing Philosophy

In modern Application Security, security controls must be verified empirically through automated test suites rather than assumed to work based on configuration files alone.

SecureAuth incorporates 44 automated security tests across unit, integration, and end-to-end layers using **Vitest** and **Supertest**.

```
backend/tests/
├── unit/
│   ├── password.test.ts          # Argon2id hashing, unique salts, timing-attack resistance
│   └── permissions.test.ts       # RBAC permission matrix checks per role
└── integration/
    ├── auth.test.ts              # Registration, duplicate handling, rotation, logout
    ├── authorization.test.ts     # Role boundaries, self-demotion prevention, 403 checks
    ├── idor.test.ts              # Cross-user record read, modify, delete attempts (BOLA)
    ├── input-validation.test.ts  # Mass assignment, malformed UUIDs, SQLi payloads
    ├── browser-security.test.ts  # Helmet headers, CORS rejection, CSRF signed tokens
    ├── logging-audit.test.ts     # Sensitive field redaction, immutable audit event logs
    └── rate-limit.test.ts        # Request ceilings and 429 status code assertions
```

---

## 2. Test Execution Commands

To execute the test suite:
```bash
# Navigate to backend
cd backend

# Execute all security test suites
npm test

# Run tests with code coverage analysis
npm run test:coverage
```

---

## 3. Test Coverage Summary

- **Authentication (10 Tests)**:
  - Account registration with least-privilege default role (`USER`).
  - Strict rejection of duplicate registration (409 Conflict).
  - Validation of minimum 12-character complexity password policy.
  - Rejection of role parameter injection in registration payload.
  - Session creation with 256-bit cryptographically secure tokens.
  - HttpOnly and SameSite cookie attributes validation.
  - Timing-safe fake hash verification on invalid/nonexistent users.
  - Session rotation verification.
  - Explicit session invalidation upon logout.
- **Authorization & RBAC (8 Tests)**:
  - Anonymous access denial (401 Unauthorized).
  - USER prohibited from administrative statistics (403 Forbidden).
  - SUPPORT prohibited from administrative controls (403 Forbidden).
  - ADMIN permitted access to system statistics (200 OK).
  - Data minimization on SUPPORT user list queries.
  - Prohibiting normal users from modifying roles.
  - Permitting ADMIN to legitimately modify user roles.
  - Prohibiting ADMIN from demoting themselves (lockout prevention).
- **IDOR / BOLA Prevention (5 Tests)**:
  - Alice creates and reads own confidential record (200 OK).
  - Bob attempts to read Alice's record -> 404 Not Found.
  - Bob attempts to update Alice's record -> 404 Not Found; database record verified untampered.
  - Bob attempts to delete Alice's record -> 404 Not Found; database record verified intact.
  - Alice legitimately deletes own record (200 OK).
- **Input Validation & Injection (5 Tests)**:
  - Zod `.strict()` schema rejecting unexpected fields.
  - Malformed non-UUID identifiers rejected with 400 Bad Request.
  - Missing required fields rejected with 400 Bad Request.
  - SQL injection payloads stored safely as literal text without query errors.
  - Malformed JSON payloads handled safely without unhandled exceptions.
- **Browser Security (6 Tests)**:
  - Presence of `nosniff`, `X-Frame-Options: DENY`, `strict-origin-when-cross-origin`, CSP.
  - Absence of `X-Powered-By` server banner.
  - Rejection of unauthorized CORS origins (403 Forbidden).
  - Verification of allowed CORS origins with credentials flag.
  - Rejection of state-changing requests missing CSRF token (403 Forbidden).
  - Rejection of state-changing requests with tampered CSRF tokens (403 Forbidden).
  - Acceptance of valid CSRF tokens with valid cookies (201 Created).
- **Logging & Audit Trail (2 Tests)**:
  - Automatic redaction of passwords, tokens, API keys in log serializations.
  - Database persistence of `USER_REGISTERED` and `LOGIN_SUCCESS` audit events.
- **Password Unit Tests (5 Tests)**:
  - Argon2id hash format and prefix verification.
  - Generation of unique random salts per password hash.
  - Accurate verification of valid passwords.
  - Rejection of invalid passwords.
  - Safe error handling on empty or invalid inputs.
- **Permissions Unit Tests (3 Tests)**:
  - Complete matrix validation across `USER`, `SUPPORT`, and `ADMIN`.
