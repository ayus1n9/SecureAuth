# SecureAuth — Authentication & Session Management

## 1. Password Hashing Architecture

SecureAuth employs **Argon2id** (the hybrid version of Argon2 recommended by the Password Hashing Competition and OWASP) as its primary password-hashing algorithm.

### 1.1 Parameters & Computational Resistance
- **Algorithm Type**: `argon2id` (resistant to both side-channel cache attacks and GPU-accelerated parallel cracking).
- **Memory Cost (`m`)**: 65,536 KiB (64 MB) in production (19,456 KiB in test environments).
- **Time Cost (`t`)**: 3 iterations in production (2 iterations in test environments).
- **Parallelism (`p`)**: 2 threads.
- **Salt**: 128-bit cryptographically secure random bytes automatically generated per hash invocation.

### 1.2 Mitigation Against Timing Attacks & Enumeration
When an authentication attempt targets a non-existent email address, the backend executes a dummy Argon2id verification with equivalent computational parameters before returning the generic error response:
```json
{
  "error": "Unauthorized",
  "message": "Invalid email or password"
}
```
This ensures response times remain identical regardless of whether an account exists, defeating statistical timing side-channel attacks.

---

## 2. Server-Managed Stateful Sessions

SecureAuth chooses server-managed stateful sessions over stateless JWTs for the browser application:

### 2.1 Justification for Stateful Sessions
1. **Instant Revocation**: When an administrator modifies a user's role or a user changes their password, all active sessions can be instantly invalidated in the database (`destroyAllUserSessions`). Stateless JWTs cannot be revoked without maintaining an external denylist or refresh-token store.
2. **Reduced Attack Surface**: Stateful tokens are stored in `HttpOnly` browser cookies, rendering them inaccessible to malicious JavaScript payloads (mitigating token theft via XSS).
3. **Prevention of Algorithm Confusion**: Session identifiers are opaque random strings, completely immune to `none`-algorithm attacks or key-confusion vulnerabilities.

### 2.2 Token Entropy & Generation
- Session IDs are generated using Node.js's native cryptographically secure pseudo-random number generator:
  ```typescript
  crypto.randomBytes(32).toString('hex'); // 256 bits of entropy
  ```
- Stored as the primary key in the PostgreSQL `Session` table with foreign key linkage to the `User` model.

### 2.3 Session Rotation (Anti-Fixation)
Upon every successful authentication, the backend destroys the existing session identifier and dispenses a fresh one (`rotateSession`). This breaks any attempt by an attacker to pre-plant a known session token in a victim's browser prior to login.

### 2.4 Cookie Security Attributes

| Attribute | Setting | Rationale |
| :--- | :--- | :--- |
| `Name` | `secureauth_session` / `__Host-secureauth_session` | Prefixed with `__Host-` in HTTPS production deployments. |
| `HttpOnly` | `true` | Prevents access from client-side scripts via `document.cookie`. |
| `SameSite` | `Lax` | Mitigates CSRF on cross-origin requests while preserving standard top-level navigation. |
| `Secure` | Dynamic (`true` in production/HTTPS) | Guarantees cookies are transmitted exclusively over encrypted TLS connections. |
| `Path` | `/` | Scoped to the application root. |
| `Max-Age` | 86,400 seconds (24 Hours) | Absolute session expiration limit. |

---

## 3. Password Modification Lifecycle

Changing a password via `POST /api/v1/auth/password` requires:
1. Re-authenticating the current password against the stored Argon2id hash.
2. Validating the new password against the strict complexity policy.
3. Hashing the new password with a fresh random salt.
4. Calling `destroyAllUserSessions(userId)` to immediately revoke all existing sessions on other devices.
5. Issuing a single fresh session cookie to the active browser.
6. Recording an immutable `PASSWORD_CHANGED` audit event.
