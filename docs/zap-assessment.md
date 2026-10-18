# SecureAuth — OWASP ZAP Empirical DAST Assessment Report

## 1. Executive Summary

This assessment documents an empirical before-and-after Dynamic Application Security Testing (DAST) analysis performed using **OWASP ZAP 2.17.0** (`ghcr.io/zaproxy/zaproxy:stable`).

The assessment compares:
1. **Baseline Environment**: An isolated, deliberate demonstration fixture (`security/fixtures/vulnerable-baseline.ts`) on port 5001 exhibiting common misconfigurations.
2. **Hardened Production Application**: The mitigated SecureAuth Express service (`backend/src/server.ts`) on port 5000.

| Metric | Baseline Target (`http://127.0.0.1:5001`) | Hardened Target (`http://127.0.0.1:5000`) | Status |
| :--- | :---: | :---: | :---: |
| **High Severity Alerts** | 0 | 0 | Clean |
| **Medium Severity Alerts** | **5** | **0** | **100% Remediated** |
| **Low Severity Alerts** | **7** | **0** | **100% Remediated** |
| **Informational Alerts** | 3 | 1 | Expected (Cache Header on 404) |
| **Passing ZAP Rules** | 53 | **66** | +13 Passes |

---

## 2. Scan Execution Metadata

- **Tool Name**: OWASP Zed Attack Proxy (ZAP)
- **Docker Image**: `ghcr.io/zaproxy/zaproxy:stable`
- **ZAP Engine Version**: `2.17.0`
- **Execution Script**: `./scripts/run-zap-assessment.sh`
- **Scan Date**: October 18, 2026
- **Scan Types**: Automation Framework Spider & Passive Baseline Scans
- **Artifacts Generated**:
  - `reports/zap-baseline-report.json`
  - `reports/zap-baseline-report.html`
  - `reports/zap-hardened-report.json`
  - `reports/zap-hardened-report.html`

---

## 3. Remediation Analysis

### 3.1 Content Security Policy (CSP) Header Not Set
- **Alert**: Content Security Policy (CSP) Header Not Set
- **Risk Level**: Medium
- **Baseline Behavior**: The server omitted the `Content-Security-Policy` header, leaving client browsers vulnerable to content injection and Cross-Site Scripting (XSS).
- **Remediation**: Configured Helmet with a strict `contentSecurityPolicy`:
  ```typescript
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    }
  }
  ```
- **Post-Remediation Result**: **REMEDIATED** (Passes ZAP Rule 10038).

### 3.2 Anti-Clickjacking Header Missing
- **Alert**: Missing Anti-clickjacking Header
- **Risk Level**: Medium
- **Baseline Behavior**: HTTP responses lacked both `X-Frame-Options` and `frame-ancestors`, allowing malicious sites to iframe the application and conduct clickjacking attacks.
- **Remediation**: Enforced `frameguard: { action: 'deny' }` and CSP `frame-ancestors 'none'`.
- **Post-Remediation Result**: **REMEDIATED** (Passes ZAP Rule 10020).

### 3.3 Absence of Anti-CSRF Tokens
- **Alert**: Absence of Anti-CSRF Tokens
- **Risk Level**: Medium
- **Baseline Behavior**: Forms on the baseline target accepted unvalidated form submissions without cryptographic anti-forgery tokens.
- **Remediation**: Implemented double-submit signed CSRF token middleware requiring an HMAC-SHA256 verified `X-CSRF-Token` header on all mutating HTTP verbs (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Post-Remediation Result**: **REMEDIATED** (Passes ZAP Rule 10202).

### 3.4 Cross-Domain Misconfiguration
- **Alert**: Cross-Domain Misconfiguration
- **Risk Level**: Medium
- **Baseline Behavior**: Permissive CORS header `Access-Control-Allow-Origin: *` was returned.
- **Remediation**: Replaced with strict whitelist origin matching against `CORS_ALLOWED_ORIGINS` without wildcard reflection.
- **Post-Remediation Result**: **REMEDIATED** (Passes ZAP Rule 10098).

### 3.5 Cookie No HttpOnly Flag & Cookie Without SameSite
- **Alerts**: Cookie No HttpOnly Flag / Cookie without SameSite Attribute
- **Risk Level**: Low
- **Baseline Behavior**: Cookies were accessible to JavaScript (`httpOnly: false`) and lacked `SameSite` restrictions, exposing session tokens to theft via XSS.
- **Remediation**: Enforced `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, and `secure: true` in production across all session cookies.
- **Post-Remediation Result**: **REMEDIATED** (Passes ZAP Rules 10010 and 10054).

### 3.6 Server Information Leaks via "X-Powered-By"
- **Alert**: Server Leaks Information via "X-Powered-By" HTTP Response Header Field(s)
- **Risk Level**: Low
- **Baseline Behavior**: Emitted `X-Powered-By: Express/4.21.2` and `Server` banner.
- **Remediation**: Stripped via Helmet `hidePoweredBy: true` and Express configuration.
- **Post-Remediation Result**: **REMEDIATED** (Passes ZAP Rule 10037).

### 3.7 X-Content-Type-Options Header Missing
- **Alert**: X-Content-Type-Options Header Missing
- **Risk Level**: Low
- **Baseline Behavior**: Server omitted the header, allowing browsers to perform MIME-type sniffing.
- **Remediation**: Added `X-Content-Type-Options: nosniff`.
- **Post-Remediation Result**: **REMEDIATED** (Passes ZAP Rule 10021).

---

## 4. Remaining Findings & Limitations

- **Informational Alert: Storable and Cacheable Content [10049]**:
  - Affects `http://127.0.0.1:5000` (404 Not Found response).
  - Risk: Informational.
  - Explanation: The catch-all 404 handler returns a standard JSON error without an explicit `Cache-Control: no-store` header. While harmless for static 404 responses, a `no-store` header can be added if desired in future hardening iterations.
