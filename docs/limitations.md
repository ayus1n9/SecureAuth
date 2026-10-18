# SecureAuth — Known Limitations & Architectural Scope

This document provides a transparent, factual accounting of design constraints, intentional tradeoffs, and architectural boundaries in SecureAuth.

## 1. Single-Instance In-Memory Rate Limiting
- **Limitation**: The current rate-limiting implementation uses `express-rate-limit`'s default in-memory store.
- **Impact**: In horizontal multi-instance deployments behind a round-robin load balancer, rate limits are tracked per process rather than cluster-wide.
- **Recommended Remediation**: Integrate `rate-limit-redis` with a managed Redis cluster for distributed state synchronization across API nodes.

## 2. Distributed Denial of Service (DDoS) & Residential Botnets
- **Limitation**: IP-based rate limiting (5 attempts per 15 minutes) is effective against basic script kiddies and single-IP brute force, but does not stop distributed botnets rotating thousands of residential IPs.
- **Recommended Remediation**: Implement Web Application Firewall (WAF) rate rules, behavioral fingerprinting, or Turnstile/reCAPTCHA challenges triggered on anomalous authentication spikes.

## 3. Local Audit Storage Scope
- **Limitation**: Audit events are persisted to the PostgreSQL `AuditEvent` table on the same database cluster as application data.
- **Impact**: While protected by application-level controls, a complete database compromise would give an attacker write access to audit records.
- **Recommended Remediation**: Ship structured JSON logs in real-time via vector/fluentbit to a write-once, append-only centralized Security Information and Event Management (SIEM) system (e.g. AWS CloudWatch, Datadog, Elastic).

## 4. Multi-Factor Authentication (MFA)
- **Limitation**: Current authentication focuses on single-factor password + server-managed session tokens.
- **Roadmap**: Implement Time-based One-Time Passwords (TOTP RFC 6238) and WebAuthn/FIDO2 hardware security keys.

## 5. DAST Scanner Detection Scope
- **Limitation**: Automated dynamic scanners like OWASP ZAP primarily analyze observable HTTP headers, cookies, and reflective parameters. They cannot autonomously deduce complex multi-step business logic vulnerabilities, IDOR ownership boundaries, or multi-role permission flaws without authenticated crawler contextual scripts.
- **Mitigation**: Dedicated automated integration tests (`backend/tests/integration/idor.test.ts`, `authorization.test.ts`) are employed to rigorously verify logical access controls.
