# SecureAuth — OWASP Top 10:2025 Mitigation Matrix

The following matrix documents the threat scenarios, technical controls, code implementations, automated verification tests, scanner findings, and residual risks for all categories defined in the official **OWASP Top 10:2025**.

---

### A01:2025 — Broken Access Control
- **Threat Scenario**: Attackers manipulate request parameters, URLs, or cookies to access unauthorized administrative routes or view/modify other users' records (BOLA / IDOR / Privilege Escalation).
- **Applicability**: Highly Applicable.
- **Implemented Controls**:
  - Centralized RBAC middleware (`requirePermission`) separating authentication and permission verification.
  - Server-side object ownership verification (`WHERE id = :id AND userId = req.user.id`).
  - Strict parameter and UUID validation via Zod schemas.
  - 404 responses on cross-user record lookups to prevent tenant enumeration.
- **Implemented Files**: `backend/src/middleware/auth.ts`, `backend/src/authorization/permissions.ts`, `backend/src/routes/records.routes.ts`, `backend/src/routes/users.routes.ts`.
- **Automated Tests**: `backend/tests/integration/authorization.test.ts`, `backend/tests/integration/idor.test.ts`.
- **Residual Risks**: Future endpoints must explicitly attach ownership check middleware; manual review needed for multi-tenant extensions.

---

### A02:2025 — Security Misconfiguration
- **Threat Scenario**: Default configurations, missing security headers, unhardened cookies, permissive CORS, or verbose stack trace leakage.
- **Applicability**: Highly Applicable.
- **Implemented Controls**:
  - Helmet middleware enforcing strict Content-Security-Policy, `frame-ancestors 'none'`, `nosniff`, and `referrer-policy`.
  - Removal of `X-Powered-By` and `Server` banner headers.
  - Strict CORS whitelist validation rejecting unauthorized origins.
  - Cookies configured with `HttpOnly`, `SameSite=lax`, and `Secure`.
  - Safe global error handler stripping internal stack traces.
- **Implemented Files**: `backend/src/middleware/security.ts`, `backend/src/app.ts`.
- **Automated Tests**: `backend/tests/integration/browser-security.test.ts`.
- **Relevant ZAP Findings**: Remediated ZAP Rules 10038 (CSP), 10020 (Anti-clickjacking), 10021 (Nosniff), 10036 (Server Leaks), 10054 (Cookie SameSite).
- **Residual Risks**: Production reverse proxy must properly terminate TLS and enforce HSTS.

---

### A03:2025 — Software Supply Chain Failures
- **Threat Scenario**: Compromised, malicious, or vulnerable third-party npm packages introducing backdoors or remote code execution.
- **Applicability**: Highly Applicable.
- **Implemented Controls**:
  - Pinned exact dependencies with committed `package-lock.json`.
  - Automated dependency vulnerability auditing (`npm audit`) in CI/CD.
  - Blocking unapproved install scripts by default in npm 12.
  - Container vulnerability scanning via Aquasec Trivy in CI pipeline.
- **Implemented Files**: `backend/package.json`, `frontend/package.json`, `.github/workflows/security-ci.yaml`.
- **Automated Tests**: CI GitHub Actions automated dependency audit and Trivy scanning steps.
- **Residual Risks**: Zero-day vulnerabilities in newly published transitive packages prior to CVE registration.

---

### A04:2025 — Cryptographic Failures
- **Threat Scenario**: Weak password hashes (MD5/SHA1), predictable session tokens, or plaintext transmission of sensitive credentials.
- **Applicability**: Highly Applicable.
- **Implemented Controls**:
  - Argon2id password hashing with memory and time cost protection.
  - Cryptographically secure 256-bit random tokens via `crypto.randomBytes(32)` for sessions.
  - HMAC-SHA256 signing for CSRF tokens with constant-time equality comparisons (`crypto.timingSafeEqual`).
  - No plaintext credentials stored or transmitted.
- **Implemented Files**: `backend/src/auth/password.ts`, `backend/src/auth/session.ts`, `backend/src/middleware/security.ts`.
- **Automated Tests**: `backend/tests/unit/password.test.ts`, `backend/tests/integration/browser-security.test.ts`.
- **Residual Risks**: Argon2id memory limits must be scaled appropriately as attacker GPU hardware advances.

---

### A05:2025 — Injection
- **Threat Scenario**: SQL injection, Command injection, or Cross-Site Scripting (XSS) via unsanitized user inputs.
- **Applicability**: Highly Applicable.
- **Implemented Controls**:
  - Parameterized database operations through Prisma ORM (zero string concatenation into queries).
  - Strict input validation with Zod (`.strict()` rejecting unexpected fields).
  - Context-aware React JSX escaping rendering untrusted user inputs safely.
  - Strict Content-Security-Policy disallowing unsafe eval and scripts.
- **Implemented Files**: `backend/src/database/db.ts`, `backend/src/validation/schemas.ts`, `frontend/src/pages/WorkspacePage.tsx`.
- **Automated Tests**: `backend/tests/integration/input-validation.test.ts`.
- **Residual Risks**: Direct usage of `dangerouslySetInnerHTML` or raw `$queryRawUnsafe` in future code would bypass these protections.

---

### A06:2025 — Insecure Design
- **Threat Scenario**: Flawed system architecture, lack of threat modeling, self-promotion logic flaws, or account enumeration side-channels.
- **Applicability**: Highly Applicable.
- **Implemented Controls**:
  - Comprehensive STRIDE threat model documented prior to implementation.
  - State-changing actions protected by double-submit CSRF tokens.
  - Constant-time dummy verification on non-existent accounts mitigating user enumeration.
  - Hardcoded least-privilege default role (`USER`) on registration.
  - Admin self-demotion prevention preventing system lockouts.
- **Implemented Files**: `docs/threat-model.md`, `backend/src/routes/auth.routes.ts`, `backend/src/routes/users.routes.ts`.
- **Automated Tests**: `backend/tests/integration/auth.test.ts`, `backend/tests/integration/authorization.test.ts`.
- **Residual Risks**: Complex enterprise business logic additions require continuous threat model updates.

---

### A07:2025 — Authentication Failures
- **Threat Scenario**: Credential stuffing, brute-force attacks, session fixation, or broken logout mechanics.
- **Applicability**: Highly Applicable.
- **Implemented Controls**:
  - Tiered IP-based rate limiting on authentication routes (5 per 15 min).
  - Session identifier rotation on authentication to prevent fixation.
  - Server-side session deletion and cookie clearing on logout.
  - Revocation of all user sessions across devices upon password changes.
  - Minimum 12-character password complexity policy.
- **Implemented Files**: `backend/src/auth/session.ts`, `backend/src/routes/auth.routes.ts`, `backend/src/middleware/security.ts`.
- **Automated Tests**: `backend/tests/integration/auth.test.ts`, `backend/tests/integration/rate-limit.test.ts`.
- **Residual Risks**: Distributed residential proxy botnets could bypass single-IP rate limits without CAPTCHA.

---

### A08:2025 — Software or Data Integrity Failures
- **Threat Scenario**: Deserialization of untrusted data, unverified external state modifications, or tampered CSRF tokens.
- **Applicability**: Highly Applicable.
- **Implemented Controls**:
  - Cryptographically signed CSRF tokens using HMAC-SHA256.
  - Safe JSON body parsing with strict size bounds (100kb limit) avoiding prototype pollution.
  - Strict TypeScript schema typing and Zod runtime schema assertions.
- **Implemented Files**: `backend/src/middleware/security.ts`, `backend/src/validation/schemas.ts`.
- **Automated Tests**: `backend/tests/integration/input-validation.test.ts`, `backend/tests/integration/browser-security.test.ts`.
- **Residual Risks**: Third-party external dependencies must maintain high integrity standards.

---

### A09:2025 — Security Logging & Alerting Failures
- **Threat Scenario**: Security incidents (failed logins, privilege escalation, CSRF failures) go undetected, or sensitive credentials leak into log files.
- **Applicability**: Highly Applicable.
- **Implemented Controls**:
  - Structured JSON logging via Pino with ISO 8601 timestamps.
  - Automatic redaction of passwords, tokens, cookies, secrets, and authorization headers.
  - Dedicated `AuditEvent` database persistence for high-priority security actions.
  - Admin audit viewer interface (`/api/v1/admin/audit-logs`).
- **Implemented Files**: `backend/src/logging/logger.ts`, `backend/src/routes/admin.routes.ts`.
- **Automated Tests**: `backend/tests/integration/logging-audit.test.ts`.
- **Residual Risks**: Local audit event tables are subject to database storage limits and require off-site log shipping (e.g. SIEM) for tamper-evident archiving.

---

### A10:2025 — Mishandling of Exceptional Conditions
- **Threat Scenario**: Unhandled exceptions crash the service, trigger fail-open authentication bypasses, or leak internal SQL queries and file paths in stack traces.
- **Applicability**: Highly Applicable.
- **Implemented Controls**:
  - Safe centralized error handling middleware (`globalErrorHandler`).
  - Fail-closed authorization checks (missing user session automatically throws 401).
  - Generic client responses for 500 errors ("An unexpected internal error occurred").
  - Syntax error handling for malformed JSON bodies.
- **Implemented Files**: `backend/src/middleware/security.ts`, `backend/src/app.ts`.
- **Automated Tests**: `backend/tests/integration/input-validation.test.ts` (malformed JSON test).
- **Residual Risks**: Unexpected OS-level signal interruptions or out-of-memory kernel kills.
