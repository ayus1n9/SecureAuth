# OWASP ZAP Automated DAST Assessment

This directory contains the scanning configurations, rule thresholds, and automation scripts for performing empirical Dynamic Application Security Testing (DAST) on the SecureAuth application using OWASP ZAP.

## Workflow Overview

1. **Baseline Assessment (`security/fixtures/vulnerable-baseline.ts`)**:
   Runs an isolated test fixture on `http://127.0.0.1:5001` that demonstrates unhardened configurations:
   - Missing Content-Security-Policy (CSP) (Rule 10038)
   - Missing Anti-Clickjacking headers (Rule 10020)
   - Missing X-Content-Type-Options: nosniff (Rule 10021)
   - Server signature information leakage (Rule 10036)
   - Insecure cookie attributes without HttpOnly or SameSite (Rules 10010, 10054)
   - Exposed debug system information (Rule 10055)

2. **Hardened Assessment (`backend/src/server.ts`)**:
   Runs the fully mitigated SecureAuth application on `http://127.0.0.1:5000`:
   - Helmet CSP with strict frame-ancestors 'none'
   - Frameguard (X-Frame-Options: DENY)
   - Strict X-Content-Type-Options: nosniff
   - Server banner redacted / X-Powered-By disabled
   - Cryptographically random sessions with HttpOnly, SameSite=lax, Secure
   - Strict 404 handlers and sanitization

3. **Comparison & Verification**:
   The output JSON and HTML reports are written to `reports/`:
   - `reports/zap-baseline-report.json` & `.html`
   - `reports/zap-hardened-report.json` & `.html`
   - `reports/zap-comparison.md`
