# SecureAuth — Threat Model & Risk Analysis

## 1. Assets & Security Objectives

| Asset | Sensitivity | Objective |
| :--- | :--- | :--- |
| **User Password Hashes** | Critical | Confidentiality & preimage resistance (Argon2id with high memory cost). Never exposed via API. |
| **Session Identifiers** | High | Confidentiality & unpredictability (256-bit cryptographically secure random tokens). |
| **User Records** | High | Confidentiality & Integrity. Strictly isolated to resource owner (BOLA/IDOR prevention). |
| **Administrative Controls** | High | Integrity & non-repudiation. Server-enforced RBAC and immutable audit logging. |
| **Audit Logs** | High | Accountability & visibility. Credential redaction in application logs. |

---

## 2. Threat Scenarios & Implemented Mitigations

### 2.1 Broken Object-Level Authorization (BOLA / IDOR)
- **Threat Scenario**: Attacker modifies a record ID parameter (`GET /api/v1/records/:id`, `PUT /api/v1/records/:id`, `DELETE /api/v1/records/:id`) to read, alter, or delete other users' records.
- **Impact**: Unauthorized data exposure or data tampering across tenants.
- **Implemented Control**: Server-enforced query constraint `WHERE id = :id AND userId = :currentUserId`.
- **Response Handling**: Returns `404 Not Found` (rather than 403) to prevent resource existence enumeration.
- **Verification**: `backend/tests/integration/idor.test.ts` (verifies Bob cannot read, modify, or delete Alice's records).
- **Residual Risk**: Low. Any future record endpoints must explicitly enforce ownership middleware.

### 2.2 Privilege Escalation & Mass Assignment
- **Threat Scenario**: Attacker registers an account or updates their profile sending `{"role": "ADMIN"}`.
- **Impact**: Full administrative takeover.
- **Implemented Control**:
  - Registration route hardcodes `role: 'USER'`.
  - Zod schemas use `.strict()`, rejecting unexpected fields with `400 Bad Request`.
  - Role modifications restricted strictly to `PATCH /api/v1/users/:id/role` requiring `users:change_role` permission.
- **Verification**: `backend/tests/integration/auth.test.ts` and `backend/tests/integration/authorization.test.ts`.
- **Residual Risk**: Negligible.

### 2.3 Session Fixation & Hijacking
- **Threat Scenario**: Attacker supplies a pre-established session identifier to a victim before authentication or intercepts unencrypted cookies.
- **Impact**: Account takeover upon victim login.
- **Implemented Control**:
  - Session identifiers are rotated upon every successful login and password change.
  - Cookies configured with `HttpOnly`, `SameSite=lax`, and `Secure` (in HTTPS/production).
  - Explicit session TTL (24 hours) and revocation on logout.
- **Verification**: `backend/tests/integration/auth.test.ts`.
- **Residual Risk**: Malicious browser extensions with full memory access could read cookie jars.

### 2.4 Cross-Site Request Forgery (CSRF)
- **Threat Scenario**: Attacker tricks an authenticated user into visiting a malicious webpage that executes background state-changing API calls.
- **Impact**: Unauthorized record creation, profile changes, or credential modification.
- **Implemented Control**:
  - Signed double-submit CSRF token pattern.
  - State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require an HMAC-verified `X-CSRF-Token` header.
- **Verification**: `backend/tests/integration/browser-security.test.ts` (verifies requests without or with invalid tokens return 403).
- **Residual Risk**: Same-origin XSS could read the non-HttpOnly CSRF cookie; mitigated via strict Content-Security-Policy.

### 2.5 Credential Stuffing & Brute Force
- **Threat Scenario**: Automated bots flood login endpoints with leaked username/password combos.
- **Impact**: Account compromise and denial of service.
- **Implemented Control**:
  - Tiered rate-limiting via `express-rate-limit` (5 attempts per 15 minutes per IP on `/api/v1/auth/login`).
  - Constant-time dummy verification on non-existent accounts mitigating timing-based user enumeration.
  - Generic authentication error messages ("Invalid email or password").
- **Verification**: `backend/tests/integration/rate-limit.test.ts` and `auth.test.ts`.
- **Residual Risk**: Distributed botnets rotating thousands of distinct residential IPs could bypass IP-based thresholds without CAPTCHA or device fingerprinting.

### 2.6 SQL Injection
- **Threat Scenario**: User inputs malicious SQL syntax into search filters, usernames, or record payloads.
- **Impact**: Database dump, unauthorized bypass, or data destruction.
- **Implemented Control**:
  - Parameterized database queries via Prisma ORM query engine.
  - Strict input schemas rejecting non-string/unexpected types.
- **Verification**: `backend/tests/integration/input-validation.test.ts` (payload stored as literal text; table integrity confirmed).
- **Residual Risk**: Negligible, provided raw query interpolation is never used.
