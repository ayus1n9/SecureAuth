# SecureAuth — Server-Enforced RBAC Permission Matrix

## 1. Formal Role-to-Permission Mapping

SecureAuth adopts a strict Principle of Least Privilege across all three defined user roles:

| Permission | Description | USER | SUPPORT | ADMIN |
| :--- | :--- | :---: | :---: | :---: |
| `profile:read:self` | View own account details | ✅ | ✅ | ✅ |
| `profile:update:self` | Update permitted personal profile fields | ✅ | ✅ | ✅ |
| `records:create:self` | Create records owned by own account | ✅ | ✅ | ✅ |
| `records:read:self` | Read records owned by own account | ✅ | ✅ | ✅ |
| `records:update:self` | Modify records owned by own account | ✅ | ✅ | ✅ |
| `records:delete:self` | Delete records owned by own account | ✅ | ✅ | ✅ |
| `support:read` | View the support queue | ❌ | ✅ | ✅ |
| `users:read_minimal` | View non-sensitive user listings (name, email) | ❌ | ✅ | ✅ |
| `users:read` | View full administrative user profiles (counts, lockouts) | ❌ | ❌ | ✅ |
| `users:update` | Update arbitrary user account details | ❌ | ❌ | ✅ |
| `users:change_role` | Promote/demote user roles | ❌ | ❌ | ✅ |
| `admin:dashboard` | View system health metrics & role distribution | ❌ | ❌ | ✅ |
| `audit:read` | View security audit log stream | ❌ | ❌ | ✅ |

---

## 2. API Endpoint Authorization Specification

| Route | Method | Required Permission | Ownership Enforcement |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/me` | `GET` | Authenticated | Scoped to `req.user.id` |
| `/api/v1/auth/profile` | `PATCH` | `profile:update:self` | Updates only `req.user.id` |
| `/api/v1/auth/password` | `POST` | Authenticated | Re-authenticates current user |
| `/api/v1/records` | `GET` | `records:read:self` | Scoped via `WHERE userId = req.user.id` |
| `/api/v1/records` | `POST` | `records:create:self` | Always attaches `userId = req.user.id` |
| `/api/v1/records/:id` | `GET` | `records:read:self` | **Strict**: `WHERE id = :id AND userId = req.user.id` |
| `/api/v1/records/:id` | `PUT` | `records:update:self` | **Strict**: `WHERE id = :id AND userId = req.user.id` |
| `/api/v1/records/:id` | `DELETE` | `records:delete:self` | **Strict**: `WHERE id = :id AND userId = req.user.id` |
| `/api/v1/users` | `GET` | `users:read_minimal` OR `users:read` | Field filtering based on caller role |
| `/api/v1/users/:id/role` | `PATCH` | `users:change_role` | ADMIN only; self-demotion rejected |
| `/api/v1/admin/stats` | `GET` | `admin:dashboard` | ADMIN only |
| `/api/v1/admin/audit-logs`| `GET` | `audit:read` | ADMIN only |

---

## 3. HTTP Status Code Conventions

- **401 Unauthorized**:
  Returned when a request attempts to access a protected endpoint without an active, valid session or with malformed credentials. Signals authentication failure.
- **403 Forbidden**:
  Returned when an authenticated user attempts an operation for which their assigned role lacks the required permission (e.g., `USER` accessing `/api/v1/admin/stats`). Also returned on CSRF token validation failures or unapproved CORS origins.
- **404 Not Found**:
  Returned when a resource does not exist **or** when a user attempts to access a record owned by someone else (`WHERE id = :id AND userId = :currentUserId`). Returning 404 rather than 403 prevents attackers from enumerating valid resource IDs across different tenants.
