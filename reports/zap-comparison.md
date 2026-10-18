# OWASP ZAP Assessment — Before-and-After Comparison

| Severity | Baseline (Port 5001) | Hardened (Port 5000) | Delta | Verification Status |
| :--- | :---: | :---: | :---: | :--- |
| **High** | 0 | 0 | 0 | Clean |
| **Medium** | 5 | 0 | -5 | **100% Remediated** |
| **Low** | 7 | 0 | -7 | **100% Remediated** |
| **Informational** | 3 | 1 | -2 | Expected 404 cache warning |
| **Passing Checks** | 53 | 66 | +13 | Passed |

## Remediated Alerts Breakdown
1. **Content Security Policy (CSP) Header Not Set** -> Remediated via Helmet CSP
2. **Missing Anti-clickjacking Header** -> Remediated via X-Frame-Options: DENY & frame-ancestors 'none'
3. **Absence of Anti-CSRF Tokens** -> Remediated via signed double-submit HMAC CSRF middleware
4. **Cross-Domain Misconfiguration (CORS)** -> Remediated via strict origin whitelist
5. **Cookie No HttpOnly Flag** -> Remediated via HttpOnly session cookies
6. **Cookie without SameSite Attribute** -> Remediated via SameSite=lax
7. **Server Leaks Information via "X-Powered-By"** -> Remediated via hidePoweredBy
8. **X-Content-Type-Options Header Missing** -> Remediated via nosniff

Full technical details available in `docs/zap-assessment.md`.
